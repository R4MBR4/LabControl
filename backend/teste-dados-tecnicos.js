const assert = require('node:assert/strict');
const { validateTechnicalFields } = require('./controllers/equipamentoController');

function testOptionalTechnicalFields() {
  const result = validateTechnicalFields({
    especificacoes: '  220 V\n50 W  ',
    data_aquisicao: '2026-10-06',
    valor_aquisicao: '1234.5',
    fornecedor: '  Fornecedor Ltda. ',
    garantia_ate: '2027-10-06',
    garantia_detalhes: ' Cobertura integral '
  });
  assert.deepEqual(result, {
    fields: {
      especificacoes: '220 V\n50 W',
      data_aquisicao: '2026-10-06',
      valor_aquisicao: '1234.50',
      fornecedor: 'Fornecedor Ltda.',
      garantia_ate: '2027-10-06',
      garantia_detalhes: 'Cobertura integral'
    }
  });

  assert.deepEqual(validateTechnicalFields({
    especificacoes: '',
    data_aquisicao: '',
    valor_aquisicao: '',
    fornecedor: null,
    garantia_ate: null,
    garantia_detalhes: ''
  }), {
    fields: {
      especificacoes: null,
      data_aquisicao: null,
      valor_aquisicao: null,
      fornecedor: null,
      garantia_ate: null,
      garantia_detalhes: null
    }
  });
}

function testInvalidTechnicalFields() {
  assert.match(validateTechnicalFields(null).error, /dados técnicos.*inválidos/);
  assert.match(validateTechnicalFields([]).error, /dados técnicos.*inválidos/);
  for (const invalidDate of ['2026-02-30', '06/10/2026', '2026-2-06']) {
    assert.match(
      validateTechnicalFields({ data_aquisicao: invalidDate }).error,
      /data válida/
    );
  }
  for (const invalidAmount of ['-1', '1.234', '10000000000', 'abc']) {
    assert.match(
      validateTechnicalFields({ valor_aquisicao: invalidAmount }).error,
      /valor de aquisição/
    );
  }
  assert.match(
    validateTechnicalFields({ fornecedor: 'x'.repeat(161) }).error,
    /160 caracteres/
  );
  assert.match(
    validateTechnicalFields({ especificacoes: 15 }).error,
    /deve ser texto/
  );
}

testOptionalTechnicalFields();
testInvalidTechnicalFields();
console.log('Testes de dados técnicos de equipamentos passaram.');
