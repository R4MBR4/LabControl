const capacitacaoModel = require('../models/capacitacaoModel');
const notificacaoModel = require('../models/notificacaoModel');
const { pool } = require('../models/dbHelper');

async function list(req, res) {
  try {
    const userRole = (req.user.perfil || '').toLowerCase();
    let itens;

    if (userRole === 'admin' || userRole === 'administrador') {
      itens = await capacitacaoModel.getAllCapacitacoes();
    } else {
      itens = await capacitacaoModel.getCapacitacoesByUser(req.user.id);
    }

    res.json(itens);
  } catch (err) {
    console.error('[Capacitacao] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar capacitações' });
  }
}

async function getByUser(req, res) {
  try {
    const role = (req.user.perfil || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrador';
    const requestedUserId = req.params.userId;
    const currentUserId = req.user.id || req.user.id_usuario;

    if (requestedUserId && String(requestedUserId) !== String(currentUserId) && !isAdmin) {
      return res.status(403).json({ error: 'Você não tem permissão para consultar as capacitações deste usuário.' });
    }

    const userId = isAdmin && requestedUserId ? requestedUserId : currentUserId;
    const itens = await capacitacaoModel.getCapacitacoesByUser(userId);
    res.json(itens);
  } catch (err) {
    console.error('[Capacitacao] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar capacitações do usuário' });
  }
}

async function check(req, res) {
  try {
    const { equipamentoId } = req.params;
    const userId = req.user.id;
    const autorizado = await capacitacaoModel.checkUserCapacitacao(userId, equipamentoId);
    res.json({ equipamento_id: equipamentoId, usuario_id: userId, autorizado });
  } catch (err) {
    console.error('[Capacitacao] Erro ao verificar autorização:', err);
    res.status(500).json({ error: 'Erro ao verificar capacitação' });
  }
}

async function create(req, res) {
  let connection;
  let transactionStarted = false;
  try {
    const { usuario_id, equipamento_id } = req.body;
    if (!usuario_id || !equipamento_id) {
      return res.status(400).json({ error: 'Identificador de usuário e equipamento são obrigatórios' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const nova = await capacitacaoModel.createCapacitacao(req.body, connection);
    const capacitacaoId = nova.id || nova.id_capacitacao;
    await notificacaoModel.createForUser({
      usuario_id,
      tipo: 'capacitacao_registrada',
      titulo: 'Capacitação registrada',
      mensagem: `Uma capacitação para o equipamento #${equipamento_id} foi registrada em seu nome.`,
      link: '/capacitacoes',
      entidade: 'capacitacao',
      entidade_id: capacitacaoId,
      dedupe_key: `capacitacao_registrada:${capacitacaoId}:${usuario_id}`
    }, connection);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(nova);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Capacitacao] Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao registrar capacitação: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function update(req, res) {
  try {
    const updated = await capacitacaoModel.updateCapacitacao(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('[Capacitacao] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro ao atualizar capacitação' });
  }
}

async function remove(req, res) {
  try {
    const success = await capacitacaoModel.deleteCapacitacao(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    res.json({ message: 'Capacitação removida com sucesso' });
  } catch (err) {
    console.error('[Capacitacao] Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover capacitação' });
  }
}

module.exports = {
  list,
  getByUser,
  check,
  create,
  update,
  remove
};
