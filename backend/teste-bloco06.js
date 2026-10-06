const espacoModel = require('./models/espacoModel');

async function testBlock06() {
  console.log('--- TESTE BLOCO 06: GESTÃO DE LABORATÓRIOS E MODO MONITOR ---');

  try {
    const espacos = await espacoModel.getAllEspacos();
    console.log(`[OK] Total de espaços encontrados: ${espacos.length}`);

    if (espacos.length === 0) {
      console.log('Criando espaço de teste...');
      const novo = await espacoModel.createEspaco({
        nome: 'Laboratório de Automação e IoT',
        tipo: 'Laboratório',
        capacidade: 25,
        localizacao: 'Bloco C - Sala 10',
        responsavel: 'Prof. Coordenador de Teste',
        regras_utilizacao: 'Uso obrigatório de EPIs. Proibido beber ou comer.'
      });
      console.log(`[OK] Espaço criado com ID: ${novo.id || novo.id_espaco}`);
    }

    const primeiroEspaco = espacos[0] || (await espacoModel.getAllEspacos())[0];
    const id = primeiroEspaco.id || primeiroEspaco.id_espaco;
    console.log(`Testando espaço ID ${id} (${primeiroEspaco.nome})...`);

    // Atualiza com campos do Bloco 06
    await espacoModel.updateEspaco(id, {
      responsavel: 'Prof. Dr. Silva',
      regras_utilizacao: 'Obrigatório uso de jaleco e óculos de proteção nas bancadas.'
    });
    console.log('[OK] Atualização de responsável e regras concluída');

    // Teste getEspacoDetalhes
    const detalhes = await espacoModel.getEspacoDetalhes(id);
    if (!detalhes) {
      throw new Error(`getEspacoDetalhes retornou vazio para ID ${id}`);
    }
    console.log('[OK] getEspacoDetalhes retornou com sucesso:');
    console.log(`  - Nome: ${detalhes.espaco.nome}`);
    console.log(`  - Responsável: ${detalhes.espaco.responsavel}`);
    console.log(`  - Equipamentos vinculados: ${detalhes.equipamentos?.length || 0}`);
    console.log(`  - Reservas listadas: ${detalhes.reservas?.length || 0}`);
    console.log(`  - Utilizações ativas: ${detalhes.utilizacaoAtual?.equipamentosEmUso?.length || 0}`);
    console.log(`  - Reserva em andamento: ${detalhes.utilizacaoAtual?.reservaEmAndamento ? detalhes.utilizacaoAtual.reservaEmAndamento.usuario_nome : 'Nenhuma'}`);
    console.log(`  - Inventários recentes: ${detalhes.inventarios?.length || 0}`);

    // Teste getEspacoMonitor
    const monitor = await espacoModel.getEspacoMonitor(id);
    if (!monitor) {
      throw new Error(`getEspacoMonitor retornou vazio para ID ${id}`);
    }
    console.log('[OK] getEspacoMonitor retornou com sucesso:');
    console.log(`  - Status do espaço: ${monitor.espaco.status}`);
    console.log(`  - Em uso?: ${monitor.ocupacaoAtual.ocupado ? 'SIM' : 'NÃO'}`);
    console.log(`  - Próximas reservas: ${monitor.proximasReservas?.length || 0}`);

    console.log('\n--- TODOS OS TESTES DO BLOCO 06 PASSARAM COM SUCESSO! ---');
    process.exit(0);
  } catch (err) {
    console.error('[ERRO NO TESTE BLOCO 06]:', err);
    process.exit(1);
  }
}

testBlock06();
