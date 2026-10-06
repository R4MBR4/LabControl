const utilizacaoModel = require('../models/utilizacaoModel');
const equipamentoModel = require('../models/equipamentoModel');
const capacitacaoModel = require('../models/capacitacaoModel');
const ocorrenciaModel = require('../models/ocorrenciaModel');
const { pool } = require('../models/dbHelper');

async function list(req, res) {
  try {
    const filters = {};
    const userRole = (req.user.perfil || '').toLowerCase();

    if (userRole !== 'admin' && userRole !== 'administrador') {
      filters.usuario_id = req.user.id;
    } else if (req.query.usuario_id) {
      filters.usuario_id = req.query.usuario_id;
    }

    if (req.query.equipamento_id) filters.equipamento_id = req.query.equipamento_id;
    if (req.query.status) filters.status = req.query.status;

    const utilizacoes = await utilizacaoModel.getAllUtilizacoes(filters);
    res.json(utilizacoes);
  } catch (err) {
    console.error('[Utilizacao] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar utilizações' });
  }
}

async function getById(req, res) {
  try {
    const item = await utilizacaoModel.getUtilizacaoById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Registro de utilização não encontrado' });
    }
    res.json(item);
  } catch (err) {
    console.error('[Utilizacao] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar utilização' });
  }
}

/**
 * Funcionalidade obrigatória 5: Check-in via QR Code
 */
async function checkin(req, res) {
  try {
    const { equipamento_id, reserva_id, condicao_inicial, observacoes } = req.body;
    const usuario_id = req.user.id;

    if (!equipamento_id) {
      return res.status(400).json({ error: 'Identificador do equipamento é obrigatório para check-in' });
    }

    const equip = await equipamentoModel.getEquipamentoById(equipamento_id);
    if (!equip) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    // Validação de inativação e manutenção
    const statusAtual = (equip.status || '').toLowerCase();
    if (equip.inativo === 1 || equip.inativo === true || statusAtual === 'inativo') {
      return res.status(400).json({ error: 'Equipamento inativo não pode ser utilizado.' });
    }

    if (statusAtual === 'manutencao' || statusAtual === 'em_manutencao') {
      return res.status(400).json({ error: 'Equipamento em manutenção. Check-in bloqueado.' });
    }

    // Validação de capacitação
    const exigeCap = equip.exige_capacitacao === 1 || equip.exige_capacitacao === true;
    if (exigeCap) {
      const autorizado = await capacitacaoModel.checkUserCapacitacao(usuario_id, equipamento_id);
      if (!autorizado) {
        return res.status(403).json({
          error: 'Equipamento exige capacitação técnica prévia. Usuário não autorizado.'
        });
      }
    }

    // Verifica se já existe utilização ativa
    const ativa = await utilizacaoModel.getActiveUtilizacaoByEquipamento(equipamento_id);
    if (ativa) {
      return res.status(400).json({
        error: 'Este equipamento já possui um check-in em andamento. Faça o check-out primeiro.'
      });
    }

    const payload = {
      usuario_id,
      equipamento_id,
      reserva_id: reserva_id || null,
      data_checkin: new Date(),
      condicao_inicial: condicao_inicial || 'Normal / Operacional',
      status: 'em_uso',
      observacoes: observacoes || ''
    };

    const novaUtilizacao = await utilizacaoModel.createCheckin(payload);

    // Atualiza status do equipamento para 'em_uso'
    await equipamentoModel.updateStatus(equipamento_id, 'em_uso');

    res.status(201).json({
      message: 'Check-in realizado com sucesso!',
      utilizacao: novaUtilizacao
    });
  } catch (err) {
    console.error('[Utilizacao] Erro no checkin:', err);
    res.status(500).json({ error: 'Erro ao realizar check-in: ' + err.message });
  }
}

/**
 * Funcionalidade obrigatória 5 e Regra de negócio crítica:
 * "O check-out deve registrar obrigatoriamente a condição do equipamento"
 */
async function checkout(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const {
      utilizacao_id,
      equipamento_id,
      condicao_devolucao,
      observacoes,
      houve_avaria,
      relato_avaria,
      foto_evidencia,
      foto_metadata
    } = req.body;
    const usuario_id = req.user.id;

    if (typeof condicao_devolucao !== 'string' || !condicao_devolucao.trim()) {
      return res.status(400).json({
        error: 'A condição do equipamento na devolução é OBRIGATÓRIA para concluir o check-out.'
      });
    }

    if (!utilizacao_id && !equipamento_id) {
      return res.status(400).json({ error: 'Informe a utilização ou o equipamento do check-out.' });
    }

    const utilizacaoSolicitada = utilizacao_id
      ? await utilizacaoModel.getUtilizacaoById(utilizacao_id)
      : await utilizacaoModel.getActiveUtilizacaoByEquipamento(equipamento_id);

    if (!utilizacaoSolicitada) {
      return res.status(404).json({
        error: 'Nenhuma utilização ativa encontrada para este registro/equipamento'
      });
    }

    const role = (req.user.perfil || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrador';
    if (!isAdmin && String(utilizacaoSolicitada.usuario_id || utilizacaoSolicitada.id_usuario) !== String(usuario_id)) {
      return res.status(403).json({ error: 'Você não pode finalizar uma utilização de outro usuário.' });
    }

    const condition = condicao_devolucao.trim();
    const isDamagedFlag = houve_avaria === true || houve_avaria === 1 || houve_avaria === '1' || houve_avaria === 'true';
    const conditionReportsDamage = /(danificad|defeit|avariad|quebrad)/i.test(condition);
    const isDamaged = isDamagedFlag || conditionReportsDamage;
    if (isDamaged && !foto_evidencia) {
      return res.status(400).json({
        error: 'A evidência fotográfica capturada pela câmera é obrigatória para registrar uma avaria.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const utilizationId = utilizacaoSolicitada.id || utilizacaoSolicitada.id_utilizacao;
    const utilizacao = await utilizacaoModel.getUtilizacaoById(utilizationId, connection, true);
    if (!utilizacao) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Registro de utilização não encontrado.' });
    }
    if ((utilizacao.status || '').toLowerCase() !== 'em_uso') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'Esta utilização já foi finalizada ou não está ativa.' });
    }
    if (!isAdmin && String(utilizacao.usuario_id || utilizacao.id_usuario) !== String(usuario_id)) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(403).json({ error: 'Você não pode finalizar uma utilização de outro usuário.' });
    }

    const targetEquipId = utilizacao.equipamento_id || utilizacao.id_equipamento;
    const serializedPhotoMetadata = foto_metadata
      ? (typeof foto_metadata === 'object' ? JSON.stringify(foto_metadata) : String(foto_metadata))
      : null;
    let ocorrencia = null;

    if (isDamaged) {
      ocorrencia = await ocorrenciaModel.createOcorrencia({
        utilizacao_id: utilizationId,
        equipamento_id: targetEquipId,
        usuario_id,
        titulo: `Avaria detectada no Check-out do equipamento #${targetEquipId}`,
        descricao: relato_avaria || `Equipamento devolvido em condição: ${condition}. ${observacoes || ''}`.trim(),
        gravidade: 'alta',
        status: 'aberta',
        foto_evidencia,
        foto_metadata: serializedPhotoMetadata
      }, connection);
    }

    const utilizacaoAtualizada = await utilizacaoModel.executeCheckout(utilizationId, {
      condicao_devolucao: condition,
      condicao_final: condition,
      data_checkout: new Date(),
      status: 'finalizado',
      foto_evidencia: foto_evidencia || null,
      foto_metadata: serializedPhotoMetadata,
      houve_avaria: isDamaged ? 1 : 0,
      relato_avaria: relato_avaria || null
    }, connection);

    await equipamentoModel.updateStatus(
      targetEquipId,
      isDamaged ? 'manutencao' : 'disponivel',
      connection
    );

    await connection.commit();
    transactionStarted = false;
    return res.json({
      message: 'Check-out concluído com sucesso!',
      avaria_registrada: isDamaged,
      ocorrencia,
      utilizacao: utilizacaoAtualizada
    });
  } catch (err) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    console.error('[Utilizacao] Erro no checkout:', err);
    res.status(500).json({ error: 'Erro ao realizar check-out: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  list,
  getById,
  checkin,
  checkout
};
