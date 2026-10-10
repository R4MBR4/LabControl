/**
 * Testes Automatizados - Fase E: Contas e Usuários
 * 
 * Validação do ciclo de vida:
 * cadastro -> confirmação -> login -> autorização -> inativação.
 */
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-phase-e-auth-secret-0123456789-abcdef';

const { pool } = require('./config/db');
const authController = require('./controllers/authController');
const usuarioModel = require('./models/usuarioModel');
const { authorizeAdmin } = require('./middlewares/auth');

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('======================================================');
  console.log('LABCONTROL - TESTES DA FASE E: CONTAS E USUÁRIOS');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${total}. ${name}`);
      console.error(`     Erro: ${err.message}`);
    }
  }

  const randSuffix = Math.floor(100000 + Math.random() * 900000);
  const emailValido = `discente_${randSuffix}@aluno.ufpi.edu.br`;
  const matriculaValida = `MAT-${randSuffix}`;
  let tokenConfirmacaoGerado = '';

  // 1. Cadastro Válido
  await test('Cadastro Válido: Cria usuário com status pendente e e-mail não confirmado', async () => {
    const req = {
      body: {
        nome: 'Aluno Teste Fase E',
        matricula: matriculaValida,
        email: emailValido,
        perfil: 'aluno',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
        departamento: 'Ciência da Computação'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 201, 'Deveria retornar 201 Created');
    assert.ok(res.data.pendenteConfirmacao, 'Deve indicar pendente de confirmação');
    assert.equal(res.data.tokenConfirmacao, undefined, 'NÃO deve expor o token de confirmação no payload');

    // Verifica no banco de dados
    const userInDb = await usuarioModel.findByEmail(emailValido);
    assert.ok(userInDb, 'Usuário deve existir no banco');
    assert.equal(userInDb.status, 'pendente');
    assert.equal(Number(userInDb.email_confirmado), 0);
    assert.ok(userInDb.token_confirmacao, 'Token deve existir internamente no banco');

    tokenConfirmacaoGerado = userInDb.token_confirmacao;
  });

  // 2. Cadastro Inválido: Campos obrigatórios ausentes
  await test('Cadastro Inválido: Rejeita quando faltam campos obrigatórios', async () => {
    const req = { body: { nome: 'Incompleto' } };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria retornar status 400');
    assert.ok(res.data.error, 'Deveria retornar mensagem de erro');
  });

  // 3. E-mail Inválido: Domínio não institucional
  await test('E-mail Inválido: Rejeita e-mails externos não institucionais (@gmail.com)', async () => {
    const req = {
      body: {
        nome: 'Tentativa Externa',
        matricula: `EXT-${randSuffix}`,
        email: 'usuario.externo@gmail.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria retornar 400 para e-mail não institucional');
    assert.match(res.data.error, /institucional/i);
  });

  // 4. Matrícula Duplicada
  await test('Matrícula Duplicada: Rejeita cadastro com matrícula já existente', async () => {
    const req = {
      body: {
        nome: 'Outro Aluno',
        matricula: matriculaValida, // Matrícula já usada no teste 1
        email: `outro_${randSuffix}@ufpi.edu.br`,
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria retornar 400 para matrícula duplicada');
    assert.match(res.data.error, /matrícula/i);
  });

  // 5. E-mail Duplicado
  await test('E-mail Duplicado: Rejeita cadastro com e-mail já registrado', async () => {
    const req = {
      body: {
        nome: 'Tentativa Duplicada',
        matricula: `DIFF-${randSuffix}`,
        email: emailValido, // E-mail já usado no teste 1
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria retornar 400 para e-mail duplicado');
    assert.match(res.data.error, /e-mail/i);
  });

  // 6. Senha Inválida (tamanho mínimo)
  await test('Senha Inválida: Rejeita senhas menores que 6 caracteres', async () => {
    const req = {
      body: {
        nome: 'Senha Curta',
        matricula: `SC-${randSuffix}`,
        email: `curta_${randSuffix}@ufpi.edu.br`,
        senha: '123',
        confirmacaoSenha: '123'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria retornar 400 para senha curta');
    assert.match(res.data.error, /mínimo 6/i);
  });

  // 7. Confirmação de Senha Divergente
  await test('Confirmação de Senha: Rejeita quando senha e confirmação divergem', async () => {
    const req = {
      body: {
        nome: 'Senha Divergente',
        matricula: `SD-${randSuffix}`,
        email: `diverg_${randSuffix}@ufpi.edu.br`,
        senha: 'senhaOriginal123',
        confirmacaoSenha: 'senhaDiferente456'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria retornar 400 para confirmação divergente');
    assert.match(res.data.error, /não coincidem/i);
  });

  // 8. Tentativa de Privilégio Administrativo no Cadastro Público
  await test('Segurança: Bloqueia tentativa de elevação de privilégio para administrador no cadastro público', async () => {
    const req = {
      body: {
        nome: 'Hacker Admin',
        matricula: `HACK-${randSuffix}`,
        email: `hacker_${randSuffix}@ufpi.edu.br`,
        perfil: 'administrador', // Tentativa maliciosa
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400, 'Deveria rejeitar escolha de admin no cadastro público');
    assert.match(res.data.error, /administrador não é permitido/i);
  });

  // 9. Login antes da Confirmação de E-mail
  await test('Login antes da Confirmação: Rejeita autenticação de conta com e-mail não confirmado', async () => {
    const req = {
      body: {
        email: emailValido,
        senha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.login(req, res);
    assert.equal(res.statusCode, 403, 'Deveria retornar 403 Forbidden antes da confirmação');
    assert.ok(res.data.pendenteConfirmacao, 'Deve indicar pendenteConfirmacao');
    assert.match(res.data.error, /não confirmado/i);
  });

  // 10. Confirmação de E-mail com Token Válido
  await test('Confirmação de E-mail: Valida token, ativa conta e limpa o token de uso único', async () => {
    const req = {
      body: {
        token: tokenConfirmacaoGerado
      }
    };
    const res = createMockRes();

    await authController.confirmarEmail(req, res);
    assert.equal(res.statusCode, 200, 'Deveria responder 200 OK');
    assert.match(res.data.message, /confirmado com sucesso/i);

    // Verifica no banco
    const userInDb = await usuarioModel.findByEmail(emailValido);
    assert.equal(Number(userInDb.email_confirmado), 1, 'email_confirmado deve ser 1');
    assert.equal(userInDb.status, 'ativo', 'status deve ser ativo');
    assert.equal(userInDb.token_confirmacao, null, 'token deve ser limpo após uso');
  });

  // 11. Login após a Confirmação de E-mail
  let jwtAluno = '';
  await test('Login após a Confirmação: Autentica com sucesso e emite JWT seguro', async () => {
    const req = {
      body: {
        email: emailValido,
        senha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.login(req, res);
    assert.equal(res.statusCode, 200, 'Deveria autenticar com sucesso');
    assert.ok(res.data.token, 'Deve retornar token JWT');
    assert.equal(res.data.usuario.senha, undefined, 'NÃO deve vazar senha');
    assert.equal(res.data.usuario.token_confirmacao, undefined, 'NÃO deve vazar token de confirmação');

    jwtAluno = res.data.token;
  });

  // 12. Usuário Inativo Bloqueado no Login
  await test('Usuário Inativo: Bloqueia autenticação quando status for inativo', async () => {
    const userInDb = await usuarioModel.findByEmail(emailValido);
    await usuarioModel.inativarUsuario(userInDb.id);

    const req = {
      body: {
        email: emailValido,
        senha: 'senhaSegura123'
      }
    };
    const res = createMockRes();

    await authController.login(req, res);
    assert.equal(res.statusCode, 403, 'Deveria retornar 403 para usuário inativo');
    assert.match(res.data.error, /inativo/i);

    // Reativa para os testes subsequentes
    await usuarioModel.reativarUsuario(userInDb.id);
  });

  // 13. Autorização de Endpoints: Bloqueio de Não-Admin
  await test('Autorização de Endpoints: Bloqueia usuário comum ao tentar ação administrativa', async () => {
    const req = {
      user: {
        id: 999,
        nome: 'Aluno Teste',
        perfil: 'aluno'
      }
    };
    const res = createMockRes();
    let nextCalled = false;

    authorizeAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'Middleware authorizeAdmin não deve chamar next() para aluno');
    assert.equal(res.statusCode, 403, 'Deveria responder 403 Forbidden');
    assert.match(res.data.error, /administrador/i);
  });

  console.log(`\n======================================================`);
  console.log(`RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Erro fatal nos testes:', err);
    pool.end();
    process.exit(1);
  });
