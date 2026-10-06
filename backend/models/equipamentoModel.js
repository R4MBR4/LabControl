const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'equipamento';

async function getAllEquipamentos(filter = {}) {
  const pk = await getPrimaryKey(TABLE);
  const espacoPk = await getPrimaryKey('espaco');
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);

  let sql = `
    SELECT e.*, s.nome AS espaco_nome
    FROM \`${TABLE}\` e
    LEFT JOIN \`espaco\` s ON e.\`${fkEspaco}\` = s.\`${espacoPk}\`
  `;

  const whereClauses = [];
  const values = [];

  if (filter.status) {
    whereClauses.push(`e.status = ?`);
    values.push(filter.status);
  }
  if (filter.espaco_id) {
    whereClauses.push(`e.\`${fkEspaco}\` = ?`);
    values.push(filter.espaco_id);
  }
  if (filter.exige_capacitacao !== undefined) {
    const colCap = await resolveColumn(TABLE, ['exige_capacitacao', 'capacitacao_obrigatoria']);
    whereClauses.push(`e.\`${colCap}\` = ?`);
    values.push(filter.exige_capacitacao ? 1 : 0);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY e.\`${pk}\` ASC`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function getEquipamentoById(id) {
  const pk = await getPrimaryKey(TABLE);
  const espacoPk = await getPrimaryKey('espaco');
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);

  const sql = `
    SELECT e.*, s.nome AS espaco_nome
    FROM \`${TABLE}\` e
    LEFT JOIN \`espaco\` s ON e.\`${fkEspaco}\` = s.\`${espacoPk}\`
    WHERE e.\`${pk}\` = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function createEquipamento(data) {
  const id = await insert(TABLE, data);
  return getEquipamentoById(id);
}

async function updateEquipamento(id, data) {
  await update(TABLE, id, data);
  return getEquipamentoById(id);
}

async function deleteEquipamento(id) {
  return remove(TABLE, id);
}

async function updateStatus(id, newStatus) {
  const statusCol = await resolveColumn(TABLE, ['status', 'situacao', 'estado']);
  return update(TABLE, id, { [statusCol]: newStatus });
}

/**
 * Retorna o histórico completo do equipamento:
 * 1. Utilizações
 * 2. Ocorrências
 * 3. Manutenções
 */
async function getEquipamentoHistorico(id) {
  const equipPk = await getPrimaryKey(TABLE);
  const fkEquipUtilizacao = await resolveColumn('utilizacao', ['equipamento_id', 'id_equipamento']);
  const fkEquipOcorrencia = await resolveColumn('ocorrencia', ['equipamento_id', 'id_equipamento']);
  const fkEquipManutencao = await resolveColumn('manutencao', ['equipamento_id', 'id_equipamento']);
  const userPk = await getPrimaryKey('usuario');
  const fkUserUtilizacao = await resolveColumn('utilizacao', ['usuario_id', 'id_usuario']);
  const fkUserOcorrencia = await resolveColumn('ocorrencia', ['usuario_id', 'id_usuario']);

  // 1. Utilizações
  let utilizacoes = [];
  try {
    const [rows] = await pool.query(`
      SELECT u.*, us.nome AS usuario_nome, us.email AS usuario_email
      FROM \`utilizacao\` u
      LEFT JOIN \`usuario\` us ON u.\`${fkUserUtilizacao}\` = us.\`${userPk}\`
      WHERE u.\`${fkEquipUtilizacao}\` = ?
      ORDER BY u.id DESC
    `, [id]);
    utilizacoes = rows;
  } catch (err) {
    console.warn('[Equipamento] Histórico utilizacao:', err.message);
  }

  // 2. Ocorrências
  let ocorrencias = [];
  try {
    const [rows] = await pool.query(`
      SELECT o.*, us.nome AS usuario_nome
      FROM \`ocorrencia\` o
      LEFT JOIN \`usuario\` us ON o.\`${fkUserOcorrencia}\` = us.\`${userPk}\`
      WHERE o.\`${fkEquipOcorrencia}\` = ?
      ORDER BY o.id DESC
    `, [id]);
    ocorrencias = rows;
  } catch (err) {
    console.warn('[Equipamento] Histórico ocorrencia:', err.message);
  }

  // 3. Manutenções
  let manutencoes = [];
  try {
    const [rows] = await pool.query(`
      SELECT m.*
      FROM \`manutencao\` m
      WHERE m.\`${fkEquipManutencao}\` = ?
      ORDER BY m.id DESC
    `, [id]);
    manutencoes = rows;
  } catch (err) {
    console.warn('[Equipamento] Histórico manutencao:', err.message);
  }

  return {
    utilizacoes,
    ocorrencias,
    manutencoes
  };
}

module.exports = {
  TABLE,
  getAllEquipamentos,
  getEquipamentoById,
  createEquipamento,
  updateEquipamento,
  deleteEquipamento,
  updateStatus,
  getEquipamentoHistorico
};
