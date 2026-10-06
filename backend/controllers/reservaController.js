const reservaModel = require('../models/reservaModel');
const equipamentoModel = require('../models/equipamentoModel');
const capacitacaoModel = require('../models/capacitacaoModel');
const auditoriaModel = require('../models/auditoriaModel');
const { pool } = require('../models/dbHelper');

async function list(req, res) {
  try {
    const filters = {};
    const userRole = (req.user?.perfil || '').toLowerCase();
    const isPrivileged = userRole === 'admin' || userRole === 'administrador' || userRole === 'docente' || userRole === 'professor';

    // Se for usuário comum e não especificar filtro, lista prioritariamente suas reservas
    if (!isPrivileged) {
      // Usuário comum pode visualizar a disponibilidade geral se passar filtro explícito,
      // mas por padrão lista suas próprias reservas
      if (req.query.usuario_id) {
        filters.usuario_id = req.user.id;
      } else if (!req.query.data_inicio_de && !req.query.status) {
        filters.usuario_id = req.user.id;
      }
    } else if (req.query.usuario_id) {
      filters.usuario_id = req.query.usuario_id;
    }

    if (req.query.search) filters.search = req.query.search;
    if (req.query.tipo_recurso) filters.tipo_recurso = req.query.tipo_recurso;
    if (req.query.equipamento_id) filters.equipamento_id = req.query.equipamento_id;
    if (req.query.espaco_id) filters.espaco_id = req.query.espaco_id;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.data_inicio_de) filters.data_inicio_de = req.query.data_inicio_de;
    if (req.query.data_fim_ate) filters.data_fim_ate = req.query.data_fim_ate;
    if (req.query.no_show !== undefined) filters.no_show = req.query.no_show;
    if (req.query.grupo_recorrencia_id) filters.grupo_recorrencia_id = req.query.grupo_recorrencia_id;

    const reservas = await reservaModel.getAllReservas(filters);
    res.json(reservas);
  } catch (err) {
    console.error('[Reserva] Erro ao listar:', err.message);
    res.status(500).json({ error: 'Erro ao listar reservas: ' + err.message });
  }
}

async function getCalendario(req, res) {
  try {
    const { inicio, fim, espaco_id, equipamento_id, mes, ano } = req.query;
    let dataInicio = inicio;
    let dataFim = fim;

    // Se fornecido mês e ano mas não início/fim
    if (!dataInicio && mes && ano) {
      const m = String(mes).padStart(2, '0');
      dataInicio = `${ano}-${m}-01 00:00:00`;
      const nextMonth = Number(mes) === 12 ? 1 : Number(mes) + 1;
      const nextYear = Number(mes) === 12 ? Number(ano) + 1 : ano;
      const nm = String(nextMonth).padStart(2, '0');
      dataFim = `${nextYear}-${nm}-01 00:00:00`;
    }

    const eventos = await reservaModel.getReservasCalendario({
      inicio: dataInicio,
      fim: dataFim,
      espaco_id: espaco_id || null,
      equipamento_id: equipamento_id || null
    });

    res.json(eventos);
  } catch (err) {
    console.error('[Reserva] Erro ao obter calendário:', err.message);
    res.status(500).json({ error: 'Erro ao carregar calendário de reservas' });
  }
}

async function getById(req, res) {
  try {
    const reserva = await reservaModel.getReservaById(req.params.id);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    res.json(reserva);
  } catch (err) {
    console.error('[Reserva] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar reserva' });
  }
}

async function create(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { equipamento_id, espaco_id, data_inicio, data_fim, finalidade, observacoes } = req.body;
    const usuario_id = req.user.id;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({ error: 'Data de início e término são obrigatórias' });
    }

    if (new Date(data_inicio) >= new Date(data_fim)) {
      return res.status(400).json({ error: 'A data de início deve ser anterior à data de término' });
    }

    if (!equipamento_id && !espaco_id) {
      return res.status(400).json({ error: 'Informe ao menos um equipamento ou espaço para reservar' });
    }

    let finalEspacoId = espaco_id ? Number(espaco_id) : null;

    // Regra 1: Validação de Equipamento (manutenção, inativo, capacitação)
    if (equipamento_id) {
      const equip = await equipamentoModel.getEquipamentoById(equipamento_id);
      if (!equip) {
        return res.status(404).json({ error: 'Equipamento selecionado não existe' });
      }

      // Se o espaço não foi fornecido diretamente, herda o espaço do equipamento
      if (!finalEspacoId && equip.espaco_id) {
        finalEspacoId = equip.espaco_id;
      }

      const statusAtual = (equip.status || '').toLowerCase();
      if (equip.inativo === 1 || equip.inativo === true || statusAtual === 'inativo') {
        return res.status(400).json({ 
          error: 'Equipamento inativo não pode receber reservas.' 
        });
      }

      if (statusAtual === 'manutencao' || statusAtual === 'em_manutencao') {
        return res.status(400).json({ 
          error: 'Equipamento em manutenção não pode ser reservado.' 
        });
      }

      // Regra 2: Capacitação obrigatória
      const exigeCap = equip.exige_capacitacao === 1 || equip.exige_capacitacao === true;
      if (exigeCap) {
        const autorizado = await capacitacaoModel.checkUserCapacitacao(usuario_id, equipamento_id);
        if (!autorizado) {
          return res.status(403).json({
            error: 'Este equipamento exige capacitação prévia. O usuário não possui autorização válida registrada.'
          });
        }
      }
    }

    // Regra 3: Prevenção matemática de conflito de horário
    const conflitos = await reservaModel.checkConflict({
      equipamento_id: equipamento_id || null,
      espaco_id: finalEspacoId,
      data_inicio,
      data_fim
    });

    if (conflitos.length > 0) {
      const c = conflitos[0];
      const recNome = c.equipamento_nome || c.espaco_nome || 'o recurso selecionado';
      const usrNome = c.usuario_nome ? ` (por ${c.usuario_nome})` : '';
      return res.status(409).json({
        error: `Conflito de horário: já existe uma reserva ativa para ${recNome}${usrNome} entre ${new Date(c.data_inicio).toLocaleString('pt-BR')} e ${new Date(c.data_fim).toLocaleString('pt-BR')}.`,
        conflitos
      });
    }

    const payload = {
      usuario_id,
      equipamento_id: equipamento_id || null,
      espaco_id: finalEspacoId,
      data_inicio,
      data_fim,
      status: 'confirmada',
      finalidade: finalidade || null,
      observacoes: observacoes || null
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const nova = await reservaModel.createReserva(payload, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: nova.equipamento_id || nova.id_equipamento || null,
      entidade: 'reserva',
      entidade_id: nova.id || nova.id_reserva,
      acao: 'reserva_criada',
      usuario_id,
      detalhes: {
        espaco_id: nova.espaco_id || nova.id_espaco || null,
        data_inicio: nova.data_inicio,
        data_fim: nova.data_fim,
        status: nova.status
      }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(nova);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro ao criar reserva: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function cancel(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const reserva = await reservaModel.getReservaById(req.params.id);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    const userRole = (req.user?.perfil || '').toLowerCase();
    const isPrivileged = userRole === 'admin' || userRole === 'administrador' || userRole === 'docente' || userRole === 'professor';
    const isOwner = Number(reserva.usuario_id || reserva.id_usuario) === Number(req.user?.id);

    if (!isPrivileged && !isOwner) {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar esta reserva' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const updated = await reservaModel.cancelReserva(req.params.id, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: reserva.equipamento_id || reserva.id_equipamento || null,
      entidade: 'reserva',
      entidade_id: req.params.id,
      acao: 'reserva_cancelada',
      usuario_id: req.user.id,
      detalhes: { status_anterior: reserva.status, status_novo: updated.status }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'Reserva cancelada com sucesso', reserva: updated });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro ao cancelar:', err);
    res.status(500).json({ error: 'Erro ao cancelar reserva' });
  } finally {
    if (connection) connection.release();
  }
}

async function updateStatus(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Novo status é obrigatório' });
    }
    const anterior = await reservaModel.getReservaById(req.params.id);
    if (!anterior) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const updated = await reservaModel.updateReserva(req.params.id, { status }, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: anterior.equipamento_id || anterior.id_equipamento || null,
      entidade: 'reserva',
      entidade_id: req.params.id,
      acao: 'reserva_status_alterado',
      usuario_id: req.user.id,
      detalhes: { status_anterior: anterior.status, status_novo: status }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json(updated);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status da reserva' });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Criação de série recorrente (Bloco 08)
 */
async function createRecorrente(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const {
      equipamento_id,
      espaco_id,
      finalidade,
      observacoes,
      dias_semana,
      data_inicio_serie,
      data_fim_serie,
      hora_inicio,
      hora_fim,
    } = req.body;

    const usuario_id = req.user.id;

    if (!dias_semana || !Array.isArray(dias_semana) || dias_semana.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um dia da semana para a série recorrente.' });
    }
    if (!data_inicio_serie || !data_fim_serie || !hora_inicio || !hora_fim) {
      return res.status(400).json({ error: 'Data de início, data de término, hora inicial e final são obrigatórias.' });
    }
    if (new Date(data_inicio_serie) > new Date(data_fim_serie)) {
      return res.status(400).json({ error: 'A data inicial da série deve ser anterior à data final.' });
    }
    if (!equipamento_id && !espaco_id) {
      return res.status(400).json({ error: 'Informe ao menos um equipamento ou espaço para reservar.' });
    }

    let finalEspacoId = espaco_id ? Number(espaco_id) : null;
    if (equipamento_id) {
      const equip = await equipamentoModel.getEquipamentoById(equipamento_id);
      if (!equip) {
        return res.status(404).json({ error: 'Equipamento selecionado não existe.' });
      }
      if (!finalEspacoId && equip.espaco_id) {
        finalEspacoId = equip.espaco_id;
      }
      const statusAtual = (equip.status || '').toLowerCase();
      if (equip.inativo || statusAtual === 'inativo') {
        return res.status(400).json({ error: 'Equipamento inativo não pode receber reservas.' });
      }
      if (statusAtual === 'manutencao' || statusAtual === 'em_manutencao') {
        return res.status(400).json({ error: 'Equipamento em manutenção não pode ser reservado.' });
      }
      if (equip.exige_capacitacao) {
        const autorizado = await capacitacaoModel.checkUserCapacitacao(usuario_id, equipamento_id);
        if (!autorizado) {
          return res.status(403).json({ error: 'Este equipamento exige capacitação prévia. Usuário não habilitado.' });
        }
      }
    }

    // Gera as ocorrências
    const ocorrencias = [];
    const dtAtual = new Date(data_inicio_serie + 'T12:00:00');
    const dtLimite = new Date(data_fim_serie + 'T12:00:00');
    const diasPermitidos = dias_semana.map(Number);

    while (dtAtual <= dtLimite) {
      const dayOfWeek = dtAtual.getDay();
      if (diasPermitidos.includes(dayOfWeek)) {
        const y = dtAtual.getFullYear();
        const m = String(dtAtual.getMonth() + 1).padStart(2, '0');
        const d = String(dtAtual.getDate()).padStart(2, '0');
        const dataStr = `${y}-${m}-${d}`;

        ocorrencias.push({
          data_inicio: `${dataStr} ${hora_inicio}:00`,
          data_fim: `${dataStr} ${hora_fim}:00`
        });
      }
      dtAtual.setDate(dtAtual.getDate() + 1);
    }

    if (ocorrencias.length === 0) {
      return res.status(400).json({
        error: 'Nenhuma ocorrência encontrada para os dias da semana selecionados no período informado.'
      });
    }

    // Regra Crítica: Valida TODAS as ocorrências antes de confirmar
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const resultado = await reservaModel.createSerieRecorrente({
      usuario_id,
      equipamento_id: equipamento_id || null,
      espaco_id: finalEspacoId,
      ocorrencias,
      finalidade,
      observacoes,
      regra_recorrencia: `semanal:${diasPermitidos.join(',')}`,
      tolerancia_no_show_min: await reservaModel.getToleranciaNoShow(),
      executor: connection
    });

    if (!resultado.success) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json(resultado);
    }

    for (const reservaId of resultado.reservasCriadas) {
      await auditoriaModel.registrarEvento({
        equipamento_id: equipamento_id || null,
        entidade: 'reserva',
        entidade_id: reservaId,
        acao: 'reserva_recorrente_criada',
        usuario_id,
        detalhes: {
          grupo_recorrencia_id: resultado.grupo_recorrencia_id,
          espaco_id: finalEspacoId,
          regra_recorrencia: `semanal:${diasPermitidos.join(',')}`
        }
      }, connection);
    }
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(resultado);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva Recorrente] Erro:', err);
    res.status(500).json({ error: 'Erro ao criar série recorrente: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function getToleranciaNoShow(req, res) {
  try {
    const tolerancia_no_show_min = await reservaModel.getToleranciaNoShow();
    res.json({ tolerancia_no_show_min });
  } catch (err) {
    console.error('[Reserva] Erro ao carregar tolerância de no-show:', err);
    res.status(500).json({ error: 'Erro ao carregar configuração de no-show: ' + err.message });
  }
}

async function updateToleranciaNoShow(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const minutos = Number(req.body?.tolerancia_no_show_min);
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 180) {
      return res.status(400).json({ error: 'Informe uma tolerância inteira entre 1 e 180 minutos.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const anterior = await reservaModel.getToleranciaNoShow(connection);
    const tolerancia_no_show_min = await reservaModel.setToleranciaNoShow(minutos, req.user.id, connection);
    await auditoriaModel.registrarEvento({
      entidade: 'configuracao_sistema',
      entidade_id: 'tolerancia_no_show_minutos',
      acao: 'tolerancia_no_show_alterada',
      usuario_id: req.user.id,
      detalhes: { anterior, nova: tolerancia_no_show_min }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'Tolerância de no-show atualizada.', tolerancia_no_show_min });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro ao salvar tolerância de no-show:', err);
    res.status(500).json({ error: 'Erro ao salvar configuração de no-show: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Cancelamento granular de ocorrência de série (Bloco 08)
 */
async function cancelarRecorrente(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const id = req.params.id;
    const tipo = req.body?.tipo || req.query?.tipo || 'apenas_esta';
    const reserva = await reservaModel.getReservaById(id);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    const userRole = (req.user?.perfil || '').toLowerCase();
    const isPrivileged = userRole === 'admin' || userRole === 'administrador' || userRole === 'docente' || userRole === 'professor';
    const isOwner = Number(reserva.usuario_id || reserva.id_usuario) === Number(req.user?.id);

    if (!isPrivileged && !isOwner) {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar esta reserva' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const resultado = await reservaModel.cancelarOcorrenciaRecorrente(id, tipo, connection);
    if (!resultado) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ error: 'Tipo de cancelamento inválido.' });
    }
    await auditoriaModel.registrarEvento({
      equipamento_id: reserva.equipamento_id || reserva.id_equipamento || null,
      entidade: 'reserva',
      entidade_id: id,
      acao: 'reserva_recorrente_cancelada',
      usuario_id: req.user.id,
      detalhes: {
        tipo: resultado?.tipo || tipo,
        afetadas: resultado?.afetadas || 0,
        grupo_recorrencia_id: reserva.grupo_recorrencia_id || null
      }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'Cancelamento efetuado com sucesso', ...resultado });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro ao cancelar ocorrência:', err);
    res.status(500).json({ error: 'Erro ao cancelar ocorrência: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Registro de No-Show (Bloco 08)
 */
async function marcarNoShow(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const reserva = await reservaModel.marcarNoShow(req.params.id, connection);
    if (!reserva) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    await auditoriaModel.registrarEvento({
      equipamento_id: reserva.equipamento_id || reserva.id_equipamento || null,
      entidade: 'reserva',
      entidade_id: req.params.id,
      acao: 'no_show_registrado',
      usuario_id: req.user.id,
      detalhes: { data_inicio: reserva.data_inicio }
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'No-show registrado com sucesso. Histórico preservado.', reserva });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro ao marcar no-show:', err);
    res.status(500).json({ error: 'Erro ao registrar no-show: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Verificação automatizada de no-shows (Bloco 08)
 */
async function verificarNoShows(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    const tolerancia = await reservaModel.getToleranciaNoShow();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const resultado = await reservaModel.verificarNoShowsAutomaticos(tolerancia, connection);
    for (const candidato of resultado.reservas) {
      const reserva = await reservaModel.getReservaById(candidato.id, connection);
      await auditoriaModel.registrarEvento({
        equipamento_id: reserva?.equipamento_id || reserva?.id_equipamento || null,
        entidade: 'reserva',
        entidade_id: candidato.id,
        acao: 'no_show_automaticamente_registrado',
        usuario_id: req.user.id,
        detalhes: { tolerancia_minutos: tolerancia, data_inicio: candidato.data_inicio }
      }, connection);
    }
    await connection.commit();
    transactionStarted = false;
    res.json({
      message: `Verificação concluída com tolerância de ${tolerancia} minutos. ${resultado.totalMarcados} reserva(s) identificadas como no-show.`,
      tolerancia_no_show_min: tolerancia,
      ...resultado
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Reserva] Erro na verificação de no-shows:', err);
    res.status(500).json({ error: 'Erro ao verificar no-shows: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  list,
  getCalendario,
  getById,
  create,
  cancel,
  updateStatus,
  createRecorrente,
  getToleranciaNoShow,
  updateToleranciaNoShow,
  cancelarRecorrente,
  marcarNoShow,
  verificarNoShows
};
