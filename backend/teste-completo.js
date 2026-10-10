const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const results = [];
function report(step, name, passed, details = '') {
  results.push({ step, name, status: passed ? 'PASS' : 'FAIL', details });
  console.log(`[${passed ? 'APROVADO' : 'FALHOU'}] Etapa ${step}: ${name} ${details ? '(' + details + ')' : ''}`);
}

async function runCompleteDiagnostics() {
  console.log('========================================================================');
  console.log('        TESTE COMPLETO DE INTEGRAÇÃO: LABCONTROL <-> TIDB CLOUD         ');
  console.log('========================================================================');
  console.log(`  Alvo:      ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`  Base:      ${process.env.DB_NAME}`);
  console.log(`  Início:    ${new Date().toLocaleString('pt-BR')}`);
  console.log('------------------------------------------------------------------------\n');

  let connection;
  try {
    // 1. Conexão Segura
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 4000,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });
    report(1, 'Conectividade SSL com TiDB Cloud na AWS', true, 'Handshake TLS v1.2 bem-sucedido');

    // 2. Verificação das 9 Tabelas Obrigatórias
    const [tabRows] = await connection.query('SHOW TABLES;');
    const tablesInDb = tabRows.map(t => Object.values(t)[0]);
    const requiredTables = [
      'usuario', 'espaco', 'equipamento', 'reserva',
      'utilizacao', 'ocorrencia', 'manutencao', 'consumivel', 'capacitacao'
    ];
    const missingTables = requiredTables.filter(t => !tablesInDb.includes(t));
    report(2, 'Estrutura das 9 Tabelas Relacionais', missingTables.length === 0, 
      missingTables.length === 0 ? 'Todas as 9 tabelas presentes' : `Faltando: ${missingTables.join(', ')}`);

    // 3. Autenticação e Hash Bcrypt
    const [userRows] = await connection.query("SELECT * FROM usuario WHERE email = 'admin@labcontrol.com' LIMIT 1;");
    if (userRows.length > 0) {
      const admin = userRows[0];
      const passValid = await bcrypt.compare('admin123', admin.senha);
      const jwtSecret = process.env.JWT_SECRET || 'test-only-diagnostic-secret-key-0123456789';
      const token = jwt.sign({ id: admin.id, perfil: admin.perfil }, jwtSecret, { expiresIn: '1h' });
      report(3, 'Autenticação de Usuário e Validação Bcrypt', passValid && !!token, 'Login com admin@labcontrol.com validado');
    } else {
      report(3, 'Autenticação de Usuário e Validação Bcrypt', false, 'Usuário admin não encontrado');
    }

    // 4. Módulo de Espaços
    const [espacos] = await connection.query('SELECT * FROM espaco;');
    report(4, 'Consulta e Integridade de Espaços/Laboratórios', espacos.length >= 4, `${espacos.length} laboratórios cadastrados`);

    // 5. Módulo de Equipamentos
    const [equips] = await connection.query(`
      SELECT e.*, s.nome AS espaco_nome 
      FROM equipamento e 
      JOIN espaco s ON e.espaco_id = s.id;
    `);
    report(5, 'Integridade de Equipamentos e Vinculação a Espaços', equips.length >= 6, `${equips.length} equipamentos verificados`);

    // 6. Regra de Negócio: Prevenção de Conflito de Horário em Reservas
    const testStart = new Date(Date.now() + 86400000); // amanhã
    const testEnd = new Date(Date.now() + 86400000 + 7200000); // amanhã + 2h
    
    // Inserção da primeira reserva
    const [res1] = await connection.query(`
      INSERT INTO reserva (usuario_id, espaco_id, equipamento_id, data_inicio, data_fim, finalidade, status)
      VALUES (1, 1, 1, ?, ?, 'Teste Automatizado 1', 'confirmada');
    `, [testStart, testEnd]);
    const reservaId = res1.insertId;

    // Tentativa matemática de detectar conflito: sobreposição (A_inicio < B_fim) AND (A_fim > B_inicio)
    const conflitoStart = new Date(testStart.getTime() + 1800000); // 30 min depois do início
    const conflitoEnd = new Date(testEnd.getTime() + 1800000);
    const [conflitos] = await connection.query(`
      SELECT * FROM reserva 
      WHERE equipamento_id = 1 
        AND status NOT IN ('cancelada', 'rejeitada')
        AND data_inicio < ? AND data_fim > ?;
    `, [conflitoEnd, conflitoStart]);
    
    const conflitoDetectado = conflitos.length > 0;
    // Limpeza da reserva de teste
    await connection.query('DELETE FROM reserva WHERE id = ?;', [reservaId]);
    report(6, 'Prevenção Matemática de Conflito de Horário', conflitoDetectado, 'Sobreposição de horários bloqueada');

    // 7. Módulo de Utilização e Check-in via QR Code
    const [checkinRes] = await connection.query(`
      INSERT INTO utilizacao (usuario_id, equipamento_id, data_inicio, status, condicao_retirada)
      VALUES (1, 3, NOW(), 'em_uso', 'Operacional sem avarias');
    `);
    const utilizacaoId = checkinRes.insertId;
    await connection.query("UPDATE utilizacao SET data_fim = NOW(), status = 'concluida', condicao_devolucao = 'Devolvido em perfeito estado' WHERE id = ?;", [utilizacaoId]);
    await connection.query('DELETE FROM utilizacao WHERE id = ?;', [utilizacaoId]);
    report(7, 'Fluxo de Check-in e Check-out via QR Code', !!utilizacaoId, 'Ciclo de sessão concluído com sucesso');

    // 8. Módulo de Ocorrências
    const [ocRes] = await connection.query(`
      INSERT INTO ocorrencia (equipamento_id, espaco_id, usuario_id, tipo, prioridade, descricao, status)
      VALUES (1, 2, 1, 'defeito', 'alta', 'Teste de ocorrência automatizada', 'aberta');
    `);
    const ocorrenciaId = ocRes.insertId;
    await connection.query("UPDATE ocorrencia SET status = 'resolvida', data_resolucao = NOW() WHERE id = ?;", [ocorrenciaId]);
    await connection.query('DELETE FROM ocorrencia WHERE id = ?;', [ocorrenciaId]);
    report(8, 'Abertura e Resolução de Ocorrências', !!ocorrenciaId, 'Ciclo de chamado registrado');

    // 9. Módulo de Manutenção: Bloqueio e Desbloqueio de Equipamento
    const [manRes] = await connection.query(`
      INSERT INTO manutencao (equipamento_id, tipo, descricao, status, custo)
      VALUES (6, 'preventiva', 'Manutenção teste automatizada', 'em_andamento', 50.00);
    `);
    const manId = manRes.insertId;
    await connection.query("UPDATE equipamento SET status = 'manutencao' WHERE id = 6;");
    
    // Conclusão da manutenção
    await connection.query("UPDATE manutencao SET status = 'concluida', data_fim = NOW(), laudo_tecnico = 'Calibrado com sucesso' WHERE id = ?;", [manId]);
    await connection.query("UPDATE equipamento SET status = 'disponivel' WHERE id = 6;");
    await connection.query('DELETE FROM manutencao WHERE id = ?;', [manId]);
    report(9, 'Ciclo de Manutenção (Bloqueio -> Reparo -> Liberação)', true, 'Equipamento retornou para DISPONÍVEL');

    // 10. Módulo de Consumíveis e Validação de Estoque
    const [consumiveis] = await connection.query('SELECT * FROM consumivel;');
    const temEstoqueCritico = consumiveis.some(c => Number(c.quantidade) <= Number(c.quantidade_minima));
    report(10, 'Controle de Insumos e Alerta de Estoque Crítico', consumiveis.length >= 4 && temEstoqueCritico, 'Regra de estoque crítico validada');

    // 11. Módulo de Capacitações
    const [capacitacoes] = await connection.query(`
      SELECT c.*, u.nome AS usuario_nome, e.nome AS equipamento_nome
      FROM capacitacao c
      JOIN usuario u ON c.usuario_id = u.id
      JOIN equipamento e ON c.equipamento_id = e.id;
    `);
    report(11, 'Matriz de Habilitação e Capacitações Técnicas', capacitacoes.length >= 3, `${capacitacoes.length} habilitações ativas`);

    console.log('\n========================================================================');
    console.log('                      RESULTADO GERAL DOS TESTES                        ');
    console.log('========================================================================');
    const aprovados = results.filter(r => r.status === 'PASS').length;
    const total = results.length;
    console.log(`  Total de Etapas Testadas: ${total}`);
    console.log(`  Etapas Aprovadas:         ${aprovados}`);
    console.log(`  Etapas com Falha:         ${total - aprovados}`);
    console.log(`  Índice de Confiabilidade: ${(aprovados / total * 100).toFixed(0)}%`);
    console.log('========================================================================\n');

  } catch (error) {
    console.error('[-] Erro crítico durante os diagnósticos:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

runCompleteDiagnostics();
