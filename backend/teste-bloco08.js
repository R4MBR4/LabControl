const reservaModel = require('./models/reservaModel');
const equipamentoModel = require('./models/equipamentoModel');
const espacoModel = require('./models/espacoModel');
const { pool } = require('./models/dbHelper');

async function testBlock08() {
  console.log('--- TESTE BLOCO 08: RESERVAS RECORRENTES E NO-SHOW ---');

  try {
    const [users] = await pool.query('SELECT id, nome FROM usuario LIMIT 1');
    const user = users[0];
    const equip = (await equipamentoModel.getAllEquipamentos())[0];
    const espaco = (await espacoModel.getAllEspacos())[0];

    console.log(`[OK] Usuário: ${user.nome} (ID ${user.id})`);
    console.log(`[OK] Recurso: ${equip.nome} (ID ${equip.id})`);

    // 1. Gerar array de 4 ocorrências em semanas consecutivas
    const baseDate = new Date(Date.now() + 15 * 86400000); // 15 dias no futuro
    const ocorrenciasValidas = [];

    for (let i = 0; i < 4; i++) {
      const dInicio = new Date(baseDate);
      dInicio.setDate(dInicio.getDate() + i * 7);
      dInicio.setHours(10, 0, 0, 0);

      const dFim = new Date(dInicio);
      dFim.setHours(12, 0, 0, 0);

      ocorrenciasValidas.push({
        data_inicio: dInicio.toISOString().slice(0, 19).replace('T', ' '),
        data_fim: dFim.toISOString().slice(0, 19).replace('T', ' ')
      });
    }

    console.log(`Geradas ${ocorrenciasValidas.length} ocorrências semanais para teste.`);

    // 2. Testar rejeição de conflito na série:
    // Criar uma reserva avulsa que colida especificamente com a 3ª ocorrência
    console.log('Criando reserva isolada que colide com a 3ª ocorrência da série futura...');
    const colidida = await reservaModel.createReserva({
      usuario_id: user.id,
      equipamento_id: equip.id,
      espaco_id: equip.espaco_id || espaco.id,
      data_inicio: ocorrenciasValidas[2].data_inicio,
      data_fim: ocorrenciasValidas[2].data_fim,
      finalidade: 'Reserva isolada para teste de colisão',
      status: 'confirmada'
    });

    console.log('Tentando criar série recorrente com colisão na 3ª ocorrência...');
    const resConflito = await reservaModel.createSerieRecorrente({
      usuario_id: user.id,
      equipamento_id: equip.id,
      espaco_id: equip.espaco_id || espaco.id,
      ocorrencias: ocorrenciasValidas,
      finalidade: 'Tentativa de Série com Conflito',
      regra_recorrencia: 'semanal:2'
    });

    if (resConflito.success !== false) {
      throw new Error('FALHA: Série recorrente deveria ter sido rejeitada devido ao conflito na 3ª semana!');
    }
    console.log(`[OK] Série REJEITADA corretamente com conflito na ocorrência ${resConflito.ocorrenciaIndice}: "${resConflito.error}"`);

    // Remover a reserva isolada de colisão
    await reservaModel.cancelReserva(colidida.id);
    console.log('[OK] Reserva de colisão cancelada.');

    // 3. Criar série recorrente agora válida e livre de conflitos
    console.log('Criando série recorrente sem conflitos...');
    const serieCriada = await reservaModel.createSerieRecorrente({
      usuario_id: user.id,
      equipamento_id: equip.id,
      espaco_id: equip.espaco_id || espaco.id,
      ocorrencias: ocorrenciasValidas,
      finalidade: 'Aulas de Sistemas Embarcados - Série Semanal',
      regra_recorrencia: 'semanal:2',
      tolerancia_no_show_min: 15
    });

    if (!serieCriada.success || serieCriada.totalCriadas !== 4) {
      throw new Error(`FALHA ao criar série recorrente: ${JSON.stringify(serieCriada)}`);
    }
    console.log(`[OK] Série criada com sucesso! Grupo ID: ${serieCriada.grupo_recorrencia_id} (${serieCriada.totalCriadas} ocorrências)`);

    const ids = serieCriada.reservasCriadas;
    const [r1, r2, r3, r4] = ids;

    // 4. Testar cancelamento de ocorrência individual (apenas_esta)
    console.log(`Testando cancelamento individual da ocorrência #2 (ID ${r2})...`);
    const cancelItem = await reservaModel.cancelarOcorrenciaRecorrente(r2, 'apenas_esta');
    if (!cancelItem || cancelItem.reserva.status !== 'cancelada') {
      throw new Error('FALHA ao cancelar ocorrência individual');
    }

    const checkR1 = await reservaModel.getReservaById(r1);
    const checkR3 = await reservaModel.getReservaById(r3);
    if (checkR1.status !== 'confirmada' || checkR3.status !== 'confirmada') {
      throw new Error('FALHA: Outras reservas da série foram afetadas pelo cancelamento individual!');
    }
    console.log('[OK] Cancelamento individual bem-sucedido! Ocorrências 1, 3 e 4 permanecem ativas.');

    // 5. Testar cancelamento de "proximas" a partir da ocorrência #3
    console.log(`Testando cancelamento de "proximas" a partir da ocorrência #3 (ID ${r3})...`);
    await reservaModel.cancelarOcorrenciaRecorrente(r3, 'proximas');
    const checkR3Depois = await reservaModel.getReservaById(r3);
    const checkR4Depois = await reservaModel.getReservaById(r4);
    if (checkR3Depois.status !== 'cancelada' || checkR4Depois.status !== 'cancelada') {
      throw new Error('FALHA: Próximas reservas deveriam ter sido canceladas!');
    }
    const checkR1Depois = await reservaModel.getReservaById(r1);
    if (checkR1Depois.status !== 'confirmada') {
      throw new Error('FALHA: Ocorrência 1 anterior não deveria ter sido cancelada ao cancelar próximas!');
    }
    console.log('[OK] Cancelamento de "proximas" bem-sucedido! Ocorrência 1 preservada.');

    // 6. Testar marcação de No-Show
    console.log(`Testando marcação de No-Show na ocorrência #1 (ID ${r1})...`);
    const noShowResult = await reservaModel.marcarNoShow(r1);
    if (!noShowResult || noShowResult.no_show !== 1 || !noShowResult.no_show_at) {
      throw new Error('FALHA na marcação de No-Show');
    }
    console.log(`[OK] No-Show registrado com sucesso (no_show=${noShowResult.no_show}, data=${noShowResult.no_show_at}).`);

    // 7. Testar verificação automatizada de No-Shows
    console.log('Testando verificação automatizada de No-Shows com tolerância de 15 min...');
    const autoNoShow = await reservaModel.verificarNoShowsAutomaticos(15);
    console.log(`[OK] Verificação executada com sucesso: ${autoNoShow.totalMarcados} registro(s) processados.`);

    console.log('\n--- TODOS OS TESTES DO BLOCO 08 PASSARAM COM SUCESSO! ---');
    process.exit(0);
  } catch (err) {
    console.error('[ERRO NO TESTE BLOCO 08]:', err);
    process.exit(1);
  }
}

testBlock08();
