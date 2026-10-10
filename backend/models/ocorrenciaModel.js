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
           COALESCE(o.espaco_id, e.espaco_id) AS espaco_id,
           esp.nome AS espaco_nome,
           (SELECT m.id FROM manutencao m WHERE m.equipamento_id = o.equipamento_id AND LOWER(COALESCE(m.status, '')) NOT IN ('concluida', 'concluído', 'concluido', 'cancelada', 'cancelado') LIMIT 1) AS manutencao_id,
           (SELECT m.status FROM manutencao m WHERE m.equipamento_id = o.equipamento_id AND LOWER(COALESCE(m.status, '')) NOT IN ('concluida', 'concluído', 'concluido', 'cancelada', 'cancelado') LIMIT 1) AS manutencao_status
    FROM \`${TABLE}\` o
    LEFT JOIN \`usuario\` u ON o.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON o.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` esp ON COALESCE(o.espaco_id, e.espaco_id) = esp.id
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
  if (filters.espaco_id) {
    whereClauses.push(`COALESCE(o.espaco_id, e.espaco_id) = ?`);
    values.push(filters.espaco_id);
  }
  if (filters.gravidade) {
    whereClauses.push(`LOWER(COALESCE(o.gravidade, '')) = LOWER(?)`);
    values.push(filters.gravidade);
  }
  if (filters.data_inicio_de) {
    whereClauses.push(`o.data_registro >= ?`);
    values.push(filters.data_inicio_de);
  }
  if (filters.data_fim_ate) {
    const dataAte = /^\d{4}-\d{2}-\d{2}$/.test(String(filters.data_fim_ate))
      ? `${filters.data_fim_ate} 23:59:59`
      : filters.data_fim_ate;
    whereClauses.push(`o.data_registro <= ?`);
    values.push(dataAte);
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
