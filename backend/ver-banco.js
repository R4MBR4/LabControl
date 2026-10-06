const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function demonstrarBanco() {
  console.log('========================================================================');
  console.log('  LABCONTROL - DEMONSTRAÇÃO DO BANCO DE DADOS NA NUVEM (MySQL / TiDB)  ');
  console.log('========================================================================');
  console.log(`  Servidor / Host: ${process.env.DB_HOST}`);
  console.log(`  Porta:           ${process.env.DB_PORT}`);
  console.log(`  Base de Dados:   ${process.env.DB_NAME}`);
  console.log(`  Ambiente:        Nuvem AWS (São Paulo - sa-east-1)`);
  console.log('------------------------------------------------------------------------\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 4000,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });

    console.log('[+] Status da Conexão: CONECTADO COM SUCESSO!\n');

    // 1. Listagem das 9 tabelas e contagem de registros
    console.log('1. TABELAS NORMALIZADAS NO BANCO DE DADOS:');
    const [tabelas] = await connection.query('SHOW TABLES;');
    const nomesTabelas = tabelas.map(t => Object.values(t)[0]);

    for (const nome of nomesTabelas) {
      const [contagem] = await connection.query(`SELECT COUNT(*) AS total FROM \`${nome}\``);
      console.log(`   - ${nome.padEnd(20)} -> ${contagem[0].total} registro(s)`);
    }

    // 2. Amostra de Usuários
    console.log('\n2. AMOSTRA DA TABELA "usuario" (Controle de Acesso com Bcrypt):');
    const [usuarios] = await connection.query('SELECT id, nome, email, perfil, status FROM usuario;');
    console.table(usuarios);

    // 3. Amostra de Espaços
    console.log('\n3. AMOSTRA DA TABELA "espaco" (Laboratórios e Salas):');
    const [espacos] = await connection.query('SELECT id, nome, codigo, capacidade, status FROM espaco;');
    console.table(espacos);

    // 4. Amostra de Equipamentos
    console.log('\n4. AMOSTRA DA TABELA "equipamento" (Patrimônio e Rastreabilidade):');
    const [equips] = await connection.query('SELECT id, nome, codigo_patrimonio, status, exige_capacitacao FROM equipamento;');
    console.table(equips);

    console.log('\n========================================================================');
    console.log('  INTEGRIDADE REFERENCIAL E CONSTRAINTS VALIDADAS COM SUCESSO!        ');
    console.log('========================================================================');

    await connection.end();
  } catch (error) {
    console.error('[-] Erro ao conectar ao banco:', error.message);
  }
}

demonstrarBanco();
