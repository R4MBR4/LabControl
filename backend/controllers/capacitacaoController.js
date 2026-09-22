const capacitacaoModel = require('../models/capacitacaoModel');

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
    const userId = req.params.userId || req.user.id;
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
  try {
    const { usuario_id, equipamento_id } = req.body;
    if (!usuario_id || !equipamento_id) {
      return res.status(400).json({ error: 'Identificador de usuário e equipamento são obrigatórios' });
    }
    const nova = await capacitacaoModel.createCapacitacao(req.body);
    res.status(201).json(nova);
  } catch (err) {
    console.error('[Capacitacao] Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao registrar capacitação: ' + err.message });
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
