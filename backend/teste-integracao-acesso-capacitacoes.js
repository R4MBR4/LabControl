const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const requiredVariables = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'CAPACITACAO_TEST_USER_A_ID',
  'CAPACITACAO_TEST_USER_B_ID',
  'CAPACITACAO_TEST_ADMIN_ID'
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  console.log(
    `SKIP: teste MySQL de acesso às capacitações não executado; configure: ${missingVariables.join(', ')}.`
  );
  process.exit(0);
}

const { pool } = require('./models/dbHelper');
const capacitacaoModel = require('./models/capacitacaoModel');

function configuredId(name) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} deve conter um identificador inteiro positivo.`);
  }
  return value;
}

async function loadUsers(userAId, userBId, adminId) {
  const ids = [userAId, userBId, adminId];
  const [rows] = await pool.query(
    'SELECT id, perfil FROM usuario WHERE id IN (?, ?, ?)',
    ids
  );
  const users = new Map(rows.map((row) => [Number(row.id), row]));
  const userA = users.get(userAId);
  const userB = users.get(userBId);
  const admin = users.get(adminId);

  assert.ok(userA, 'O usuário A configurado não existe no banco.');
  assert.ok(userB, 'O usuário B configurado não existe no banco.');
  assert.ok(admin, 'O administrador configurado não existe no banco.');
  assert.notEqual(userAId, userBId, 'Os usuários A e B devem ser diferentes.');
  assert.notEqual(userAId, adminId, 'O usuário A e o administrador devem ser diferentes.');
  assert.notEqual(userBId, adminId, 'O usuário B e o administrador devem ser diferentes.');
  assert.ok(!['admin', 'administrador'].includes(String(userA.perfil).toLowerCase()));
  assert.ok(!['admin', 'administrador'].includes(String(userB.perfil).toLowerCase()));
  assert.ok(['admin', 'administrador'].includes(String(admin.perfil).toLowerCase()));

  return { userA, userB, admin };
}

async function runIntegrationTest() {
  const userAId = configuredId('CAPACITACAO_TEST_USER_A_ID');
  const userBId = configuredId('CAPACITACAO_TEST_USER_B_ID');
  const adminId = configuredId('CAPACITACAO_TEST_ADMIN_ID');
  const { userA, userB, admin } = await loadUsers(userAId, userBId, adminId);
  const [equipmentRows] = await pool.query('SELECT id FROM equipamento ORDER BY id LIMIT 1');
  assert.ok(equipmentRows.length > 0, 'O banco precisa ter ao menos um equipamento para o teste.');

  const marker = `teste-acesso-cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdIds = [];
  try {
    const trainingA = await capacitacaoModel.createCapacitacao({
      usuario_id: userAId,
      equipamento_id: equipmentRows[0].id,
      titulo: `${marker}-A`
    });
    createdIds.push(trainingA.id || trainingA.id_capacitacao);

    const trainingB = await capacitacaoModel.createCapacitacao({
      usuario_id: userBId,
      equipamento_id: equipmentRows[0].id,
      titulo: `${marker}-B`
    });
    createdIds.push(trainingB.id || trainingB.id_capacitacao);

    await assert.rejects(
      capacitacaoModel.getCapacitacoesByUser(userBId, userA),
      (error) => error.statusCode === 403
    );

    const ownTraining = await capacitacaoModel.getCapacitacoesByUser(userAId, userA);
    assert.ok(ownTraining.some((item) => item.titulo === `${marker}-A`));

    const otherUserTraining = await capacitacaoModel.getCapacitacoesByUser(userBId, admin);
    assert.ok(otherUserTraining.some((item) => item.titulo === `${marker}-B`));
  } finally {
    for (const id of createdIds) {
      if (id) await capacitacaoModel.deleteCapacitacao(id);
    }
  }
}

runIntegrationTest()
  .then(() => console.log('Teste de integração MySQL de acesso às capacitações passou.'))
  .catch((error) => {
    console.error('Falha no teste de integração MySQL de acesso às capacitações:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
