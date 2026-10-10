/**
 * Testes Automatizados - Fase D: UX, Dashboard e Experiência
 * 
 * Validação de contratos de dados, endpoints do dashboard de gestão,
 * painel de ocupação (kiosk) e integridade de respostas da API.
 */
const assert = require('node:assert/strict');
const { pool } = require('./config/db');
const dashboardController = require('./controllers/dashboardController');
const espacoController = require('./controllers/espacoController');
const espacoModel = require('./models/espacoModel');

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
  console.log('=================================================');
  console.log('LABCONTROL - TESTES DA FASE D: UX, DASHBOARD & KIOSK');
  console.log('=================================================\n');

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

  // 1. Dashboard: Estrutura do bloco AGORA (capacidade instalada e ocupação atual)
  await test('Dashboard: Estrutura do bloco AGORA (situação operacional atual)', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();

    await dashboardController.getAdminMetrics(req, res);
    assert.equal(res.statusCode, 200, 'Deveria responder status 200');

    const data = res.data;
    assert.ok(data.equipamentos, 'Deve conter objeto equipamentos');
    assert.equal(typeof data.equipamentos.total, 'number');
    assert.equal(typeof data.equipamentos.disponiveis, 'number');
    assert.equal(typeof data.equipamentos.em_uso, 'number');
    assert.equal(typeof data.equipamentos.manutencao, 'number');
    assert.equal(typeof data.equipamentos.inativos, 'number');

    assert.ok(data.espacos, 'Deve conter objeto espacos');
    assert.equal(typeof data.espacos.total, 'number');
    assert.equal(typeof data.espacos.disponiveis, 'number');
    assert.equal(typeof data.espacos.ocupados, 'number');

    assert.ok(Array.isArray(data.em_utilizacao_agora), 'em_utilizacao_agora deve ser um array');
  });

  // 2. Dashboard: Estrutura do bloco ATENÇÃO (alertas acionáveis e direcionamento)
  await test('Dashboard: Estrutura do bloco ATENÇÃO com alertas direcionados para ação', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();

    await dashboardController.getAdminMetrics(req, res);
    const alertas = res.data.alertas;
    assert.ok(alertas, 'Deve conter objeto alertas');

    const requiredKeys = [
      'ocorrencias_abertas',
      'divergencias_localizacao',
      'manutencoes_pendentes',
      'estoque_baixo',
      'no_shows',
      'capacitacoes_vencidas'
    ];

    for (const key of requiredKeys) {
      assert.equal(typeof alertas[key], 'number', `Alerta ${key} deve ser número`);
    }
  });

  // 3. Dashboard: Estrutura do bloco ANÁLISE (gráficos que respondem perguntas reais)
  await test('Dashboard: Estrutura do bloco ANÁLISE (perguntas gerenciais reais)', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();

    await dashboardController.getAdminMetrics(req, res);
    const { graficos, manutencoes } = res.data;
    assert.ok(graficos, 'Deve conter objeto graficos');

    // 1. Demanda temporal e no-shows
    assert.ok(Array.isArray(graficos.reservas_ultimos_7_dias), 'reservas_ultimos_7_dias deve ser array');
    assert.ok(Array.isArray(graficos.no_shows_ultimos_7_dias), 'no_shows_ultimos_7_dias deve ser array');

    // 2. Carga por laboratório
    assert.ok(Array.isArray(graficos.utilizacao_por_laboratorio), 'utilizacao_por_laboratorio deve ser array');

    // 3. Perfil de gravidade das ocorrências
    assert.ok(Array.isArray(graficos.ocorrencias_por_gravidade), 'ocorrencias_por_gravidade deve ser array');

    // 4. Manutenção por status e tempo médio
    assert.ok(Array.isArray(graficos.manutencoes_por_status), 'manutencoes_por_status deve ser array');
    assert.ok('tempo_medio_horas' in manutencoes, 'tempo_medio_horas deve existir');
  });

  // 4. Dashboard: Estrutura do bloco AGENDA (próximas reservas e cronograma)
  await test('Dashboard: Estrutura do bloco AGENDA com próximas reservas', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();

    await dashboardController.getAdminMetrics(req, res);
    assert.ok(Array.isArray(res.data.proximas_reservas), 'proximas_reservas deve ser array');
  });

  // 5. Painel de Ocupação (Modo Kiosk da Porta): Consulta de status e agenda
  await test('Painel de Ocupação (Kiosk de Porta): Consulta de status e reservas na entrada do espaço', async () => {
    const [espacos] = await pool.query('SELECT id, nome, codigo FROM espaco LIMIT 1');
    assert.ok(espacos.length > 0, 'Deve existir ao menos um espaço para teste');
    const espacoId = espacos[0].id;

    const req = { params: { id: espacoId } };
    const res = createMockRes();

    await espacoController.getMonitor(req, res);
    assert.equal(res.statusCode, 200, 'Deveria responder status 200');

    const data = res.data;
    assert.ok(data.espaco, 'Deve retornar dados do espaço');
    assert.ok(data.espaco.nome, 'Espaço deve ter nome');
    assert.equal(typeof data.ocupacaoAtual?.ocupado, 'boolean', 'ocupacaoAtual.ocupado deve ser booleano');
    assert.ok(Array.isArray(data.proximasReservas), 'proximasReservas deve ser array');
    assert.ok(data.estatisticasEquipamentos, 'estatisticasEquipamentos deve estar presente');
  });

  // 6. Integridade: Tratamento de espaço inexistente no Painel de Ocupação
  await test('Painel de Ocupação: Tratamento adequado de espaço inexistente (HTTP 404)', async () => {
    const req = { params: { id: 99999999 } };
    const res = createMockRes();

    await espacoController.getMonitor(req, res);
    assert.equal(res.statusCode, 404, 'Deveria responder 404 para espaço inexistente');
    assert.ok(res.data.error, 'Deveria retornar mensagem descritiva de erro');
  });

  // 7. Integridade: Ausência de dados fictícios em estados vazios
  await test('Integridade de dados: Não inventar registros em estados analíticos vazios', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();

    await dashboardController.getAdminMetrics(req, res);
    const g = res.data.graficos;
    for (const key of Object.keys(g)) {
      if (Array.isArray(g[key])) {
        for (const item of g[key]) {
          assert.notEqual(item, null, `Item do gráfico ${key} não pode ser nulo`);
          assert.equal(typeof item, 'object', `Item do gráfico ${key} deve ser objeto válido`);
        }
      }
    }
  });

  console.log(`\n=================================================`);
  console.log(`RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log(`=================================================\n`);

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
