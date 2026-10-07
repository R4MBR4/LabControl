const assert = require('node:assert/strict');

const dbHelperPath = require.resolve('./models/dbHelper');
let queryRegistrada;
const pool = {
  query: async (sql, params) => {
    queryRegistrada = { sql, params };
    return [[{ id: 27, tipo_recurso: 'equipamento', espaco_nome: 'Laboratório de Robótica' }]];
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
    resolveColumn: async () => 'id',
    getTableColumns: async () => []
  }
};

const reservaModel = require('./models/reservaModel');

async function testCalendarQuery() {
  const events = await reservaModel.getReservasCalendario({
    inicio: '2026-10-01 00:00:00',
    fim: '2026-11-01 00:00:00',
    espaco_id: 4,
    equipamento_id: 9,
    tipo_recurso: 'equipamento',
    status: 'confirmada',
    data_inicio_de: '2026-10-01',
    data_fim_ate: '2026-10-31',
    search: 'robot'
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].tipo_recurso, 'equipamento');
  assert.match(queryRegistrada.sql, /r\.data_fim > \?/);
  assert.match(queryRegistrada.sql, /r\.data_inicio < \?/);
  assert.match(queryRegistrada.sql, /r\.equipamento_id IS NOT NULL/);
  assert.match(queryRegistrada.sql, /COALESCE\(s\.nome, es\.nome\) AS espaco_nome/);
  assert.match(queryRegistrada.sql, /LEFT JOIN espaco es ON e\.espaco_id = es\.id/);
  assert.deepEqual(queryRegistrada.params, [
    '2026-10-01 00:00:00',
    '2026-11-01 00:00:00',
    4,
    4,
    9,
    'confirmada',
    '2026-10-01',
    '2026-10-31 23:59:59',
    '%robot%',
    '%robot%',
    '%robot%',
    '%robot%',
    '%robot%',
    '%robot%',
    '%robot%'
  ]);

  console.log('Testes do calendário de reservas passaram.');
}

testCalendarQuery().catch((error) => {
  console.error('Falha nos testes do calendário de reservas:', error);
  process.exitCode = 1;
});
