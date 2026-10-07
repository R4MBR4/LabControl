const assert = require('node:assert/strict');
const reservaModel = require('./models/reservaModel');
const ocorrenciaModel = require('./models/ocorrenciaModel');
const utilizacaoModel = require('./models/utilizacaoModel');
const reservaController = require('./controllers/reservaController');
const ocorrenciaController = require('./controllers/ocorrenciaController');
const utilizacaoController = require('./controllers/utilizacaoController');

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

async function call(handler, user, params = {}, query = {}) {
  const response = createResponse();
  await handler({ user, params, query }, response);
  return response;
}

async function testReservationListAlwaysScopesRegularUsers() {
  const original = reservaModel.getAllReservas;
  let receivedFilters;
  reservaModel.getAllReservas = async (filters) => {
    receivedFilters = filters;
    return [];
  };
  try {
    const response = await call(
      reservaController.list,
      { id: 12, perfil: 'usuario' },
      {},
      { usuario_id: '99', status: 'aprovada', data_inicio_de: '2026-01-01' }
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedFilters, {
      usuario_id: 12,
      status: 'aprovada',
      data_inicio_de: '2026-01-01'
    });
  } finally {
    reservaModel.getAllReservas = original;
  }
}

async function testOwnedRecordAccess(controller, model, methodName, ownerField, label, adminRole) {
  const original = model[methodName];
  const record = { id: 7, [ownerField]: 99, titulo: 'Registro de outro usuário' };
  model[methodName] = async () => record;
  try {
    const denied = await call(controller.getById, { id: 12, perfil: 'usuario' }, { id: '7' });
    assert.equal(denied.statusCode, 404, `${label}: registros de terceiros devem ser ocultados`);
    assert.notEqual(denied.body, record);

    record[ownerField] = 12;
    const ownRecord = await call(controller.getById, { id: 12, perfil: 'usuario' }, { id: '7' });
    assert.equal(ownRecord.statusCode, 200, `${label}: o proprietário deve acessar o registro`);
    assert.equal(ownRecord.body, record);

    record[ownerField] = 99;
    const adminRecord = await call(controller.getById, { id: 1, perfil: adminRole }, { id: '7' });
    assert.equal(adminRecord.statusCode, 200, `${label}: administradores devem acessar registros alheios`);
    assert.equal(adminRecord.body, record);
  } finally {
    model[methodName] = original;
  }
}

(async () => {
  await testReservationListAlwaysScopesRegularUsers();
  await testOwnedRecordAccess(
    reservaController,
    reservaModel,
    'getReservaById',
    'usuario_id',
    'Reserva',
    'administrador'
  );
  await testOwnedRecordAccess(
    ocorrenciaController,
    ocorrenciaModel,
    'getOcorrenciaById',
    'usuario_id',
    'Ocorrência',
    'administrador'
  );
  await testOwnedRecordAccess(
    utilizacaoController,
    utilizacaoModel,
    'getUtilizacaoById',
    'usuario_id',
    'Utilização',
    'admin'
  );
  const reservation = { id: 8, usuario_id: 99 };
  const originalReservationLookup = reservaModel.getReservaById;
  reservaModel.getReservaById = async () => reservation;
  try {
    const professorAccess = await call(
      reservaController.getById,
      { id: 2, perfil: 'docente' },
      { id: '8' }
    );
    assert.equal(professorAccess.statusCode, 200, 'Docentes mantêm acesso privilegiado às reservas');
  } finally {
    reservaModel.getReservaById = originalReservationLookup;
  }
  console.log('Testes de autorização de reservas, ocorrências e utilizações passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
