const { pool, getTableColumns, resolveColumn } = require('../config/db');

/**
 * Filtra um objeto com campos recebidos da requisição mantendo apenas
 * as chaves que de fato existem na tabela do banco de dados (ignorando case).
 */
async function filterValidColumns(tableName, data) {
  const tableCols = await getTableColumns(tableName);
  if (!tableCols || tableCols.length === 0) {
    return data;
  }

  const validData = {};
  const lowerToReal = {};
  for (const col of tableCols) {
    lowerToReal[col] = col;
  }

  for (const [key, value] of Object.entries(data)) {
    const kLower = key.toLowerCase();
    if (lowerToReal[kLower]) {
      validData[lowerToReal[kLower]] = value;
    }
  }
  return validData;
}

/**
 * Detecta o nome da chave primária da tabela (ex: 'id', 'id_usuario', 'id_equipamento')
 */
async function getPrimaryKey(tableName) {
  const defaultPk = `id_${tableName}`;
  const pk = await resolveColumn(tableName, ['id', defaultPk, `${tableName}_id`]);
  return pk;
}

/**
 * Insere um registro na tabela existente utilizando apenas colunas existentes
 */
async function insert(tableName, data) {
  const filtered = await filterValidColumns(tableName, data);
  const keys = Object.keys(filtered);
  if (keys.length === 0) {
    throw new Error(`Nenhum campo válido fornecido para inserção na tabela '${tableName}'`);
  }

  const columns = keys.map(k => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const values = Object.values(filtered);

  const sql = `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders})`;
  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Atualiza um registro existente na tabela
 */
async function update(tableName, id, data) {
  const pk = await getPrimaryKey(tableName);
  const filtered = await filterValidColumns(tableName, data);
  delete filtered[pk]; // não atualiza a PK

  const keys = Object.keys(filtered);
  if (keys.length === 0) {
    return false;
  }

  const setClauses = keys.map(k => `\`${k}\` = ?`).join(', ');
  const values = [...Object.values(filtered), id];

  const sql = `UPDATE \`${tableName}\` SET ${setClauses} WHERE \`${pk}\` = ?`;
  const [result] = await pool.query(sql, values);
  return result.affectedRows > 0;
}

/**
 * Remove um registro por ID
 */
async function remove(tableName, id) {
  const pk = await getPrimaryKey(tableName);
  const sql = `DELETE FROM \`${tableName}\` WHERE \`${pk}\` = ?`;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows > 0;
}

/**
 * Busca registro por ID
 */
async function findById(tableName, id) {
  const pk = await getPrimaryKey(tableName);
  const sql = `SELECT * FROM \`${tableName}\` WHERE \`${pk}\` = ? LIMIT 1`;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Busca todos os registros com filtro opcional
 */
async function findAll(tableName, conditions = {}, orderBy = null) {
  let sql = `SELECT * FROM \`${tableName}\``;
  const values = [];

  const keys = Object.keys(conditions);
  if (keys.length > 0) {
    const whereClauses = keys.map(k => `\`${k}\` = ?`).join(' AND ');
    sql += ` WHERE ${whereClauses}`;
    values.push(...Object.values(conditions));
  }

  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }

  const [rows] = await pool.query(sql, values);
  return rows;
}

module.exports = {
  pool,
  getPrimaryKey,
  resolveColumn,
  filterValidColumns,
  insert,
  update,
  remove,
  findById,
  findAll
};
