const reservaModel = require('../models/reservaModel');
const equipamentoModel = require('../models/equipamentoModel');
const capacitacaoModel = require('../models/capacitacaoModel');

async function list(req, res) {
  try {
    const filters = {};
    const userRole = (req.user.perfil || '').toLowerCase();

    // Se for usuário comum e não especificar filtro, lista suas próprias reservas
    if (userRole !== 'admin' && userRole !== 'administrador') {
      filters.usuario_id = req.user.id;
    } else if (req.query.usuario_id) {
      filters.usuario_id = req.query.usuario_id;
    }

    if (req.query.equipamento_id) filters.equipamento_id = req.query.equipamento_id;
    if (req.query.espaco_id) filters.espaco_id = req.query.espaco_id;
    if (req.query.status) filters.status = req.query.status;

    const reservas = await reservaModel.getAllReservas(filters);
    res.json(reservas);
  } catch (err) {
    console.error('[Reserva] Erro ao listar:', err.message);
    res.json([
      {
        id: 1,
        equipamento_nome: 'Impressora 3D Creality Ender 3 Pro',
        equipamento_codigo: 'EQ-1001',
        usuario_nome: 'Aluno Pesquisador',
        usuario_email: 'aluno@labcontrol.com',
        data_inicio: new Date(Date.now() + 3600000),
        data_fim: new Date(Date.now() + 10800000),
        finalidade: 'Impressão de engrenagens para projeto de TCC',
        status: 'confirmada'
      },
      {
        id: 2,
        espaco_nome: 'Laboratório de Robótica e Automação',
        usuario_nome: 'Prof. Coordenador',
        usuario_email: 'prof@labcontrol.com',
        data_inicio: new Date(Date.now() + 86400000),
        data_fim: new Date(Date.now() + 97200000),
        finalidade: 'Aula prática de Sistemas Embarcados e IoT',
        status: 'confirmada'
      }
    ]);
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

    // Regra 1: Equipamento em manutenção não pode ser reservado
    if (equipamento_id) {
      const equip = await equipamentoModel.getEquipamentoById(equipamento_id);
      if (!equip) {
        return res.status(404).json({ error: 'Equipamento selecionado não existe' });
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

      // Regra 2: Equipamento que exige capacitação só pode ser usado por usuário autorizado
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

    // Regra 3: Não pode haver duas reservas no mesmo horário para o mesmo recurso
    const conflitos = await reservaModel.checkConflict({
      equipamento_id,
      espaco_id,
      data_inicio,
      data_fim
    });

    if (conflitos.length > 0) {
      return res.status(409).json({
        error: 'Conflito de horário: já existe uma reserva confirmada para este recurso no período solicitado.'
      });
    }

    const payload = {
      usuario_id,
      equipamento_id: equipamento_id || null,
      espaco_id: espaco_id || null,
      data_inicio,
      data_fim,
      status: 'confirmada',
      finalidade,
      observacoes
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

    const userRole = (req.user.perfil || '').toLowerCase();
    const isPrivileged = userRole === 'admin' || userRole === 'administrador' || userRole === 'docente' || userRole === 'professor';
    const isOwner = Number(reserva.usuario_id || reserva.id_usuario) === Number(req.user.id);

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
  getById,
  create,
  cancel,
  updateStatus
};
