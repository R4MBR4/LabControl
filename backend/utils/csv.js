function detectDelimiter(text) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && Object.hasOwn(counts, char)) {
      counts[char] += 1;
    }
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsv(input) {
  const text = String(input || '').replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('O arquivo CSV está vazio.');

  const delimiter = detectDelimiter(text);
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let rowLine = 1;

  const finishField = () => {
    row.push(field);
    field = '';
    closedQuote = false;
  };
  const finishRecord = () => {
    finishField();
    if (row.some((value) => value.trim() !== '')) records.push({ line: rowLine, values: row });
    row = [];
    rowLine = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += char;
        if (char === '\n') line += 1;
      }
      continue;
    }

    if (char === delimiter) {
      finishField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      finishRecord();
      line += 1;
      rowLine = line;
    } else if (char === '"') {
      if (field.length > 0 || closedQuote) throw new Error(`Aspas fora de posição na linha ${line}.`);
      quoted = true;
    } else if (closedQuote && char.trim() !== '') {
      throw new Error(`Conteúdo inesperado após aspas na linha ${line}.`);
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error(`Campo entre aspas não foi fechado (linha ${rowLine}).`);
  if (field.length > 0 || row.length > 0 || closedQuote) finishRecord();

  if (records.length === 0) throw new Error('O arquivo CSV não contém cabeçalho.');
  const headers = records[0].values.map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error('O cabeçalho contém uma coluna sem nome.');

  return {
    headers,
    rows: records.slice(1).map((record) => ({ line: record.line, values: record.values }))
  };
}

function protectSpreadsheetFormula(value) {
  if (typeof value !== 'string') return value;
  if (/^[\t\r ]*[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function serializeCsv(headers, rows, delimiter = ';') {
  const serializeField = (value) => {
    const sourceValue = value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`
      : value === null || value === undefined
        ? ''
        : value;
    const safeValue = typeof sourceValue === 'string' ? protectSpreadsheetFormula(sourceValue) : sourceValue;
    const text = String(safeValue);
    return /["\r\n;]/.test(text) || text.includes(delimiter)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };

  return `\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((values) => values.map(serializeField).join(delimiter))
    .join('\r\n')}\r\n`;
}

module.exports = { parseCsv, serializeCsv };
