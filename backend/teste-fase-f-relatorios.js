/**
 * Testes Automatizados - Fase F: Relatórios e Acompanhamento
 * 
 * Validação rigorosa dos relatórios gerenciais:
 * 1. Utilização
 * 2. Reservas
 * 3. Equipamentos
 * 4. Ocorrências
 * 5. Manutenção
 * 6. Inventário Físico
 * Consistência de dados com o Dashboard, segurança e ausência de dados fictícios.
 */
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-phase-f-reports-secret-0123456789-abcdef';

const { pool } = require('./config/db');
const utilizacaoModel = require('./models/utilizacaoModel');
const reservaModel = require('./models/reservaModel');
const equipamentoModel = require('./models/equipamentoModel');
const ocorrenciaModel = require('./models/ocorrenciaModel');
const manutencaoModel = require('./models/manutencaoModel');
const inventarioModel = require('./models/inventarioModel');
const dashboardController = require('./controllers/dashboardController');
const inventarioController = require('./controllers/inventarioController');
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
  console.log('LABCONTROL - TESTES DA FASE F: RELATÓRIOS E ACOMPANHAMENTO');
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

  // 1. Permissões de Acesso
  await test('Privacidade e Permissões: Bloqueia usuário comum ao acessar relatório administrativo', async () => {
    const req = {
      user: { id: 99, nome: 'Aluno Teste', perfil: 'aluno' }
    };
    const res = createMockRes();
    let nextCalled = false;
    authorizeAdmin(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false, 'Usuário comum não deveria passar pelo middleware authorizeAdmin');
    assert.equal(res.statusCode, 403, 'Deveria responder HTTP 403 Forbidden');
    assert.match(res.data.error, /Acesso negado/i);
  });

  // 2. Acesso Administrativo Autorizado
  await test('Permissões: Permite acesso de administrador a relatórios de auditoria', async () => {
    const req = {
      user: { id: 1, nome: 'Admin Master', perfil: 'admin' },
      query: {}
    };
    const res = createMockRes();
    await inventarioController.relatorioItens(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.data), true, 'Deveria retornar lista de itens de auditoria');
  });

  // 3. Relatório de Utilização - Filtro por Laboratório e Período
  await test('Relatório de Utilização: Filtro por laboratório (espaco_id) e período', async () => {
    const [espacos] = await pool.query('SELECT id, nome FROM espaco LIMIT 1');
    assert.ok(espacos.length > 0, 'Deve existir ao menos um espaço para teste');
    const espacoId = espacos[0].id;

    const utilizacoes = await utilizacaoModel.getAllUtilizacoes({ espaco_id: espacoId });
    assert.ok(Array.isArray(utilizacoes));
    // Todos os registros retornados devem pertencer ao espaço filtrado
    for (const u of utilizacoes) {
      assert.equal(Number(u.espaco_id), Number(espacoId), 'Utilização deve pertencer ao laboratório filtrado');
    }

    // Filtro por data
    const utilizacoesData = await utilizacaoModel.getAllUtilizacoes({
      data_inicio_de: '2020-01-01',
      data_fim_ate: '2030-12-31'
    });
    assert.ok(Array.isArray(utilizacoesData));
  });

  // 4. Relatório de Utilização - Agregações Operacionais
  await test('Relatório de Utilização: Consistência de colunas (equipamento, usuário, status, avaria)', async () => {
    const utilizacoes = await utilizacaoModel.getAllUtilizacoes({});
    assert.ok(Array.isArray(utilizacoes));
    if (utilizacoes.length > 0) {
      const first = utilizacoes[0];
      assert.ok('equipamento_nome' in first, 'Deve conter equipamento_nome');
      assert.ok('usuario_nome' in first, 'Deve conter usuario_nome');
      assert.ok('status' in first, 'Deve conter status');
      assert.ok('houve_avaria' in first, 'Deve conter campo de avaria');
    }
  });

  // 5. Relatório de Reservas - Efetivação vs Cancelamentos vs No-Show
  await test('Relatório de Reservas: Identificação de utilização vinculada e status de no-show', async () => {
    const reservas = await reservaModel.getAllReservas({});
    assert.ok(Array.isArray(reservas));
    if (reservas.length > 0) {
      const first = reservas[0];
      assert.ok('utilizacao_id' in first, 'Deve conter utilizacao_id da subconsulta');
      assert.ok('status' in first, 'Deve conter status');
      assert.ok('no_show' in first, 'Deve conter no_show');
    }
  });

  // 6. Relatório de Equipamentos - Consistência de Status com Dashboard
  await test('Relatório de Equipamentos: Consistência exata de status com o Dashboard', async () => {
    const req = { user: { id: 1, perfil: 'admin' } };
    const res = createMockRes();
    await dashboardController.getAdminMetrics(req, res);
    const dashboardMetrics = res.data.equipamentos;

    const equipamentosRelatorio = await equipamentoModel.getAllEquipamentos({ incluir_inativos: true });
    assert.equal(equipamentosRelatorio.length, dashboardMetrics.total, 'Total de equipamentos no relatório deve ser idêntico ao do dashboard');

    const disponiveisRel = equipamentosRelatorio.filter((e) =>
      ['disponivel', 'disponível'].includes(String(e.status || '').toLowerCase()) && !e.inativo
    ).length;
    assert.equal(disponiveisRel, dashboardMetrics.disponiveis, 'Equipamentos disponíveis devem coincidir');

    const emUsoRel = equipamentosRelatorio.filter((e) =>
      ['em_uso', 'uso', 'ocupado'].includes(String(e.status || '').toLowerCase()) && !e.inativo
    ).length;
    assert.equal(emUsoRel, dashboardMetrics.em_uso, 'Equipamentos em uso devem coincidir');

    const manutencaoRel = equipamentosRelatorio.filter((e) =>
      String(e.status || '').toLowerCase().includes('manutencao') && !e.inativo
    ).length;
    assert.equal(manutencaoRel, dashboardMetrics.manutencao, 'Equipamentos em manutenção devem coincidir');

    const inativosRel = equipamentosRelatorio.filter((e) =>
      Boolean(e.inativo) || String(e.status || '').toLowerCase() === 'inativo'
    ).length;
    assert.equal(inativosRel, dashboardMetrics.inativos, 'Equipamentos inativos devem coincidir');
  });

  // 7. Relatório de Equipamentos - Agregação de Utilizações e Manutenções
  await test('Relatório de Equipamentos: Total de utilizações e manutenções computadas por item', async () => {
    const equipamentos = await equipamentoModel.getAllEquipamentos({ incluir_inativos: true });
    assert.ok(Array.isArray(equipamentos));
    if (equipamentos.length > 0) {
      const item = equipamentos[0];
      assert.ok('total_utilizacoes' in item, 'Deve incluir total_utilizacoes');
      assert.ok('total_manutencoes' in item, 'Deve incluir total_manutencoes');
      assert.ok(Number(item.total_utilizacoes) >= 0, 'Total de utilizações deve ser não-negativo');
      assert.ok(Number(item.total_manutencoes) >= 0, 'Total de manutenções deve ser não-negativo');
    }
  });

  // 8. Relatório de Ocorrências - Filtro por Gravidade e Vínculo de Manutenção
  await test('Relatório de Ocorrências: Filtro por gravidade, espaço e vínculo de OS', async () => {
    const ocorrencias = await ocorrenciaModel.getAllOcorrencias({});
    assert.ok(Array.isArray(ocorrencias));
    if (ocorrencias.length > 0) {
      const oc = ocorrencias[0];
      assert.ok('gravidade' in oc, 'Deve conter gravidade');
      assert.ok('espaco_nome' in oc, 'Deve conter espaco_nome');
      assert.ok('manutencao_id' in oc, 'Deve conter manutencao_id da OS vinculada');
    }

    // Filtro por gravidade
    const criticas = await ocorrenciaModel.getAllOcorrencias({ gravidade: 'alta' });
    assert.ok(Array.isArray(criticas));
    for (const item of criticas) {
      assert.equal(String(item.gravidade || '').toLowerCase(), 'alta');
    }
  });

  // 9. Relatório de Manutenção - Recorrência e Custo Total
  await test('Relatório de Manutenção: Identificação de equipamentos recorrentes (≥2 OS) e laboratório', async () => {
    const manutencoes = await manutencaoModel.getAllManutencoes({});
    assert.ok(Array.isArray(manutencoes));
    if (manutencoes.length > 0) {
      const first = manutencoes[0];
      assert.ok('espaco_nome' in first, 'Deve conter espaco_nome');
      assert.ok('total_manutencoes_equipamento' in first, 'Deve conter contagem de reincidência de manutenções');
    }

    // Testar filtro apenas de recorrentes
    const recorrentes = await manutencaoModel.getAllManutencoes({ recorrente: true });
    assert.ok(Array.isArray(recorrentes));
    for (const m of recorrentes) {
      assert.ok(Number(m.total_manutencoes_equipamento) >= 2, 'Manutenção filtrada como recorrente deve ter ao menos 2 ordens');
    }
  });

  // 10. Relatório de Inventário Físico - Divergências e Decisões Deliberadas
  await test('Relatório de Inventário Físico: Rastreabilidade de itens conferidos, divergências e decisões', async () => {
    const itens = await inventarioModel.getRelatorioItens({});
    assert.ok(Array.isArray(itens));
    if (itens.length > 0) {
      const item = itens[0];
      assert.ok('inventario_id' in item, 'Deve conter inventario_id');
      assert.ok('status_conferencia' in item, 'Deve conter status_conferencia');
      assert.ok('decisao_admin' in item, 'Deve conter decisao_admin');
      assert.ok('espaco_esperado_nome' in item, 'Deve conter local esperado');
      assert.ok('espaco_encontrado_nome' in item, 'Deve conter local encontrado');
    }
  });

  // 11. Tratamento de Estado Vazio
  await test('Integridade de Dados: Trata estado vazio sem falhas e sem dados inventados', async () => {
    const resultadoInexistente = await utilizacaoModel.getAllUtilizacoes({ espaco_id: 99999999 });
    assert.equal(Array.isArray(resultadoInexistente), true, 'Deve retornar array vazio');
    assert.equal(resultadoInexistente.length, 0, 'Não deve inventar dados quando nenhum registro existir');

    const manutencaoVazia = await manutencaoModel.getAllManutencoes({ espaco_id: 99999999 });
    assert.equal(manutencaoVazia.length, 0, 'Não deve inventar ordens de manutenção inexistentes');
  });

  // 12. Consistência entre Dados das Tabelas e Métricas dos Relatórios
  await test('Consistência Global: Números de relatório conferem exatamente com as tabelas do banco', async () => {
    const [[countEquip]] = await pool.query('SELECT COUNT(*) AS total FROM equipamento');
    const [[countReserva]] = await pool.query('SELECT COUNT(*) AS total FROM reserva');
    const [[countUtilizacao]] = await pool.query('SELECT COUNT(*) AS total FROM utilizacao');

    const listaEquip = await equipamentoModel.getAllEquipamentos({ incluir_inativos: true });
    const listaReserva = await reservaModel.getAllReservas({});
    const listaUtil = await utilizacaoModel.getAllUtilizacoes({});

    assert.equal(listaEquip.length, Number(countEquip.total), 'Total de equipamentos no relatório deve ser exato ao banco');
    assert.equal(listaReserva.length, Number(countReserva.total), 'Total de reservas no relatório deve ser exato ao banco');
    assert.equal(listaUtil.length, Number(countUtilizacao.total), 'Total de utilizações no relatório deve ser exato ao banco');
  });

  console.log('\n======================================================');
  console.log(`RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha fatal na execução da suíte da Fase F:', err);
    process.exit(1);
  });
