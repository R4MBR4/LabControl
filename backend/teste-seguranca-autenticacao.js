const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const backendDirectory = __dirname;
const authModulePath = path.join(backendDirectory, 'middlewares', 'auth');
const publishedSecret = 'labcontrol_secret_token_academico_2026';

function testJwtSecretConfiguration() {
  for (const secret of ['', 'short', publishedSecret]) {
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(authModulePath)})`], {
      cwd: backendDirectory,
      encoding: 'utf8',
      env: { ...process.env, JWT_SECRET: secret }
    });
    assert.notEqual(result.status, 0, `Expected JWT_SECRET ${JSON.stringify(secret)} to be rejected`);
    assert.match(`${result.stderr}${result.stdout}`, /JWT_SECRET deve ser configurado/);
  }

  const validSecretResult = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(authModulePath)})`], {
    cwd: backendDirectory,
    encoding: 'utf8',
    env: { ...process.env, JWT_SECRET: 'a'.repeat(64) }
  });
  assert.equal(validSecretResult.status, 0, validSecretResult.stderr);
}

async function testDatabaseFailureDoesNotIssueDemoToken() {
  process.env.JWT_SECRET = 'test-only-random-secret-value-0123456789';
  const usuarioModel = require('./models/usuarioModel');
  const authController = require('./controllers/authController');
  const originalFindByEmail = usuarioModel.findByEmail;
  const originalConsoleError = console.error;
  const response = {
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

  usuarioModel.findByEmail = async () => {
    const error = new Error('database unavailable');
    error.code = 'ECONNREFUSED';
    throw error;
  };
  console.error = () => {};

  try {
    await authController.login({
      body: { email: 'attacker-admin@example.com', senha: 'arbitrary-password' }
    }, response);
  } finally {
    usuarioModel.findByEmail = originalFindByEmail;
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    error: 'Não foi possível autenticar no momento. Tente novamente.'
  });
  assert.equal(Object.prototype.hasOwnProperty.call(response.body, 'token'), false);
}

(async () => {
  testJwtSecretConfiguration();
  await testDatabaseFailureDoesNotIssueDemoToken();
  console.log('Testes de segurança de autenticação passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
