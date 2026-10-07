const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const ocorrenciaModel = require('./models/ocorrenciaModel');
const utilizacaoModel = require('./models/utilizacaoModel');
const equipamentoModel = require('./models/equipamentoModel');
const { pool } = require('./models/dbHelper');

async function runTests() {
  console.log('=====================================================');
  console.log(' TESTES AUTOMATIZADOS - BLOCO 04: FOTOGRAFIAS E EVIDÊNCIAS');
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

  try {
    // 1. Obter usuário e equipamento para testes
    const [usuarios] = await pool.query('SELECT * FROM usuario WHERE perfil = "admin" LIMIT 1');
    const [equipamentos] = await pool.query('SELECT * FROM equipamento WHERE inativo = 0 LIMIT 1');

    assert(usuarios.length > 0, 'Usuário de teste encontrado no banco');
    assert(equipamentos.length > 0, 'Equipamento de teste encontrado no banco');

    const testUser = usuarios[0];
    const testEquip = equipamentos[0];

    // 2. Testar criação de ocorrência com foto de evidência direta
    const fakePhotoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...EVIDENCIA_TESTE_BLOCO_04...';
    const fakeMetadata = {
      timestamp: new Date().toISOString(),
      timestampFormatado: new Date().toLocaleString('pt-BR'),
      modoCaptura: 'camera_ao_vivo_estrita',
      tipoContexto: 'Avaria Detectada'
    };

    const novaOcorrencia = await ocorrenciaModel.createOcorrencia({
      usuario_id: testUser.id,
      equipamento_id: testEquip.id,
      titulo: 'Cabo de alimentação partido com faíscas',
      descricao: 'Foi detectado rompimento do isolamento externo do cabo durante utilização.',
      gravidade: 'alta',
      status: 'aberta',
      foto_evidencia: fakePhotoDataUrl,
      foto_metadata: JSON.stringify(fakeMetadata)
    });

    assert(novaOcorrencia && novaOcorrencia.id, 'Ocorrência criada com sucesso via ocorrenciaModel');
    assert(novaOcorrencia.foto_evidencia === fakePhotoDataUrl, 'foto_evidencia persistida fielmente no banco');
    assert(novaOcorrencia.gravidade === 'alta', 'gravidade da ocorrência gravada como "alta"');
    assert(novaOcorrencia.titulo === 'Cabo de alimentação partido com faíscas', 'titulo da ocorrência gravado');

    // 3. Testar busca da ocorrência por ID e em listagem com joins
    const ocRecuperada = await ocorrenciaModel.getOcorrenciaById(novaOcorrencia.id);
    assert(ocRecuperada && ocRecuperada.id === novaOcorrencia.id, 'Ocorrência recuperada por ID');
    assert(ocRecuperada.foto_evidencia === fakePhotoDataUrl, 'foto_evidencia presente na busca por ID');
    assert(ocRecuperada.equipamento_nome !== undefined, 'Join de equipamento_nome presente na consulta');

    // 4. Testar decisão do administrador na ocorrência
    const ocDecidida = await ocorrenciaModel.updateOcorrencia(novaOcorrencia.id, {
      status: 'resolvida',
      decisao_admin: 'Cabo elétrico substituído e testado com multímetro.',
      data_decisao: new Date(),
      data_resolucao: new Date()
    });

    assert(ocDecidida.status === 'resolvida', 'Status da ocorrência atualizado para "resolvida"');
    assert(ocDecidida.decisao_admin.includes('Cabo elétrico substituído'), 'decisao_admin salva com sucesso');

    // 5. Testar check-in e check-out com foto de evidência na devolução
    const novoCheckin = await utilizacaoModel.createCheckin({
      usuario_id: testUser.id,
      equipamento_id: testEquip.id,
      condicao_retirada: 'Em perfeito estado',
      observacoes: 'Teste de posse e devolução com foto'
    });

    assert(novoCheckin && novoCheckin.id, 'Check-in realizado com sucesso');

    const fakeCheckoutPhoto = 'data:image/jpeg;base64,CHECKOUT_PHOTO_EVIDENCE_PROBATÓRIA';
    const checkoutExecutado = await utilizacaoModel.executeCheckout(novoCheckin.id, {
      condicao_devolucao: 'Devolvido com avaria no botão de acionamento',
      condicao_final: 'Devolvido com avaria no botão de acionamento',
      status: 'finalizado',
      houve_avaria: 1,
      relato_avaria: 'Botão travado após impacto acidental',
      foto_evidencia: fakeCheckoutPhoto,
      foto_metadata: JSON.stringify({ source: 'camera_ao_vivo', context: 'checkout' })
    });

    assert(checkoutExecutado.status === 'finalizado', 'Utilização concluída com status "finalizado"');
    assert(checkoutExecutado.foto_evidencia === fakeCheckoutPhoto, 'foto_evidencia gravada com sucesso no checkout');
    assert(checkoutExecutado.houve_avaria === 1, 'Flag houve_avaria = 1 gravada');

    // 6. Limpeza dos registros de teste
    await ocorrenciaModel.deleteOcorrencia(novaOcorrencia.id);
    await pool.query('DELETE FROM utilizacao WHERE id = ?', [novoCheckin.id]);
    assert(true, 'Registros de teste excluídos de forma segura');

  } catch (err) {
    console.error('Erro durante execução dos testes:', err);
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
