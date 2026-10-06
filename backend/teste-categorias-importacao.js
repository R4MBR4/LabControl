const assert = require('node:assert/strict');

const dbHelperPath = require.resolve('./models/dbHelper');
const fakeExecutor = {
  async query(sql) {
    if (sql.includes('FROM `espaco`')) {
      return [[{ id: 3, nome: 'Laboratório de Teste', codigo: 'LAB-TST' }]];
    }
    if (sql.includes('AS patrimonio')) return [[]];
    if (sql.includes('SELECT DISTINCT categoria')) {
      return [[{ categoria: 'Instrumentação' }, { categoria: 'Fabricação Digital' }]];
    }
    throw new Error(`Consulta não prevista no teste: ${sql}`);
  }
};

require.cache[dbHelperPath] = {
  id: dbHelperPath,
  filename: dbHelperPath,
  loaded: true,
  exports: {
    pool: fakeExecutor,
    getTableColumns: async () => [],
    resolveColumn: async (_table, candidates) => candidates[0],
    getPrimaryKey: async () => 'id',
    insert: async () => 1,
    update: async () => true,
    remove: async () => true,
    findById: async () => null,
    findAll: async () => []
  }
};

const {
  CATEGORY_SUGGESTIONS,
  KEEP_ORIGINAL_CATEGORY,
  validateEquipmentCsv
} = require('./controllers/integracaoController');

const csv = [
  'patrimonio_ufpi;nome;categoria;laboratorio',
  'PAT-CAT-001;Medidor A;Instrumentação;LAB-TST',
  'PAT-CAT-002;Microscópio B;Microscopia Avançada;LAB-TST',
  'PAT-CAT-003;Bancada C;Fabricação Digital;LAB-TST'
].join('\n');

(async () => {
  const unmapped = await validateEquipmentCsv(csv, fakeExecutor);
  assert.equal(unmapped.summary.total, 3);
  assert.equal(unmapped.summary.invalidos, 0);
  assert.equal(unmapped.summary.categorias_pendentes, 1);
  assert.equal(unmapped.summary.validos, 2);
  assert.deepEqual(unmapped.categoryReview, [{
    categoria: 'Microscopia Avançada',
    linhas: [3]
  }]);
  assert(CATEGORY_SUGGESTIONS.includes('Outro'));
  assert(unmapped.categoryCatalog.includes('Instrumentação'));
  assert(unmapped.issues.some((issue) => issue.line === 3 && issue.warnings.length > 0));

  const mappedToExisting = await validateEquipmentCsv(csv, fakeExecutor, false, {
    categoryMappings: { 'Microscopia Avançada': 'Instrumentação' }
  });
  assert.equal(mappedToExisting.summary.categorias_pendentes, 0);
  assert.equal(mappedToExisting.summary.validos, 3);
  assert.equal(mappedToExisting.rows[1].data.categoria, 'Instrumentação');

  const keptOriginal = await validateEquipmentCsv(csv, fakeExecutor, false, {
    categoryMappings: { 'Microscopia Avançada': KEEP_ORIGINAL_CATEGORY }
  });
  assert.equal(keptOriginal.summary.categorias_pendentes, 0);
  assert.equal(keptOriginal.rows[1].data.categoria, 'Microscopia Avançada');
  assert(keptOriginal.issues.some((issue) => issue.warnings.some((warning) => warning.includes('mantida como texto original'))));

  console.log('Testes de categorias na importação CSV passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
