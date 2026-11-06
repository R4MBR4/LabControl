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
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           e.codigo_labcontrol AS equipamento_labcontrol, e.patrimonio_ufpi AS equipamento_patrimonio_ufpi,
           e.espaco_id, esp.nome AS espaco_nome
    FROM \`${TABLE}\` u
    LEFT JOIN \`usuario\` us ON u.\`${fkUser}\` = us.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON u.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN espaco esp ON e.espaco_id = esp.id
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
  if (filters.espaco_id) {
    whereClauses.push(`e.espaco_id = ?`);
    values.push(filters.espaco_id);
  }
  if (filters.data_inicio_de) {
    whereClauses.push(`u.data_inicio >= ?`);
    values.push(filters.data_inicio_de);
  }
  if (filters.data_fim_ate) {
    const dataAte = /^\d{4}-\d{2}-\d{2}$/.test(String(filters.data_fim_ate))
      ? `${filters.data_fim_ate} 23:59:59`
      : filters.data_fim_ate;
    whereClauses.push(`u.data_inicio <= ?`);
    values.push(dataAte);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY u.\`${pk}\` DESC`;

  const [rows] = await pool.query(sql, values);
  return rows.map((u) => ({
    ...u,
    data_checkin: u.data_checkin || u.data_inicio,
    data_inicio: u.data_inicio || u.data_checkin,
    data_checkout: u.data_checkout || u.data_fim,
    data_fim: u.data_fim || u.data_checkout
  }));
}

async function getUtilizacaoById(id, executor = pool, lock = false) {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');

  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT u.*,
           us.nome AS usuario_nome, us.email AS usuario_email,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           e.codigo_labcontrol AS equipamento_labcontrol, e.patrimonio_ufpi AS equipamento_patrimonio_ufpi
    FROM \`${TABLE}\` u
    LEFT JOIN \`usuario\` us ON u.\`${fkUser}\` = us.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON u.\`${fkEquip}\` = e.\`${equipPk}\`
    WHERE u.\`${pk}\` = ?
    LIMIT 1
    ${lock ? 'FOR UPDATE' : ''}
  `;
  const [rows] = await executor.query(sql, [id]);
  const row = rows[0] || null;
  if (row) {
    row.data_checkin = row.data_checkin || row.data_inicio;
    row.data_inicio = row.data_inicio || row.data_checkin;
    row.data_checkout = row.data_checkout || row.data_fim;
    row.data_fim = row.data_fim || row.data_checkout;
  }
  return row;
}

/**
 * Busca utilização ativa (em_uso) para um determinado equipamento ou usuário
 */
async function getActiveUtilizacaoByEquipamento(equipId) {
  const pk = await getPrimaryKey(TABLE);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const sql = `
    SELECT * FROM \`${TABLE}\`
    WHERE \`${fkEquip}\` = ? AND LOWER(COALESCE(status, '')) = 'em_uso'
    ORDER BY \`${pk}\` DESC LIMIT 1
  `;
  const [rows] = await pool.query(sql, [equipId]);
  const row = rows[0] || null;
  if (row) {
    row.data_checkin = row.data_checkin || row.data_inicio;
    row.data_inicio = row.data_inicio || row.data_checkin;
    row.data_checkout = row.data_checkout || row.data_fim;
    row.data_fim = row.data_fim || row.data_checkout;
  }
  return row;
}

async function createCheckin(data, executor = pool) {
  const cols = await getTableColumns(TABLE);
  const checkinPayload = { ...data };
  const now = new Date();

  // Garante timestamp exato de check-in tanto em data_checkin quanto data_inicio
  if (!checkinPayload.data_checkin && !checkinPayload.data_inicio) {
    checkinPayload.data_checkin = now;
    checkinPayload.data_inicio = now;
  } else {
    checkinPayload.data_checkin = checkinPayload.data_checkin || checkinPayload.data_inicio;
    checkinPayload.data_inicio = checkinPayload.data_inicio || checkinPayload.data_checkin;
  }

  // Compatibiliza campos de condição inicial / de retirada
  if (!checkinPayload.condicao_retirada && checkinPayload.condicao_inicial) {
    checkinPayload.condicao_retirada = checkinPayload.condicao_inicial;
  }
  if (!checkinPayload.condicao_inicial && checkinPayload.condicao_retirada) {
    checkinPayload.condicao_inicial = checkinPayload.condicao_retirada;
  }

  if (cols.includes('status') && !checkinPayload.status) {
    checkinPayload.status = 'em_uso';
  }

  const id = await insert(TABLE, checkinPayload, executor);
  return getUtilizacaoById(id, executor);
}

/**
 * Checkout com registro obrigatório da condição do equipamento e horário real exato
 */
async function executeCheckout(id, checkoutData, executor = pool) {
  const cols = await getTableColumns(TABLE);
  const data = { ...checkoutData };
  const now = new Date();

  // Garante horário real exato de check-out em ambas as colunas
  data.data_checkout = now;
  data.data_fim = now;

  if (!data.condicao_devolucao && data.condicao_final) {
    data.condicao_devolucao = data.condicao_final;
  }
  if (!data.condicao_final && data.condicao_devolucao) {
    data.condicao_final = data.condicao_devolucao;
  }

  if (cols.includes('status')) {
    data.status = 'finalizado';
  }

  await update(TABLE, id, data, executor);
  return getUtilizacaoById(id, executor);
}

module.exports = {
  TABLE,
  getAllUtilizacoes,
  getUtilizacaoById,
  getActiveUtilizacaoByEquipamento,
  createCheckin,
  executeCheckout
};
