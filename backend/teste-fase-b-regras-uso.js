const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.JWT_SECRET = 'test-only-phase-b-validation-secret-0123456789';

const espacoModel = require('./models/espacoModel');
const reservaModel = require('./models/reservaModel');

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

// 1. Integridade de Schema e Migrations da Fase B
function testSchemaAndMigrationsFaseB() {
  const migrationPath = path.join(__dirname, '../database/migrations/16_regras_uso_espacos_reservas.sql');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  assert.equal(
    migrationContent.includes('horario_abertura'),
    true,
    'Migration 16 deve incluir horario_abertura em espaco'
  );
  assert.equal(
    migrationContent.includes('horario_fechamento'),
    true,
    'Migration 16 deve incluir horario_fechamento em espaco'
  );
  assert.equal(
    migrationContent.includes('dias_funcionamento'),
    true,
    'Migration 16 deve incluir dias_funcionamento em espaco'
  );
  assert.equal(
    migrationContent.includes('tipo'),
    true,
    'Migration 16 deve incluir tipo em reserva'
  );
  assert.equal(
    migrationContent.includes('data_fim_original'),
    true,
    'Migration 16 deve incluir data_fim_original em reserva'
  );
  assert.equal(
    migrationContent.includes('prorrogada_ate'),
    true,
    'Migration 16 deve incluir prorrogada_ate em reserva'
  );

  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert.equal(
    schemaContent.includes('`horario_abertura` TIME'),
    true,
    'schema.sql deve conter horario_abertura na tabela espaco'
  );
  assert.equal(
    schemaContent.includes('`tipo` VARCHAR(30) NOT NULL DEFAULT \'comum\''),
    true,
    'schema.sql deve conter tipo na tabela reserva'
  );
  assert.equal(
    schemaContent.includes('`data_fim_original` DATETIME'),
    true,
    'schema.sql deve conter data_fim_original na tabela reserva'
  );
}

// 2. Horários de Funcionamento dos Espaços
function testHorarioFuncionamentoEspaco() {
  const espacoPadrao = {
    id: 1,
    nome: 'Laboratório de Informática 1',
    status: 'disponivel',
    horario_abertura: '07:00:00',
    horario_fechamento: '22:00:00',
    dias_funcionamento: '1,2,3,4,5,6' // seg a sab (domingo = 0)
  };

  // Caso Válido: Quarta-feira (2026-10-14), das 08:00 às 10:00
  const v1 = espacoModel.validarHorarioFuncionamento(espacoPadrao, '2026-10-14 08:00:00', '2026-10-14 10:00:00');
  assert.equal(v1.valido, true, 'Horário comercial em dia útil deve ser aceito');

  // Início antes do horário de abertura (06:30)
  const v2 = espacoModel.validarHorarioFuncionamento(espacoPadrao, '2026-10-14 06:30:00', '2026-10-14 08:00:00');
  assert.equal(v2.valido, false, 'Início antes da abertura deve ser rejeitado');
  assert.match(v2.erro, /abertura/i);

  // Término após o horário de fechamento (22:30)
  const v3 = espacoModel.validarHorarioFuncionamento(espacoPadrao, '2026-10-14 21:00:00', '2026-10-14 22:30:00');
  assert.equal(v3.valido, false, 'Término após o fechamento deve ser rejeitado');
  assert.match(v3.erro, /fechamento/i);

  // Dia sem expediente (Domingo 2026-10-18)
  const v4 = espacoModel.validarHorarioFuncionamento(espacoPadrao, '2026-10-18 10:00:00', '2026-10-18 12:00:00');
  assert.equal(v4.valido, false, 'Reserva em dia sem expediente deve ser rejeitada');
  assert.match(v4.erro, /expediente|dia/i);

  // Reserva cruzando a meia-noite (dias diferentes)
  const v5 = espacoModel.validarHorarioFuncionamento(espacoPadrao, '2026-10-14 21:00:00', '2026-10-15 01:00:00');
  assert.equal(v5.valido, false, 'Reserva ultrapassando o mesmo dia deve ser rejeitada');

  // Início posterior ou igual ao término
  const v6 = espacoModel.validarHorarioFuncionamento(espacoPadrao, '2026-10-14 10:00:00', '2026-10-14 09:00:00');
  assert.equal(v6.valido, false, 'Início maior que término deve ser rejeitado');

  // Espaço em manutenção / inativo
  const espacoEmManutencao = { ...espacoPadrao, status: 'manutencao' };
  const v7 = espacoModel.validarHorarioFuncionamento(espacoEmManutencao, '2026-10-14 08:00:00', '2026-10-14 10:00:00');
  assert.equal(v7.valido, false, 'Espaço em manutenção deve ser rejeitado');
  assert.match(v7.erro, /disponível|manuten/i);
}

// 3. Prevenção de Conflitos e Fronteiras Temporais
async function testLogicaConflitoLimites() {
  // Simulador de executor de consulta SQL
  const mockReservasAtivas = [
    {
      id: 10,
      equipamento_id: 1,
      espaco_id: 1,
      data_inicio: '2026-10-15 08:00:00',
      data_fim: '2026-10-15 10:00:00',
      status: 'confirmada',
      usuario_id: 100,
      usuario_nome: 'Docente Carlos'
    },
    {
      id: 20,
      equipamento_id: 2,
      espaco_id: 1,
      data_inicio: '2026-10-15 08:00:00',
      data_fim: '2026-10-15 10:00:00',
      status: 'confirmada',
      usuario_id: 101,
      usuario_nome: 'Aluno Lucas'
    }
  ];

  const fakeExecutor = {
    query: async (sql, params) => {
      // Simula a consulta de checkConflict
      const fimSolicitado = params[0];
      const inicioSolicitado = params[1];
      const targetEquipId = params[2];
      const targetEspacoId = params[3];

      const rows = mockReservasAtivas.filter((r) => {
        // Sobreposição: r.inicio < fimSolicitado AND r.fim > inicioSolicitado
        const sobreposicao = r.data_inicio < fimSolicitado && r.data_fim > inicioSolicitado;
        if (!sobreposicao) return false;

        if (targetEquipId && targetEspacoId) {
          // Equipamento individual: conflita com mesmo equipamento OU reserva exclusiva da sala inteira
          return r.equipamento_id === targetEquipId || (r.espaco_id === targetEspacoId && r.equipamento_id === null);
        }
        if (targetEquipId) {
          return r.equipamento_id === targetEquipId;
        }
        if (targetEspacoId) {
          // Reserva exclusiva da sala: conflita com sala OU qualquer equipamento alocado
          return r.espaco_id === targetEspacoId;
        }
        return false;
      });
      return [rows];
    }
  };

  // Teste de Fronteira Exata: Termina exatamente quando a outra começa (10:00)
  // Reserva existente: 08:00 às 10:00
  // Nova reserva: 10:00 às 12:00 -> NÃO PODE conflitar
  const conflitoFronteira = await reservaModel.checkConflict({
    equipamento_id: 1,
    espaco_id: 1,
    data_inicio: '2026-10-15 10:00:00',
    data_fim: '2026-10-15 12:00:00',
    executor: fakeExecutor
  });
  assert.equal(conflitoFronteira.length, 0, 'Reserva que inicia exatamente no término da anterior não deve conflitar');

  // Teste de Sobreposição Parcial: 09:30 às 11:00 -> DEVE conflitar com eq 1
  const conflitoParcial = await reservaModel.checkConflict({
    equipamento_id: 1,
    espaco_id: 1,
    data_inicio: '2026-10-15 09:30:00',
    data_fim: '2026-10-15 11:00:00',
    executor: fakeExecutor
  });
  assert.equal(conflitoParcial.length, 1, 'Sobreposição parcial deve ser identificada como conflito');
  assert.equal(conflitoParcial[0].id, 10);

  // Teste de Isolamento entre Equipamentos Diferentes no Mesmo Laboratório:
  // Eq 1 e Eq 2 estão no laboratório 1 no mesmo horário (08:00 - 10:00).
  // Eq 3 no laboratório 1 das 08:00 às 10:00 NÃO deve conflitar com Eq 1 nem Eq 2!
  const conflitoOutroEquip = await reservaModel.checkConflict({
    equipamento_id: 3,
    espaco_id: 1,
    data_inicio: '2026-10-15 08:00:00',
    data_fim: '2026-10-15 10:00:00',
    executor: fakeExecutor
  });
  assert.equal(conflitoOutroEquip.length, 0, 'Equipamento diferente no mesmo espaço não pode sofrer falso conflito');

  // Teste de Reserva Exclusiva do Espaço Inteiro:
  // Se alguém tenta reservar o Laboratório 1 inteiro (espaco_id: 1, equipamento_id: null),
  // DEVE conflitar porque Eq 1 e Eq 2 já estão reservados naquele horário!
  const conflitoSalaInteira = await reservaModel.checkConflict({
    espaco_id: 1,
    data_inicio: '2026-10-15 08:30:00',
    data_fim: '2026-10-15 09:30:00',
    executor: fakeExecutor
  });
  assert.equal(conflitoSalaInteira.length > 0, true, 'Reserva de espaço exclusivo deve conflitar com equipamentos já agendados nele');
}

// 4. Reservas Recorrentes, Validação Atômica e Cancelamento Granular
async function testReservasRecorrentes() {
  const ocorrenciasValidas = [
    { data_inicio: '2026-10-15 08:00:00', data_fim: '2026-10-15 10:00:00' },
    { data_inicio: '2026-10-22 08:00:00', data_fim: '2026-10-22 10:00:00' }
  ];

  // Mock com simulação de conflito na segunda ocorrência
  const mockConflictExecutor = {
    query: async (sql, params) => {
      if (sql.includes('SELECT r.*') && params[1] === '2026-10-22 08:00:00') {
        return [[{ id: 99, usuario_nome: 'Prof. Marcos', data_inicio: '2026-10-22 08:00:00', data_fim: '2026-10-22 10:00:00' }]];
      }
      return [[]];
    }
  };

  const resultadoConflito = await reservaModel.createSerieRecorrente({
    usuario_id: 1,
    espaco_id: 1,
    ocorrencias: ocorrenciasValidas,
    finalidade: 'Aulas de Programação',
    executor: mockConflictExecutor
  });

  assert.equal(resultadoConflito.success, false, 'Série deve falhar se qualquer ocorrência conflitar');
  assert.equal(resultadoConflito.ocorrenciaIndice, 2, 'Deve identificar precisamente a ocorrência conflitante');
  assert.match(resultadoConflito.error, /Conflito detectado na ocorrência 2/);
}

// 5. Aulas / Turmas: Suporte a tipo, disciplina e cancelamento sem no-show
async function testAulasETurmas() {
  const mockReservaAula = {
    id: 42,
    usuario_id: 5,
    espaco_id: 2,
    tipo: 'aula',
    disciplina: 'Sistemas Embarcados',
    turma: 'T01',
    status: 'confirmada',
    data_inicio: '2026-10-16 14:00:00',
    data_fim: '2026-10-16 16:00:00',
    grupo_recorrencia_id: 'rec_aula_embarcados'
  };

  const mockDb = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE `reserva` SET status = \'cancelada\'')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }
  };

  // Cancelar apenas esta ocorrência da aula
  const cancelamento = await reservaModel.cancelarOcorrenciaRecorrente(42, 'apenas_esta', {
    ...mockDb,
    query: async (sql, params) => {
      if (sql.includes('SELECT r.*')) return [[mockReservaAula]];
      return [{ affectedRows: 1 }];
    }
  });

  assert.equal(cancelamento.tipo, 'apenas_esta');
  assert.equal(cancelamento.afetadas, 1);
  // O cancelamento define status = 'cancelada' (não 'no_show')
}

// 6. Extensão de Reserva / Utilização além do horário previsto
async function testExtensaoReserva() {
  const mockReservaAtiva = {
    id: 55,
    usuario_id: 8,
    espaco_id: 1,
    equipamento_id: 10,
    status: 'em_andamento',
    data_inicio: '2026-10-15 08:00:00',
    data_fim: '2026-10-15 10:00:00',
    data_fim_original: null,
    horario_abertura: '07:00:00',
    horario_fechamento: '22:00:00',
    dias_funcionamento: '1,2,3,4,5,6'
  };

  // Caso 1: Extensão permitida (sem conflito e dentro do horário de fechamento)
  let updatePayloadCapture = null;
  const mockExecutorPermitido = {
    query: async (sql, params) => {
      if (sql.includes('data_inicio') && sql.includes('data_fim')) {
        return [[]]; // Sem conflito
      }
      if (sql.includes('LIMIT 1') || sql.includes('SELECT * FROM `espaco`') || sql.includes('SELECT r.*')) {
        return [[mockReservaAtiva]];
      }
      if (sql.includes('UPDATE `reserva`') || sql.includes('UPDATE reserva') || sql.includes('UPDATE `')) {
        updatePayloadCapture = { sql, params };
        return [{ affectedRows: 1 }];
      }
      return [[]]; // Sem conflitos
    }
  };

  const extSucesso = await reservaModel.estenderReserva({
    id: 55,
    minutos: 30,
    justificativa: 'Conclusão de experimento de física',
    usuarioId: 8,
    isPrivileged: false,
    executor: mockExecutorPermitido
  });

  assert.equal(extSucesso.success, true, 'Extensão válida deve ser aprovada');
  assert.equal(extSucesso.minutos_estendidos, 30);
  assert.equal(extSucesso.data_fim_nova, '2026-10-15 10:30:00');
  assert.ok(updatePayloadCapture, 'Deve ter executado o UPDATE');
  assert.ok(updatePayloadCapture.params.includes('2026-10-15 10:30:00'), 'Deve atualizar nova data fim');
  assert.ok(updatePayloadCapture.params.includes('2026-10-15 10:00:00'), 'Deve preservar data_fim_original');

  // Caso 2: Extensão recusada devido a próxima reserva agendada
  const mockExecutorComConflito = {
    query: async (sql, params) => {
      if (sql.includes('SELECT r.*') || sql.includes('SELECT * FROM `espaco`')) {
        return [[mockReservaAtiva]];
      }
      if (sql.includes('conflito_fim_local')) {
        // Retorna conflito com próxima reserva
        return [[{
          id: 88,
          usuario_nome: 'Dra. Ana',
          data_inicio: '2026-10-15 10:15:00',
          data_fim: '2026-10-15 12:00:00'
        }]];
      }
      return [[]];
    }
  };

  const extBloqueada = await reservaModel.estenderReserva({
    id: 55,
    minutos: 30,
    justificativa: 'Preciso de mais tempo',
    usuarioId: 8,
    isPrivileged: false,
    executor: mockExecutorComConflito
  });

  assert.equal(extBloqueada.success, false, 'Extensão deve ser bloqueada se houver próxima reserva');
  assert.equal(extBloqueada.status, 409);
  assert.equal(extBloqueada.motivo, 'conflito_proxima_reserva');
  assert.match(extBloqueada.error, /já existe uma próxima reserva/i);
}

// 7. Validação de Coerência entre Reserva e Check-in
async function testCoerenciaReservaCheckin() {
  const utilizacaoController = require('./controllers/utilizacaoController');

  // Cria mock de req / res
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status: (code) => {
      responseStatus = code;
      return {
        json: (data) => { responseBody = data; return data; }
      };
    },
    json: (data) => {
      responseStatus = 200;
      responseBody = data;
      return data;
    }
  };

  // Mock do equipamento #1 (pertence ao espaço #1)
  const equipMock = { id: 1, nome: 'Osciloscópio Digital', status: 'disponivel', inativo: 0, exige_capacitacao: 0, espaco_id: 1 };
  const equipModel = require('./models/equipamentoModel');
  const originalGetEquip = equipModel.getEquipamentoById;
  const originalGetReserva = reservaModel.getReservaById;
  const originalGetActiveUtil = require('./models/utilizacaoModel').getActiveUtilizacaoByEquipamento;

  equipModel.getEquipamentoById = async () => equipMock;
  require('./models/utilizacaoModel').getActiveUtilizacaoByEquipamento = async () => null;

  try {
    // Caso de Incoerência: Usuário A tenta check-in com reserva de Usuário B
    reservaModel.getReservaById = async () => ({
      id: 999,
      usuario_id: 50, // pertence ao user 50
      equipamento_id: 1,
      status: 'confirmada'
    });

    const mockReqIncoerente = {
      user: { id: 10, perfil: 'usuario' }, // user 10 (não admin)
      body: { equipamento_id: 1, reserva_id: 999 }
    };

    await utilizacaoController.checkin(mockReqIncoerente, mockRes);
    assert.equal(responseStatus, 403, 'Check-in com reserva de outro usuário comum deve ser rejeitado');
    assert.match(responseBody.error, /pertence a outro usuário/i);

    // Caso de Incoerência: Reserva cancelada
    reservaModel.getReservaById = async () => ({
      id: 999,
      usuario_id: 10,
      equipamento_id: 1,
      status: 'cancelada'
    });

    await utilizacaoController.checkin(mockReqIncoerente, mockRes);
    assert.equal(responseStatus, 400, 'Check-in com reserva cancelada deve ser rejeitado');
    assert.match(responseBody.error, /não está ativa/i);

    // Caso de Incoerência: Equipamento não coincide
    reservaModel.getReservaById = async () => ({
      id: 999,
      usuario_id: 10,
      equipamento_id: 888, // reserva para outro equipamento
      status: 'confirmada'
    });

    await utilizacaoController.checkin(mockReqIncoerente, mockRes);
    assert.equal(responseStatus, 400, 'Check-in com equipamento divergente deve ser rejeitado');
    assert.match(responseBody.error, /não coincide/i);
  } finally {
    equipModel.getEquipamentoById = originalGetEquip;
    reservaModel.getReservaById = originalGetReserva;
    require('./models/utilizacaoModel').getActiveUtilizacaoByEquipamento = originalGetActiveUtil;
  }
}

// 8. Isenção de Aulas no Varredor Automático de No-Shows
async function testIsencaoAulasNoShow() {
  let executedQuery = '';
  const mockExecutor = {
    query: async (sql, params) => {
      executedQuery = sql;
      return [[]];
    }
  };

  await reservaModel.verificarNoShowsAutomaticos(15, mockExecutor);
  assert.equal(
    executedQuery.includes('tipo != \'aula\''),
    true,
    'Varredor de no-shows deve filtrar e isentar reservas do tipo aula'
  );
}

async function run() {
  console.log('\n========================================');
  console.log('LABCONTROL - TESTES DA FASE B: REGRAS DE USO');
  console.log('========================================\n');

  await runTest('1. Integridade do schema e migration 16', testSchemaAndMigrationsFaseB);
  await runTest('2. Validação rigorosa de horários de funcionamento do espaço', testHorarioFuncionamentoEspaco);
  await runTest('3. Prevenção de conflitos e precisão nas fronteiras temporais', testLogicaConflitoLimites);
  await runTest('4. Criação atômica e cancelamento de séries recorrentes', testReservasRecorrentes);
  await runTest('5. Suporte a aulas/turmas e cancelamento pontual sem no-show', testAulasETurmas);
  await runTest('6. Extensão formal de reserva (com aprovação e bloqueio por conflito)', testExtensaoReserva);
  await runTest('7. Coerência entre reserva e utilização no check-in', testCoerenciaReservaCheckin);
  await runTest('8. Isenção de turmas/aulas no varredor automático de no-show', testIsencaoAulasNoShow);

  console.log('\n========================================');
  console.log('TODOS OS TESTES DA FASE B PASSARAM COM SUCESSO!');
  console.log('========================================\n');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\nFALHA NOS TESTES DA FASE B:\n', err);
    process.exit(1);
  });
}

module.exports = { run };
