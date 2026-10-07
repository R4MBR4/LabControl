const reservaModel = require('./models/reservaModel');
const equipamentoModel = require('./models/equipamentoModel');
const espacoModel = require('./models/espacoModel');
const { pool } = require('./models/dbHelper');

async function testBlock07() {
  console.log('--- TESTE BLOCO 07: GESTÃO DE RESERVAS, FILTROS E CALENDÁRIO ---');

  try {
    // 1. Obter usuário e recursos existentes
    const [users] = await pool.query('SELECT id, nome FROM usuario LIMIT 1');
    const user = users[0];
    if (!user) throw new Error('Nenhum usuário encontrado para testes');

    const espacos = await espacoModel.getAllEspacos();
    const espaco = espacos[0];
    const equipamentos = await equipamentoModel.getAllEquipamentos();
    const equip = equipamentos[0];

    console.log(`[OK] Usuário de teste: ${user.nome} (ID ${user.id})`);
    console.log(`[OK] Espaço de teste: ${espaco?.nome || 'N/A'}`);
    console.log(`[OK] Equipamento de teste: ${equip?.nome || 'N/A'}`);

    // 2. Listar reservas com filtros avançados
    const todas = await reservaModel.getAllReservas({});
    console.log(`[OK] Total de reservas existentes: ${todas.length}`);

    // Filtro por texto
    const buscaTexto = await reservaModel.getAllReservas({ search: 'robo' });
    console.log(`[OK] Busca textual ('robo'): retornou ${buscaTexto.length} resultado(s)`);

    // Filtro por status
    const ativas = await reservaModel.getAllReservas({ status: 'confirmada' });
    console.log(`[OK] Filtro status ('confirmada'): retornou ${ativas.length} resultado(s)`);

    // 3. Teste do Calendário
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const eventosCalendario = await reservaModel.getReservasCalendario({
      inicio: `${anoAtual}-01-01 00:00:00`,
      fim: `${anoAtual}-12-31 23:59:59`
    });
    console.log(`[OK] Eventos carregados no calendário para ${anoAtual}: ${eventosCalendario.length}`);

    // 4. Teste de Prevenção de Conflito de Horário
    const dataInicioTeste = new Date(Date.now() + 864000000); // 10 dias no futuro
    dataInicioTeste.setHours(14, 0, 0, 0);
    const dataFimTeste = new Date(dataInicioTeste);
    dataFimTeste.setHours(16, 0, 0, 0);

    const dataInicioStr = dataInicioTeste.toISOString().slice(0, 19).replace('T', ' ');
    const dataFimStr = dataFimTeste.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`Criando reserva de teste 1 para equipamento ${equip.id}: ${dataInicioStr} até ${dataFimStr}...`);
    const novaReserva = await reservaModel.createReserva({
      usuario_id: user.id,
      equipamento_id: equip.id,
      espaco_id: equip.espaco_id || espaco.id,
      data_inicio: dataInicioStr,
      data_fim: dataFimStr,
      finalidade: 'Teste Automatizado Bloco 07 - Análise de Conflito',
      status: 'confirmada'
    });
    console.log(`[OK] Reserva 1 criada com ID ${novaReserva.id}`);

    // Verificar se checkConflict detecta sobreposição idêntica ou parcial
    console.log('Testando verificação de conflito sobre o mesmo horário...');
    const conflitos = await reservaModel.checkConflict({
      equipamento_id: equip.id,
      data_inicio: dataInicioStr,
      data_fim: dataFimStr
    });

    if (conflitos.length === 0) {
      throw new Error('FALHA: Conflito de horário NÃO foi detectado!');
    }
    console.log(`[OK] Prevenção de conflito funcionou perfeitamente! Conflito detectado com reserva #${conflitos[0].id} (${conflitos[0].usuario_nome})`);

    // Testar cancelamento de reserva
    console.log(`Cancelando reserva de teste #${novaReserva.id}...`);
    await reservaModel.cancelReserva(novaReserva.id);
    const reservaCancelada = await reservaModel.getReservaById(novaReserva.id);
    if (reservaCancelada.status !== 'cancelada') {
      throw new Error(`FALHA: Status da reserva deveria ser 'cancelada', obtido: ${reservaCancelada.status}`);
    }
    console.log('[OK] Reserva cancelada com sucesso!');

    // Após cancelamento, o mesmo horário deve estar LIVRE para agendamento!
    const conflitosAposCancel = await reservaModel.checkConflict({
      equipamento_id: equip.id,
      data_inicio: dataInicioStr,
      data_fim: dataFimStr
    });
    if (conflitosAposCancel.length > 0) {
      throw new Error('FALHA: Reserva cancelada não deveria gerar conflito para novos agendamentos!');
    }
    console.log('[OK] Horário liberado após cancelamento (sem falso-positivo de conflito).');

    console.log('\n--- TODOS OS TESTES DO BLOCO 07 PASSARAM COM SUCESSO! ---');
    process.exit(0);
  } catch (err) {
    console.error('[ERRO NO TESTE BLOCO 07]:', err);
    process.exit(1);
  }
}

testBlock07();
