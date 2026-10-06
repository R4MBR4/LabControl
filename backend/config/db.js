const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const isCloud = process.env.DB_HOST && (process.env.DB_HOST.includes('tidbcloud.com') || process.env.DB_SSL === 'true');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'labcontrol',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  decimalNumbers: true,
  ssl: isCloud ? {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  } : undefined
};

const pool = mysql.createPool(dbConfig);

// Cache de colunas das tabelas para adaptação automática de esquemas existentes
const columnCache = {};

/**
 * Obtém os nomes das colunas de uma tabela existente no banco de dados.
 * Não altera nem cria nada, apenas inspeciona INFORMATION_SCHEMA.
 */
async function getTableColumns(tableName) {
  if (columnCache[tableName]) {
    return columnCache[tableName];
  }
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbConfig.database, tableName]
    );
    const cols = rows.map(r => r.COLUMN_NAME.toLowerCase());
    columnCache[tableName] = cols;
    return cols;
  } catch (err) {
    console.warn(`[DB] Aviso ao inspecionar colunas de ${tableName}:`, err.message);
    return [];
  }
}

/**
 * Retorna o primeiro nome de coluna existente na tabela dentre as opções fornecidas.
 * Exemplo: resolveColumn('usuario', ['id', 'id_usuario']) => 'id' ou 'id_usuario'
 */
async function resolveColumn(tableName, candidateNames) {
  const cols = await getTableColumns(tableName);
  if (!cols || cols.length === 0) {
    return candidateNames[0]; // fallback padrão
  }
  for (const candidate of candidateNames) {
    if (cols.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return candidateNames[0];
}

/**
 * Testa a conectividade com o banco de dados MySQL
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[DB] Conectado com sucesso ao banco MySQL: '${dbConfig.database}' em ${dbConfig.host}:${dbConfig.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`[DB] Erro ao conectar ao MySQL (${dbConfig.host}:${dbConfig.port}/${dbConfig.database}):`, error.message);
    console.error(`[DB] Certifique-se de que o serviço MySQL está ativo e que o banco '${dbConfig.database}' existe.`);
    return false;
  }
}

module.exports = {
  pool,
  dbConfig,
  getTableColumns,
  resolveColumn,
  testConnection
};
