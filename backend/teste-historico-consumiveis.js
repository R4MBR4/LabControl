const assert = require('node:assert/strict');

const dbHelperPath = require.resolve('./models/dbHelper');
const state = { quantity: 12.5, logs: [], changed: 0 };
const executor = {
  async query(sql, params = []) {
    if (sql.includes('FOR UPDATE')) {
      return [[{ id: 6, nome: 'Reagente de teste', quantidade: state.quantity }]];
    }
    if (sql.includes('UPDATE `consumivel`')) {
      const [next, , previous] = params;
      if (state.quantity !== Number(previous)) return [{ affectedRows: 0 }];
      state.quantity = Number(next);
      state.changed += 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('INSERT INTO `consumivel_movimentacao`')) {
      state.logs.push(params);
      return [{ insertId: state.logs.length }];
    }
    if (sql.includes('SELECT * FROM `consumivel`')) {
      return [[{ id: 6, nome: 'Reagente de teste', quantidade: state.quantity, quantidade_minima: 2 }]];
    }
    if (sql.includes('FROM `consumivel_movimentacao`')) {
      return [[{ id: 1, tipo: 'consumo', usuario_nome: 'Admin Teste' }]];
    }
    throw new Error(`Consulta não prevista no teste: ${sql}`);
  }
};

require.cache[dbHelperPath] = {
  id: dbHelperPath,
  filename: dbHelperPath,
  loaded: true,
  exports: {
    pool: executor,
    getPrimaryKey: async () => 'id',
    resolveColumn: async (_table, candidates) => candidates[0],
    insert: async () => 6,
    update: async () => true,
    remove: async () => true
  }
};

const consumivelModel = require('./models/consumivelModel');

(async () => {
  const consumed = await consumivelModel.movimentarEstoque(6, 'consumo', 2.25, 9, 'Aula de química', executor);
  assert.equal(consumed.consumivel.quantidade, 10.25);
  assert.equal(consumed.movimentacao.quantidade_anterior, 12.5);
  assert.equal(consumed.movimentacao.quantidade_movimentada, 2.25);
  assert.equal(consumed.movimentacao.quantidade_resultante, 10.25);
  assert.equal(consumed.movimentacao.usuario_id, 9);
  assert.equal(state.logs.length, 1);
  assert.equal(state.logs[0][2], 'consumo');

  const replenished = await consumivelModel.movimentarEstoque(6, 'reposicao', 3.5, 9, '', executor);
  assert.equal(replenished.consumivel.quantidade, 13.75);
  assert.equal(state.logs[1][2], 'reposicao');

  const updatesBeforeInvalid = state.changed;
  await assert.rejects(
    consumivelModel.movimentarEstoque(6, 'saida', 100, 9, '', executor),
    /Estoque insuficiente/
  );
  await assert.rejects(
    consumivelModel.movimentarEstoque(6, 'consumo', 0, 9, '', executor),
    /positiva/
  );
  await assert.rejects(
    consumivelModel.movimentarEstoque(6, 'entrada', 1.001, 9, '', executor),
    /duas casas decimais/
  );
  assert.equal(state.changed, updatesBeforeInvalid);
  assert.equal(state.logs.length, 2);

  await assert.rejects(
    consumivelModel.updateConsumivel(6, { quantidade: 20 }),
    /movimentação de estoque/
  );

  const history = await consumivelModel.getHistoricoMovimentacoes(6, executor);
  assert.equal(history[0].usuario_nome, 'Admin Teste');
  console.log('Testes de histórico de consumíveis passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
