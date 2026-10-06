const manutencaoModel = require('../models/manutencaoModel');

async function list(req, res) {
  try {
    const filters = {};
    if (req.query.equipamento_id) filters.equipamento_id = req.query.equipamento_id;
    if (req.query.status) filters.status = req.query.status;

    const manutencoes = await manutencaoModel.getAllManutencoes(filters);
    res.json(manutencoes);
  } catch (err) {
    console.error('[Manutencao] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar manutenções' });
  }
}

async function getById(req, res) {
  try {
    const item = await manutencaoModel.getManutencaoById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    res.json(item);
  } catch (err) {
    console.error('[Manutencao] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar manutenção' });
  }
}

/**
 * Passo 1 e 2 do fluxo: Bloqueio do equipamento e registro da manutenção
 */
async function create(req, res) {
  try {
    const { equipamento_id, descricao, tipo, custo, responsavel, ocorrencia_id } = req.body;

    if (!equipamento_id || !descricao) {
      return res.status(400).json({ error: 'Equipamento e descrição do serviço são obrigatórios' });
    }
    if (custo !== undefined && (!Number.isFinite(Number(custo)) || Number(custo) < 0)) {
      return res.status(400).json({ error: 'O custo da manutenção deve ser um número igual ou maior que zero.' });
    }

    const nova = await manutencaoModel.createManutencao({
      equipamento_id,
      ocorrencia_id: ocorrencia_id || null,
      tipo: tipo || 'corretiva',
      descricao,
      custo: custo || 0,
      responsavel: responsavel || req.user.nome,
      status: 'em_andamento'
    });

    res.status(201).json({
      message: 'Manutenção registrada e equipamento bloqueado com sucesso',
      manutencao: nova
    });
  } catch (err) {
    console.error('[Manutencao] Erro ao cadastrar:', err);
    res.status(500).json({ error: 'Erro ao iniciar manutenção: ' + err.message });
  }
}

/**
 * Passo 3 e 4 do fluxo: Conclusão da manutenção e retorno ao status 'disponivel'
 */
async function concluir(req, res) {
  try {
    const { observacoes, laudo_tecnico, custo } = req.body;
    const laudo = typeof laudo_tecnico === 'string' ? laudo_tecnico.trim() : '';

    if (!laudo) {
      return res.status(400).json({ error: 'O laudo técnico é obrigatório para concluir a manutenção.' });
    }
    if (custo !== undefined && (!Number.isFinite(Number(custo)) || Number(custo) < 0)) {
      return res.status(400).json({ error: 'O custo final deve ser um número igual ou maior que zero.' });
    }

    const existente = await manutencaoModel.getManutencaoById(req.params.id);
    if (!existente) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    if (['concluida', 'concluído', 'concluido', 'cancelada', 'cancelado'].includes((existente.status || '').toLowerCase())) {
      return res.status(409).json({ error: 'Esta ordem de manutenção já foi concluída ou cancelada.' });
    }

    const atualizada = await manutencaoModel.finalizarManutencao(req.params.id, {
      laudo_tecnico: laudo,
      observacoes: observacoes || laudo,
      custo: custo !== undefined ? custo : undefined
    });

    res.json({
      message: 'Manutenção concluída. A disponibilidade do equipamento foi revisada considerando seu estado e outras ordens abertas.',
      equipamento_liberado: (atualizada.equipamento_status || '').toLowerCase() === 'disponivel',
      manutencao: atualizada
    });
  } catch (err) {
    console.error('[Manutencao] Erro ao concluir:', err);
    res.status(500).json({ error: 'Erro ao concluir manutenção: ' + err.message });
  }
}

async function update(req, res) {
  try {
    const payload = {};
    for (const key of ['tipo', 'descricao', 'custo', 'responsavel']) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um campo editável da manutenção.' });
    }
    if (payload.custo !== undefined && (!Number.isFinite(Number(payload.custo)) || Number(payload.custo) < 0)) {
      return res.status(400).json({ error: 'O custo da manutenção deve ser um número igual ou maior que zero.' });
    }

    const updated = await manutencaoModel.updateManutencao(req.params.id, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Manutenção não encontrada' });
    }
    res.json(updated);
  } catch (err) {
    console.error('[Manutencao] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro ao atualizar manutenção' });
  }
}

async function remove(req, res) {
  return res.status(409).json({
    error: 'Ordens de manutenção são parte do histórico administrativo e não podem ser excluídas.'
  });
}

module.exports = {
  list,
  getById,
  create,
  concluir,
  update,
  remove
};
