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

module.exports = {
  list,
  getCalendario,
  getById,
  create,
  cancel,
  updateStatus
};
