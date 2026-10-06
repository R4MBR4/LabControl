const { pool, getTableColumns, resolveColumn } = require('../models/dbHelper');
const equipamentoModel = require('../models/equipamentoModel');
const auditoriaModel = require('../models/auditoriaModel');
const espacoModel = require('../models/espacoModel');
const reservaModel = require('../models/reservaModel');
const utilizacaoModel = require('../models/utilizacaoModel');
const ocorrenciaModel = require('../models/ocorrenciaModel');
const manutencaoModel = require('../models/manutencaoModel');
const consumivelModel = require('../models/consumivelModel');
const inventarioModel = require('../models/inventarioModel');
const { parseCsv, serializeCsv } = require('../utils/csv');

const EXPORTS = {
  equipamentos: {
    label: 'Equipamentos',
    table: 'equipamento',
    load: () => equipamentoModel.getAllEquipamentos({ incluir_inativos: true })
  },
  laboratorios: { label: 'Laboratórios', table: 'espaco', load: () => espacoModel.getAllEspacos() },
  reservas: { label: 'Reservas', table: 'reserva', load: () => reservaModel.getAllReservas() },
  utilizacoes: { label: 'Utilizações', table: 'utilizacao', load: () => utilizacaoModel.getAllUtilizacoes() },
  ocorrencias: { label: 'Ocorrências', table: 'ocorrencia', load: () => ocorrenciaModel.getAllOcorrencias() },
  manutencoes: { label: 'Manutenções', table: 'manutencao', load: () => manutencaoModel.getAllManutencoes() },
  consumiveis: { label: 'Consumíveis', table: 'consumivel', load: () => consumivelModel.getAllConsumiveis() },
  inventarios: { label: 'Inventários', table: 'inventario', load: () => inventarioModel.getAllInventarios() },
  itens_inventario: { label: 'Itens de inventário', table: 'inventario_item', load: async () => {
    const [rows] = await pool.query('SELECT * FROM `inventario_item` ORDER BY `id` ASC');
    return rows;
  } }
};

const OMITTED_EXPORT_COLUMNS = new Set([
  'foto_url', 'foto_evidencia', 'foto_metadata', 'imagem', 'image', 'senha', 'password'
]);
const FIELD_ALIASES = {
  patrimonio_ufpi: ['patrimonio ufpi', 'patrimonio', 'codigo patrimonio', 'codigo patrimonio ufpi'],
  nome: ['nome', 'nome do equipamento', 'equipamento'],
  categoria: ['categoria'],
  marca: ['marca'],
  modelo: ['modelo'],
  numero_serie: ['numero de serie', 'numero serie', 'serie'],
  laboratorio: ['laboratorio', 'laboratorio espaco', 'espaco', 'espaco vinculado'],
  localizacao: ['localizacao', 'localizacao detalhada', 'localizacao no laboratorio'],
  status: ['status', 'status operacional'],
  exige_capacitacao: ['capacitacao', 'exige capacitacao', 'capacitacao obrigatoria', 'exige capacitacao obrigatoria'],
  observacoes: ['observacoes', 'observacao']
};
const IMPORT_HEADERS = new Set(Object.values(FIELD_ALIASES).flat().map(normalizeHeader));
const FIELD_LIMITS = {
  patrimonio_ufpi: 50,
  nome: 100,
  categoria: 50,
  marca: 100,
  modelo: 100,
  numero_serie: 100,
  localizacao: 150
};

function normalizeHeader(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function mapCsvRow(headers, values) {
  const data = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        data[field] = String(values[index] ?? '').trim();
        break;
      }
    }
  });
  return data;
}

function normalizeStatus(value) {
  const normalized = normalizeHeader(value).replace(/\s+/g, '_');
  const aliases = {
    disponivel: 'disponivel',
    em_uso: 'em_uso',
    manutencao: 'manutencao',
    em_manutencao: 'manutencao',
    inativo: 'inativo'
  };
  return aliases[normalized] || null;
}

function normalizeBoolean(value) {
  const normalized = normalizeHeader(value);
  if (!normalized) return false;
  if (['1', 'true', 'sim', 'yes', 's'].includes(normalized)) return true;
  if (['0', 'false', 'nao', 'no', 'n'].includes(normalized)) return false;
  return null;
}

async function validateEquipmentCsv(csv, executor = pool, lockExisting = false) {
  const parsed = parseCsv(csv);
  const headerMap = new Map(parsed.headers.map((header) => [normalizeHeader(header), header]));
  const normalizedHeaders = parsed.headers.map(normalizeHeader);
  const duplicateHeaders = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    return {
      rows: [],
      summary: { total: parsed.rows.length, validos: 0, duplicados: 0, laboratorios_inexistentes: 0, invalidos: Math.max(parsed.rows.length, 1) },
      issues: [{ line: 1, errors: [`Cabeçalhos repetidos: ${[...new Set(duplicateHeaders)].join(', ')}.`] }]
    };
  }
  const duplicateFields = Object.entries(FIELD_ALIASES)
    .filter(([, aliases]) => normalizedHeaders.filter((header) => aliases.map(normalizeHeader).includes(header)).length > 1)
    .map(([field]) => field.replaceAll('_', ' '));
  if (duplicateFields.length) {
    return {
      rows: [],
      summary: { total: parsed.rows.length, validos: 0, duplicados: 0, laboratorios_inexistentes: 0, invalidos: Math.max(parsed.rows.length, 1) },
      issues: [{ line: 1, errors: [`Mais de uma coluna corresponde a: ${duplicateFields.join(', ')}.`] }]
    };
  }
  const unsupportedHeaders = normalizedHeaders.filter((header) => !IMPORT_HEADERS.has(header));
  if (unsupportedHeaders.length) {
    return {
      rows: [],
      summary: { total: parsed.rows.length, validos: 0, duplicados: 0, laboratorios_inexistentes: 0, invalidos: Math.max(parsed.rows.length, 1) },
      issues: [{ line: 1, errors: [`Colunas não reconhecidas: ${[...new Set(unsupportedHeaders)].join(', ')}.`] }]
    };
  }
  const findHeader = (field) => FIELD_ALIASES[field]
    .map(normalizeHeader)
    .find((alias) => headerMap.has(alias));
  const missing = ['patrimonio_ufpi', 'nome', 'laboratorio']
    .filter((field) => !findHeader(field))
    .map((field) => ({
      patrimonio_ufpi: 'Patrimônio UFPI',
      nome: 'Nome',
      laboratorio: 'Laboratório'
    }[field]));

  if (missing.length) {
    return {
      rows: [],
      summary: { total: parsed.rows.length, validos: 0, duplicados: 0, laboratorios_inexistentes: 0, invalidos: Math.max(parsed.rows.length, 1) },
      issues: [{ line: 1, errors: [`Colunas obrigatórias ausentes: ${missing.join(', ')}.`] }]
    };
  }
  if (parsed.rows.length === 0) {
    return {
      rows: [],
      summary: { total: 0, validos: 0, duplicados: 0, laboratorios_inexistentes: 0, invalidos: 1 },
      issues: [{ line: 1, errors: ['O arquivo precisa conter ao menos uma linha de equipamento.'] }]
    };
  }

  const [spaces] = await executor.query('SELECT `id`, `nome`, `codigo` FROM `espaco`');
  const spaceByLabel = new Map();
  spaces.forEach((space) => {
    [space.nome, space.codigo].filter(Boolean).forEach((label) => {
      spaceByLabel.set(normalizeIdentifier(label), space.id);
    });
  });

  const patrimonioColumn = await resolveColumn('equipamento', ['patrimonio_ufpi', 'codigo_patrimonio']);
  const legacyPatrimonioColumn = await resolveColumn('equipamento', ['codigo_patrimonio', 'patrimonio_ufpi']);
  const existingQuery = `SELECT \`${patrimonioColumn}\` AS patrimonio, \`${legacyPatrimonioColumn}\` AS legado FROM \`equipamento\`${lockExisting ? ' FOR UPDATE' : ''}`;
  const [existing] = await executor.query(existingQuery);
  const existingPatrimonios = new Set();
  existing.forEach((row) => {
    [row.patrimonio, row.legado].filter(Boolean).forEach((value) => {
      existingPatrimonios.add(normalizeIdentifier(value));
    });
  });

  const mappedRows = parsed.rows.map((record) => ({
    line: record.line,
    data: mapCsvRow(parsed.headers, record.values),
    columnCountError: record.values.length !== parsed.headers.length
  }));
  const frequencies = new Map();
  mappedRows.forEach(({ data }) => {
    const key = normalizeIdentifier(data.patrimonio_ufpi);
    if (key) frequencies.set(key, (frequencies.get(key) || 0) + 1);
  });

  const rows = mappedRows.map(({ line, data, columnCountError }) => {
    const errors = [];
    if (columnCountError) errors.push('A quantidade de campos desta linha não corresponde ao cabeçalho.');
    const labId = spaceByLabel.get(normalizeIdentifier(data.laboratorio));
    if (!data.patrimonio_ufpi) errors.push('Patrimônio UFPI é obrigatório.');
    if (!data.nome) errors.push('Nome é obrigatório.');
    if (!data.laboratorio) errors.push('Laboratório é obrigatório.');
    else if (!labId) errors.push(`Laboratório inexistente: "${data.laboratorio}".`);

    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      if (data[field] && data[field].length > limit) {
        errors.push(`${field.replaceAll('_', ' ')} excede o limite de ${limit} caracteres.`);
      }
    }
    if (data.status && !normalizeStatus(data.status)) {
      errors.push(`Status inválido: "${data.status}". Use disponível, em_uso, manutencao ou inativo.`);
    }

    let exigeCapacitacao = false;
    if (data.exige_capacitacao !== undefined) {
      exigeCapacitacao = normalizeBoolean(data.exige_capacitacao);
      if (exigeCapacitacao === null) errors.push(`Capacitação inválida: "${data.exige_capacitacao}". Use sim/não ou true/false.`);
    }

    const normalizedPatrimonio = normalizeIdentifier(data.patrimonio_ufpi);
    if (normalizedPatrimonio && (existingPatrimonios.has(normalizedPatrimonio) || frequencies.get(normalizedPatrimonio) > 1)) {
      errors.push(`Patrimônio duplicado: "${data.patrimonio_ufpi}".`);
    }

    return {
      line,
      data: {
        patrimonio_ufpi: data.patrimonio_ufpi,
        codigo_patrimonio: data.patrimonio_ufpi,
        nome: data.nome,
        categoria: data.categoria || null,
        marca: data.marca || null,
        modelo: data.modelo || null,
        numero_serie: data.numero_serie || null,
        espaco_id: labId || null,
        localizacao_detalhada: data.localizacao || null,
        status: normalizeStatus(data.status || 'disponivel'),
        inativo: normalizeStatus(data.status || 'disponivel') === 'inativo' ? 1 : 0,
        exige_capacitacao: exigeCapacitacao ? 1 : 0,
        observacoes: data.observacoes || null
      },
      errors
    };
  });

  const duplicates = rows.filter((row) => row.errors.some((error) => error.startsWith('Patrimônio duplicado'))).length;
  const missingSpaces = rows.filter((row) => row.errors.some((error) => error.startsWith('Laboratório inexistente'))).length;
  const invalid = rows.filter((row) => row.errors.length > 0).length;

  return {
    rows,
    summary: {
      total: rows.length,
      validos: rows.length - invalid,
      duplicados: duplicates,
      laboratorios_inexistentes: missingSpaces,
      invalidos: invalid
    },
    issues: rows.filter((row) => row.errors.length).map(({ line, errors }) => ({ line, errors }))
  };
}

async function previewEquipmentImport(req, res) {
  try {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Envie o conteúdo do arquivo CSV para validar.' });
    }
    const preview = await validateEquipmentCsv(req.body);
    res.json({
      summary: preview.summary,
      issues: preview.issues,
      validRows: preview.rows.filter((row) => row.errors.length === 0).length
    });
  } catch (err) {
    console.error('[Integração] Erro ao validar CSV de equipamentos:', err);
    res.status(400).json({ error: err.message });
  }
}

async function importEquipmentCsv(req, res) {
  let connection;
  let transactionStarted = false;

  try {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Envie o conteúdo do arquivo CSV para importar.' });
    }
    try {
      parseCsv(req.body);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const validation = await validateEquipmentCsv(req.body, connection, true);
    if (validation.summary.invalidos > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: 'A importação foi cancelada: corrija todas as linhas inválidas antes de inserir.',
        summary: validation.summary,
        issues: validation.issues
      });
    }

    for (const row of validation.rows) {
      const equipamento = await equipamentoModel.createEquipamento(row.data, connection);
      await auditoriaModel.registrarEvento({
        equipamento_id: equipamento.id || equipamento.id_equipamento,
        entidade: 'equipamento',
        entidade_id: equipamento.id || equipamento.id_equipamento,
        acao: 'equipamento_importado',
        usuario_id: req.user.id,
        detalhes: { linha_csv: row.line, patrimonio_ufpi: row.data.patrimonio_ufpi }
      }, connection);
    }
    await connection.commit();
    transactionStarted = false;
    res.status(201).json({
      message: `${validation.rows.length} equipamento(s) importado(s) com sucesso.`,
      importados: validation.rows.length
    });
  } catch (err) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Integração] Erro ao importar equipamentos:', err);
    res.status(500).json({ error: 'Erro ao importar equipamentos: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
}

async function exportCsv(req, res) {
  try {
    const dataset = EXPORTS[req.params.dataset];
    if (!dataset) return res.status(404).json({ error: 'Conjunto de dados para exportação não encontrado.' });

    const rows = await dataset.load();
    const columns = await getTableColumns(dataset.table);
    const headers = rows.length
      ? Object.keys(rows[0]).filter((column) => !OMITTED_EXPORT_COLUMNS.has(column.toLowerCase()))
      : columns.filter((column) => !OMITTED_EXPORT_COLUMNS.has(column.toLowerCase()));
    if (headers.length === 0) {
      throw new Error(`Não foi possível determinar as colunas para exportar ${dataset.label.toLowerCase()}.`);
    }
    const csv = serializeCsv(headers, rows, ';');
    const fileDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="labcontrol-${req.params.dataset}-${fileDate}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(`[Integração] Erro ao exportar ${req.params.dataset}:`, err);
    res.status(500).json({ error: 'Erro ao gerar exportação CSV: ' + err.message });
  }
}

module.exports = {
  previewEquipmentImport,
  importEquipmentCsv,
  exportCsv
};
