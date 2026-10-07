const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'capacitacao';

async function getAllCapacitacoes() {
  const pk = await getPrimaryKey(TABLE);
  const userPk = await getPrimaryKey('usuario');
  const equipPk = await getPrimaryKey('equipamento');
  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT c.*, u.nome AS usuario_nome, u.email AS usuario_email,
           e.nome AS equipamento_nome, COALESCE(c.espaco_id, e.espaco_id) AS espaco_id,
           s.nome AS espaco_nome
    FROM \`${TABLE}\` c
    LEFT JOIN \`usuario\` u ON c.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON c.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` s ON s.id = COALESCE(c.espaco_id, e.espaco_id)
    ORDER BY c.\`${pk}\` DESC
  `;
  const [rows] = await pool.query(sql);
  return rows;
}

function assertCanReadUserCapacitacoes(userId, requester) {
  if (!requester || (!requester.id && !requester.id_usuario)) {
    const error = new Error('Usuário solicitante inválido para consultar capacitações.');
    error.statusCode = 403;
    throw error;
  }

  const requesterId = requester.id || requester.id_usuario;
  const role = String(requester.perfil || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'administrador';
  if (!isAdmin && String(requesterId) !== String(userId)) {
    const error = new Error('Você não tem permissão para consultar as capacitações deste usuário.');
    error.statusCode = 403;
    throw error;
  }
}

async function getCapacitacoesByUser(userId, requester) {
  assertCanReadUserCapacitacoes(userId, requester);
  const pk = await getPrimaryKey(TABLE);
  const equipPk = await getPrimaryKey('equipamento');
  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT c.*, e.nome AS equipamento_nome, e.tipo AS equipamento_tipo
    FROM \`${TABLE}\` c
    LEFT JOIN \`equipamento\` e ON c.\`${fkEquip}\` = e.\`${equipPk}\`
    WHERE c.\`${fkUser}\` = ?
    ORDER BY c.\`${pk}\` DESC
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
}

/**
 * Regra de negócio crítica:
 * Verifica se o usuário possui capacitação válida para operar o equipamento.
 */
async function checkUserCapacitacao(userId, equipId) {
  const cols = await getTableColumns(TABLE);
  const fkUser = await resolveColumn(TABLE, ['usuario_id', 'id_usuario']);
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  let sql = `SELECT * FROM \`${TABLE}\` WHERE \`${fkUser}\` = ? AND \`${fkEquip}\` = ?`;
  const params = [userId, equipId];

  // Se houver coluna de status na tabela
  if (cols.includes('status')) {
    sql += ` AND LOWER(status) IN ('ativo', 'valido', 'aprovado', 'concluido', '1')`;
  }

  // Se houver validade
  if (cols.includes('validade')) {
    sql += ` AND (validade IS NULL OR validade >= CURDATE())`;
  }

  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

async function createCapacitacao(data, executor = pool) {
  const id = await insert(TABLE, data, executor);
  const pk = await getPrimaryKey(TABLE);
  const [rows] = await executor.query(`SELECT * FROM \`${TABLE}\` WHERE \`${pk}\` = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function updateCapacitacao(id, data) {
  await update(TABLE, id, data);
  return findById(TABLE, id);
}

async function deleteCapacitacao(id) {
  return remove(TABLE, id);
}

module.exports = {
  TABLE,
  getAllCapacitacoes,
  getCapacitacoesByUser,
  assertCanReadUserCapacitacoes,
  checkUserCapacitacao,
  createCapacitacao,
  updateCapacitacao,
  deleteCapacitacao
};
