const { pool } = require('./config/db');
const reservaModel = require('./models/reservaModel');

async function executarDiagnosticoCompleto() {
  console.log('================================================================');
  console.log('  TESTE COMPLETO DE FLUXO NO BANCO DE DADOS TIDB CLOUD');
  console.log('  Host: gateway01.sa-east-1.prod.aws.tidbcloud.com (AWS SP)');
  console.log('  Base: labcontrol');
  console.log('================================================================\n');

  try {
    // 1. Conexão
    const [dbInfo] = await pool.query('SELECT DATABASE() AS db, VERSION() AS versao, NOW() AS horario;');
    console.log(`✅ [CONECTADO] Banco: ${dbInfo[0].db} | Horário do servidor: ${dbInfo[0].horario}`);

    // 2. Estado antes do teste
    const [reservasAntes] = await pool.query('SELECT id, finalidade, status FROM reserva;');
    console.log(`\n📋 [RESERVAS ATUAIS NO BANCO (${reservasAntes.length} cadastradas)]:`);
    reservasAntes.forEach(r => console.log(`   - ID ${r.id}: [${r.status}] ${r.finalidade}`));

    // 3. SUBINDO uma nova reserva
    console.log('\n--- ETAPA 1: SUBINDO NOVA RESERVA AO BANCO ---');
    const nova = await reservaModel.createReserva({
      usuario_id: 3, // Mariana Lima
      espaco_id: 2,  // Espaço Maker
      equipamento_id: 1, // Impressora 3D
      data_inicio: new Date(Date.now() + 10000000),
      data_fim: new Date(Date.now() + 14000000),
      finalidade: 'Teste Academico - Validacao de Ciclo Completo',
      status: 'confirmada'
    });
    console.log(`🟢 [SUBIDO COM SUCESSO] Nova Reserva ID: ${nova.id} | Status inicial: ${nova.status}`);

    // 4. Verificando persistência no banco físico
    const [checkInsert] = await pool.query('SELECT id, usuario_id, espaco_id, equipamento_id, status FROM reserva WHERE id = ?', [nova.id]);
    console.log('🔍 [CONSULTADO NO TIDB CLOUD]:', checkInsert[0]);

    // 5. CANCELANDO a reserva
    console.log('\n--- ETAPA 2: CANCELANDO A RESERVA ---');
    const cancelada = await reservaModel.cancelReserva(nova.id);
    console.log(`🟡 [CANCELAMENTO EXECUTADO]: Status retornado pelo modelo: ${cancelada.status}`);

    // 6. Verificando se o status realmente virou 'cancelada' no banco físico
    const [checkCancel] = await pool.query('SELECT id, status FROM reserva WHERE id = ?', [nova.id]);
    console.log('🔍 [VERIFICADO APÓS CANCELAR]:', checkCancel[0]);

    if (checkCancel[0].status !== 'cancelada') {
      throw new Error('Falha: o status no banco não foi atualizado para cancelada!');
    }
    console.log('✅ Status validado no TiDB Cloud: cancelada');

    // 7. APAGANDO a reserva de teste para manter o banco limpo
    console.log('\n--- ETAPA 3: APAGANDO A RESERVA DE TESTE ---');
    await pool.query('DELETE FROM reserva WHERE id = ?', [nova.id]);
    console.log(`🔴 [APAGADO COM SUCESSO]: Registro ID ${nova.id} deletado do banco.`);

    // 8. Verificando que o registro foi totalmente removido
    const [checkDelete] = await pool.query('SELECT COUNT(*) AS total FROM reserva WHERE id = ?', [nova.id]);
    console.log(`🔍 [VERIFICAÇÃO DE LIMPEZA]: Registros restantes com ID ${nova.id}: ${checkDelete[0].total}`);

    console.log('\n================================================================');
    console.log('  RESULTADO: BANCO DE DADOS 100% OPERACIONAL E VALIDADO!');
    console.log('  Subida: OK | Cancelamento: OK | Exclusão: OK');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERRO NO DIAGNÓSTICO DO BANCO:', err);
    process.exit(1);
  }
}

executarDiagnosticoCompleto();
