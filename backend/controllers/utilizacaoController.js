const utilizacaoModel = require('../models/utilizacaoModel');
const equipamentoModel = require('../models/equipamentoModel');
const capacitacaoModel = require('../models/capacitacaoModel');
const ocorrenciaModel = require('../models/ocorrenciaModel');
const reservaModel = require('../models/reservaModel');
const { pool } = require('../models/dbHelper');
const auditoriaModel = require('../models/auditoriaModel');

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
    if (req.query.espaco_id) filters.espaco_id = req.query.espaco_id;
    if (req.query.data_inicio_de) filters.data_inicio_de = req.query.data_inicio_de;
    if (req.query.data_fim_ate) filters.data_fim_ate = req.query.data_fim_ate;

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
    const userRole = (req.user.perfil || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'administrador';
    const ownerId = item.usuario_id || item.id_usuario;
    if (!isAdmin && String(ownerId) !== String(req.user.id)) {
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
 * Fase B: Validação estrita de coerência entre Reserva e Utilização
 */
async function checkin(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    let targetEquipId = req.body.equipamento_id;
    const scannedCode = req.body.qr_code || req.body.scanned_value;
    if (!targetEquipId && scannedCode) {
      const localizado = await equipamentoModel.localizarPorIdentificadorQR(scannedCode);
      if (localizado) {
        targetEquipId = localizado.id || localizado.id_equipamento;
      } else {
        return res.status(404).json({ error: 'Nenhum equipamento cadastrado corresponde ao QR Code informado.' });
      }
    }

    const { reserva_id, condicao_inicial, observacoes } = req.body;
    const usuario_id = req.user.id;

    if (!targetEquipId) {
      return res.status(400).json({ error: 'Identificador do equipamento ou leitura de QR Code é obrigatório para check-in' });
    }

    const equip = await equipamentoModel.getEquipamentoById(targetEquipId);
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
      const autorizado = await capacitacaoModel.checkUserCapacitacao(usuario_id, targetEquipId);
      if (!autorizado) {
        return res.status(403).json({
          error: 'Equipamento exige capacitação técnica prévia. Usuário não autorizado.'
        });
      }
    }

    // Verifica se já existe utilização ativa
    const ativa = await utilizacaoModel.getActiveUtilizacaoByEquipamento(targetEquipId);
    if (ativa) {
      return res.status(400).json({
        error: 'Este equipamento já possui um check-in em andamento. Faça o check-out primeiro.'
      });
    }

    // Regra de Coerência Reserva-Utilização (Fase B):
    let finalReservaId = reserva_id ? Number(reserva_id) : null;
    const userRole = (req.user?.perfil || '').toLowerCase();
    const isPrivileged = ['admin', 'administrador', 'docente', 'professor'].includes(userRole);

    if (finalReservaId) {
      const reserva = await reservaModel.getReservaById(finalReservaId);
      if (!reserva) {
        return res.status(404).json({ error: 'Reserva informada não encontrada.' });
      }
      const ownerId = reserva.usuario_id || reserva.id_usuario;
      if (!isPrivileged && Number(ownerId) !== Number(usuario_id)) {
        return res.status(403).json({ error: 'A reserva informada pertence a outro usuário.' });
      }
      const statusRes = (reserva.status || '').toLowerCase();
      if (!['confirmada', 'em_andamento'].includes(statusRes)) {
        return res.status(400).json({ error: `A reserva informada não está ativa (status: ${reserva.status}).` });
      }
      if (reserva.equipamento_id && Number(reserva.equipamento_id) !== Number(targetEquipId)) {
        return res.status(400).json({ error: 'O equipamento informado não coincide com o equipamento da reserva.' });
      }
      if (!reserva.equipamento_id && reserva.espaco_id && equip.espaco_id && Number(reserva.espaco_id) !== Number(equip.espaco_id)) {
        return res.status(400).json({ error: 'O equipamento não pertence ao laboratório/espaço da reserva.' });
      }
    } else {
      // Auto-associação: verifica se o usuário possui reserva para este recurso no momento presente
      try {
        const [reservasAtuais] = await pool.query(`
          SELECT id FROM reserva
          WHERE usuario_id = ?
            AND (equipamento_id = ? OR (espaco_id = ? AND equipamento_id IS NULL))
            AND status = 'confirmada'
            AND NOW() BETWEEN DATE_SUB(data_inicio, INTERVAL 30 MINUTE) AND data_fim
          ORDER BY data_inicio ASC
          LIMIT 1
        `, [usuario_id, targetEquipId, equip.espaco_id || null]);
        if (reservasAtuais && reservasAtuais[0]) {
          finalReservaId = reservasAtuais[0].id;
        }
      } catch (e) {
        // Ignora em caso de indisponibilidade momentânea
      }
    }

    const payload = {
      usuario_id,
      equipamento_id: targetEquipId,
      reserva_id: finalReservaId,
      data_checkin: new Date(),
      condicao_inicial: condicao_inicial || 'Normal / Operacional',
      status: 'em_uso',
      observacoes: observacoes || ''
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const novaUtilizacao = await utilizacaoModel.createCheckin(payload, connection);
    await equipamentoModel.updateStatus(targetEquipId, 'em_uso', connection);

    // Atualiza status da reserva para 'em_andamento'
    if (finalReservaId) {
      await reservaModel.updateReserva(finalReservaId, { status: 'em_andamento' }, connection);
    }

    await auditoriaModel.registrarEvento({
      equipamento_id: targetEquipId,
      entidade: 'utilizacao',
      entidade_id: novaUtilizacao.id || novaUtilizacao.id_utilizacao,
      acao: 'checkin_realizado',
      usuario_id,
      detalhes: { reserva_id: finalReservaId, condicao_inicial: payload.condicao_inicial }
    }, connection);
    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      message: 'Check-in realizado com sucesso!',
      utilizacao: novaUtilizacao
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Utilizacao] Erro no checkin:', err);
    res.status(500).json({
      error: 'Erro ao realizar check-in',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
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

    let targetEquipId = req.body.equipamento_id;
    const scannedCode = req.body.qr_code || req.body.scanned_value;
    if (!utilizacao_id && !targetEquipId && scannedCode) {
      const localizado = await equipamentoModel.localizarPorIdentificadorQR(scannedCode);
      if (localizado) {
        targetEquipId = localizado.id || localizado.id_equipamento;
      } else {
        return res.status(404).json({ error: 'Nenhum equipamento cadastrado corresponde ao QR Code informado.' });
      }
    }

    if (!utilizacao_id && !targetEquipId) {
      return res.status(400).json({ error: 'Informe a utilização ou o equipamento do check-out.' });
    }

    const utilizacaoSolicitada = utilizacao_id
      ? await utilizacaoModel.getUtilizacaoById(utilizacao_id)
      : await utilizacaoModel.getActiveUtilizacaoByEquipamento(targetEquipId);

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

    targetEquipId = utilizacao.equipamento_id || utilizacao.id_equipamento || targetEquipId;
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
      await auditoriaModel.registrarEvento({
        equipamento_id: targetEquipId,
        entidade: 'ocorrencia',
        entidade_id: ocorrencia.id || ocorrencia.id_ocorrencia,
        acao: 'ocorrencia_registrada',
        usuario_id,
        detalhes: { titulo: ocorrencia.titulo, gravidade: ocorrencia.gravidade, origem: 'checkout' }
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
    await auditoriaModel.registrarEvento({
      equipamento_id: targetEquipId,
      entidade: 'utilizacao',
      entidade_id: utilizationId,
      acao: 'checkout_realizado',
      usuario_id,
      detalhes: {
        condicao_devolucao: condition,
        houve_avaria: isDamaged,
        ocorrencia_id: ocorrencia?.id || ocorrencia?.id_ocorrencia || null
      }
    }, connection);

    // Atualiza status da reserva vinculada para 'concluida'
    if (utilizacao.reserva_id) {
      await reservaModel.updateReserva(utilizacao.reserva_id, { status: 'concluida' }, connection);
    }

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
    res.status(500).json({
      error: 'Erro ao realizar check-out',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Extensão de utilização ativa (Fase B)
 */
async function estender(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const id = req.params.id;
    const { minutos, justificativa } = req.body;
    const usuario_id = req.user.id;
    const userRole = (req.user?.perfil || '').toLowerCase();
    const isPrivileged = ['admin', 'administrador', 'docente', 'professor'].includes(userRole);

    const item = await utilizacaoModel.getUtilizacaoById(id);
    if (!item) {
      return res.status(404).json({ error: 'Registro de utilização não encontrado.' });
    }

    if ((item.status || '').toLowerCase() !== 'em_uso') {
      return res.status(400).json({ error: 'Apenas utilizações em andamento podem ser estendidas.' });
    }

    const ownerId = item.usuario_id || item.id_usuario;
    if (!isPrivileged && Number(ownerId) !== Number(usuario_id)) {
      return res.status(403).json({ error: 'Você não pode estender a utilização de outro usuário.' });
    }

    const minExtensao = Number(minutos) || 15;

    // Se estiver vinculada a uma reserva, estende através do ciclo formal da reserva
    if (item.reserva_id) {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;

      const resultado = await reservaModel.estenderReserva({
        id: item.reserva_id,
        minutos: minExtensao,
        justificativa,
        usuarioId: usuario_id,
        isPrivileged,
        executor: connection
      });

      if (!resultado.success) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(resultado.status || 400).json(resultado);
      }

      await auditoriaModel.registrarEvento({
        equipamento_id: item.equipamento_id,
        entidade: 'utilizacao',
        entidade_id: id,
        acao: 'utilizacao_estendida',
        usuario_id,
        detalhes: {
          reserva_id: item.reserva_id,
          minutos_estendidos: minExtensao,
          nova_data_fim: resultado.data_fim_nova
        }
      }, connection);

      await connection.commit();
      transactionStarted = false;

      return res.json({
        message: 'Utilização e reserva estendidas com sucesso!',
        ...resultado
      });
    }

    // Se não tiver reserva vinculada (uso avulso direto do equipamento)
    const equip = await equipamentoModel.getEquipamentoById(item.equipamento_id);
    const espacoModel = require('../models/espacoModel');
    if (equip?.espaco_id) {
      const espaco = await espacoModel.getEspacoById(equip.espaco_id);
      if (espaco) {
        const now = new Date();
        const newEnd = new Date(now.getTime() + minExtensao * 60 * 1000);
        const valHorario = espacoModel.validarHorarioFuncionamento(espaco, now, newEnd);
        if (!valHorario.valido) {
          return res.status(400).json({
            error: `Extensão não permitida pelo horário do laboratório: ${valHorario.erro}`,
            motivo: 'horario_funcionamento'
          });
        }
      }
    }

    // Verifica se há alguma reserva agendada iniciando em breve
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const newEnd = new Date(now.getTime() + minExtensao * 60 * 1000);
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const newEndStr = `${newEnd.getFullYear()}-${pad(newEnd.getMonth() + 1)}-${pad(newEnd.getDate())} ${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}:${pad(newEnd.getSeconds())}`;

    const conflitos = await reservaModel.checkConflict({
      equipamento_id: item.equipamento_id,
      espaco_id: equip?.espaco_id || null,
      data_inicio: nowStr,
      data_fim: newEndStr
    });

    if (conflitos.length > 0) {
      const proxima = conflitos[0];
      return res.status(409).json({
        error: `Não é possível estender o uso: há uma reserva agendada para este equipamento iniciando em ${new Date(proxima.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Por favor, realize o check-out.`,
        motivo: 'conflito_proxima_reserva',
        proximaReserva: proxima
      });
    }

    await auditoriaModel.registrarEvento({
      equipamento_id: item.equipamento_id,
      entidade: 'utilizacao',
      entidade_id: id,
      acao: 'utilizacao_estendida',
      usuario_id,
      detalhes: { minutos_estendidos: minExtensao, justificativa: justificativa || null }
    });

    return res.json({
      message: 'Utilização estendida com sucesso!',
      minutos_estendidos: minExtensao
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Utilizacao] Erro ao estender utilização:', err);
    res.status(500).json({
      error: 'Erro ao estender utilização',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  list,
  getById,
  checkin,
  checkout,
  estender
};
