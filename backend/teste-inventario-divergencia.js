const assert = require('node:assert/strict');

const inventarioModel = require('./models/inventarioModel');

function createExecutor(overrides = {}) {
  const state = {
    item: {
      id: 41,
      inventario_id: 12,
      equipamento_id: 8,
      espaco_esperado_id: 2,
      espaco_encontrado_id: 3,
      status_conferencia: 'divergente',
      decisao_admin: 'pendente',
      inventario_status: 'em_andamento',
      equipamento_espaco_id: 2,
      espaco_anterior_nome: 'Laboratório anterior',
      espaco_novo_nome: 'Laboratório novo'
    },
    decisionUpdates: 0,
    equipmentUpdates: 0,
    ...overrides
  };

  return {
    state,
    async query(sql, params) {
      if (sql.includes('FOR UPDATE')) return [[state.item]];
      if (sql.includes('UPDATE equipamento SET espaco_id')) {
        state.equipmentUpdates += 1;
        state.updatedLocation = params[0];
        return [{ affectedRows: overrides.locationUpdateAffectedRows ?? 1 }];
      }
      if (sql.includes('SET decisao_admin = ?')) {
        state.decisionUpdates += 1;
        state.decision = params[0];
        return [{ affectedRows: overrides.decisionUpdateAffectedRows ?? 1 }];
      }
      if (sql.includes('WHERE inv.id = ?')) return [[{ id: 12, espaco_id: 3, status: 'em_andamento' }]];
      if (sql.includes('WHERE e.espaco_id = ?')) return [[]];
      if (sql.includes('WHERE it.inventario_id = ?')) {
        return [[{ ...state.item, decisao_admin: state.decision || state.item.decisao_admin }]];
      }
      throw new Error(`Query não prevista no teste: ${sql}`);
    }
  };
}

async function testModel() {
  const transferExecutor = createExecutor();
  const transferred = await inventarioModel.decidirDivergencia(12, 41, 'transferir', 5, transferExecutor);
  assert.equal(transferExecutor.state.updatedLocation, 3);
  assert.equal(transferExecutor.state.decision, 'transferir_localizacao');
  assert.equal(transferred.alteracaoLocalizacao.espaco_anterior_id, 2);
  assert.equal(transferred.alteracaoLocalizacao.espaco_novo_id, 3);

  const keepExecutor = createExecutor();
  const kept = await inventarioModel.decidirDivergencia(12, 41, 'manter', 5, keepExecutor);
  assert.equal(keepExecutor.state.equipmentUpdates, 0);
  assert.equal(keepExecutor.state.decision, 'manter_localizacao_original');
  assert.equal(kept.alteracaoLocalizacao.espaco_anterior_id, 2);
  assert.equal(kept.alteracaoLocalizacao.espaco_novo_id, 2);

  await assert.rejects(
    inventarioModel.decidirDivergencia(12, 41, 'transferir', 5, createExecutor({
      item: { ...createExecutor().state.item, inventario_status: 'concluido' }
    })),
    (error) => error.statusCode === 409
  );
  await assert.rejects(
    inventarioModel.decidirDivergencia(12, 41, 'transferir', 5, createExecutor({
      item: { ...createExecutor().state.item, decisao_admin: 'manter_localizacao_original' }
    })),
    (error) => error.statusCode === 409
  );
  await assert.rejects(
    inventarioModel.decidirDivergencia(12, 41, 'transferir', 5, createExecutor({ locationUpdateAffectedRows: 0 })),
    (error) => error.statusCode === 409
  );
}

function installMockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports
  };
}

async function invokeController(action, auditFailureIndex = -1) {
  const events = [];
  const transaction = { committed: false, rolledBack: false, released: false };
  const connection = {
    async beginTransaction() {},
    async commit() { transaction.committed = true; },
    async rollback() { transaction.rolledBack = true; },
    release() { transaction.released = true; }
  };
  const modelResult = {
    itens: [{
      id: 41,
      equipamento_id: 8,
      espaco_esperado_id: 2,
      espaco_encontrado_id: 3
    }],
    alteracaoLocalizacao: {
      equipamento_id: 8,
      espaco_anterior_id: 2,
      espaco_anterior_nome: 'Laboratório anterior',
      espaco_novo_id: action === 'transferir' ? 3 : 2,
      espaco_novo_nome: action === 'transferir' ? 'Laboratório novo' : 'Laboratório anterior',
      usuario_id: 5
    }
  };

  installMockModule('./models/inventarioModel', {
    async decidirDivergencia() { return { ...modelResult, itens: [...modelResult.itens] }; }
  });
  installMockModule('./models/auditoriaModel', {
    async registrarEvento(event) {
      events.push(event);
      if (events.length - 1 === auditFailureIndex) throw new Error('Falha simulada de auditoria');
    }
  });
  installMockModule('./models/dbHelper', {
    pool: { async getConnection() { return connection; } }
  });
  delete require.cache[require.resolve('./controllers/inventarioController')];
  const controller = require('./controllers/inventarioController');

  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await controller.decidirDivergencia({
      body: { item_id: 41, acao: action },
      params: { id: '12' },
      user: { id: 5 }
    }, response);
  } finally {
    console.error = originalError;
  }
  return { events, transaction, response };
}

async function testController() {
  const transfer = await invokeController('transferir');
  assert.equal(transfer.events.length, 2);
  assert.equal(transfer.events[0].acao, 'inventario_divergencia_decidida');
  assert.equal(transfer.events[1].acao, 'equipamento_local_alterado');
  assert.equal(transfer.events[0].detalhes.usuario_responsavel_id, 5);
  assert.equal(transfer.events[0].detalhes.data_hora_decisao.length > 0, true);
  assert.equal(transfer.events[1].detalhes.espaco_anterior_id, 2);
  assert.equal(transfer.events[1].detalhes.espaco_novo_id, 3);
  assert.equal(transfer.transaction.committed, true);
  assert.equal(transfer.transaction.released, true);
  assert.equal(Object.hasOwn(transfer.response.body.inventario, 'alteracaoLocalizacao'), false);

  const keep = await invokeController('manter');
  assert.equal(keep.events.length, 1);
  assert.equal(keep.events[0].acao, 'inventario_divergencia_decidida');
  assert.equal(keep.events[0].detalhes.decisao, 'manter');
  assert.equal(keep.transaction.committed, true);

  const rollback = await invokeController('transferir', 1);
  assert.equal(rollback.response.statusCode, 500);
  assert.equal(rollback.transaction.rolledBack, true);
  assert.equal(rollback.transaction.committed, false);
}

(async () => {
  await testModel();
  await testController();
  console.log('Testes de divergência de inventário passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
