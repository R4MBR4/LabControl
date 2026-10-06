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
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo, e.codigo_labcontrol AS equipamento_codigo_labcontrol,
           s.nome AS espaco_nome,
           es.nome AS equipamento_espaco_nome
    FROM \`${TABLE}\` r
    LEFT JOIN \`usuario\` u ON r.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON r.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` s ON r.\`${fkEspaco}\` = s.\`${espacoPk}\`
    LEFT JOIN \`espaco\` es ON e.espaco_id = es.\`${espacoPk}\`
  `;

  const whereClauses = [];
  const values = [];

  // Busca textual
  if (filters.search && filters.search.trim()) {
    whereClauses.push(`(
      r.finalidade LIKE ? OR
      r.observacoes LIKE ? OR
      u.nome LIKE ? OR
      u.email LIKE ? OR
      e.nome LIKE ? OR
      e.codigo_patrimonio LIKE ? OR
      s.nome LIKE ?
    )`);
    const term = `%${filters.search.trim()}%`;
    values.push(term, term, term, term, term, term, term);
  }

  // Filtro por tipo de recurso
  if (filters.tipo_recurso === 'equipamento') {
    whereClauses.push(`r.\`${fkEquip}\` IS NOT NULL`);
  } else if (filters.tipo_recurso === 'espaco') {
    whereClauses.push(`r.\`${fkEquip}\` IS NULL AND r.\`${fkEspaco}\` IS NOT NULL`);
  }

  // Filtro por solicitante
  if (filters.usuario_id) {
    whereClauses.push(`r.\`${fkUser}\` = ?`);
    values.push(filters.usuario_id);
  }

  // Filtro por equipamento específico
  if (filters.equipamento_id) {
    whereClauses.push(`r.\`${fkEquip}\` = ?`);
    values.push(filters.equipamento_id);
  }

  // Filtro por espaço / laboratório (seja reserva do espaço ou equipamento localizado nele)
  if (filters.espaco_id) {
    whereClauses.push(`(r.\`${fkEspaco}\` = ? OR e.espaco_id = ?)`);
    values.push(filters.espaco_id, filters.espaco_id);
  }

  // Filtro por status
  if (filters.status && filters.status !== 'todas') {
    whereClauses.push(`LOWER(r.status) = LOWER(?)`);
    values.push(filters.status);
  }

  // Filtro por período
  if (filters.data_inicio_de) {
    whereClauses.push(`r.data_inicio >= ?`);
    values.push(filters.data_inicio_de);
  }
  if (filters.data_fim_ate) {
    whereClauses.push(`r.data_fim <= ?`);
    values.push(filters.data_fim_ate);
  }

  // Filtro de recorrência
  if (filters.grupo_recorrencia_id) {
    whereClauses.push(`r.grupo_recorrencia_id = ?`);
    values.push(filters.grupo_recorrencia_id);
  }

  // Filtro de no-show
  if (filters.no_show !== undefined && filters.no_show !== '') {
    whereClauses.push(`r.no_show = ?`);
    values.push(Number(filters.no_show) ? 1 : 0);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ` ORDER BY r.data_inicio DESC`;

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
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo, e.codigo_labcontrol AS equipamento_codigo_labcontrol,
           s.nome AS espaco_nome,
           es.nome AS equipamento_espaco_nome
    FROM \`${TABLE}\` r
    LEFT JOIN \`usuario\` u ON r.\`${fkUser}\` = u.\`${userPk}\`
    LEFT JOIN \`equipamento\` e ON r.\`${fkEquip}\` = e.\`${equipPk}\`
    LEFT JOIN \`espaco\` s ON r.\`${fkEspaco}\` = s.\`${espacoPk}\`
    LEFT JOIN \`espaco\` es ON e.espaco_id = es.\`${espacoPk}\`
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

  const sql = `
    SELECT r.*,
           u.nome AS usuario_nome,
           e.nome AS equipamento_nome,
           s.nome AS espaco_nome
    FROM \`${TABLE}\` r
    LEFT JOIN usuario u ON r.usuario_id = u.id
    LEFT JOIN equipamento e ON r.equipamento_id = e.id
    LEFT JOIN espaco s ON r.espaco_id = s.id
    WHERE ${conditions.join(' AND ')}
  `;
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Consulta de eventos do calendário em um intervalo
 */
async function getReservasCalendario({ inicio, fim, espaco_id, equipamento_id }) {
  const conditions = [];
  const params = [];

  if (inicio) {
    conditions.push('r.data_fim >= ?');
    params.push(inicio);
  }
  if (fim) {
    conditions.push('r.data_inicio <= ?');
    params.push(fim);
  }
  if (espaco_id) {
    conditions.push('(r.espaco_id = ? OR e.espaco_id = ?)');
    params.push(espaco_id, espaco_id);
  }
  if (equipamento_id) {
    conditions.push('r.equipamento_id = ?');
    params.push(equipamento_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT r.id, r.data_inicio, r.data_fim, r.finalidade, r.status,
           r.grupo_recorrencia_id, r.recorrente, r.no_show,
           u.nome AS usuario_nome,
           e.nome AS equipamento_nome, e.codigo_patrimonio AS equipamento_codigo,
           s.nome AS espaco_nome
    FROM \`${TABLE}\` r
    LEFT JOIN usuario u ON r.usuario_id = u.id
    LEFT JOIN equipamento e ON r.equipamento_id = e.id
    LEFT JOIN espaco s ON r.espaco_id = s.id
    ${where}
    ORDER BY r.data_inicio ASC
  `;

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
  getReservasCalendario,
  createReserva,
  updateReserva,
  cancelReserva
};
