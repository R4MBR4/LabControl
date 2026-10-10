const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'equipamento';

async function getAllEquipamentos(filter = {}) {
  const pk = await getPrimaryKey(TABLE);
  const espacoPk = await getPrimaryKey('espaco');
  const userPk = await getPrimaryKey('usuario');
  const fkEspaco = await resolveColumn(TABLE, ['espaco_id', 'id_espaco']);
  const cols = await getTableColumns(TABLE);

  let sql = `
    SELECT e.*, s.nome AS espaco_nome,
           (SELECT COUNT(*) FROM utilizacao u WHERE u.equipamento_id = e.\`${pk}\`) AS total_utilizacoes,
           (SELECT COUNT(*) FROM manutencao m WHERE m.equipamento_id = e.\`${pk}\`) AS total_manutencoes
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

async function getEquipamentoById(id, executor = pool) {
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

  const [rows] = await executor.query(sql, [id]);
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

async function createEquipamento(data, executor = pool) {
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

  const id = await insert(TABLE, payload, executor);
  return getEquipamentoById(id, executor);
}

async function updateEquipamento(id, data, executor = pool) {
  const cols = await getTableColumns(TABLE);
  const payload = { ...data };

  // Mantém sincronia entre patrimonio_ufpi e codigo_patrimonio
  if (cols.includes('patrimonio_ufpi') && payload.patrimonio_ufpi && !payload.codigo_patrimonio) {
    payload.codigo_patrimonio = payload.patrimonio_ufpi;
  }

  await update(TABLE, id, payload, executor);
  return getEquipamentoById(id, executor);
}

/**
 * Inativação lógica com registro de responsável, motivo e data
 * (NÃO exclui fisicamente o equipamento para preservar rastreabilidade histórica)
 */
async function inativarEquipamento(id, usuarioId, motivo, executor = pool) {
  const cols = await getTableColumns(TABLE);
  const payload = {
    status: 'inativo'
  };

  if (cols.includes('inativo')) payload.inativo = 1;
  if (cols.includes('inativo_em')) payload.inativo_em = new Date();
  if (cols.includes('inativo_por_usuario_id')) payload.inativo_por_usuario_id = usuarioId || null;
  if (cols.includes('motivo_inativacao')) payload.motivo_inativacao = motivo || 'Inativação administrativa sem histórico especificado';

  await update(TABLE, id, payload, executor);
  return getEquipamentoById(id, executor);
}

/**
 * Reativação lógica de equipamento previamente inativo
 */
async function reativarEquipamento(id, executor = pool) {
  const cols = await getTableColumns(TABLE);
  const payload = {
    status: 'disponivel'
  };

  if (cols.includes('inativo')) payload.inativo = 0;
  if (cols.includes('inativo_em')) payload.inativo_em = null;
  if (cols.includes('inativo_por_usuario_id')) payload.inativo_por_usuario_id = null;
  if (cols.includes('motivo_inativacao')) payload.motivo_inativacao = null;

  await update(TABLE, id, payload, executor);
  return getEquipamentoById(id, executor);
}

/**
 * Exclusão Segura:
 * Se o equipamento possuir histórico em utilização, ocorrência, manutenção ou reserva,
 * NÃO efetua o DELETE físico. Realiza a inativação automática.
 */
async function deleteEquipamento(id, usuarioId = null, motivo = null, executor = pool) {
  const equipPk = await getPrimaryKey(TABLE);
  const fkEquipUtilizacao = await resolveColumn('utilizacao', ['equipamento_id', 'id_equipamento']);
  const fkEquipOcorrencia = await resolveColumn('ocorrencia', ['equipamento_id', 'id_equipamento']);
  const fkEquipManutencao = await resolveColumn('manutencao', ['equipamento_id', 'id_equipamento']);
  const fkEquipReserva = await resolveColumn('reserva', ['equipamento_id', 'id_equipamento']);

  let totalHistorico = 0;

  try {
    const [uRows] = await executor.query(`SELECT COUNT(*) AS total FROM \`utilizacao\` WHERE \`${fkEquipUtilizacao}\` = ?`, [id]);
    totalHistorico += Number(uRows[0]?.total || 0);
  } catch {}

  try {
    const [oRows] = await executor.query(`SELECT COUNT(*) AS total FROM \`ocorrencia\` WHERE \`${fkEquipOcorrencia}\` = ?`, [id]);
    totalHistorico += Number(oRows[0]?.total || 0);
  } catch {}

  try {
    const [mRows] = await executor.query(`SELECT COUNT(*) AS total FROM \`manutencao\` WHERE \`${fkEquipManutencao}\` = ?`, [id]);
    totalHistorico += Number(mRows[0]?.total || 0);
  } catch {}

  try {
    const [rRows] = await executor.query(`SELECT COUNT(*) AS total FROM \`reserva\` WHERE \`${fkEquipReserva}\` = ?`, [id]);
    totalHistorico += Number(rRows[0]?.total || 0);
  } catch {}

  const [auditRows] = await executor.query(
    'SELECT COUNT(*) AS total FROM auditoria_evento WHERE equipamento_id = ?',
    [id]
  );
  totalHistorico += Number(auditRows[0]?.total || 0);

  if (totalHistorico > 0) {
    // Preserva dados e histórico: inativa o equipamento em vez de deletar
    const inativado = await inativarEquipamento(id, usuarioId, motivo || 'Inativado automaticamente por possuir registros históricos de uso/manutenção vinculados.', executor);
    return {
      success: true,
      inativado: true,
      message: 'Equipamento possui histórico e foi inativado com sucesso para preservar a rastreabilidade.',
      equipamento: inativado
    };
  }

  // Sem histórico associado: permite remoção física
  await remove(TABLE, id, executor);
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
  const utilizacaoPk = await getPrimaryKey('utilizacao');
  const ocorrenciaPk = await getPrimaryKey('ocorrencia');
  const manutencaoPk = await getPrimaryKey('manutencao');
  const fkEquipUtilizacao = await resolveColumn('utilizacao', ['equipamento_id', 'id_equipamento']);
  const fkEquipOcorrencia = await resolveColumn('ocorrencia', ['equipamento_id', 'id_equipamento']);
  const fkEquipManutencao = await resolveColumn('manutencao', ['equipamento_id', 'id_equipamento']);
  const userPk = await getPrimaryKey('usuario');
  const fkUserUtilizacao = await resolveColumn('utilizacao', ['usuario_id', 'id_usuario']);
  const fkUserOcorrencia = await resolveColumn('ocorrencia', ['usuario_id', 'id_usuario']);

  const [utilizacoesRows, ocorrenciasRows, manutencoesRows] = await Promise.all([
    pool.query(`
      SELECT u.*, us.nome AS usuario_nome, us.email AS usuario_email
      FROM \`utilizacao\` u
      LEFT JOIN \`usuario\` us ON u.\`${fkUserUtilizacao}\` = us.\`${userPk}\`
      WHERE u.\`${fkEquipUtilizacao}\` = ?
      ORDER BY u.\`${utilizacaoPk}\` DESC
    `, [id]),
    pool.query(`
      SELECT o.*, us.nome AS usuario_nome
      FROM \`ocorrencia\` o
      LEFT JOIN \`usuario\` us ON o.\`${fkUserOcorrencia}\` = us.\`${userPk}\`
      WHERE o.\`${fkEquipOcorrencia}\` = ?
      ORDER BY o.\`${ocorrenciaPk}\` DESC
    `, [id]),
    pool.query(`
      SELECT m.*
      FROM \`manutencao\` m
      WHERE m.\`${fkEquipManutencao}\` = ?
      ORDER BY m.\`${manutencaoPk}\` DESC
    `, [id])
  ]);

  return {
    utilizacoes: utilizacoesRows[0],
    ocorrencias: ocorrenciasRows[0],
    manutencoes: manutencoesRows[0]
  };
}

/**
 * Localiza equipamento de forma inequívoca através de QR Code ou identificador.
 * Suporta:
 * 1. Payload JSON (gerado pelo sistema com { id, codigo_labcontrol, patrimonio_ufpi })
 * 2. Código LabControl (ex: "LC-EQ-0001")
 * 3. Patrimônio UFPI / Código de patrimônio (ex: "PAT-001", "123456")
 * 4. ID numérico (ex: 5)
 *
 * Previne que identificadores ambíguos selecionem equipamento incorreto.
 */
async function localizarPorIdentificadorQR(scannedValue, executor = pool) {
  if (!scannedValue) return null;

  let parsed = null;
  if (typeof scannedValue === 'object') {
    parsed = scannedValue;
  } else if (typeof scannedValue === 'string') {
    const trimmed = scannedValue.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = null;
      }
    }
  }

  // Caso 1: Payload estruturado JSON
  if (parsed && typeof parsed === 'object') {
    const targetId = parsed.id || parsed.equipamento_id;
    const targetLabControl = parsed.codigo_labcontrol;
    const targetPatrimonio = parsed.patrimonio_ufpi || parsed.codigo_patrimonio || parsed.codigo;

    if (targetId) {
      const equip = await getEquipamentoById(targetId, executor);
      if (!equip) return null;

      // Validação de consistência se o payload trouxer códigos adicionais
      if (targetLabControl && equip.codigo_labcontrol && equip.codigo_labcontrol.toUpperCase() !== String(targetLabControl).toUpperCase()) {
        const err = new Error(`Inconsistência no QR Code: o ID #${targetId} não corresponde ao código LabControl "${targetLabControl}".`);
        err.statusCode = 400;
        throw err;
      }
      return equip;
    }

    if (targetLabControl) {
      const [rows] = await executor.query(
        `SELECT e.*, esp.nome AS espaco_nome FROM equipamento e LEFT JOIN espaco esp ON e.espaco_id = esp.id WHERE UPPER(e.codigo_labcontrol) = UPPER(?) LIMIT 2`,
        [String(targetLabControl).trim()]
      );
      if (rows.length === 1) return rows[0];
      if (rows.length > 1) {
        const err = new Error(`Identificador ambíguo: múltiplos equipamentos com código LabControl "${targetLabControl}".`);
        err.statusCode = 409;
        throw err;
      }
    }

    if (targetPatrimonio) {
      const [rows] = await executor.query(
        `SELECT e.*, esp.nome AS espaco_nome FROM equipamento e LEFT JOIN espaco esp ON e.espaco_id = esp.id WHERE UPPER(e.codigo_patrimonio) = UPPER(?) OR UPPER(e.patrimonio_ufpi) = UPPER(?) LIMIT 2`,
        [String(targetPatrimonio).trim(), String(targetPatrimonio).trim()]
      );
      if (rows.length === 1) return rows[0];
      if (rows.length > 1) {
        const err = new Error(`Identificador ambíguo: múltiplos equipamentos correspondem ao patrimônio "${targetPatrimonio}".`);
        err.statusCode = 409;
        throw err;
      }
    }

    return null;
  }

  // Caso 2: String ou número simples
  const term = String(scannedValue).trim();
  if (!term) return null;

  // Busca candidatos por código LabControl exato
  const [labMatches] = await executor.query(
    `SELECT e.*, esp.nome AS espaco_nome FROM equipamento e LEFT JOIN espaco esp ON e.espaco_id = esp.id WHERE UPPER(e.codigo_labcontrol) = UPPER(?)`,
    [term]
  );
  if (labMatches.length === 1) return labMatches[0];
  if (labMatches.length > 1) {
    const err = new Error(`Identificador ambíguo: múltiplos equipamentos com código LabControl "${term}".`);
    err.statusCode = 409;
    throw err;
  }

  // Busca candidatos por patrimônio oficial ou cadastrado
  const [patMatches] = await executor.query(
    `SELECT e.*, esp.nome AS espaco_nome FROM equipamento e LEFT JOIN espaco esp ON e.espaco_id = esp.id WHERE UPPER(e.codigo_patrimonio) = UPPER(?) OR UPPER(e.patrimonio_ufpi) = UPPER(?)`,
    [term, term]
  );

  const isNumeric = /^\d+$/.test(term);
  let idMatch = null;
  if (isNumeric) {
    idMatch = await getEquipamentoById(Number(term), executor);
  }

  // Se houver conflito entre patrimônio e ID de equipamentos distintos, é ambíguo!
  if (patMatches.length > 0 && idMatch && !patMatches.some(e => e.id === idMatch.id)) {
    const err = new Error(`Identificador ambíguo: o termo "${term}" corresponde ao patrimônio do equipamento #${patMatches[0].id} e ao ID do equipamento #${idMatch.id}. Utilize o QR Code ou código LabControl.`);
    err.statusCode = 409;
    throw err;
  }

  if (patMatches.length === 1) return patMatches[0];
  if (patMatches.length > 1) {
    const err = new Error(`Identificador ambíguo: múltiplos equipamentos encontrados para o patrimônio "${term}".`);
    err.statusCode = 409;
    throw err;
  }

  if (idMatch) return idMatch;

  return null;
}

/**
 * Geração de dados de etiquetas em lote para múltiplos equipamentos selecionados.
 * Retorna os dados normalizados (QR payload, nome, código LabControl, patrimônio UFPI se disponível).
 * Não gera dados fictícios.
 */
async function gerarEtiquetasEmLote(ids, executor = pool) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const numericIds = ids.map(id => Number(id)).filter(id => !Number.isNaN(id) && id > 0);
  if (numericIds.length === 0) return [];

  const [rows] = await executor.query(`
    SELECT e.id, e.nome, e.codigo_patrimonio, e.patrimonio_ufpi, e.codigo_labcontrol, e.status, e.inativo,
           esp.nome AS espaco_nome, esp.codigo AS espaco_codigo
    FROM equipamento e
    LEFT JOIN espaco esp ON e.espaco_id = esp.id
    WHERE e.id IN (?)
    ORDER BY e.id ASC
  `, [numericIds]);

  let QRCode = null;
  try {
    QRCode = require('qrcode');
  } catch {
    QRCode = null;
  }

  const etiquetas = [];
  for (const equip of rows) {
    const equipId = equip.id;
    const codigoLab = equip.codigo_labcontrol || `LC-EQ-${String(equipId).padStart(4, '0')}`;
    const patrimonioUfpi = equip.patrimonio_ufpi || null;

    const payloadObj = {
      id: equipId,
      codigo_labcontrol: codigoLab,
      nome: equip.nome,
      action: 'LABCONTROL_CHECKIN_CHECKOUT'
    };

    if (patrimonioUfpi) {
      payloadObj.patrimonio_ufpi = patrimonioUfpi;
    }

    const payloadStr = JSON.stringify(payloadObj);
    let qrDataUrl = null;
    if (QRCode) {
      try {
        qrDataUrl = await QRCode.toDataURL(payloadStr, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 250,
          color: { dark: '#1e293b', light: '#ffffff' }
        });
      } catch {
        qrDataUrl = null;
      }
    }

    etiquetas.push({
      id: equipId,
      nome: equip.nome,
      codigo_labcontrol: codigoLab,
      patrimonio_ufpi: patrimonioUfpi,
      espaco_nome: equip.espaco_nome || null,
      status: equip.status,
      inativo: equip.inativo === 1,
      qr_payload: payloadStr,
      qr_data_url: qrDataUrl
    });
  }

  return etiquetas;
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
  getEquipamentoHistorico,
  localizarPorIdentificadorQR,
  gerarEtiquetasEmLote
};
