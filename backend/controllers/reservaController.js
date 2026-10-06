const reservaModel = require('../models/reservaModel');
const equipamentoModel = require('../models/equipamentoModel');
const capacitacaoModel = require('../models/capacitacaoModel');

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

    const nova = await reservaModel.createReserva(payload);
    res.status(201).json(nova);
  } catch (err) {
    console.error('[Reserva] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro ao criar reserva: ' + err.message });
  }
}

async function cancel(req, res) {
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

    const updated = await reservaModel.cancelReserva(req.params.id);
    res.json({ message: 'Reserva cancelada com sucesso', reserva: updated });
  } catch (err) {
    console.error('[Reserva] Erro ao cancelar:', err);
    res.status(500).json({ error: 'Erro ao cancelar reserva' });
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Novo status é obrigatório' });
    }
    const updated = await reservaModel.updateReserva(req.params.id, { status });
    res.json(updated);
  } catch (err) {
    console.error('[Reserva] Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status da reserva' });
  }
}

/**
 * Criação de série recorrente (Bloco 08)
 */
async function createRecorrente(req, res) {
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
      tolerancia_no_show_min = 15
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
    const resultado = await reservaModel.createSerieRecorrente({
      usuario_id,
      equipamento_id: equipamento_id || null,
      espaco_id: finalEspacoId,
      ocorrencias,
      finalidade,
      observacoes,
      regra_recorrencia: `semanal:${diasPermitidos.join(',')}`,
      tolerancia_no_show_min
    });

    if (!resultado.success) {
      return res.status(409).json(resultado);
    }

    res.status(201).json(resultado);
  } catch (err) {
    console.error('[Reserva Recorrente] Erro:', err);
    res.status(500).json({ error: 'Erro ao criar série recorrente: ' + err.message });
  }
}

/**
 * Cancelamento granular de ocorrência de série (Bloco 08)
 */
async function cancelarRecorrente(req, res) {
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

    const resultado = await reservaModel.cancelarOcorrenciaRecorrente(id, tipo);
    res.json({ message: 'Cancelamento efetuado com sucesso', ...resultado });
  } catch (err) {
    console.error('[Reserva] Erro ao cancelar ocorrência:', err);
    res.status(500).json({ error: 'Erro ao cancelar ocorrência: ' + err.message });
  }
}

/**
 * Registro de No-Show (Bloco 08)
 */
async function marcarNoShow(req, res) {
  try {
    const reserva = await reservaModel.marcarNoShow(req.params.id);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    res.json({ message: 'No-show registrado com sucesso. Histórico preservado.', reserva });
  } catch (err) {
    console.error('[Reserva] Erro ao marcar no-show:', err);
    res.status(500).json({ error: 'Erro ao registrar no-show: ' + err.message });
  }
}

/**
 * Verificação automatizada de no-shows (Bloco 08)
 */
async function verificarNoShows(req, res) {
  try {
    const tolerancia = Number(req.body?.tolerancia || req.query?.tolerancia || 15);
    const resultado = await reservaModel.verificarNoShowsAutomaticos(tolerancia);
    res.json({
      message: `Verificação concluída. ${resultado.totalMarcados} reserva(s) identificadas como no-show.`,
      ...resultado
    });
  } catch (err) {
    console.error('[Reserva] Erro na verificação de no-shows:', err);
    res.status(500).json({ error: 'Erro ao verificar no-shows: ' + err.message });
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
  cancelarRecorrente,
  marcarNoShow,
  verificarNoShows
};

