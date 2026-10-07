const assert = require('node:assert/strict');
const notificacaoModel = require('./models/notificacaoModel');

async function testIdempotentNotifications() {
  const calls = [];
  const executor = {
    async query(sql, values) {
      calls.push({ sql, values });
      return [{ insertId: 42 }];
    }
  };

  const id = await notificacaoModel.createForUser({
    usuario_id: 7,
    tipo: 'reserva_proxima',
    titulo: 'Reserva próxima',
    mensagem: 'Sua reserva começa em breve.',
    entidade: 'reserva',
    entidade_id: 9,
    dedupe_key: 'reserva_proxima:9:7'
  }, executor);
  assert.equal(id, 42);
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID\(id\)/);
  assert.equal(calls[0].values[6], '9');
  assert.equal(calls[0].values[7], 'reserva_proxima:9:7');
  await assert.rejects(
    notificacaoModel.createForUser({
      usuario_id: 7,
      tipo: 'aviso',
      titulo: 'Aviso',
      mensagem: 'Teste',
      dedupe_key: 'x'.repeat(192)
    }, executor),
    /até 191 caracteres/
  );
}

async function testRoleFanoutAndUpcomingReservations() {
  const inserts = [];
  const executor = {
    async query(sql, values) {
      if (sql.includes('SELECT id FROM usuario')) {
        return [[{ id: 3 }, { id: 4 }]];
      }
      if (sql.includes('INSERT INTO notificacao')) {
        inserts.push({ sql, values });
        return [{ insertId: inserts.length }];
      }
      if (sql.includes('FROM reserva r')) {
        assert.match(sql, /r\.status = 'confirmada'/);
        assert.match(sql, /NOT EXISTS\s*\(\s*SELECT 1 FROM utilizacao/i);
        assert.match(sql, /INTERVAL 15 MINUTE/);
        return [[{ id: 12, usuario_id: 3 }]];
      }
      throw new Error(`Query inesperada: ${sql}`);
    }
  };

  const sent = await notificacaoModel.createForRole('admin', {
    tipo: 'inventario_iniciado',
    titulo: 'Inventário iniciado',
    mensagem: 'Uma sessão de inventário foi iniciada.',
    dedupe_key: 'inventario_iniciado:8'
  }, executor, 3);
  assert.equal(sent, 1);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].values[7], 'inventario_iniciado:8:4');

  const proximas = await notificacaoModel.getReservasProximas(executor);
  assert.deepEqual(proximas, [{ id: 12, usuario_id: 3 }]);
}

(async () => {
  await testIdempotentNotifications();
  await testRoleFanoutAndUpcomingReservations();
  console.log('Testes de notificações internas passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
