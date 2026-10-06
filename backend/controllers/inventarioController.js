const inventarioModel = require('../models/inventarioModel');

async function list(req, res) {
  try {
    const inventarios = await inventarioModel.getAllInventarios();
    res.json(inventarios);
  } catch (err) {
    console.error('[Inventario] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar sessões de inventário' });
  }
}

async function getById(req, res) {
  try {
    const inventario = await inventarioModel.getInventarioById(req.params.id);
    if (!inventario) {
      return res.status(404).json({ error: 'Sessão de inventário não encontrada' });
    }
    res.json(inventario);
  } catch (err) {
    console.error('[Inventario] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar detalhes do inventário' });
  }
}

async function start(req, res) {
  try {
    const { espaco_id, observacoes } = req.body;
    const usuario_id = req.user.id;

    if (!espaco_id) {
      return res.status(400).json({ error: 'O laboratório (espaço) é obrigatório para iniciar a contagem.' });
    }

    const novo = await inventarioModel.startInventario(espaco_id, usuario_id, observacoes);
    res.status(201).json(novo);
  } catch (err) {
    console.error('[Inventario] Erro ao iniciar:', err);
    res.status(500).json({ error: 'Erro ao iniciar sessão de inventário: ' + err.message });
  }
}

async function scan(req, res) {
  try {
    const { scanned_value } = req.body;
    const usuario_id = req.user.id;

    if (!scanned_value) {
      return res.status(400).json({ error: 'Código do equipamento ou leitura QR é obrigatória.' });
    }

    const resultado = await inventarioModel.scanItem(req.params.id, scanned_value, usuario_id);
    res.json(resultado);
  } catch (err) {
    console.error('[Inventario] Erro ao escanear item:', err);
    res.status(400).json({ error: err.message });
  }
}

async function decidirDivergencia(req, res) {
  try {
    const { item_id, acao } = req.body;
    const usuario_id = req.user.id;

    if (!item_id || !acao) {
      return res.status(400).json({ error: 'Item e ação (transferir ou manter) são obrigatórios.' });
    }

    const atualizado = await inventarioModel.decidirDivergencia(req.params.id, item_id, acao, usuario_id);
    res.json({
      message: acao === 'transferir' 
        ? 'Localização do equipamento atualizada com sucesso para este laboratório.' 
        : 'Localização original do equipamento preservada.',
      inventario: atualizado
    });
  } catch (err) {
    console.error('[Inventario] Erro ao decidir divergência:', err);
    res.status(500).json({ error: 'Erro ao registrar decisão de divergência: ' + err.message });
  }
}

async function finalizar(req, res) {
  try {
    const finalizado = await inventarioModel.finalizarInventario(req.params.id);
    res.json({
      message: 'Sessão de inventário concluída com sucesso!',
      inventario: finalizado
    });
  } catch (err) {
    console.error('[Inventario] Erro ao finalizar:', err);
    res.status(500).json({ error: 'Erro ao finalizar inventário: ' + err.message });
  }
}

module.exports = {
  list,
  getById,
  start,
  scan,
  decidirDivergencia,
  finalizar
};
