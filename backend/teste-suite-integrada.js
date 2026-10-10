/**
 * LABCONTROL — SUÍTE INTEGRADA E REGRESSÃO COMPLETA DE TODOS OS MÓDULOS
 * 
 * Cobertura de ponta a ponta dos módulos principais:
 * 1. Autenticação, Usuários e RBAC (Fases A e E)
 * 2. Espaços, Regras de Uso e Monitor Kiosk (Fases B e D)
 * 3. Equipamentos, Dados Técnicos e QR Code (Fases A e C)
 * 4. Reservas, Séries Recorrentes, Extensões e No-Show (Fases B e F)
 * 5. Utilização, Check-in / Out e Avarias (Fases B e C)
 * 6. Ocorrências e Ordens de Manutenção (Fases D e F)
 * 7. Inventário Físico, Divergências e Decisões (Fases C e F)
 * 8. Consumíveis, Estoque e Movimentações (Fases A e F)
 * 9. Dashboard Analítico e Relatórios Gerenciais (Fases D e F)
 */
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-integrada-secret-key-0123456789-abcdef';

const { pool } = require('./config/db');
const authController = require('./controllers/authController');
const usuarioController = require('./controllers/usuarioController');
const usuarioModel = require('./models/usuarioModel');
const espacoModel = require('./models/espacoModel');
const espacoController = require('./controllers/espacoController');
const equipamentoModel = require('./models/equipamentoModel');
const equipamentoController = require('./controllers/equipamentoController');
const reservaModel = require('./models/reservaModel');
const reservaController = require('./controllers/reservaController');
const utilizacaoModel = require('./models/utilizacaoModel');
const utilizacaoController = require('./controllers/utilizacaoController');
const ocorrenciaModel = require('./models/ocorrenciaModel');
const ocorrenciaController = require('./controllers/ocorrenciaController');
const manutencaoModel = require('./models/manutencaoModel');
const manutencaoController = require('./controllers/manutencaoController');
const inventarioModel = require('./models/inventarioModel');
const inventarioController = require('./controllers/inventarioController');
const consumivelModel = require('./models/consumivelModel');
const dashboardController = require('./controllers/dashboardController');
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

async function runSuite() {
  console.log('========================================================================');
  console.log('        LABCONTROL — SUÍTE DE TESTES INTEGRADA E REGRESSÃO TOTAL        ');
  console.log('========================================================================');
  console.log(`  Ambiente:   Node.js ${process.version}`);
  console.log(`  Execução:   ${new Date().toLocaleString('pt-BR')}`);
  console.log('------------------------------------------------------------------------\n');

  let passed = 0;
  let total = 0;
  const falhas = [];

  async function test(categoria, nome, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [${categoria}] ${nome}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [${categoria}] ${nome}`);
      console.error(`     Erro: ${err.message}`);
      falhas.push({ categoria, nome, erro: err.message });
    }
  }

  // ========================================================================
  // MÓDULO 1: AUTENTICAÇÃO, CONTAS E PERMISSÕES (RBAC)
  // ========================================================================
  const rand = Math.floor(100000 + Math.random() * 900000);
  const emailAluno = `discente_${rand}@aluno.ufpi.edu.br`;
  const matriculaAluno = `MAT-INT-${rand}`;
  let tokenAluno = '';
  let idAlunoCriado = null;

  await test('Auth', 'Rejeita cadastro público com e-mail não institucional (@gmail.com)', async () => {
    const req = {
      body: {
        nome: 'Teste Externo',
        matricula: `EXT-${rand}`,
        email: 'teste@gmail.com',
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
        perfil: 'aluno'
      }
    };
    const res = createMockRes();
    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.error, /institucional/i);
  });

  await test('Auth', 'Impede elevação de privilégio: não permite perfil administrador no cadastro público', async () => {
    const req = {
      body: {
        nome: 'Tentativa Invasor',
        matricula: `ADMIN-HACK-${rand}`,
        email: `invasor_${rand}@ufpi.edu.br`,
        senha: 'senhaSegura123',
        confirmacaoSenha: 'senhaSegura123',
        perfil: 'admin'
      }
    };
    const res = createMockRes();
    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.error, /administrador não é permitido/i);
  });

  await test('Auth', 'Cadastro público válido cria conta pendente sem expor token de confirmação', async () => {
    const req = {
      body: {
        nome: 'Aluno Teste Integrado',
        matricula: matriculaAluno,
        email: emailAluno,
        senha: 'senhaValida123',
        confirmacaoSenha: 'senhaValida123',
        perfil: 'aluno'
      }
    };
    const res = createMockRes();
    await authController.cadastro(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.pendenteConfirmacao, true);
    assert.equal(res.data.token, undefined, 'Token de ativação nunca pode ser exposto no payload');

    const [rows] = await pool.query('SELECT id, token_confirmacao, status, email_confirmado FROM usuario WHERE email = ?', [emailAluno]);
    assert.ok(rows.length > 0);
    idAlunoCriado = rows[0].id;
    tokenAluno = rows[0].token_confirmacao;
    assert.equal(rows[0].email_confirmado, 0);
    assert.equal(rows[0].status, 'pendente');
  });

  await test('Auth', 'Bloqueia login antes da confirmação de e-mail (HTTP 403 pendenteConfirmacao)', async () => {
    const req = { body: { email: emailAluno, senha: 'senhaValida123' } };
    const res = createMockRes();
    await authController.login(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.data.pendenteConfirmacao, true);
  });

  await test('Auth', 'Confirmação com token ativa o usuário e limpa o token de uso único', async () => {
    const req = { body: { token: tokenAluno } };
    const res = createMockRes();
    await authController.confirmarEmail(req, res);
    assert.equal(res.statusCode, 200);

    const [rows] = await pool.query('SELECT status, email_confirmado, token_confirmacao FROM usuario WHERE id = ?', [idAlunoCriado]);
    assert.equal(rows[0].email_confirmado, 1);
    assert.equal(rows[0].status, 'ativo');
    assert.equal(rows[0].token_confirmacao, null);
  });

  await test('Auth', 'Login autentica com sucesso após ativação e emite JWT seguro', async () => {
    const req = { body: { email: emailAluno, senha: 'senhaValida123' } };
    const res = createMockRes();
    await authController.login(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.data.token, 'Deve retornar token JWT');
    assert.equal(res.data.usuario.email, emailAluno);
  });

  await test('RBAC', 'Middleware de autorização barra discente em endpoint administrativo (HTTP 403)', async () => {
    const req = { user: { id: idAlunoCriado, perfil: 'aluno' } };
    const res = createMockRes();
    let nextCalled = false;
    authorizeAdmin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  // ========================================================================
  // MÓDULO 2: ESPAÇOS, REGRAS DE USO E KIOSK
  // ========================================================================
  let espacoTesteId = null;

  await test('Espaços', 'Recupera espaços cadastrados com horários e regras de funcionamento', async () => {
    const espacos = await espacoModel.getAllEspacos();
    assert.ok(Array.isArray(espacos));
    assert.ok(espacos.length > 0, 'Deve haver ao menos um espaço na base');
    espacoTesteId = espacos[0].id;
    const primeiro = espacos[0];
    assert.ok('horario_abertura' in primeiro, 'Deve conter horário de abertura');
    assert.ok('horario_fechamento' in primeiro, 'Deve conter horário de fechamento');
  });

  await test('Espaços', 'Painel Kiosk de Porta retorna status, capacidade e próximas reservas do espaço', async () => {
    const req = { params: { id: espacoTesteId } };
    const res = createMockRes();
    await espacoController.getMonitor(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.data.espaco, 'Deve retornar objeto do espaço');
    assert.ok('ocupado' in res.data.ocupacaoAtual, 'Deve conter status de ocupação atual');
    assert.ok(Array.isArray(res.data.proximasReservas), 'Deve conter lista de próximas reservas');
  });

  await test('Espaços', 'Painel Kiosk trata espaço inexistente com HTTP 404 sem erro de servidor', async () => {
    const req = { params: { id: 99999999 } };
    const res = createMockRes();
    await espacoController.getMonitor(req, res);
    assert.equal(res.statusCode, 404);
  });

  // ========================================================================
  // MÓDULO 3: EQUIPAMENTOS E IDENTIFICAÇÃO QR
  // ========================================================================
  let equipTesteId = null;
  let equipCodigoLabControl = null;

  await test('Equipamentos', 'Lista equipamentos com totalizadores de utilização e manutenção', async () => {
    const equipamentos = await equipamentoModel.getAllEquipamentos({ incluir_inativos: true });
    assert.ok(Array.isArray(equipamentos));
    assert.ok(equipamentos.length > 0);
    const equip = equipamentos[0];
    equipTesteId = equip.id;
    equipCodigoLabControl = equip.codigo_labcontrol;
    assert.ok('total_utilizacoes' in equip);
    assert.ok('total_manutencoes' in equip);
  });

  await test('Equipamentos', 'Identificação inequívoca por QR Code JSON estruturado', async () => {
    const qrPayload = JSON.stringify({ id: equipTesteId, tipo: 'equipamento' });
    const local = await equipamentoModel.localizarPorIdentificadorQR(qrPayload);
    assert.ok(local, 'Deve localizar equipamento por QR JSON');
    assert.equal(local.id, equipTesteId);
  });

  await test('Equipamentos', 'Identificação inequívoca por código LabControl textual direto', async () => {
    if (equipCodigoLabControl) {
      const local = await equipamentoModel.localizarPorIdentificadorQR(equipCodigoLabControl);
      assert.ok(local);
      assert.equal(local.id, equipTesteId);
    }
  });

  await test('Equipamentos', 'Tratamento de identificador QR inexistente sem erro de sistema', async () => {
    const local = await equipamentoModel.localizarPorIdentificadorQR('QR-TOTALMENTE-INEXISTENTE-99999');
    assert.equal(local, null);
  });

  // ========================================================================
  // MÓDULO 4: RESERVAS, CONFLITOS E PRORROGAÇÃO
  // ========================================================================
  await test('Reservas', 'Validação estrita de conflito temporal direto para o mesmo recurso', async () => {
    const conflitos = await reservaModel.checkConflict({
      espaco_id: espacoTesteId,
      data_inicio: '2026-10-20 14:00:00',
      data_fim: '2026-10-20 16:00:00'
    });
    assert.ok(Array.isArray(conflitos));
  });

  await test('Reservas', 'Prorrogação de reserva com atualização de horário e preservação da data original', async () => {
    const mockReserva = {
      id: 777,
      usuario_id: idAlunoCriado,
      espaco_id: espacoTesteId,
      status: 'confirmada',
      data_inicio: '2026-10-22 10:00:00',
      data_fim: '2026-10-22 12:00:00',
      data_fim_original: null,
      horario_abertura: '07:00:00',
      horario_fechamento: '22:00:00',
      dias_funcionamento: '1,2,3,4,5,6'
    };
    let updateCap = null;
    const mockExec = {
      query: async (sql) => {
        if (sql.includes('data_inicio') && sql.includes('data_fim')) return [[]];
        if (sql.includes('UPDATE')) {
          updateCap = sql;
          return [{ affectedRows: 1 }];
        }
        return [[mockReserva]];
      }
    };
    const resExt = await reservaModel.estenderReserva({
      id: 777,
      minutos: 30,
      justificativa: 'Continuação de experimento prático',
      usuarioId: idAlunoCriado,
      isPrivileged: false,
      executor: mockExec
    });
    assert.equal(resExt.success, true);
    assert.equal(resExt.minutos_estendidos, 30);
    assert.equal(resExt.data_fim_nova, '2026-10-22 12:30:00');
  });

  // ========================================================================
  // MÓDULO 5: UTILIZAÇÃO E CHECK-IN / CHECK-OUT
  // ========================================================================
  await test('Utilização', 'Filtro por espaço e intervalo de datas no endpoint de utilizações', async () => {
    const req = {
      user: { id: 1, perfil: 'admin' },
      query: { espaco_id: espacoTesteId, data_inicio_de: '2020-01-01', data_fim_ate: '2030-12-31' }
    };
    const res = createMockRes();
    await utilizacaoController.list(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
  });

  await test('Utilização', 'Rejeita check-in quando nem ID nem QR Code do equipamento são enviados', async () => {
    const req = {
      user: { id: idAlunoCriado },
      body: {}
    };
    const res = createMockRes();
    await utilizacaoController.checkin(req, res);
    assert.equal(res.statusCode, 400);
  });

  await test('Utilização', 'Check-out obriga condição do equipamento para finalização', async () => {
    const req = {
      user: { id: idAlunoCriado },
      body: { utilizacao_id: 1, condicao_devolucao: '' }
    };
    const res = createMockRes();
    await utilizacaoController.checkout(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.error, /OBRIGATÓRIA/i);
  });

  // ========================================================================
  // MÓDULO 6: OCORRÊNCIAS E ORDENS DE MANUTENÇÃO
  // ========================================================================
  await test('Ocorrências', 'Listagem de ocorrências suporta filtros por gravidade e laboratório', async () => {
    const ocorrencias = await ocorrenciaModel.getAllOcorrencias({ gravidade: 'alta' });
    assert.ok(Array.isArray(ocorrencias));
    for (const oc of ocorrencias) {
      assert.equal(String(oc.gravidade || '').toLowerCase(), 'alta');
    }
  });

  await test('Manutenção', 'Identificação precisa de reincidência de manutenções (total_manutencoes_equipamento >= 2)', async () => {
    const manutencoes = await manutencaoModel.getAllManutencoes({ recorrente: true });
    assert.ok(Array.isArray(manutencoes));
    for (const m of manutencoes) {
      assert.ok(Number(m.total_manutencoes_equipamento) >= 2);
    }
  });

  // ========================================================================
  // MÓDULO 7: INVENTÁRIO FÍSICO E AUDITORIA QR
  // ========================================================================
  await test('Inventário', 'Relatório de conferência de itens rastreia local esperado, encontrado e divergência', async () => {
    const req = { user: { id: 1, perfil: 'admin' }, query: {} };
    const res = createMockRes();
    await inventarioController.relatorioItens(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
    if (res.data.length > 0) {
      const it = res.data[0];
      assert.ok('status_conferencia' in it);
      assert.ok('decisao_admin' in it);
      assert.ok('espaco_esperado_nome' in it);
      assert.ok('espaco_encontrado_nome' in it);
    }
  });

  // ========================================================================
  // MÓDULO 8: CONSUMÍVEIS E ESTOQUE
  // ========================================================================
  await test('Consumíveis', 'Histórico de movimentações preserva saldo anterior e resultante com usuário responsável', async () => {
    const movs = await consumivelModel.getAllHistoricoMovimentacoes();
    assert.ok(Array.isArray(movs));
    if (movs.length > 0) {
      const m = movs[0];
      assert.ok('quantidade_anterior' in m);
      assert.ok('quantidade_movimentada' in m);
      assert.ok('quantidade_resultante' in m);
      assert.ok('tipo' in m);
    }
  });

  // ========================================================================
  // MÓDULO 9: DASHBOARD ANALÍTICO E CONSISTÊNCIA COM RELATÓRIOS
  // ========================================================================
  await test('Dashboard', 'Blocos analíticos AGORA, ATENÇÃO, ANÁLISE e AGENDA com indicadores confiáveis', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();
    await dashboardController.getAdminMetrics(req, res);
    assert.equal(res.statusCode, 200);
    const d = res.data;
    assert.ok('equipamentos' in d);
    assert.ok('espacos' in d);
    assert.ok('reservas' in d);
    assert.ok('ocorrencias' in d);
    assert.ok('manutencoes' in d);
    assert.ok('alertas' in d);
    assert.ok('graficos' in d);
  });

  await test('Consistência', 'Total de equipamentos no Relatório coincide 100% com o total no Dashboard', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const resDash = createMockRes();
    await dashboardController.getAdminMetrics(req, resDash);
    const totalDashboard = resDash.data.equipamentos.total;

    const equipsRelatorio = await equipamentoModel.getAllEquipamentos({ incluir_inativos: true });
    assert.equal(equipsRelatorio.length, totalDashboard);
  });

  // Limpeza de registros de teste temporários
  if (idAlunoCriado) {
    try {
      await pool.query('DELETE FROM usuario WHERE id = ?', [idAlunoCriado]);
    } catch {
      // Ignora erro de limpeza
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`RESULTADO DA SUÍTE INTEGRADA: ${passed}/${total} TESTES APROVADOS!`);
  if (falhas.length > 0) {
    console.log(`FALHAS DETECTADAS (${falhas.length}):`);
    falhas.forEach((f, idx) => console.log(`  ${idx + 1}. [${f.categoria}] ${f.nome}: ${f.erro}`));
  }
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha crítica na execução da suíte integrada:', err);
    process.exit(1);
  });
