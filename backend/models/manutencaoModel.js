const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');
const equipamentoModel = require('./equipamentoModel');

const TABLE = 'manutencao';

async function getAllManutencoes(filters = {}) {
  const pk = await getPrimaryKey(TABLE);
  const equipPk = await getPrimaryKey('equipamento');
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  let sql = `
    SELECT m.*,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           e.status AS equipamento_status
    FROM \`${TABLE}\` m
    LEFT JOIN \`equipamento\` e ON m.\`${fkEquip}\` = e.\`${equipPk}\`
  `;

  const whereClauses = [];
  const values = [];

  if (filters.equipamento_id) {
    whereClauses.push(`m.\`${fkEquip}\` = ?`);
    values.push(filters.equipamento_id);
  }
  if (filters.status) {
    whereClauses.push(`m.status = ?`);
    values.push(filters.status);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY m.\`${pk}\` DESC`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function getManutencaoById(id) {
  const pk = await getPrimaryKey(TABLE);
  const equipPk = await getPrimaryKey('equipamento');
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT m.*,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo
    FROM \`${TABLE}\` m
    LEFT JOIN \`equipamento\` e ON m.\`${fkEquip}\` = e.\`${equipPk}\`
    WHERE m.\`${pk}\` = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Fluxo de manutenção: bloqueio automático do equipamento ao registrar
 */
async function createManutencao(data) {
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const cols = await getTableColumns(TABLE);

  const payload = { ...data };
  const dataInicioCol = await resolveColumn(TABLE, ['data_inicio', 'inicio']);
  if (cols.includes(dataInicioCol) && !payload[dataInicioCol]) {
    payload[dataInicioCol] = new Date();
  }

  if (cols.includes('status') && !payload.status) {
    payload.status = 'em_andamento';
  }

  const id = await insert(TABLE, payload);

  // Bloqueio do equipamento para status 'manutencao'
  const equipId = payload[fkEquip] || payload.equipamento_id;
  if (equipId) {
    await equipamentoModel.updateStatus(equipId, 'manutencao');
  }

  return getManutencaoById(id);
}

/**
 * Conclusão da manutenção: registra data_fim e retorna equipamento para 'disponivel'
 */
async function finalizarManutencao(id, conclusaoData = {}) {
  const manutencao = await getManutencaoById(id);
  if (!manutencao) {
    throw new Error('Registro de manutenção não encontrado');
  }

  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const equipId = manutencao[fkEquip] || manutencao.equipamento_id;

  const cols = await getTableColumns(TABLE);
  const dataFimCol = await resolveColumn(TABLE, ['data_fim', 'fim']);

  const payload = { ...conclusaoData, status: 'concluida' };
  if (cols.includes(dataFimCol) && !payload[dataFimCol]) {
    payload[dataFimCol] = new Date();
  }

  await update(TABLE, id, payload);

  // Retorno automático ao status 'disponivel'
  if (equipId) {
    await equipamentoModel.updateStatus(equipId, 'disponivel');
  }

  return getManutencaoById(id);
}

async function updateManutencao(id, data) {
  await update(TABLE, id, data);
  return getManutencaoById(id);
}

async function deleteManutencao(id) {
  return remove(TABLE, id);
}

module.exports = {
  TABLE,
  getAllManutencoes,
  getManutencaoById,
  createManutencao,
  finalizarManutencao,
  updateManutencao,
  deleteManutencao
};
