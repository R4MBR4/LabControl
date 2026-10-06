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
           e.status AS equipamento_status, o.titulo AS ocorrencia_titulo
    FROM \`${TABLE}\` m
    LEFT JOIN \`equipamento\` e ON m.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`ocorrencia\` o ON m.ocorrencia_id = o.id
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

async function getManutencaoById(id, executor = pool) {
  const pk = await getPrimaryKey(TABLE);
  const equipPk = await getPrimaryKey('equipamento');
  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);

  const sql = `
    SELECT m.*,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           e.status AS equipamento_status, o.titulo AS ocorrencia_titulo
    FROM \`${TABLE}\` m
    LEFT JOIN \`equipamento\` e ON m.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`ocorrencia\` o ON m.ocorrencia_id = o.id
    WHERE m.\`${pk}\` = ?
    LIMIT 1
  `;
  const [rows] = await executor.query(sql, [id]);
  return rows[0] || null;
}

async function getManutencaoByOcorrenciaId(ocorrenciaId, executor = pool) {
  const pk = await getPrimaryKey(TABLE);
  const [rows] = await executor.query(
    `SELECT * FROM \`${TABLE}\` WHERE ocorrencia_id = ? ORDER BY \`${pk}\` DESC LIMIT 1`,
    [ocorrenciaId]
  );
  return rows[0] || null;
}

/**
 * Fluxo de manutenção: bloqueio automático do equipamento ao registrar
 */
async function createManutencao(data, executor = pool) {
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

  const id = await insert(TABLE, payload, executor);

  // Bloqueio do equipamento para status 'manutencao'
  const equipId = payload[fkEquip] || payload.equipamento_id;
  if (equipId) {
    await equipamentoModel.updateStatus(equipId, 'manutencao', executor);
  }

  return getManutencaoById(id, executor);
}

/**
 * Conclusão da manutenção: registra data_fim e retorna equipamento para 'disponivel'
 */
async function finalizarManutencao(id, conclusaoData = {}, executor = pool) {
  const manutencao = await getManutencaoById(id, executor);
  if (!manutencao) {
    throw new Error('Registro de manutenção não encontrado');
  }
  if (['concluida', 'concluído', 'concluido', 'cancelada', 'cancelado'].includes((manutencao.status || '').toLowerCase())) {
    throw new Error('A ordem de manutenção não está mais em andamento');
  }

  const fkEquip = await resolveColumn(TABLE, ['equipamento_id', 'id_equipamento']);
  const pk = await getPrimaryKey(TABLE);
  const equipId = manutencao[fkEquip] || manutencao.equipamento_id;

  const cols = await getTableColumns(TABLE);
  const dataFimCol = await resolveColumn(TABLE, ['data_fim', 'fim']);

  const payload = { ...conclusaoData, status: 'concluida' };
  if (cols.includes(dataFimCol) && !payload[dataFimCol]) {
    payload[dataFimCol] = new Date();
  }

  await update(TABLE, id, payload, executor);

  const [outrasOrdensAbertas] = await executor.query(`
    SELECT COUNT(*) AS total
    FROM \`${TABLE}\`
    WHERE \`${fkEquip}\` = ?
      AND \`${pk}\` <> ?
      AND LOWER(COALESCE(status, '')) NOT IN ('concluida', 'concluído', 'concluido', 'cancelada', 'cancelado')
  `, [equipId, id]);
  const equipamento = equipId ? await equipamentoModel.getEquipamentoById(equipId, executor) : null;
  const estaInativo = equipamento && (
    Number(equipamento.inativo) === 1 ||
    equipamento.inativo === true ||
    (equipamento.status || '').toLowerCase() === 'inativo'
  );

  if (equipId && Number(outrasOrdensAbertas[0]?.total || 0) === 0 && !estaInativo) {
    await equipamentoModel.updateStatus(equipId, 'disponivel', executor);
  }

  return getManutencaoById(id, executor);
}

async function updateManutencao(id, data, executor = pool) {
  await update(TABLE, id, data, executor);
  return getManutencaoById(id, executor);
}

async function deleteManutencao(id) {
  return remove(TABLE, id);
}

module.exports = {
  TABLE,
  getAllManutencoes,
  getManutencaoById,
  getManutencaoByOcorrenciaId,
  createManutencao,
  finalizarManutencao,
  updateManutencao,
  deleteManutencao
};
