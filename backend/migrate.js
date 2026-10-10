const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function runMigration() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const port = Number(process.env.DB_PORT) || 3306;
  const database = process.env.DB_NAME || 'labcontrol';

  if (!host || !user) {
    console.error('Erro de configuração: DB_HOST e DB_USER são obrigatórios e devem ser definidos no arquivo .env.');
    process.exit(1);
  }

  const isCloud = host.includes('tidbcloud.com') || process.env.DB_SSL === 'true';

  console.log('----------------------------------------------------');
  console.log(' Inicializando migração de banco de dados...');
  console.log('----------------------------------------------------');

  const connectionConfig = {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    ssl: isCloud ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    } : undefined
  };

  try {
    const connection = await mysql.createConnection(connectionConfig);
    console.log(' Conectado com sucesso ao banco de dados!');

    const sqlFilePath = path.resolve(__dirname, '../database/schema.sql');
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo não encontrado: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    console.log(' Executando aplicação do schema.sql...');

    await connection.query(sqlContent);

    console.log('====================================================');
    console.log(' SUCESSO! Schema do banco de dados aplicado com êxito!');
    console.log('====================================================');

    await connection.end();
  } catch (error) {
    console.error(' Erro na migração:', error.message);
    process.exit(1);
  }
}

runMigration();
