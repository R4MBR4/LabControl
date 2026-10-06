const consumivelModel = require('../models/consumivelModel');
const { pool } = require('../models/dbHelper');

async function list(req, res) {
  try {
    const itens = await consumivelModel.getAllConsumiveis();
    res.json(itens);
  } catch (err) {
    console.error('[Consumivel] Erro ao listar:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar os consumíveis. Tente novamente.' });
  }
}

async function getById(req, res) {
  try {
    const item = await consumivelModel.getConsumivelById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Consumível não encontrado' });
    }
    res.json(item);
  } catch (err) {
    console.error('[Consumivel] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar consumível' });
  }
}

async function create(req, res) {
  let connection;
  let transactionStarted = false;
  try {
    const { nome, quantidade } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'O nome do consumível é obrigatório' });
    }

    if (quantidade !== undefined && (!Number.isFinite(Number(quantidade)) || Number(quantidade) < 0)) {
      return res.status(400).json({ error: 'A quantidade inicial deve ser um número não negativo' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const novo = await consumivelModel.createConsumivel(req.body, req.user.id, connection);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(novo);
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Consumivel] Erro ao cadastrar:', err);
    res.status(err.statusCode || 500).json({ error: 'Erro ao cadastrar consumível: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function update(req, res) {
  try {
    const updated = await consumivelModel.updateConsumivel(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Consumível não encontrado' });
    }
    res.json(updated);
  } catch (err) {
    console.error('[Consumivel] Erro ao atualizar:', err);
    res.status(err.statusCode || 500).json({ error: 'Erro ao atualizar consumível: ' + err.message });
  }
}

async function historico(req, res) {
  try {
    const item = await consumivelModel.getConsumivelById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Consumível não encontrado.' });
    const movimentacoes = await consumivelModel.getHistoricoMovimentacoes(req.params.id);
    res.json(movimentacoes);
  } catch (err) {
    console.error('[Consumivel] Erro ao carregar histórico:', err);
    res.status(500).json({ error: 'Não foi possível carregar o histórico do consumível.' });
  }
}

/**
 * Regra de negócio crítica: movimentação de estoque com proteção contra saldo negativo
 */
async function movimentar(req, res) {
  let connection;
  let transactionStarted = false;
  try {
    const { delta, tipo, quantidade, observacao, motivo } = req.body;
    let movementType = tipo;
    let movementQuantity = quantidade;
    if (delta !== undefined && tipo === undefined && quantidade === undefined) {
      const numericDelta = Number(delta);
      if (!Number.isFinite(numericDelta) || numericDelta === 0) {
        return res.status(400).json({ error: 'A quantidade movimentada deve ser diferente de zero.' });
      }
      movementType = numericDelta > 0 ? 'entrada' : 'saida';
      movementQuantity = Math.abs(numericDelta);
    }
    if (typeof movementType !== 'string' || movementQuantity === undefined) {
      return res.status(400).json({ error: 'Informe o tipo de movimentação e uma quantidade positiva.' });
    }
    const observation = observacao || motivo || '';
    if (typeof observation !== 'string' || observation.length > 500) {
      return res.status(400).json({ error: 'A observação deve conter no máximo 500 caracteres.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const resultado = await consumivelModel.movimentarEstoque(
      req.params.id,
      movementType.toLowerCase(),
      movementQuantity,
      req.user.id,
      observation,
      connection
    );
    await connection.commit();
    transactionStarted = false;
    res.json({
      message: 'Estoque atualizado com sucesso',
      ...resultado
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Consumivel] Erro ao movimentar estoque:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function remove(req, res) {
  try {
    const success = await consumivelModel.deleteConsumivel(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Consumível não encontrado' });
    }
    res.json({ message: 'Consumível removido com sucesso' });
  } catch (err) {
    console.error('[Consumivel] Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover consumível' });
  }
}

module.exports = {
  list,
  getById,
  historico,
  create,
  update,
  movimentar,
  remove
};
