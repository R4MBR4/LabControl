const utilizacaoModel = require('../models/utilizacaoModel');
const equipamentoModel = require('../models/equipamentoModel');
const capacitacaoModel = require('../models/capacitacaoModel');
const ocorrenciaModel = require('../models/ocorrenciaModel');

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
  try {
    const { utilizacao_id, equipamento_id, condicao_devolucao, observacoes, houve_avaria, relato_avaria } = req.body;
    const usuario_id = req.user.id;

    // Regra Crítica: Condição de devolução é OBRIGATÓRIA
    if (!condicao_devolucao || condicao_devolucao.trim() === '') {
      return res.status(400).json({
        error: 'A condição do equipamento na devolução é OBRIGATÓRIA para concluir o check-out.'
      });
    }

    let utilizacao = null;
    if (utilizacao_id) {
      utilizacao = await utilizacaoModel.getUtilizacaoById(utilizacao_id);
    } else if (equipamento_id) {
      utilizacao = await utilizacaoModel.getActiveUtilizacaoByEquipamento(equipamento_id);
    }

    if (!utilizacao) {
      return res.status(404).json({
        error: 'Nenhuma utilização ativa encontrada para este registro/equipamento'
      });
    }

    const targetEquipId = utilizacao.equipamento_id || utilizacao.id_equipamento;

    // Conclui a utilização
    const checkoutData = {
      condicao_devolucao: condicao_devolucao.trim(),
      condicao_final: condicao_devolucao.trim(),
      data_checkout: new Date(),
      status: 'finalizado'
    };

    const utilizacaoAtualizada = await utilizacaoModel.executeCheckout(utilizacao.id || utilizacao.id_utilizacao, checkoutData);

    // Avalia se o equipamento foi devolvido danificado
    const condicaoLower = condicao_devolucao.toLowerCase();
    const isDanificado = houve_avaria || 
      condicaoLower.includes('danificado') || 
      condicaoLower.includes('defeito') || 
      condicaoLower.includes('avariado') || 
      condicaoLower.includes('quebrado');

    if (isDanificado) {
      // Registra ocorrência automática vinculada à utilização
      try {
        await ocorrenciaModel.createOcorrencia({
          utilizacao_id: utilizacao.id || utilizacao.id_utilizacao,
          equipamento_id: targetEquipId,
          usuario_id,
          titulo: `Avaria detectada no Check-out do equipamento #${targetEquipId}`,
          descricao: relato_avaria || `Equipamento devolvido em condição: ${condicao_devolucao}. ${observacoes || ''}`,
          gravidade: 'alta',
          status: 'aberta'
        });
      } catch (errOcorrencia) {
        console.warn('[Checkout] Aviso ao vincular ocorrência:', errOcorrencia.message);
      }

      // Direciona equipamento para manutenção
      await equipamentoModel.updateStatus(targetEquipId, 'manutencao');
    } else {
      // Retorna equipamento para 'disponivel'
      await equipamentoModel.updateStatus(targetEquipId, 'disponivel');
    }

    res.json({
      message: 'Check-out concluído com sucesso!',
      avaria_registrada: !!isDanificado,
      utilizacao: utilizacaoAtualizada
    });
  } catch (err) {
    console.error('[Utilizacao] Erro no checkout:', err);
    res.status(500).json({ error: 'Erro ao realizar check-out: ' + err.message });
  }
}

module.exports = {
  list,
  getById,
  checkin,
  checkout
};
