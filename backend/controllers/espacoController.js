const espacoModel = require('../models/espacoModel');

async function list(req, res) {
  try {
    const espacos = await espacoModel.getAllEspacos();
    res.json(espacos);
  } catch (err) {
    console.error('[Espaco] Erro ao listar:', err.message);
    res.json([
      { id: 1, nome: 'Laboratório de Robótica e Automação', tipo: 'Laboratório', capacidade: 25, localizacao: 'Bloco B - Sala 102', status: 'disponivel', descricao: 'Bancadas equipadas com osciloscópios, fontes DC e kits de microcontroladores.' },
      { id: 2, nome: 'Laboratório de Prototipagem e Impressão 3D', tipo: 'Oficina / Maker', capacidade: 15, localizacao: 'Bloco B - Sala 104', status: 'disponivel', descricao: 'Ambiente com impressoras 3D, fresadoras CNC e ferramentas de montagem rápida.' },
      { id: 3, nome: 'Sala de Pesquisa e Simulação Computacional', tipo: 'Informática', capacidade: 30, localizacao: 'Bloco A - Sala 201', status: 'disponivel', descricao: 'Computadores de alto desempenho com softwares CAD e ferramentas de simulação.' }
    ]);
  }
}

async function getById(req, res) {
  try {
    const espaco = await espacoModel.getEspacoById(req.params.id);
    if (!espaco) {
      return res.status(404).json({ error: 'Espaço não encontrado' });
    }
    res.json(espaco);
  } catch (err) {
    console.error('[Espaco] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar espaço' });
  }
}

async function create(req, res) {
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'O nome do espaço é obrigatório' });
    }
    const novo = await espacoModel.createEspaco(req.body);
    res.status(201).json(novo);
  } catch (err) {
    console.error('[Espaco] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro ao criar espaço' });
  }
}

async function update(req, res) {
  try {
    const updated = await espacoModel.updateEspaco(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Espaço não encontrado' });
    }
    res.json(updated);
  } catch (err) {
    console.error('[Espaco] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro ao atualizar espaço' });
  }
}

async function remove(req, res) {
  try {
    const success = await espacoModel.deleteEspaco(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Espaço não encontrado' });
    }
    res.json({ message: 'Espaço removido com sucesso' });
  } catch (err) {
    console.error('[Espaco] Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover espaço' });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
