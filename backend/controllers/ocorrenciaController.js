const ocorrenciaModel = require('../models/ocorrenciaModel');
const equipamentoModel = require('../models/equipamentoModel');
const manutencaoModel = require('../models/manutencaoModel');
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
    const { equipamento_id, utilizacao_id, espaco_id, titulo, descricao, gravidade, foto_evidencia, foto_metadata } = req.body;
    const usuario_id = req.user.id;

    if (!titulo || !descricao) {
      return res.status(400).json({ error: 'Título e descrição da ocorrência são obrigatórios' });
    }

    const payload = {
      usuario_id,
      equipamento_id: equipamento_id || null,
      espaco_id: espaco_id || null,
      utilizacao_id: utilizacao_id || null,
      titulo,
      descricao,
      gravidade: gravidade || 'media',
      status: 'aberta',
      foto_evidencia: foto_evidencia || null,
      foto_metadata: foto_metadata ? (typeof foto_metadata === 'object' ? JSON.stringify(foto_metadata) : String(foto_metadata)) : null
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
  let connection;
  let transactionStarted = false;

  try {
    const { status, decisao_admin, encaminhar_manutencao } = req.body;
    const shouldForward = encaminhar_manutencao === true || encaminhar_manutencao === 1 || encaminhar_manutencao === 'true';

    if (typeof status !== 'string' || !['em_analise', 'resolvida', 'rejeitada'].includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'Informe um status válido para a decisão administrativa.' });
    }
    if (typeof decisao_admin !== 'string' || !decisao_admin.trim()) {
      return res.status(400).json({ error: 'O parecer técnico/decisão administrativa é obrigatório.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const ocorrencia = await ocorrenciaModel.getOcorrenciaById(req.params.id, connection, true);
    if (!ocorrencia) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    const equipId = ocorrencia.equipamento_id || ocorrencia.id_equipamento;
    if (shouldForward && !equipId) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ error: 'Não é possível encaminhar para manutenção uma ocorrência sem equipamento associado.' });
    }

    let manutencao = await manutencaoModel.getManutencaoByOcorrenciaId(req.params.id, connection);
    const manutencaoAtiva = manutencao && !['concluida', 'concluído', 'concluido', 'cancelada', 'cancelado'].includes((manutencao.status || '').toLowerCase());
    if (manutencaoAtiva && !shouldForward && status.toLowerCase() !== 'em_analise') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'A ocorrência só pode ser encerrada após a conclusão da ordem de manutenção vinculada.' });
    }

    if (shouldForward) {
      if (manutencao && ['concluida', 'concluído', 'concluido', 'cancelada', 'cancelado'].includes((manutencao.status || '').toLowerCase())) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({ error: 'Esta ocorrência já possui uma ordem de manutenção concluída ou cancelada.' });
      }
      if (!manutencao) {
        manutencao = await manutencaoModel.createManutencao({
          equipamento_id: equipId,
          ocorrencia_id: ocorrencia.id || ocorrencia.id_ocorrencia,
          tipo: 'corretiva',
          descricao: `${ocorrencia.titulo || 'Avaria'}: ${ocorrencia.descricao}`,
          custo: 0,
          responsavel: 'A definir',
          status: 'em_andamento'
        }, connection);
      } else {
        await equipamentoModel.updateStatus(equipId, 'manutencao', connection);
      }
    }

    const statusAtualizado = shouldForward ? 'em_analise' : status.toLowerCase();
    const updated = await ocorrenciaModel.updateOcorrencia(req.params.id, {
      status: statusAtualizado,
      decisao_admin: decisao_admin.trim(),
      resposta_admin: decisao_admin.trim(),
      data_decisao: new Date(),
      data_resolucao: statusAtualizado === 'resolvida' ? new Date() : null
    }, connection);

    await connection.commit();
    transactionStarted = false;
    return res.json({
      message: 'Ocorrência analisada e atualizada com sucesso',
      ocorrencia: updated,
      manutencao
    });
  } catch (err) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    console.error('[Ocorrencia] Erro ao decidir:', err);
    res.status(500).json({ error: 'Erro ao registrar decisão sobre a ocorrência' });
  } finally {
    if (connection) connection.release();
  }
}

async function remove(req, res) {
  return res.status(409).json({
    error: 'Ocorrências são parte do histórico administrativo e não podem ser excluídas. Registre uma decisão para encerrá-las.'
  });
}

module.exports = {
  list,
  getById,
  create,
  decidir,
  remove
};
