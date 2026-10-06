const { pool } = require('./config/db');

async function executarTesteTodasTabelas() {
  console.log('=================================================================================');
  console.log('       TESTE COMPLETO DE MANIPULAÇÃO EM TODAS AS 9 TABELAS DO BANCO TIDB CLOUD');
  console.log('       Operações por tabela: INSERT -> SELECT -> UPDATE -> SELECT -> DELETE -> VERIFICAÇÃO');
  console.log('=================================================================================\n');

  const resultados = [];

  try {
    // 1. TABELA USUARIO
    console.log('🔹 [1/9] Testando Tabela: usuario...');
    const [insUser] = await pool.query(`
      INSERT INTO usuario (nome, email, senha, perfil, matricula, departamento, status)
      VALUES ('Teste Usuario Ciclo', 'teste_ciclo@labcontrol.ufpi.br', 'hash_teste', 'aluno', 'MAT-9999', 'Engenharia', 'ativo');
    `);
    const idUser = insUser.insertId;
    const [selUser1] = await pool.query('SELECT id, nome, status FROM usuario WHERE id = ?;', [idUser]);
    await pool.query('UPDATE usuario SET nome = ?, status = ? WHERE id = ?;', ['Teste Usuario Modificado', 'inativo', idUser]);
    const [selUser2] = await pool.query('SELECT id, nome, status FROM usuario WHERE id = ?;', [idUser]);
    await pool.query('DELETE FROM usuario WHERE id = ?;', [idUser]);
    const [delUserCheck] = await pool.query('SELECT COUNT(*) as total FROM usuario WHERE id = ?;', [idUser]);
    
    resultados.push({
      tabela: 'usuario',
      id: idUser,
      inserido: selUser1[0]?.nome === 'Teste Usuario Ciclo',
      alterado: selUser2[0]?.nome === 'Teste Usuario Modificado' && selUser2[0]?.status === 'inativo',
      apagado: delUserCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idUser}) -> Alterado para "Teste Usuario Modificado" -> Apagado com sucesso!`);

    // 2. TABELA ESPACO
    console.log('\n🔹 [2/9] Testando Tabela: espaco...');
    const [insEsp] = await pool.query(`
      INSERT INTO espaco (nome, codigo, capacidade, localizacao, status, descricao)
      VALUES ('Laboratório de Teste Ciclo', 'LAB-TEST-99', 30, 'Bloco Z - Sala 99', 'disponivel', 'Espaço de teste temporário');
    `);
    const idEsp = insEsp.insertId;
    const [selEsp1] = await pool.query('SELECT id, nome, capacidade FROM espaco WHERE id = ?;', [idEsp]);
    await pool.query('UPDATE espaco SET nome = ?, capacidade = ? WHERE id = ?;', ['Lab Teste Alterado', 45, idEsp]);
    const [selEsp2] = await pool.query('SELECT id, nome, capacidade FROM espaco WHERE id = ?;', [idEsp]);
    await pool.query('DELETE FROM espaco WHERE id = ?;', [idEsp]);
    const [delEspCheck] = await pool.query('SELECT COUNT(*) as total FROM espaco WHERE id = ?;', [idEsp]);

    resultados.push({
      tabela: 'espaco',
      id: idEsp,
      inserido: selEsp1[0]?.nome === 'Laboratório de Teste Ciclo',
      alterado: selEsp2[0]?.nome === 'Lab Teste Alterado' && Number(selEsp2[0]?.capacidade) === 45,
      apagado: delEspCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idEsp}) -> Alterado para "Lab Teste Alterado" -> Apagado com sucesso!`);

    // 3. TABELA EQUIPAMENTO
    console.log('\n🔹 [3/9] Testando Tabela: equipamento...');
    const [insEq] = await pool.query(`
      INSERT INTO equipamento (espaco_id, nome, codigo_patrimonio, categoria, modelo, status, exige_capacitacao)
      VALUES (1, 'Equipamento Teste Ciclo', 'PAT-TEST-999', 'Geral', 'Mod-X', 'disponivel', 0);
    `);
    const idEq = insEq.insertId;
    const [selEq1] = await pool.query('SELECT id, nome, status FROM equipamento WHERE id = ?;', [idEq]);
    await pool.query('UPDATE equipamento SET nome = ?, status = ? WHERE id = ?;', ['Equipamento Teste Alterado', 'em_uso', idEq]);
    const [selEq2] = await pool.query('SELECT id, nome, status FROM equipamento WHERE id = ?;', [idEq]);
    await pool.query('DELETE FROM equipamento WHERE id = ?;', [idEq]);
    const [delEqCheck] = await pool.query('SELECT COUNT(*) as total FROM equipamento WHERE id = ?;', [idEq]);

    resultados.push({
      tabela: 'equipamento',
      id: idEq,
      inserido: selEq1[0]?.nome === 'Equipamento Teste Ciclo',
      alterado: selEq2[0]?.nome === 'Equipamento Teste Alterado' && selEq2[0]?.status === 'em_uso',
      apagado: delEqCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idEq}) -> Alterado para "Equipamento Teste Alterado" -> Apagado com sucesso!`);

    // 4. TABELA RESERVA
    console.log('\n🔹 [4/9] Testando Tabela: reserva...');
    const [insRes] = await pool.query(`
      INSERT INTO reserva (usuario_id, espaco_id, equipamento_id, data_inicio, data_fim, finalidade, status)
      VALUES (2, 1, 2, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR), 'Reserva Teste Ciclo', 'confirmada');
    `);
    const idRes = insRes.insertId;
    const [selRes1] = await pool.query('SELECT id, finalidade, status FROM reserva WHERE id = ?;', [idRes]);
    await pool.query('UPDATE reserva SET status = ? WHERE id = ?;', ['cancelada', idRes]);
    const [selRes2] = await pool.query('SELECT id, finalidade, status FROM reserva WHERE id = ?;', [idRes]);
    await pool.query('DELETE FROM reserva WHERE id = ?;', [idRes]);
    const [delResCheck] = await pool.query('SELECT COUNT(*) as total FROM reserva WHERE id = ?;', [idRes]);

    resultados.push({
      tabela: 'reserva',
      id: idRes,
      inserido: selRes1[0]?.status === 'confirmada',
      alterado: selRes2[0]?.status === 'cancelada',
      apagado: delResCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idRes}) -> Alterado para "cancelada" -> Apagado com sucesso!`);

    // 5. TABELA UTILIZACAO (CHECK-IN / CHECK-OUT)
    console.log('\n🔹 [5/9] Testando Tabela: utilizacao...');
    const [insUt] = await pool.query(`
      INSERT INTO utilizacao (usuario_id, equipamento_id, data_inicio, status, condicao_retirada)
      VALUES (3, 2, NOW(), 'em_uso', 'Perfeito estado');
    `);
    const idUt = insUt.insertId;
    const [selUt1] = await pool.query('SELECT id, status, condicao_devolucao FROM utilizacao WHERE id = ?;', [idUt]);
    await pool.query('UPDATE utilizacao SET status = ?, condicao_devolucao = ?, data_fim = NOW() WHERE id = ?;', ['finalizado', 'Devolvido limpo e calibrado', idUt]);
    const [selUt2] = await pool.query('SELECT id, status, condicao_devolucao FROM utilizacao WHERE id = ?;', [idUt]);
    await pool.query('DELETE FROM utilizacao WHERE id = ?;', [idUt]);
    const [delUtCheck] = await pool.query('SELECT COUNT(*) as total FROM utilizacao WHERE id = ?;', [idUt]);

    resultados.push({
      tabela: 'utilizacao',
      id: idUt,
      inserido: selUt1[0]?.status === 'em_uso',
      alterado: selUt2[0]?.status === 'finalizado' && selUt2[0]?.condicao_devolucao === 'Devolvido limpo e calibrado',
      apagado: delUtCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idUt}) -> Alterado para "finalizado" -> Apagado com sucesso!`);

    // 6. TABELA OCORRENCIA
    console.log('\n🔹 [6/9] Testando Tabela: ocorrencia...');
    const [insOc] = await pool.query(`
      INSERT INTO ocorrencia (usuario_id, espaco_id, tipo, prioridade, descricao, status)
      VALUES (3, 1, 'aviso', 'media', 'Ocorrencia Teste Ciclo', 'aberta');
    `);
    const idOc = insOc.insertId;
    const [selOc1] = await pool.query('SELECT id, status, prioridade FROM ocorrencia WHERE id = ?;', [idOc]);
    await pool.query('UPDATE ocorrencia SET status = ?, prioridade = ? WHERE id = ?;', ['resolvida', 'baixa', idOc]);
    const [selOc2] = await pool.query('SELECT id, status, prioridade FROM ocorrencia WHERE id = ?;', [idOc]);
    await pool.query('DELETE FROM ocorrencia WHERE id = ?;', [idOc]);
    const [delOcCheck] = await pool.query('SELECT COUNT(*) as total FROM ocorrencia WHERE id = ?;', [idOc]);

    resultados.push({
      tabela: 'ocorrencia',
      id: idOc,
      inserido: selOc1[0]?.status === 'aberta',
      alterado: selOc2[0]?.status === 'resolvida' && selOc2[0]?.prioridade === 'baixa',
      apagado: delOcCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idOc}) -> Alterado para "resolvida" -> Apagado com sucesso!`);

    // 7. TABELA MANUTENCAO
    console.log('\n🔹 [7/9] Testando Tabela: manutencao...');
    const [insMan] = await pool.query(`
      INSERT INTO manutencao (equipamento_id, tipo, descricao, responsavel, custo, status)
      VALUES (2, 'preventiva', 'Manutencao Teste Ciclo', 'Tecnico Alfa', 150.00, 'agendada');
    `);
    const idMan = insMan.insertId;
    const [selMan1] = await pool.query('SELECT id, status, custo FROM manutencao WHERE id = ?;', [idMan]);
    await pool.query('UPDATE manutencao SET status = ?, custo = ? WHERE id = ?;', ['concluida', 200.00, idMan]);
    const [selMan2] = await pool.query('SELECT id, status, custo FROM manutencao WHERE id = ?;', [idMan]);
    await pool.query('DELETE FROM manutencao WHERE id = ?;', [idMan]);
    const [delManCheck] = await pool.query('SELECT COUNT(*) as total FROM manutencao WHERE id = ?;', [idMan]);

    resultados.push({
      tabela: 'manutencao',
      id: idMan,
      inserido: selMan1[0]?.status === 'agendada',
      alterado: selMan2[0]?.status === 'concluida' && Number(selMan2[0]?.custo) === 200,
      apagado: delManCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idMan}) -> Alterado para "concluida" (R$ 200) -> Apagado com sucesso!`);

    // 8. TABELA CONSUMIVEL
    console.log('\n🔹 [8/9] Testando Tabela: consumivel...');
    const [insCon] = await pool.query(`
      INSERT INTO consumivel (espaco_id, nome, categoria, quantidade, quantidade_minima, unidade)
      VALUES (2, 'Resina Teste Ciclo', 'Insumos 3D', 10, 2, 'litros');
    `);
    const idCon = insCon.insertId;
    const [selCon1] = await pool.query('SELECT id, nome, quantidade FROM consumivel WHERE id = ?;', [idCon]);
    await pool.query('UPDATE consumivel SET quantidade = ?, nome = ? WHERE id = ?;', [25, 'Resina Teste Atualizada', idCon]);
    const [selCon2] = await pool.query('SELECT id, nome, quantidade FROM consumivel WHERE id = ?;', [idCon]);
    await pool.query('DELETE FROM consumivel WHERE id = ?;', [idCon]);
    const [delConCheck] = await pool.query('SELECT COUNT(*) as total FROM consumivel WHERE id = ?;', [idCon]);

    resultados.push({
      tabela: 'consumivel',
      id: idCon,
      inserido: selCon1[0]?.nome === 'Resina Teste Ciclo',
      alterado: selCon2[0]?.nome === 'Resina Teste Atualizada' && Number(selCon2[0]?.quantidade) === 25,
      apagado: delConCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idCon}) -> Alterado para 25 litros -> Apagado com sucesso!`);

    // 9. TABELA CAPACITACAO
    console.log('\n🔹 [9/9] Testando Tabela: capacitacao...');
    const [insCap] = await pool.query(`
      INSERT INTO capacitacao (usuario_id, equipamento_id, titulo, status)
      VALUES (3, 2, 'Capacitacao Teste Ciclo', 'pendente');
    `);
    const idCap = insCap.insertId;
    const [selCap1] = await pool.query('SELECT id, titulo, status FROM capacitacao WHERE id = ?;', [idCap]);
    await pool.query('UPDATE capacitacao SET status = ?, titulo = ? WHERE id = ?;', ['ativo', 'Capacitacao Aprovada', idCap]);
    const [selCap2] = await pool.query('SELECT id, titulo, status FROM capacitacao WHERE id = ?;', [idCap]);
    await pool.query('DELETE FROM capacitacao WHERE id = ?;', [idCap]);
    const [delCapCheck] = await pool.query('SELECT COUNT(*) as total FROM capacitacao WHERE id = ?;', [idCap]);

    resultados.push({
      tabela: 'capacitacao',
      id: idCap,
      inserido: selCap1[0]?.status === 'pendente',
      alterado: selCap2[0]?.status === 'ativo' && selCap2[0]?.titulo === 'Capacitacao Aprovada',
      apagado: delCapCheck[0]?.total === 0
    });
    console.log(`   ✅ Inserido (ID ${idCap}) -> Alterado para "ativo" -> Apagado com sucesso!`);

    // RESUMO FINAL
    console.log('\n=================================================================================');
    console.log('                 RELATÓRIO DE VALIDAÇÃO GERAL (TODAS AS 9 TABELAS)');
    console.log('=================================================================================');
    console.table(resultados.map(r => ({
      'Tabela': r.tabela,
      'ID de Teste': r.id,
      'Insert (Subida)': r.inserido ? '✅ OK' : '❌ Falha',
      'Update (Alteração)': r.alterado ? '✅ OK' : '❌ Falha',
      'Delete (Limpeza)': r.apagado ? '✅ OK (0 resíduos)' : '❌ Falha'
    })));

    const todasValidadas = resultados.every(r => r.inserido && r.alterado && r.apagado);
    if (todasValidadas) {
      console.log('🎉 TODAS AS 9 TABELAS FORAM MANIPULADAS, ALTERADAS E LIMPAS COM 100% DE SUCESSO!');
    } else {
      console.error('⚠️ ALGUNS TESTES FALHARAM!');
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ ERRO NO TESTE GERAL DE TABELAS:', err);
    process.exit(1);
  }
}

executarTesteTodasTabelas();
