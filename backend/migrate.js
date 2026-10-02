const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function runMigration() {
  const host = (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') 
    ? process.env.DB_HOST 
    : 'gateway01.sa-east-1.prod.aws.tidbcloud.com';

  const user = (process.env.DB_USER && process.env.DB_USER !== 'root')
    ? process.env.DB_USER
    : 'HeM5cUxXcweZ747.root';

  const password = process.env.DB_PASSWORD || '6SFCN7tOoUihsvtW';
  const port = Number(process.env.DB_PORT) || 4000;

  console.log('----------------------------------------------------');
  console.log(' Conectando ao TiDB Cloud na nuvem...');
  console.log(` Host: ${host}`);
  console.log(` Porta: ${port}`);
  console.log(` Usuário: ${user}`);
  console.log('----------------------------------------------------');

  const connectionConfig = {
    host,
    port,
    user,
    password,
    multipleStatements: true,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  };

  try {
    const connection = await mysql.createConnection(connectionConfig);
    console.log(' Conectado com sucesso ao TiDB Cloud!');

    const sqlFilePath = path.resolve(__dirname, '../database/schema.sql');
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo não encontrado: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    console.log(' Executando criação das 9 tabelas e seeds...');

    await connection.query(sqlContent);

    console.log('====================================================');
    console.log(' SUCESSO! Banco labcontrol criado e populado na nuvem!');
    console.log(' Tabelas ativas:');
    console.log('  usuario, espaco, equipamento, reserva, utilizacao,');
    console.log('  ocorrencia, manutencao, consumivel, capacitacao');
    console.log('====================================================');

    await connection.end();
  } catch (error) {
    console.error(' Erro na migração:', error.message);
  }
}

runMigration();
