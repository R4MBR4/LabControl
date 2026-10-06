const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const inventarioModel = require('./models/inventarioModel');
const equipamentoModel = require('./models/equipamentoModel');
const { pool } = require('./models/dbHelper');

async function runTests() {
  console.log('=====================================================');
  console.log(' TESTES AUTOMATIZADOS - BLOCO 05: INVENTÁRIO POR QR');
  console.log('=====================================================');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  let inventarioCriado = null;
  let dummyEquipCriado = null;

  try {
    // 1. Obter usuário admin e dois espaços distintos
    const [usuarios] = await pool.query('SELECT * FROM usuario WHERE perfil = "admin" LIMIT 1');
    const [espacos] = await pool.query('SELECT * FROM espaco ORDER BY id ASC LIMIT 2');

    assert(usuarios.length > 0, 'Usuário Administrador encontrado no banco');
    assert(espacos.length >= 2, 'Ao menos 2 espaços/laboratórios encontrados para teste');

    const adminUser = usuarios[0];
    const labAlvo = espacos[0]; // Laboratório onde o inventário será realizado
    const labOutro = espacos[1]; // Outro laboratório para testar divergência

    // 2. Iniciar Sessão de Inventário no labAlvo
    inventarioCriado = await inventarioModel.startInventario(
      labAlvo.id,
      adminUser.id,
      'Sessão de teste automatizado do Bloco 05'
    );

    assert(inventarioCriado && inventarioCriado.id, 'Sessão de inventário iniciada com sucesso');
    assert(inventarioCriado.status === 'em_andamento', 'Status inicial é "em_andamento"');
    assert(inventarioCriado.total_conferidos === 0, 'total_conferidos inicia com 0');
    assert(inventarioCriado.total_divergentes === 0, 'total_divergentes inicia com 0');

    // 3. Obter ou criar equipamento que pertence ao labAlvo para leitura regular
    const [equipsLabAlvo] = await pool.query(
      'SELECT * FROM equipamento WHERE espaco_id = ? AND (inativo = 0 OR inativo IS NULL) LIMIT 1',
      [labAlvo.id]
    );

    let equipRegular = equipsLabAlvo[0];
    if (!equipRegular) {
      // Cria temporário se não houver
      const novo = await equipamentoModel.createEquipamento({
        espaco_id: labAlvo.id,
        nome: 'Equipamento Teste Regular',
        codigo_patrimonio: `PAT-TEST-REG-${Date.now()}`
      });
      equipRegular = novo;
      dummyEquipCriado = novo;
    }

    // 4. Testar leitura de QR Code Conforme (equipamento esperado no laboratório)
    const scanConforme = await inventarioModel.scanItem(
      inventarioCriado.id,
      equipRegular.codigo_patrimonio,
      adminUser.id
    );

    assert(!scanConforme.isDivergente, 'Leitura de equipamento do próprio laboratório identificada como conforme');
    assert(scanConforme.item.status_conferencia === 'conferido', 'Status de conferência gravado como "conferido"');

    // 5. Testar detecção de leitura duplicada na mesma sessão
    const scanDuplicado = await inventarioModel.scanItem(
      inventarioCriado.id,
      equipRegular.codigo_patrimonio,
      adminUser.id
    );
    assert(scanDuplicado.jaConferido === true, 'Leitura repetida na mesma sessão detectada e prevenida');

    // 6. Criar equipamento no labOutro para testar DIVERGÊNCIA
    const [equipsOutro] = await pool.query(
      'SELECT * FROM equipamento WHERE espaco_id = ? AND (inativo = 0 OR inativo IS NULL) LIMIT 1',
      [labOutro.id]
    );

    let equipDivergente = equipsOutro[0];
    if (!equipDivergente) {
      const novo2 = await equipamentoModel.createEquipamento({
        espaco_id: labOutro.id,
        nome: 'Equipamento Teste Divergente',
        codigo_patrimonio: `PAT-TEST-DIV-${Date.now()}`
      });
      equipDivergente = novo2;
    }

    // 7. Testar leitura de equipamento de outro laboratório (Divergência de Localização)
    const scanDivergente = await inventarioModel.scanItem(
      inventarioCriado.id,
      equipDivergente.codigo_patrimonio,
      adminUser.id
    );

    assert(scanDivergente.isDivergente === true, 'Divergência de localização detectada com precisão');
    assert(scanDivergente.item.status_conferencia === 'divergente', 'Status gravado como "divergente"');
    assert(scanDivergente.item.decisao_admin === 'pendente', 'Decisão gravada inicialmente como "pendente"');

    // Regra crítica da especificação: A localização NÃO deve ser alterada automaticamente!
    const [checkEquipAntes] = await pool.query('SELECT espaco_id FROM equipamento WHERE id = ?', [equipDivergente.id]);
    assert(
      Number(checkEquipAntes[0].espaco_id) === Number(labOutro.id),
      'Regra Absoluta: Localização do equipamento NÃO foi alterada automaticamente após QR'
    );

    // 8. Testar Decisão Administrativa de DIVERGÊNCIA: "transferir"
    const invAposDecisao = await inventarioModel.decidirDivergencia(
      inventarioCriado.id,
      scanDivergente.item.id,
      'transferir',
      adminUser.id
    );

    // Confirma que agora o equipamento foi formalmente transferido para o labAlvo pelo admin
    const [checkEquipDepois] = await pool.query('SELECT espaco_id FROM equipamento WHERE id = ?', [equipDivergente.id]);
    assert(
      Number(checkEquipDepois[0].espaco_id) === Number(labAlvo.id),
      'Decisão "transferir": Equipamento teve espaco_id atualizado pelo Administrador'
    );

    // Retorna o equipamento para labOutro para preservar integridade
    await pool.query('UPDATE equipamento SET espaco_id = ? WHERE id = ?', [labOutro.id, equipDivergente.id]);

    // 9. Testar Finalização da Sessão de Inventário
    const invFinalizado = await inventarioModel.finalizarInventario(inventarioCriado.id);
    assert(invFinalizado.status === 'concluido', 'Sessão de inventário marcada como "concluido"');
    assert(invFinalizado.data_fim !== null, 'data_fim registrada na conclusão');
    assert(invFinalizado.total_nao_localizados >= 0, 'Contagem de não localizados apurada');

    // 10. Limpeza dos registros criados no teste
    await pool.query('DELETE FROM inventario_item WHERE inventario_id = ?', [inventarioCriado.id]);
    await pool.query('DELETE FROM inventario WHERE id = ?', [inventarioCriado.id]);
    if (dummyEquipCriado) {
      await pool.query('DELETE FROM equipamento WHERE id = ?', [dummyEquipCriado.id]);
    }

    assert(true, 'Limpeza segura dos registros de teste realizada com sucesso');

  } catch (err) {
    console.error('Erro durante execução dos testes do Bloco 05:', err);
    assert(false, `Exceção não tratada: ${err.message}`);
  } finally {
    console.log('=====================================================');
    console.log(` RESULTADO: ${passed}/${total} testes passaram (${Math.round((passed/total)*100)}%)`);
    console.log('=====================================================');
    await pool.end();
    process.exit(passed === total ? 0 : 1);
  }
}

runTests();
