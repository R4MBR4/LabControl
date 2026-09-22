const ocorrenciaModel = require('../models/ocorrenciaModel');
const equipamentoModel = require('../models/equipamentoModel');

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

    const ocorrencias = await ocorrenciaModel.getAllOcorrencias(filters);
    res.json(ocorrencias);
  } catch (err) {
    console.error('[Ocorrencia] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar ocorrências' });
  }
}

async function getById(req, res) {
  try {
    const ocorrencia = await ocorrenciaModel.getOcorrenciaById(req.params.id);
    if (!ocorrencia) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }
    res.json(ocorrencia);
  } catch (err) {
    console.error('[Ocorrencia] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar ocorrência' });
  }
}

async function create(req, res) {
  try {
    const { equipamento_id, utilizacao_id, titulo, descricao, gravidade } = req.body;
    const usuario_id = req.user.id;

    if (!titulo || !descricao) {
      return res.status(400).json({ error: 'Título e descrição da ocorrência são obrigatórios' });
    }

    const payload = {
      usuario_id,
      equipamento_id: equipamento_id || null,
      utilizacao_id: utilizacao_id || null,
      titulo,
      descricao,
      gravidade: gravidade || 'media',
      status: 'aberta'
    };

    const nova = await ocorrenciaModel.createOcorrencia(payload);
    res.status(201).json(nova);
  } catch (err) {
    console.error('[Ocorrencia] Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao registrar ocorrência' });
  }
}

/**
 * Ação do Administrador: Analisar e decidir sobre a ocorrência
 */
async function decidir(req, res) {
  try {
    const { status, decisao_admin, encaminhar_manutencao } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'O novo status da ocorrência é obrigatório' });
    }

    const ocorrencia = await ocorrenciaModel.getOcorrenciaById(req.params.id);
    if (!ocorrencia) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    const updatePayload = {
      status,
      decisao_admin: decisao_admin || '',
      resposta_admin: decisao_admin || ''
    };

    const updated = await ocorrenciaModel.updateOcorrencia(req.params.id, updatePayload);

    // Se o admin optar por encaminhar o equipamento para manutenção
    const equipId = ocorrencia.equipamento_id || ocorrencia.id_equipamento;
    if (encaminhar_manutencao && equipId) {
      await equipamentoModel.updateStatus(equipId, 'manutencao');
    }

    res.json({
      message: 'Ocorrência analisada e atualizada com sucesso',
      ocorrencia: updated
    });
  } catch (err) {
    console.error('[Ocorrencia] Erro ao decidir:', err);
    res.status(500).json({ error: 'Erro ao registrar decisão sobre a ocorrência' });
  }
}

async function remove(req, res) {
  try {
    const success = await ocorrenciaModel.deleteOcorrencia(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }
    res.json({ message: 'Ocorrência removida com sucesso' });
  } catch (err) {
    console.error('[Ocorrencia] Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover ocorrência' });
  }
}

module.exports = {
  list,
  getById,
  create,
  decidir,
  remove
};
