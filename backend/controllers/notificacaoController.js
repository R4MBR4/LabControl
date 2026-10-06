const notificacaoModel = require('../models/notificacaoModel');

async function list(req, res) {
  try {
    const result = await notificacaoModel.listByUser(req.user.id, req.query.limit);
    res.json(result);
  } catch (err) {
    console.error('[Notificacoes] Erro ao listar:', err);
    res.status(500).json({ error: 'Não foi possível carregar as notificações.' });
  }
}

async function markRead(req, res) {
  try {
    const marked = await notificacaoModel.markRead(req.params.id, req.user.id);
    if (!marked) {
      return res.status(404).json({ error: 'Notificação não encontrada.' });
    }
    res.json({ message: 'Notificação marcada como lida.' });
  } catch (err) {
    console.error('[Notificacoes] Erro ao marcar como lida:', err);
    res.status(500).json({ error: 'Não foi possível atualizar a notificação.' });
  }
}

async function markAllRead(req, res) {
  try {
    const total = await notificacaoModel.markAllRead(req.user.id);
    res.json({ message: 'Notificações marcadas como lidas.', total });
  } catch (err) {
    console.error('[Notificacoes] Erro ao marcar todas como lidas:', err);
    res.status(500).json({ error: 'Não foi possível atualizar as notificações.' });
  }
}

module.exports = { list, markRead, markAllRead };
