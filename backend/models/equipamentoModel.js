const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'equipamento';

async function getAllEquipamentos(filter = {}) {
  const pk = await getPrimaryKey(TABLE);
  const espacoPk = await getPrimaryKey('espaco');
  const userPk = await getPrimaryKey('usuario');
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);
  const cols = await getTableColumns(TABLE);

  let sql = `
    SELECT e.*, s.nome AS espaco_nome
  `;

  if (cols.includes('inativo_por_usuario_id')) {
    sql += `, u_inativo.nome AS inativo_por_usuario_nome`;
  }

  sql += `
    FROM \`${TABLE}\` e
    LEFT JOIN \`espaco\` s ON e.\`${fkEspaco}\` = s.\`${espacoPk}\`
  `;

  if (cols.includes('inativo_por_usuario_id')) {
    sql += ` LEFT JOIN \`usuario\` u_inativo ON e.inativo_por_usuario_id = u_inativo.\`${userPk}\``;
  }

  const whereClauses = [];
  const values = [];

  // Filtro de inativação: por padrão oculta inativos, a menos que explicitamente solicitado
  if (cols.includes('inativo')) {
    if (filter.inativo !== undefined) {
      whereClauses.push(`e.inativo = ?`);
      values.push(filter.inativo ? 1 : 0);
    } else if (filter.apenas_inativos === true || filter.apenas_inativos === 'true') {
      whereClauses.push(`e.inativo = 1`);
    } else if (filter.includeInativos !== true && filter.incluir_inativos !== true && filter.incluir_inativos !== 'true' && filter.status !== 'inativo') {
      whereClauses.push(`(e.inativo = 0 OR e.inativo IS NULL)`);
    }
  }

  if (filter.status) {
    whereClauses.push(`LOWER(e.status) = LOWER(?)`);
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

  if (filter.search) {
    const term = `%${filter.search}%`;
    const searchCols = ['nome', 'modelo'];
    if (cols.includes('codigo_patrimonio')) searchCols.push('codigo_patrimonio');
    if (cols.includes('patrimonio_ufpi')) searchCols.push('patrimonio_ufpi');
    if (cols.includes('codigo_labcontrol')) searchCols.push('codigo_labcontrol');
    if (cols.includes('marca')) searchCols.push('marca');
    if (cols.includes('categoria')) searchCols.push('categoria');

    const searchSql = searchCols.map(c => `e.\`${c}\` LIKE ?`).join(' OR ');
    whereClauses.push(`(${searchSql})`);
    for (let i = 0; i < searchCols.length; i++) {
      values.push(term);
    }
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
  const userPk = await getPrimaryKey('usuario');
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);
  const cols = await getTableColumns(TABLE);

  let sql = `
    SELECT e.*, s.nome AS espaco_nome
  `;

  if (cols.includes('inativo_por_usuario_id')) {
    sql += `, u_inativo.nome AS inativo_por_usuario_nome`;
  }

  sql += `
    FROM \`${TABLE}\` e
    LEFT JOIN \`espaco\` s ON e.\`${fkEspaco}\` = s.\`${espacoPk}\`
  `;

  if (cols.includes('inativo_por_usuario_id')) {
    sql += ` LEFT JOIN \`usuario\` u_inativo ON e.inativo_por_usuario_id = u_inativo.\`${userPk}\``;
  }

  sql += ` WHERE e.\`${pk}\` = ? LIMIT 1`;

  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function generateNextLabControlCode() {
  const pk = await getPrimaryKey(TABLE);
  try {
    const [rows] = await pool.query(`SELECT MAX(\`${pk}\`) AS maxId FROM \`${TABLE}\``);
    const nextId = (rows[0]?.maxId || 0) + 1;
    return `LC-EQ-${String(nextId).padStart(4, '0')}`;
  } catch {
    return `LC-EQ-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

async function createEquipamento(data) {
  const cols = await getTableColumns(TABLE);
  const payload = { ...data };

  // Gera código LabControl caso não fornecido
  if (cols.includes('codigo_labcontrol') && !payload.codigo_labcontrol) {
    payload.codigo_labcontrol = await generateNextLabControlCode();
  }

  // Compatibiliza identificador oficial UFPI e codigo_patrimonio legado
  if (cols.includes('patrimonio_ufpi') && !payload.patrimonio_ufpi && payload.codigo_patrimonio) {
    payload.patrimonio_ufpi = payload.codigo_patrimonio;
  }
  if (cols.includes('codigo_patrimonio') && !payload.codigo_patrimonio && payload.patrimonio_ufpi) {
    payload.codigo_patrimonio = payload.patrimonio_ufpi;
  }

  const id = await insert(TABLE, payload);
  return getEquipamentoById(id);
}

async function updateEquipamento(id, data) {
  const cols = await getTableColumns(TABLE);
  const payload = { ...data };

  // Mantém sincronia entre patrimonio_ufpi e codigo_patrimonio
  if (cols.includes('patrimonio_ufpi') && payload.patrimonio_ufpi && !payload.codigo_patrimonio) {
    payload.codigo_patrimonio = payload.patrimonio_ufpi;
  }

  await update(TABLE, id, payload);
  return getEquipamentoById(id);
}

/**
 * Inativação lógica com registro de responsável, motivo e data
 * (NÃO exclui fisicamente o equipamento para preservar rastreabilidade histórica)
 */
async function inativarEquipamento(id, usuarioId, motivo) {
  const cols = await getTableColumns(TABLE);
  const payload = {
    status: 'inativo'
  };

  if (cols.includes('inativo')) payload.inativo = 1;
  if (cols.includes('inativo_em')) payload.inativo_em = new Date();
  if (cols.includes('inativo_por_usuario_id')) payload.inativo_por_usuario_id = usuarioId || null;
  if (cols.includes('motivo_inativacao')) payload.motivo_inativacao = motivo || 'Inativação administrativa sem histórico especificado';

  await update(TABLE, id, payload);
  return getEquipamentoById(id);
}

/**
 * Reativação lógica de equipamento previamente inativo
 */
async function reativarEquipamento(id) {
  const cols = await getTableColumns(TABLE);
  const payload = {
    status: 'disponivel'
  };

  if (cols.includes('inativo')) payload.inativo = 0;
  if (cols.includes('inativo_em')) payload.inativo_em = null;
  if (cols.includes('inativo_por_usuario_id')) payload.inativo_por_usuario_id = null;
  if (cols.includes('motivo_inativacao')) payload.motivo_inativacao = null;

  await update(TABLE, id, payload);
  return getEquipamentoById(id);
}

/**
 * Exclusão Segura:
 * Se o equipamento possuir histórico em utilização, ocorrência, manutenção ou reserva,
 * NÃO efetua o DELETE físico. Realiza a inativação automática.
 */
async function deleteEquipamento(id, usuarioId = null, motivo = null) {
  const equipPk = await getPrimaryKey(TABLE);
  const fkEquipUtilizacao = await resolveColumn('utilizacao', ['equipamento_id', 'id_equipamento']);
  const fkEquipOcorrencia = await resolveColumn('ocorrencia', ['equipamento_id', 'id_equipamento']);
  const fkEquipManutencao = await resolveColumn('manutencao', ['equipamento_id', 'id_equipamento']);
  const fkEquipReserva = await resolveColumn('reserva', ['equipamento_id', 'id_equipamento']);

  let totalHistorico = 0;

  try {
    const [uRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`utilizacao\` WHERE \`${fkEquipUtilizacao}\` = ?`, [id]);
    totalHistorico += Number(uRows[0]?.total || 0);
  } catch {}

  try {
    const [oRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`ocorrencia\` WHERE \`${fkEquipOcorrencia}\` = ?`, [id]);
    totalHistorico += Number(oRows[0]?.total || 0);
  } catch {}

  try {
    const [mRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`manutencao\` WHERE \`${fkEquipManutencao}\` = ?`, [id]);
    totalHistorico += Number(mRows[0]?.total || 0);
  } catch {}

  try {
    const [rRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`reserva\` WHERE \`${fkEquipReserva}\` = ?`, [id]);
    totalHistorico += Number(rRows[0]?.total || 0);
  } catch {}

  if (totalHistorico > 0) {
    // Preserva dados e histórico: inativa o equipamento em vez de deletar
    const inativado = await inativarEquipamento(id, usuarioId, motivo || 'Inativado automaticamente por possuir registros históricos de uso/manutenção vinculados.');
    return {
      success: true,
      inativado: true,
      message: 'Equipamento possui histórico e foi inativado com sucesso para preservar a rastreabilidade.',
      equipamento: inativado
    };
  }

  // Sem histórico associado: permite remoção física
  await remove(TABLE, id);
  return {
    success: true,
    inativado: false,
    message: 'Equipamento sem histórico foi removido permanentemente com sucesso.'
  };
}

async function updateStatus(id, newStatus, executor) {
  const statusCol = await resolveColumn(TABLE, ['status', 'situacao', 'estado']);
  return update(TABLE, id, { [statusCol]: newStatus }, executor);
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
  inativarEquipamento,
  reativarEquipamento,
  deleteEquipamento,
  updateStatus,
  getEquipamentoHistorico
};
