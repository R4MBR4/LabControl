const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'utilizacao';

async function getAllUtilizacoes(filters = {}) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const fkReserva = await resolveColumn(TABLE, ['reserva_id', 'id_reserva']);

  let sql = `
    SELECT u.*,
           us.nome AS usuario_nome, us.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo
    FROM \`${TABLE}\` u
    LEFT JOIN \`usuario\` us ON u.\`${fkUser}\` = us.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON u.\`${fkEquip}\` = e.\`${equipPk}\`
  `;

  const whereClauses = [];
  const values = [];

  if (filters.usuario_id) {
    whereClauses.push(`u.\`${fkUser}\` = ?`);
    values.push(filters.usuario_id);
  }
  if (filters.equipamento_id) {
    whereClauses.push(`u.\`${fkEquip}\` = ?`);
    values.push(filters.equipamento_id);
  }
  if (filters.status) {
    whereClauses.push(`u.status = ?`);
    values.push(filters.status);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY u.\`${pk}\` DESC`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function getUtilizacaoById(id) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT u.*,
           us.nome AS usuario_nome, us.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo
    FROM \`${TABLE}\` u
    LEFT JOIN \`usuario\` us ON u.\`${fkUser}\` = us.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON u.\`${fkEquip}\` = e.\`${equipPk}\`
    WHERE u.\`${pk}\` = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Busca utilização ativa (em_uso) para um determinado equipamento ou usuário
 */
async function getActiveUtilizacaoByEquipamento(equipId) {
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const sql = `
    SELECT * FROM \`${TABLE}\`
    WHERE \`${fkEquip}\` = ? 
      AND (status = 'em_uso' OR data_checkout IS NULL OR checkout IS NULL)
    ORDER BY id DESC LIMIT 1
  `;
  const [rows] = await pool.query(sql, [equipId]);
  return rows[0] || null;
}

async function createCheckin(data) {
  const cols = await getTableColumns(TABLE);
  const checkinPayload = { ...data };

  // Garante timestamp de checkin
  const checkinCol = await resolveColumn(TABLE, ['data_checkin', 'checkin', 'data_inicio']);
  if (!checkinPayload[checkinCol]) {
    checkinPayload[checkinCol] = new Date();
  }

  if (cols.includes('status') && !checkinPayload.status) {
    checkinPayload.status = 'em_uso';
  }

  const id = await insert(TABLE, checkinPayload);
  return getUtilizacaoById(id);
}

/**
 * Checkout com registro obrigatório da condição do equipamento
 */
async function executeCheckout(id, checkoutData) {
  const cols = await getTableColumns(TABLE);
  const data = { ...checkoutData };

  const checkoutCol = await resolveColumn(TABLE, ['data_checkout', 'checkout', 'data_fim']);
  data[checkoutCol] = new Date();

  if (cols.includes('status')) {
    data.status = 'finalizado';
  }

  await update(TABLE, id, data);
  return getUtilizacaoById(id);
}

module.exports = {
  TABLE,
  getAllUtilizacoes,
  getUtilizacaoById,
  getActiveUtilizacaoByEquipamento,
  createCheckin,
  executeCheckout
};
