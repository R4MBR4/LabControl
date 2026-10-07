const ocorrenciaModel = require('../models/ocorrenciaModel');
const equipamentoModel = require('../models/equipamentoModel');
const manutencaoModel = require('../models/manutencaoModel');
const { pool } = require('../models/dbHelper');
const auditoriaModel = require('../models/auditoriaModel');
const notificacaoModel = require('../models/notificacaoModel');

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
    const userRole = (req.user.perfil || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'administrador';
    const ownerId = ocorrencia.usuario_id || ocorrencia.id_usuario;
    if (!isAdmin && String(ownerId) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }
    res.json(ocorrencia);
  } catch (err) {
    console.error('[Ocorrencia] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar ocorrência' });
  }
}

async function create(req, res) {
  let connection;
  let transactionStarted = false;

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

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const nova = await ocorrenciaModel.createOcorrencia(payload, connection);
    await auditoriaModel.registrarEvento({
      equipamento_id: nova.equipamento_id,
      entidade: 'ocorrencia',
      entidade_id: nova.id || nova.id_ocorrencia,
      acao: 'ocorrencia_registrada',
      usuario_id,
      detalhes: { titulo, gravidade: payload.gravidade, status: payload.status }
    }, connection);
    await notificacaoModel.createForRole('admin', {
      tipo: 'ocorrencia_registrada',
      titulo: 'Nova ocorrência registrada',
      mensagem: `${titulo}${equipamento_id ? ` · equipamento #${equipamento_id}` : ''}`,
      link: '/ocorrencias',
      entidade: 'ocorrencia',
      entidade_id: nova.id || nova.id_ocorrencia,
      dedupe_key: `ocorrencia_registrada:${nova.id || nova.id_ocorrencia}`
    }, connection, usuario_id);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(nova);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Ocorrencia] Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao registrar ocorrência' });
  } finally {
    if (connection) connection.release();
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
        await auditoriaModel.registrarEvento({
          equipamento_id: equipId,
          entidade: 'manutencao',
          entidade_id: manutencao.id || manutencao.id_manutencao,
          acao: 'manutencao_iniciada',
          usuario_id: req.user.id,
          detalhes: {
            tipo: manutencao.tipo,
            descricao: manutencao.descricao,
            ocorrencia_id: ocorrencia.id || ocorrencia.id_ocorrencia
          }
        }, connection);
        await notificacaoModel.createForRole('admin', {
          tipo: 'manutencao_iniciada',
          titulo: 'Manutenção iniciada',
          mensagem: `A manutenção do equipamento #${equipId} foi iniciada após análise de ocorrência.`,
          link: '/manutencao',
          entidade: 'manutencao',
          entidade_id: manutencao.id || manutencao.id_manutencao,
          dedupe_key: `manutencao_iniciada:${manutencao.id || manutencao.id_manutencao}`
        }, connection, req.user.id);
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
    await auditoriaModel.registrarEvento({
      equipamento_id: equipId,
      entidade: 'ocorrencia',
      entidade_id: req.params.id,
      acao: 'decisao_administrativa_registrada',
      usuario_id: req.user.id,
      detalhes: {
        status: statusAtualizado,
        decisao: decisao_admin.trim(),
        manutencao_id: manutencao?.id || manutencao?.id_manutencao || null
      }
    }, connection);
    const solicitanteId = ocorrencia.usuario_id || ocorrencia.id_usuario;
    if (solicitanteId && Number(solicitanteId) !== Number(req.user.id)) {
      await notificacaoModel.createForUser({
        usuario_id: solicitanteId,
        tipo: 'ocorrencia_decidida',
        titulo: 'Atualização da ocorrência',
        mensagem: `Sua ocorrência "${ocorrencia.titulo || 'Ocorrência'}" foi atualizada para "${statusAtualizado}".`,
        link: '/ocorrencias',
        entidade: 'ocorrencia',
        entidade_id: req.params.id,
        dedupe_key: `ocorrencia_atualizada:${req.params.id}:${statusAtualizado}`
      }, connection);
    }

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
