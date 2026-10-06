const assert = require('node:assert/strict');

const dbHelperPath = require.resolve('./models/dbHelper');
const queries = [];
const pool = {
  query: async (sql, params = []) => {
    queries.push({ sql, params });
    return [[{ id: 7, usuario_id: 3, equipamento_id: 11, espaco_id: 4 }]];
  }
};

require.cache[dbHelperPath] = {
  id: dbHelperPath,
  filename: dbHelperPath,
  loaded: true,
  exports: {
    pool,
    getPrimaryKey: async () => 'id',
    insert: async () => null,
    update: async () => null,
    remove: async () => null,
    findById: async () => null,
    findAll: async () => [],
    resolveColumn: async (table, candidates) => candidates[0],
    getTableColumns: async () => []
  }
};

const consumivelModel = require('./models/consumivelModel');
const capacitacaoModel = require('./models/capacitacaoModel');
const utilizacaoModel = require('./models/utilizacaoModel');

async function testReportQueries() {
  const movements = await consumivelModel.getAllHistoricoMovimentacoes();
  assert.equal(movements.length, 1);
  assert.match(queries[0].sql, /FROM `consumivel_movimentacao` m/);
  assert.match(queries[0].sql, /LEFT JOIN `consumivel` c ON c\.id = m\.consumivel_id/);
  assert.match(queries[0].sql, /LEFT JOIN espaco s ON s\.id = c\.espaco_id/);
  assert.match(queries[0].sql, /LEFT JOIN usuario u ON u\.id = m\.usuario_id/);

  const capacitacoes = await capacitacaoModel.getAllCapacitacoes();
  assert.equal(capacitacoes.length, 1);
  assert.match(queries[1].sql, /LEFT JOIN `espaco` s ON s\.id = COALESCE\(c\.espaco_id, e\.espaco_id\)/);
  assert.match(queries[1].sql, /u\.nome AS usuario_nome/);

  const utilizacoes = await utilizacaoModel.getAllUtilizacoes({});
  assert.equal(utilizacoes.length, 1);
  assert.match(queries[2].sql, /e\.espaco_id, esp\.nome AS espaco_nome/);
  assert.match(queries[2].sql, /LEFT JOIN espaco esp ON e\.espaco_id = esp\.id/);
  console.log('Testes das consultas para relatórios passaram.');
}

testReportQueries().catch((error) => {
  console.error('Falha nos testes de relatórios:', error);
  process.exitCode = 1;
});
