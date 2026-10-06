const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'reserva';
const NO_SHOW_TOLERANCE_KEY = 'tolerancia_no_show_minutos';

async function getToleranciaNoShow(executor = pool) {
  const [rows] = await executor.query(
    'SELECT valor FROM `configuracao_sistema` WHERE chave = ? LIMIT 1',
    [NO_SHOW_TOLERANCE_KEY]
  );
  if (!rows[0]) {
    throw new Error('A configuração de tolerância de no-show não foi inicializada. Aplique a migration 07_configuracao_no_show.sql.');
  }
  return Number(rows[0].valor);
}

async function setToleranciaNoShow(minutos, usuarioId, executor = pool) {
  await executor.query(`
    INSERT INTO \`configuracao_sistema\` (chave, valor, atualizado_por_usuario_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      valor = VALUES(valor),
      atualizado_por_usuario_id = VALUES(atualizado_por_usuario_id),
      atualizado_em = CURRENT_TIMESTAMP
  `, [NO_SHOW_TOLERANCE_KEY, String(minutos), usuarioId || null]);
  return getToleranciaNoShow(executor);
}

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

async function getReservaById(id, executor = pool) {
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
  const [rows] = await executor.query(sql, [id]);
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

async function createReserva(data, executor = pool) {
  const id = await insert(TABLE, data, executor);
  return getReservaById(id, executor);
}

async function updateReserva(id, data, executor = pool) {
  await update(TABLE, id, data, executor);
  return getReservaById(id, executor);
}

async function cancelReserva(id, executor = pool) {
  return updateReserva(id, { status: 'cancelada' }, executor);
}

/**
 * Criação atômica de série recorrente (Bloco 08)
 * REGRA CRÍTICA: Verifica conflitos em TODAS as ocorrências antes de confirmar a série.
 */
async function createSerieRecorrente({
  usuario_id,
  equipamento_id,
  espaco_id,
  ocorrencias,
  finalidade,
  observacoes,
  regra_recorrencia,
  tolerancia_no_show_min = 15,
  executor = pool
}) {
  if (!ocorrencias || ocorrencias.length === 0) {
    throw new Error('Nenhuma ocorrência fornecida para a série recorrente.');
  }

  // 1. Verificação rigorosa de conflito em TODAS as ocorrências da série
  for (let i = 0; i < ocorrencias.length; i++) {
    const oc = ocorrencias[i];
    const conflitos = await checkConflict({
      equipamento_id,
      espaco_id,
      data_inicio: oc.data_inicio,
      data_fim: oc.data_fim
    });

    if (conflitos.length > 0) {
      const c = conflitos[0];
      return {
        success: false,
        ocorrenciaIndice: i + 1,
        totalOcorrencias: ocorrencias.length,
        data_conflito: oc.data_inicio,
        conflito: c,
        error: `Conflito detectado na ocorrência ${i + 1} de ${ocorrencias.length} (${new Date(oc.data_inicio).toLocaleString('pt-BR')}): já existe reserva ativa por ${c.usuario_nome || 'outro usuário'}. Toda a série foi cancelada para prevenir sobreposição.`
      };
    }
  }

  // 2. Com todas as ocorrências validadas sem conflito, cria o grupo da série
  const grupo_recorrencia_id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const criadas = [];

  for (const oc of ocorrencias) {
    const payload = {
      usuario_id,
      equipamento_id: equipamento_id || null,
      espaco_id: espaco_id || null,
      data_inicio: oc.data_inicio,
      data_fim: oc.data_fim,
      status: 'confirmada',
      finalidade: finalidade || null,
      observacoes: observacoes || null,
      grupo_recorrencia_id,
      recorrente: 1,
      regra_recorrencia: regra_recorrencia || 'semanal',
      tolerancia_no_show_min: Number(tolerancia_no_show_min) || 15
    };
    const id = await insert(TABLE, payload, executor);
    criadas.push(id);
  }

  return {
    success: true,
    grupo_recorrencia_id,
    totalCriadas: criadas.length,
    reservasCriadas: criadas
  };
}

/**
 * Cancelamento granular de ocorrência recorrente (Bloco 08)
 * Opções: 'apenas_esta' | 'proximas' | 'toda_serie'
 * Caso mínimo obrigatório: liberar uma ocorrência individual sem destruir a série inteira.
 */
async function cancelarOcorrenciaRecorrente(id, tipo = 'apenas_esta', executor = pool) {
  const reserva = await getReservaById(id, executor);
  if (!reserva) return null;

  if (!reserva.grupo_recorrencia_id || tipo === 'apenas_esta') {
    // Cancela apenas esta ocorrência individual
    await update(TABLE, id, { status: 'cancelada' }, executor);
    return {
      tipo: 'apenas_esta',
      afetadas: 1,
      reserva: await getReservaById(id, executor)
    };
  }

  if (tipo === 'proximas') {
    // Cancela esta e todas as ocorrências futuras da mesma série
    const [result] = await executor.query(`
      UPDATE \`${TABLE}\`
      SET status = 'cancelada'
      WHERE grupo_recorrencia_id = ? AND data_inicio >= ? AND status != 'cancelada'
    `, [reserva.grupo_recorrencia_id, reserva.data_inicio]);

    return {
      tipo: 'proximas',
      afetadas: result.affectedRows,
      grupo_recorrencia_id: reserva.grupo_recorrencia_id
    };
  }

  if (tipo === 'toda_serie') {
    // Cancela toda a série recorrente
    const [result] = await executor.query(`
      UPDATE \`${TABLE}\`
      SET status = 'cancelada'
      WHERE grupo_recorrencia_id = ? AND status != 'cancelada'
    `, [reserva.grupo_recorrencia_id]);

    return {
      tipo: 'toda_serie',
      afetadas: result.affectedRows,
      grupo_recorrencia_id: reserva.grupo_recorrencia_id
    };
  }

  return null;
}

/**
 * Marcação de No-Show com tolerância (Bloco 08)
 * Regra: Não aplicar punição automática. Preservar histórico para indicadores.
 */
async function marcarNoShow(id, executor = pool) {
  const reserva = await getReservaById(id, executor);
  if (!reserva) return null;

  await update(TABLE, id, {
    no_show: 1,
    no_show_at: new Date(),
    status: 'no_show'
  }, executor);

  return getReservaById(id, executor);
}

/**
 * Verificação em lote de no-shows baseada na tolerância configurável (Bloco 08)
 */
async function verificarNoShowsAutomaticos(toleranciaMin = 15, executor = pool) {
  const toleranciaConfigurada = Number(toleranciaMin);
  if (!Number.isInteger(toleranciaConfigurada) || toleranciaConfigurada < 1 || toleranciaConfigurada > 180) {
    throw new Error('A tolerância para no-show deve estar entre 1 e 180 minutos.');
  }

  // Busca reservas confirmadas cujo início + tolerância já passou, e que não possuem utilização iniciada
  const [candidatos] = await executor.query(`
    SELECT r.id, r.usuario_id, r.data_inicio, r.finalidade
    FROM \`${TABLE}\` r
    WHERE r.status IN ('confirmada', 'pendente')
      AND (r.no_show = 0 OR r.no_show IS NULL)
      AND r.data_inicio < DATE_SUB(NOW(), INTERVAL ? MINUTE)
      AND NOT EXISTS (
        SELECT 1 FROM utilizacao u WHERE u.reserva_id = r.id
      )
  `, [toleranciaMin]);

  if (candidatos.length > 0) {
    const ids = candidatos.map(c => c.id);
    await executor.query(`
      UPDATE \`${TABLE}\`
      SET no_show = 1, no_show_at = NOW(), status = 'no_show'
      WHERE id IN (?)
    `, [ids]);
  }

  return {
    totalMarcados: candidatos.length,
    reservas: candidatos
  };
}

module.exports = {
  TABLE,
  getToleranciaNoShow,
  setToleranciaNoShow,
  getAllReservas,
  getReservaById,
  checkConflict,
  getReservasCalendario,
  createReserva,
  updateReserva,
  cancelReserva,
  createSerieRecorrente,
  cancelarOcorrenciaRecorrente,
  marcarNoShow,
  verificarNoShowsAutomaticos
};
