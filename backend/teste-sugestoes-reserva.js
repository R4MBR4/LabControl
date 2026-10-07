const assert = require('node:assert/strict');

const dbHelperPath = require.resolve('./models/dbHelper');
const fakePool = {
  async query(sql, params = []) {
    if (sql.includes('FROM `reserva`')) {
      const start = params[1];
      const equipmentId = params.length > 2 ? params[2] : null;
      const spaceId = params.length > 3 ? params[3] : params[2];
      if (start === requestedStart && Number(equipmentId) === 5 && Number(spaceId) === 2) {
        return [[{
          id: 90,
          data_inicio: `${requestedStart.replace('T', ' ')}:00`,
          data_fim: `${requestedEnd.replace('T', ' ')}:00`,
          conflito_fim_local: conflictEnd,
          equipamento_nome: 'Equipamento reservado',
          espaco_nome: 'Espaço reservado'
        }]];
      }
      return [[]];
    }
    if (sql.includes('FROM espaco')) {
      return [[{ id: 8, nome: 'Sala alternativa', localizacao: 'Bloco E' }]];
    }
    if (sql.includes('FROM equipamento') && sql.includes('WHERE id = ?')) {
      return [[{ categoria: 'Instrumentação', exige_capacitacao: 0 }]];
    }
    if (sql.includes('FROM equipamento e')) {
      return [[{
        id: 7,
        nome: 'Osciloscópio equivalente',
        categoria: 'Instrumentação',
        espaco_id: 4,
        exige_capacitacao: 0,
        codigo_patrimonio: 'PAT-7',
        espaco_nome: 'Laboratório B'
      }]];
    }
    throw new Error(`Consulta não prevista no teste: ${sql}`);
  }
};

const futureStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
futureStart.setMinutes(0, 0, 0);
const toLocalString = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const requestedStart = toLocalString(futureStart);
const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000);
const requestedEnd = toLocalString(futureEnd);
const conflictEndDate = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);
const conflictEnd = `${toLocalString(conflictEndDate)}:00`;

require.cache[dbHelperPath] = {
  id: dbHelperPath,
  filename: dbHelperPath,
  loaded: true,
  exports: {
    pool: fakePool,
    getPrimaryKey: async () => 'id',
    resolveColumn: async (_table, candidates) => candidates[0],
    getTableColumns: async () => []
  }
};

const reservaModel = require('./models/reservaModel');

(async () => {
  const suggestions = await reservaModel.getConflictSuggestions({
    equipamento_id: 5,
    espaco_id: 2,
    data_inicio: requestedStart,
    data_fim: requestedEnd,
    usuario_id: 3
  });

  assert.equal(suggestions.proximos_horarios.length, 3);
  assert.equal(suggestions.proximos_horarios[0].data_inicio, toLocalString(conflictEndDate));
  assert.equal(suggestions.proximos_horarios[0].data_fim, toLocalString(new Date(conflictEndDate.getTime() + 60 * 60 * 1000)));
  assert.deepEqual(suggestions.espacos, []);
  assert.equal(suggestions.equipamentos[0].id, 7);

  const spaceSuggestions = await reservaModel.getConflictSuggestions({
    espaco_id: 2,
    data_inicio: requestedStart,
    data_fim: requestedEnd,
    usuario_id: 3
  });
  assert.equal(spaceSuggestions.espacos[0].id, 8);
  assert.deepEqual(spaceSuggestions.equipamentos, []);

  console.log('Testes de sugestões de reservas passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
