const assert = require('node:assert/strict');
const capacitacaoModel = require('./models/capacitacaoModel');
const { getByUser } = require('./controllers/capacitacaoController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function requestFor(user, userId) {
  const response = createResponse();
  await getByUser({ user, params: userId ? { userId } : {} }, response);
  return response;
}

async function testUserCanReadOwnTraining() {
  const original = capacitacaoModel.getCapacitacoesByUser;
  const queriedIds = [];
  capacitacaoModel.getCapacitacoesByUser = async (userId) => {
    queriedIds.push(String(userId));
    return [{ usuario_id: userId, equipamento_id: 23 }];
  };
  try {
    const response = await requestFor({ id: 12, perfil: 'usuario' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(queriedIds, ['12']);
    assert.deepEqual(response.body, [{ usuario_id: 12, equipamento_id: 23 }]);
  } finally {
    capacitacaoModel.getCapacitacoesByUser = original;
  }
}

async function testUserCannotReadAnotherUsersTraining() {
  const original = capacitacaoModel.getCapacitacoesByUser;
  let modelWasCalled = false;
  capacitacaoModel.getCapacitacoesByUser = async () => {
    modelWasCalled = true;
    return [{ usuario_id: 99 }];
  };
  try {
    const response = await requestFor({ id: 12, perfil: 'usuario' }, '99');
    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /não tem permissão/);
    assert.equal(modelWasCalled, false);
  } finally {
    capacitacaoModel.getCapacitacoesByUser = original;
  }
}

async function testAdminCanReadAnotherUsersTraining() {
  const original = capacitacaoModel.getCapacitacoesByUser;
  const queriedIds = [];
  capacitacaoModel.getCapacitacoesByUser = async (userId) => {
    queriedIds.push(String(userId));
    return [{ usuario_id: userId }];
  };
  try {
    const response = await requestFor({ id: 1, perfil: 'administrador' }, '99');
    assert.equal(response.statusCode, 200);
    assert.deepEqual(queriedIds, ['99']);
    assert.deepEqual(response.body, [{ usuario_id: '99' }]);
  } finally {
    capacitacaoModel.getCapacitacoesByUser = original;
  }
}

(async () => {
  await testUserCanReadOwnTraining();
  await testUserCannotReadAnotherUsersTraining();
  await testAdminCanReadAnotherUsersTraining();
  assert.throws(
    () => capacitacaoModel.assertCanReadUserCapacitacoes(99, { id: 12, perfil: 'usuario' }),
    (error) => error.statusCode === 403
  );
  assert.doesNotThrow(
    () => capacitacaoModel.assertCanReadUserCapacitacoes(99, { id: 1, perfil: 'administrador' })
  );
  console.log('Testes de autorização de consulta de capacitações passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
