const assert = require('node:assert/strict');

const reservaModel = require('./models/reservaModel');
const { createNoShowScheduler } = require('./services/noShowScheduler');

async function testAutomaticReservationSelection() {
  const candidate = {
    id: 17,
    usuario_id: 4,
    data_inicio: '2026-10-06 10:00:00',
    finalidade: 'Aula prática'
  };
  const state = { updated: [], queries: [] };
  const executor = {
    async query(sql, values) {
      state.queries.push({ sql, values });
      if (sql.includes('FOR UPDATE')) return [[candidate]];
      if (sql.includes('UPDATE `reserva`')) {
        state.updated.push(values[0]);
        return [{ affectedRows: values[0] === 17 ? 1 : 0 }];
      }
      throw new Error(`Query inesperada: ${sql}`);
    }
  };

  const result = await reservaModel.verificarNoShowsAutomaticos(20, executor);
  assert.equal(result.totalMarcados, 1);
  assert.deepEqual(result.reservas, [candidate]);
  assert.deepEqual(state.updated, [17]);
  assert.match(state.queries[0].sql, /r\.status = 'confirmada'/);
  assert.doesNotMatch(state.queries[0].sql, /'pendente'/);
  assert.match(state.queries[0].sql, /NOT EXISTS\s*\(\s*SELECT 1 FROM utilizacao/i);
  assert.match(state.queries[0].sql, /FOR UPDATE/);
  assert.match(state.queries[1].sql, /NOT EXISTS\s*\(\s*SELECT 1 FROM utilizacao/i);
  assert.deepEqual(state.queries[0].values, [20]);
  assert.deepEqual(state.queries[1].values, [17, 20]);

  const racedExecutor = {
    async query(sql) {
      if (sql.includes('FOR UPDATE')) return [[candidate]];
      return [{ affectedRows: 0 }];
    }
  };
  const raced = await reservaModel.verificarNoShowsAutomaticos(20, racedExecutor);
  assert.equal(raced.totalMarcados, 0);
  assert.deepEqual(raced.reservas, []);

  await assert.rejects(
    reservaModel.verificarNoShowsAutomaticos(0, executor),
    /entre 1 e 180 minutos/
  );
}

function createConnection() {
  return {
    began: false,
    committed: false,
    rolledBack: false,
    released: false,
    async beginTransaction() { this.began = true; },
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; }
  };
}

async function testSchedulerAuditAndRollback() {
  const connection = createConnection();
  const auditEvents = [];
  const sentNotifications = [];
  let receivedTolerance;
  const scheduler = createNoShowScheduler({
    connectionPool: { async getConnection() { return connection; } },
    reservas: {
      async getToleranciaNoShow(executor) {
        assert.equal(executor, connection);
        return 25;
      },
      async verificarNoShowsAutomaticos(tolerance, executor) {
        receivedTolerance = tolerance;
        assert.equal(executor, connection);
        return {
          totalMarcados: 1,
          reservas: [{ id: 17, usuario_id: 4, data_inicio: '2026-10-06 10:00:00' }]
        };
      }
    },
    auditoria: {
      async registrarEvento(event, executor) {
        assert.equal(executor, connection);
        auditEvents.push(event);
      }
    },
    notificacoes: {
      async getReservasProximas(executor) {
        assert.equal(executor, connection);
        return [];
      },
      async createForRole(role, notification, executor) {
        assert.equal(executor, connection);
        sentNotifications.push({ role, notification });
      },
      async createForUser(notification, executor) {
        assert.equal(executor, connection);
        sentNotifications.push({ role: 'user', notification });
      }
    },
    intervalMs: 1_000,
    logger: { info() {}, error() {} }
  });

  const result = await scheduler.checkOnce();
  assert.equal(receivedTolerance, 25);
  assert.equal(result.totalMarcados, 1);
  assert.equal(result.tolerancia_no_show_min, 25);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].acao, 'no_show_automaticamente_registrado');
  assert.equal(auditEvents[0].usuario_id, null);
  assert.equal(auditEvents[0].detalhes.origem, 'agendador_automatico');
  assert.equal(auditEvents[0].detalhes.tolerancia_minutos, 25);
  assert.equal(sentNotifications.length, 2);
  assert.match(sentNotifications[0].notification.dedupe_key, /^reserva_no_show_admin:17$/);
  assert.match(sentNotifications[1].notification.dedupe_key, /^reserva_no_show_usuario:17$/);
  assert.equal(connection.began, true);
  assert.equal(connection.committed, true);
  assert.equal(connection.rolledBack, false);
  assert.equal(connection.released, true);

  const failedConnection = createConnection();
  const failingScheduler = createNoShowScheduler({
    connectionPool: { async getConnection() { return failedConnection; } },
    reservas: {
      async getToleranciaNoShow() { return 15; },
      async verificarNoShowsAutomaticos() {
        return { totalMarcados: 1, reservas: [{ id: 17, data_inicio: '2026-10-06 10:00:00' }] };
      }
    },
    auditoria: {
      async registrarEvento() { throw new Error('falha simulada na auditoria'); }
    },
    notificacoes: {
      async getReservasProximas() { return []; },
      async createForRole() {},
      async createForUser() {}
    },
    intervalMs: 1_000,
    logger: { info() {}, error() {} }
  });
  await assert.rejects(failingScheduler.checkOnce(), /falha simulada na auditoria/);
  assert.equal(failedConnection.rolledBack, true);
  assert.equal(failedConnection.committed, false);
  assert.equal(failedConnection.released, true);
}

async function testSchedulerStartsAutomatically() {
  let calls = 0;
  const scheduler = createNoShowScheduler({
    connectionPool: {
      async getConnection() {
        calls += 1;
        return createConnection();
      }
    },
    reservas: {
      async getToleranciaNoShow() { return 15; },
      async verificarNoShowsAutomaticos() { return { totalMarcados: 0, reservas: [] }; }
    },
    auditoria: { async registrarEvento() {} },
    notificacoes: {
      async getReservasProximas() { return []; },
      async createForRole() {},
      async createForUser() {}
    },
    intervalMs: 1_000,
    logger: { info() {}, error() {} }
  });

  scheduler.start();
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  scheduler.stop();
  assert.equal(calls, 2);
}

async function testUpcomingReservationReminder() {
  const connection = createConnection();
  const sent = [];
  const scheduler = createNoShowScheduler({
    connectionPool: { async getConnection() { return connection; } },
    reservas: {
      async getToleranciaNoShow() { return 15; },
      async verificarNoShowsAutomaticos() { return { totalMarcados: 0, reservas: [] }; }
    },
    auditoria: { async registrarEvento() {} },
    notificacoes: {
      async getReservasProximas(executor) {
        assert.equal(executor, connection);
        return [{
          id: 29,
          usuario_id: 6,
          data_inicio: '2026-10-06 10:00:00',
          finalidade: 'Aula prática'
        }];
      },
      async createForRole() {},
      async createForUser(notification, executor) {
        assert.equal(executor, connection);
        sent.push(notification);
      }
    },
    intervalMs: 1_000,
    logger: { info() {}, error() {} }
  });

  await scheduler.checkOnce();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].tipo, 'reserva_proxima');
  assert.equal(sent[0].entidade_id, 29);
  assert.equal(sent[0].dedupe_key, 'reserva_proxima:29:6');
  assert.equal(connection.committed, true);
}

(async () => {
  await testAutomaticReservationSelection();
  await testSchedulerAuditAndRollback();
  await testSchedulerStartsAutomatically();
  await testUpcomingReservationReminder();
  console.log('Testes de no-show automático passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
