const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const http = require('node:http');

process.env.JWT_SECRET = 'test-only-phase-a-validation-secret-0123456789';

const { generateToken, authenticateToken, authorizeAdmin } = require('./middlewares/auth');
const usuarioModel = require('./models/usuarioModel');
const usuarioController = require('./controllers/usuarioController');
const authController = require('./controllers/authController');

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

// 1. Teste de ausência de credenciais hardcoded
function testNoHardcodedCredentialsInMigrate() {
  const migratePath = path.join(__dirname, 'migrate.js');
  const content = fs.readFileSync(migratePath, 'utf8');

  assert.equal(
    content.includes('gateway01.sa-east-1.prod.aws.tidbcloud.com'),
    false,
    'migrate.js não pode conter host hardcoded do TiDB Cloud'
  );
  assert.equal(
    content.includes('HeM5cUxXcweZ747.root'),
    false,
    'migrate.js não pode conter usuário hardcoded'
  );
  assert.equal(
    content.includes('6SFCN7tOoUihsvtW'),
    false,
    'migrate.js não pode conter senha hardcoded'
  );
}

// 2. Teste de schema.sql: presença de consumivel_movimentacao e restrições de FK
function testSchemaIntegrity() {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const content = fs.readFileSync(schemaPath, 'utf8');

  assert.equal(
    content.includes('CREATE TABLE `consumivel_movimentacao`'),
    true,
    'schema.sql deve conter a definição canônica da tabela consumivel_movimentacao'
  );
  assert.equal(
    content.includes('DROP TABLE IF EXISTS `consumivel_movimentacao`'),
    true,
    'schema.sql deve conter consumivel_movimentacao na limpeza inicial de DROP TABLE'
  );
  assert.match(
    content,
    /CONSTRAINT `fk_reserva_usuario`[\s\S]*?ON DELETE RESTRICT/,
    'schema.sql deve ter ON DELETE RESTRICT para fk_reserva_usuario'
  );
  assert.match(
    content,
    /CONSTRAINT `fk_utilizacao_usuario`[\s\S]*?ON DELETE RESTRICT/,
    'schema.sql deve ter ON DELETE RESTRICT para fk_utilizacao_usuario'
  );
  assert.match(
    content,
    /CONSTRAINT `fk_ocorrencia_usuario`[\s\S]*?ON DELETE RESTRICT/,
    'schema.sql deve ter ON DELETE RESTRICT para fk_ocorrencia_usuario'
  );
}

// 3. Teste de autenticação: login com sucesso, login com senha incorreta e usuário inativo
async function testAuthLoginFlows() {
  const originalFindByEmail = usuarioModel.findByEmail;
  const originalVerifyPassword = usuarioModel.verifyPassword;

  // Mock usuário
  const mockUser = {
    id: 10,
    nome: 'Carlos Teste',
    email: 'carlos@teste.com',
    senha: '$2a$10$validhashedpasswordhere',
    perfil: 'usuario',
    status: 'ativo'
  };

  usuarioModel.findByEmail = async (email) => {
    if (email === mockUser.email) return { ...mockUser };
    return null;
  };
  usuarioModel.verifyPassword = async (pass, stored) => pass === 'senhaCorreta';

  const makeLoginReq = async (body) => {
    let statusCode = 200;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };
    await authController.login({ body }, res);
    return { statusCode, body: responseBody };
  };

  try {
    // Caso 1: Login com credenciais válidas
    const validLogin = await makeLoginReq({ email: 'carlos@teste.com', senha: 'senhaCorreta' });
    assert.equal(validLogin.statusCode, 200);
    assert.ok(validLogin.body.token, 'Token JWT deve ser gerado');
    assert.equal(validLogin.body.usuario.id, 10);
    assert.equal(validLogin.body.usuario.senha, undefined, 'Senha não deve ser retornada');

    // Caso 2: Login com senha incorreta
    const invalidPass = await makeLoginReq({ email: 'carlos@teste.com', senha: 'senhaErrada' });
    assert.equal(invalidPass.statusCode, 401);
    assert.equal(invalidPass.body.error, 'Credenciais inválidas');

    // Caso 3: Login com usuário inexistente
    const notFound = await makeLoginReq({ email: 'inexistente@teste.com', senha: 'senha' });
    assert.equal(notFound.statusCode, 401);

    // Caso 4: Login com usuário inativo
    mockUser.status = 'inativo';
    const inactiveLogin = await makeLoginReq({ email: 'carlos@teste.com', senha: 'senhaCorreta' });
    assert.equal(inactiveLogin.statusCode, 403);
    assert.match(inactiveLogin.body.error, /inativo/i);
    mockUser.status = 'ativo';
  } finally {
    usuarioModel.findByEmail = originalFindByEmail;
    usuarioModel.verifyPassword = originalVerifyPassword;
  }
}

// 4. Teste de inativação lógica de usuários e proteção contra auto-inativação
async function testUserInactivationAndSelfProtection() {
  const originalGetUserById = usuarioModel.getUserById;
  const originalInativarUsuario = usuarioModel.inativarUsuario;

  let updatedData = null;
  usuarioModel.getUserById = async (id) => ({
    id,
    nome: 'Admin User',
    email: 'admin@teste.com',
    perfil: 'admin',
    status: 'ativo'
  });
  usuarioModel.inativarUsuario = async (id) => {
    updatedData = { status: 'inativo', ativo: 0 };
    return { id, status: 'inativo', ativo: 0 };
  };

  const makeReq = async (controllerFn, req) => {
    let statusCode = 200;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };
    await controllerFn(req, res);
    return { statusCode, body: responseBody };
  };

  try {
    // 4.1 Bloqueio de auto-inativação do administrador conectado
    const selfInactivate = await makeReq(usuarioController.inativar, {
      user: { id: 1, perfil: 'admin' },
      params: { id: '1' },
      body: {}
    });
    assert.equal(selfInactivate.statusCode, 400);
    assert.match(selfInactivate.body.error, /própria conta/i);

    // 4.2 Inativação bem-sucedida de outro usuário (lógica, sem exclusão física)
    const inactivateOther = await makeReq(usuarioController.remove, {
      user: { id: 1, perfil: 'admin' },
      params: { id: '2' },
      body: { motivo: 'Preservação de histórico' }
    });
    assert.equal(inactivateOther.statusCode, 200);
    assert.match(inactivateOther.body.message, /inativado com sucesso/i);
    assert.equal(updatedData.status, 'inativo', 'Status do usuário deve ser atualizado para inativo');
    assert.equal(updatedData.ativo, 0, 'Flag ativo deve ser atualizada para 0');

    // 4.3 Validação de tamanho mínimo de senha
    const invalidPassCreate = await makeReq(usuarioController.create, {
      user: { id: 1, perfil: 'admin' },
      body: { nome: 'Novo', email: 'novo@teste.com', senha: '123' } // menor que 6 chars
    });
    assert.equal(invalidPassCreate.statusCode, 400);
    assert.match(invalidPassCreate.body.error, /mínimo 6 caracteres/i);
  } finally {
    usuarioModel.getUserById = originalGetUserById;
    usuarioModel.inativarUsuario = originalInativarUsuario;
  }
}

// 5. Teste de promoção segura de hash de senha legada
async function testLegacyPasswordUpgrade() {
  const dbHelper = require('./models/dbHelper');
  const originalUpdate = dbHelper.update;
  let hashUpdated = null;
  dbHelper.update = async (table, id, data) => {
    if (data.senha) hashUpdated = data.senha;
    return true;
  };

  try {
    // Simula validação com senha armazenada em texto puro
    const plainStored = 'plainTextPassword123';
    let upgraded = false;
    const match = await usuarioModel.verifyPassword('plainTextPassword123', plainStored, async () => {
      await usuarioModel.updatePasswordHash(5, 'plainTextPassword123');
      upgraded = true;
    });

    assert.equal(match, true);
    assert.equal(upgraded, true, 'Callback de atualização deve ter sido disparado');
    assert.ok(hashUpdated && hashUpdated.startsWith('$2a$'), 'Nova senha no banco deve ser hash bcrypt');
  } finally {
    dbHelper.update = originalUpdate;
  }
}

(async () => {
  console.log('--- EXECUTANDO TESTES DA FASE A (SEGURANÇA & CONFIABILIDADE) ---');
  await runTest('Ausência de credenciais hardcoded em migrate.js', testNoHardcodedCredentialsInMigrate);
  await runTest('Integridade do schema.sql e constraints RESTRICT para usuários', testSchemaIntegrity);
  await runTest('Fluxo de login, rejeição de credenciais inválidas e usuário inativo', testAuthLoginFlows);
  await runTest('Inativação lógica de usuários e bloqueio de auto-exclusão do admin', testUserInactivationAndSelfProtection);
  await runTest('Promoção automática de senha legada em texto plano para hash bcrypt', testLegacyPasswordUpgrade);
  console.log('--- TODOS OS TESTES DA FASE A PASSARAM COM SUCESSO! ---');
})().catch((err) => {
  console.error('\nFALHA NOS TESTES DA FASE A:', err);
  process.exit(1);
});
