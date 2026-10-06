const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const equipamentoModel = require('./models/equipamentoModel');
const reservaController = require('./controllers/reservaController');
const utilizacaoController = require('./controllers/utilizacaoController');

async function testBloco02() {
  console.log('========================================================================');
  console.log('       TESTE AUTOMATIZADO - BLOCO 02: GESTÃO DE EQUIPAMENTOS           ');
  console.log('========================================================================');

  let passed = 0;
  let total = 0;
  function assert(name, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`[FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
    }
  }

  try {
    // 1. Criar novo equipamento com duplo identificador, marca e localização detalhada
    const novoData = {
      nome: 'Balança Analítica de Precisão Shimadzu',
      categoria: 'Química e Pesagem',
      patrimonio_ufpi: 'UFPI-TEST-9901',
      marca: 'Shimadzu',
      modelo: 'AUW220D',
      numero_serie: 'SHIM-998811',
      espaco_id: 1,
      localizacao_detalhada: 'Bancada de Pesagem 04',
      status: 'disponivel',
      exige_capacitacao: 1,
      observacoes: 'Sensibilidade de 0,01mg. Manter nivelada e protegida de correntes de ar.'
    };

    const criado = await equipamentoModel.createEquipamento(novoData);
    assert('1. Cadastro de Equipamento com Novos Campos', !!criado && criado.nome === novoData.nome, `ID: ${criado?.id}`);
    assert('2. Geração de Código LabControl Interno', !!criado?.codigo_labcontrol && criado.codigo_labcontrol.startsWith('LC-EQ-'), `Código: ${criado?.codigo_labcontrol}`);
    assert('3. Preservação do Patrimônio Oficial UFPI', criado?.patrimonio_ufpi === 'UFPI-TEST-9901', `Patrimônio: ${criado?.patrimonio_ufpi}`);
    assert('4. Registro de Marca e Localização Detalhada', criado?.marca === 'Shimadzu' && criado?.localizacao_detalhada === 'Bancada de Pesagem 04');

    // 2. Inativação do Equipamento
    const motivoTeste = 'Inativação para substituição do prato de pesagem';
    const inativado = await equipamentoModel.inativarEquipamento(criado.id, 1, motivoTeste);
    assert('5. Fluxo de Inativação Lógica', inativado?.status === 'inativo' && inativado?.inativo === 1, `Status: ${inativado?.status}`);
    assert('6. Registro de Motivo e Auditoria de Inativação', inativado?.motivo_inativacao === motivoTeste, `Motivo: ${inativado?.motivo_inativacao}`);

    // 3. Teste de Bloqueio de Reserva para Equipamento Inativo
    const reqReservaMock = {
      user: { id: 1, perfil: 'admin' },
      body: {
        equipamento_id: criado.id,
        data_inicio: new Date(Date.now() + 86400000).toISOString(),
        data_fim: new Date(Date.now() + 90000000).toISOString(),
        finalidade: 'Teste de Bloqueio em Inativo'
      }
    };
    let reservaRejeitada = false;
    let reservaErroMsg = '';
    const resReservaMock = {
      status: (code) => ({
        json: (data) => {
          if (code === 400 && data.error && data.error.includes('inativo')) {
            reservaRejeitada = true;
            reservaErroMsg = data.error;
          }
        }
      }),
      json: () => {}
    };
    await reservaController.create(reqReservaMock, resReservaMock);
    assert('7. Bloqueio de Reserva para Equipamento Inativo', reservaRejeitada, reservaErroMsg);

    // 4. Teste de Bloqueio de Check-in para Equipamento Inativo
    const reqCheckinMock = {
      user: { id: 1, perfil: 'admin' },
      body: {
        equipamento_id: criado.id,
        condicao_inicial: 'Normal'
      }
    };
    let checkinRejeitado = false;
    let checkinErroMsg = '';
    const resCheckinMock = {
      status: (code) => ({
        json: (data) => {
          if (code === 400 && data.error && data.error.includes('inativo')) {
            checkinRejeitado = true;
            checkinErroMsg = data.error;
          }
        }
      }),
      json: () => {}
    };
    await utilizacaoController.checkin(reqCheckinMock, resCheckinMock);
    assert('8. Bloqueio de Check-in para Equipamento Inativo', checkinRejeitado, checkinErroMsg);

    // 5. Reativação do Equipamento
    const reativado = await equipamentoModel.reativarEquipamento(criado.id);
    assert('9. Reativação com Retorno a Disponível', reativado?.status === 'disponivel' && reativado?.inativo === 0);

    // 6. Exclusão do Equipamento de Teste sem Histórico
    const remocao = await equipamentoModel.deleteEquipamento(criado.id);
    assert('10. Limpeza Segura de Equipamento de Teste', remocao?.success === true);

  } catch (err) {
    console.error('[-] Erro crítico durante os testes do Bloco 02:', err.message);
  }

  console.log('\n========================================================================');
  console.log(` RESULTADO: ${passed}/${total} ETAPAS APROVADAS (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================');
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testBloco02();
