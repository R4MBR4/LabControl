const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'ocorrencia';

async function getAllOcorrencias(filters = {}) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  let sql = `
    SELECT o.*,
           u.nome AS usuario_nome, u.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           e.codigo_labcontrol AS equipamento_labcontrol, e.patrimonio_ufpi AS equipamento_patrimonio_ufpi,
           esp.nome AS espaco_nome
    FROM \`${TABLE}\` o
    LEFT JOIN \`usuario\` u ON o.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON o.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` esp ON o.espaco_id = esp.id
  `;

  const whereClauses = [];
  const values = [];

  if (filters.usuario_id) {
    whereClauses.push(`o.\`${fkUser}\` = ?`);
    values.push(filters.usuario_id);
  }
  if (filters.equipamento_id) {
    whereClauses.push(`o.\`${fkEquip}\` = ?`);
    values.push(filters.equipamento_id);
  }
  if (filters.status) {
    whereClauses.push(`o.status = ?`);
    values.push(filters.status);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY o.\`${pk}\` DESC`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function getOcorrenciaById(id, executor = pool, lock = false) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT o.*,
           u.nome AS usuario_nome, u.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           e.codigo_labcontrol AS equipamento_labcontrol, e.patrimonio_ufpi AS equipamento_patrimonio_ufpi,
           esp.nome AS espaco_nome
    FROM \`${TABLE}\` o
    LEFT JOIN \`usuario\` u ON o.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON o.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` esp ON o.espaco_id = esp.id
    WHERE o.\`${pk}\` = ?
    LIMIT 1
    ${lock ? 'FOR UPDATE' : ''}
  `;
  const [rows] = await executor.query(sql, [id]);
  return rows[0] || null;
}

async function createOcorrencia(data, executor = pool) {
  const cols = await getTableColumns(TABLE);
  const payload = { ...data };

  const dataCol = await resolveColumn(TABLE, ['data_registro', 'data_hora', 'created_at']);
  if (cols.includes(dataCol) && !payload[dataCol]) {
    payload[dataCol] = new Date();
  }

  if (cols.includes('status') && !payload.status) {
    payload.status = 'aberta';
  }

  const id = await insert(TABLE, payload, executor);
  return getOcorrenciaById(id, executor);
}

async function updateOcorrencia(id, data, executor = pool) {
  await update(TABLE, id, data, executor);
  return getOcorrenciaById(id, executor);
}

async function deleteOcorrencia(id) {
  return remove(TABLE, id);
}

module.exports = {
  TABLE,
  getAllOcorrencias,
  getOcorrenciaById,
  createOcorrencia,
  updateOcorrencia,
  deleteOcorrencia
};
