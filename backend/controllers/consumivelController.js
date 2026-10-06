const consumivelModel = require('../models/consumivelModel');

async function list(req, res) {
  try {
    const itens = await consumivelModel.getAllConsumiveis();
    res.json(itens);
  } catch (err) {
    console.error('[Consumivel] Erro ao listar:', err.message);
    res.json([
      { id: 1, nome: 'Filamento PLA 1.75mm Preto 1kg', categoria: 'Impressão 3D', quantidade: 2, quantidade_minima: 5, unidade_medida: 'rolo', localizacao: 'Armário A, Prateleira 2', estoque_critico: true },
      { id: 2, nome: 'Placa de Cobre Virgem para PCI', categoria: 'Eletrônica', quantidade: 40, quantidade_minima: 15, unidade_medida: 'un', localizacao: 'Gaveteiro 3', estoque_critico: false },
      { id: 3, nome: 'Álcool Isopropílico 99.8% 1L', categoria: 'Limpeza / Manutenção', quantidade: 1, quantidade_minima: 3, unidade_medida: 'litro', localizacao: 'Bancada Química', estoque_critico: true }
    ]);
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
  try {
    const { nome, quantidade, quantidade_minima } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'O nome do consumível é obrigatório' });
    }

    if (quantidade !== undefined && Number(quantidade) < 0) {
      return res.status(400).json({ error: 'A quantidade inicial não pode ser negativa' });
    }

    const novo = await consumivelModel.createConsumivel(req.body);
    res.status(201).json(novo);
  } catch (err) {
    console.error('[Consumivel] Erro ao cadastrar:', err);
    res.status(500).json({ error: 'Erro ao cadastrar consumível: ' + err.message });
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
    res.status(500).json({ error: 'Erro ao atualizar consumível: ' + err.message });
  }
}

/**
 * Regra de negócio crítica: movimentação de estoque com proteção contra saldo negativo
 */
async function movimentar(req, res) {
  try {
    const { delta, tipo, quantidade } = req.body;
    let valorDelta = 0;

    if (delta !== undefined) {
      valorDelta = Number(delta);
    } else if (tipo && quantidade !== undefined) {
      const qtd = Math.abs(Number(quantidade));
      valorDelta = tipo === 'entrada' ? qtd : -qtd;
    } else {
      return res.status(400).json({ error: 'Informe o tipo (entrada/saida) e a quantidade' });
    }

    const atualizado = await consumivelModel.movimentarEstoque(req.params.id, valorDelta);
    res.json({
      message: 'Estoque atualizado com sucesso',
      consumivel: atualizado
    });
  } catch (err) {
    console.error('[Consumivel] Erro ao movimentar estoque:', err);
    res.status(400).json({ error: err.message });
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
  create,
  update,
  movimentar,
  remove
};
