const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-only-session-authorization-secret-0123456789';

const { generateToken, authenticateToken } = require('./middlewares/auth');
const usuarioModel = require('./models/usuarioModel');
const authController = require('./controllers/authController');

function authenticate(userRecord, tokenUser = { id: 12, perfil: 'usuario' }) {
  const original = usuarioModel.getUserById;
  let lookedUpId;
  usuarioModel.getUserById = async (id) => {
    lookedUpId = id;
    if (userRecord instanceof Error) throw userRecord;
    return userRecord;
  };

  const token = generateToken(tokenUser);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const result = new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body, user: req.user });
        return this;
      }
    };
    authenticateToken(req, res, () => resolve({
      statusCode: 200,
      user: req.user
    }));
  }).finally(() => {
    usuarioModel.getUserById = original;
  });

  return result.then((response) => ({ ...response, lookedUpId }));
}

async function testInactiveUserCannotLogin() {
  const originalFindByEmail = usuarioModel.findByEmail;
  const originalVerifyPassword = usuarioModel.verifyPassword;
  usuarioModel.findByEmail = async () => ({
    id: 12,
    nome: 'Usuário',
    email: 'user@example.com',
    senha: 'stored-password',
    perfil: 'usuario',
    status: 'inativo'
  });
  usuarioModel.verifyPassword = async () => true;

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
  try {
    await authController.login({
      body: { email: 'user@example.com', senha: 'correct-password' }
    }, response);
  } finally {
    usuarioModel.findByEmail = originalFindByEmail;
    usuarioModel.verifyPassword = originalVerifyPassword;
  }

  assert.equal(response.statusCode, 403);
  assert.equal(Object.prototype.hasOwnProperty.call(response.body, 'token'), false);
}

(async () => {
  const downgraded = await authenticate(
    { id: 12, nome: 'Usuário', perfil: 'usuario', status: 'ativo' },
    { id: 12, perfil: 'administrador' }
  );
  assert.equal(downgraded.statusCode, 200);
  assert.equal(downgraded.lookedUpId, 12);
  assert.equal(downgraded.user.perfil, 'usuario', 'O perfil atual do banco deve prevalecer sobre o JWT.');

  const inactive = await authenticate(
    { id: 12, perfil: 'administrador', status: 'inativo' },
    { id: 12, perfil: 'administrador' }
  );
  assert.equal(inactive.statusCode, 403, 'Usuários desativados não devem manter sessões válidas.');

  const deleted = await authenticate(null);
  assert.equal(deleted.statusCode, 401, 'Sessões de usuários removidos devem ser invalidadas.');

  const lookupFailure = await authenticate(new Error('database unavailable'));
  assert.equal(lookupFailure.statusCode, 503, 'Falha ao validar no banco não deve aceitar o token.');

  await testInactiveUserCannotLogin();
  console.log('Testes de revogação de sessão e atualização de autorização passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
