const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'reserva';

async function getAllReservas(filters = {}) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');
  const espacoPk = await getPrimaryKey('espaco');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);

  let sql = `
    SELECT r.*,
           u.nome AS usuario_nome, u.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           s.nome AS espaco_nome
    FROM \`${TABLE}\` r
    LEFT JOIN \`usuario\` u ON r.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON r.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` s ON r.\`${fkEspaco}\` = s.\`${espacoPk}\`
  `;

  const whereClauses = [];
  const values = [];

  if (filters.usuario_id) {
    whereClauses.push(`r.\`${fkUser}\` = ?`);
    values.push(filters.usuario_id);
  }
  if (filters.equipamento_id) {
    whereClauses.push(`r.\`${fkEquip}\` = ?`);
    values.push(filters.equipamento_id);
  }
  if (filters.espaco_id) {
    whereClauses.push(`r.\`${fkEspaco}\` = ?`);
    values.push(filters.espaco_id);
  }
  if (filters.status) {
    whereClauses.push(`r.status = ?`);
    values.push(filters.status);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY r.\`${pk}\` DESC`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function getReservaById(id) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');
  const espacoPk = await getPrimaryKey('espaco');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);

  const sql = `
    SELECT r.*,
           u.nome AS usuario_nome, u.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           s.nome AS espaco_nome
    FROM \`${TABLE}\` r
    LEFT JOIN \`usuario\` u ON r.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON r.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` s ON r.\`${fkEspaco}\` = s.\`${espacoPk}\`
    WHERE r.\`${pk}\` = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Regra de negócio crítica: Prevenção de conflito de horário
 * Verifica se já existe reserva ativa/confirmada sobrepondo as datas fornecidas
 * para o mesmo equipamento ou espaço.
 */
async function checkConflict({ equipamento_id, espaco_id, data_inicio, data_fim, excludeId = null }) {
  const pk = await getPrimaryKey(TABLE);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);
  const colInicio = await resolveColumn(TABLE, ['data_inicio', 'inicio', 'data_hora_inicio']);
  const colFim = await resolveColumn(TABLE, ['data_fim', 'fim', 'data_hora_fim']);

  const conditions = [];
  const params = [];

  // Sobreposição temporal matemática: (A_inicio < B_fim) AND (A_fim > B_inicio)
  conditions.push(`r.\`${colInicio}\` < ? AND r.\`${colFim}\` > ?`);
  params.push(data_fim, data_inicio);

  // Considera apenas reservas não canceladas
  conditions.push(`(r.status IS NULL OR LOWER(r.status) NOT IN ('cancelada', 'cancelado', 'recusada', 'rejeitada'))`);

  if (equipamento_id && espaco_id) {
    conditions.push(`(r.\`${fkEquip}\` = ? OR r.\`${fkEspaco}\` = ?)`);
    params.push(equipamento_id, espaco_id);
  } else if (equipamento_id) {
    conditions.push(`r.\`${fkEquip}\` = ?`);
    params.push(equipamento_id);
  } else if (espaco_id) {
    conditions.push(`r.\`${fkEspaco}\` = ?`);
    params.push(espaco_id);
  } else {
    return [];
  }

  if (excludeId) {
    conditions.push(`r.\`${pk}\` != ?`);
    params.push(excludeId);
  }

  const sql = `SELECT * FROM \`${TABLE}\` r WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function createReserva(data) {
  const id = await insert(TABLE, data);
  return getReservaById(id);
}

async function updateReserva(id, data) {
  await update(TABLE, id, data);
  return getReservaById(id);
}

async function cancelReserva(id) {
  return updateReserva(id, { status: 'cancelada' });
}

module.exports = {
  TABLE,
  getAllReservas,
  getReservaById,
  checkConflict,
  createReserva,
  updateReserva,
  cancelReserva
};
