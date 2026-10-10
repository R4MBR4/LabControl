const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn } = require('./dbHelper');

const TABLE = 'espaco';

async function getAllEspacos() {
  const pk = await getPrimaryKey(TABLE);
  const sql = `SELECT * FROM \`${TABLE}\` ORDER BY \`${pk}\` ASC`;
  const [rows] = await pool.query(sql);
  return rows;
}

async function getEspacoById(id, executor = pool) {
  return findById(TABLE, id, executor);
}

async function createEspaco(data) {
  const id = await insert(TABLE, data);
  return getEspacoById(id);
}

async function updateEspaco(id, data) {
  await update(TABLE, id, data);
  return getEspacoById(id);
}

async function deleteEspaco(id) {
  return remove(TABLE, id);
}

/**
 * Consulta unificada e completa da página do Laboratório (Bloco 06)
 */
async function getEspacoDetalhes(id) {
  const espaco = await getEspacoById(id);
  if (!espaco) return null;

  // Equipamentos do espaço
  const [equipamentos] = await pool.query(`
    SELECT e.*
    FROM equipamento e
    WHERE e.espaco_id = ? AND (e.inativo = 0 OR e.inativo IS NULL)
    ORDER BY e.nome ASC
  `, [id]);

  // Reservas e agenda do espaço
  const [reservas] = await pool.query(`
    SELECT r.*,
           u.nome AS usuario_nome, u.email AS usuario_email,
           eq.nome AS equipamento_nome, eq.codigo_patrimonio AS equipamento_codigo
    FROM reserva r
    LEFT JOIN usuario u ON r.usuario_id = u.id
    LEFT JOIN equipamento eq ON r.equipamento_id = eq.id
    WHERE r.espaco_id = ?
    ORDER BY r.data_inicio DESC
    LIMIT 20
  `, [id]);

  // Utilizações ativas no espaço (equipamentos com check-in em andamento)
  const [utilizacoesAtivas] = await pool.query(`
    SELECT ut.*,
           u.nome AS usuario_nome,
           eq.nome AS equipamento_nome, eq.codigo_patrimonio, eq.codigo_labcontrol
    FROM utilizacao ut
    JOIN equipamento eq ON ut.equipamento_id = eq.id
    JOIN usuario u ON ut.usuario_id = u.id
    WHERE eq.espaco_id = ? AND ut.status = 'em_uso'
    ORDER BY ut.data_inicio DESC
  `, [id]);

  // Reserva atualmente em andamento no laboratório
  const [reservaAtual] = await pool.query(`
    SELECT r.*, u.nome AS usuario_nome, u.email AS usuario_email
    FROM reserva r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.espaco_id = ? 
      AND r.status IN ('confirmada', 'em_andamento')
      AND NOW() BETWEEN r.data_inicio AND r.data_fim
    ORDER BY r.data_inicio ASC
    LIMIT 1
  `, [id]);

  // Histórico de inventários do espaço
  let inventarios = [];
  try {
    const [invRows] = await pool.query(`
      SELECT inv.*, u.nome AS usuario_nome
      FROM inventario inv
      LEFT JOIN usuario u ON inv.usuario_id = u.id
      WHERE inv.espaco_id = ?
      ORDER BY inv.id DESC
      LIMIT 5
    `, [id]);
    inventarios = invRows;
  } catch (e) {
    // Tabela pode estar vazia
  }

  return {
    espaco,
    equipamentos,
    reservas,
    utilizacaoAtual: {
      reservaEmAndamento: reservaAtual[0] || null,
      equipamentosEmUso: utilizacoesAtivas
    },
    inventarios
  };
}

/**
 * Modo Monitor: Payload simples, limpo e legível à distância (Bloco 06)
 * Regra: Evitar exibição de informações desnecessárias. Respeitar privacidade.
 */
async function getEspacoMonitor(id) {
  const espaco = await getEspacoById(id);
  if (!espaco) return null;

  // Reserva atualmente em vigor
  const [reservaAtual] = await pool.query(`
    SELECT r.id, r.finalidade, r.data_inicio, r.data_fim,
           u.nome AS usuario_nome
    FROM reserva r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.espaco_id = ? 
      AND r.status IN ('confirmada', 'em_andamento')
      AND NOW() BETWEEN r.data_inicio AND r.data_fim
    LIMIT 1
  `, [id]);

  // Próximas reservas do dia ou futuras
  const [proximas] = await pool.query(`
    SELECT r.id, r.finalidade, r.data_inicio, r.data_fim,
           u.nome AS usuario_nome
    FROM reserva r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.espaco_id = ? 
      AND r.data_fim > NOW()
      AND r.status IN ('confirmada', 'pendente')
    ORDER BY r.data_inicio ASC
    LIMIT 4
  `, [id]);

  // Equipamentos em uso no momento dentro do laboratório
  const [equipamentosEmUso] = await pool.query(`
    SELECT ut.id, ut.data_inicio,
           eq.nome AS equipamento_nome,
           u.nome AS usuario_nome
    FROM utilizacao ut
    JOIN equipamento eq ON ut.equipamento_id = eq.id
    JOIN usuario u ON ut.usuario_id = u.id
    WHERE eq.espaco_id = ? AND ut.status = 'em_uso'
    ORDER BY ut.data_inicio DESC
  `, [id]);

  // Resumo numérico rápido dos equipamentos
  const [equipStats] = await pool.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'disponivel' THEN 1 ELSE 0 END) AS disponiveis,
      SUM(CASE WHEN status = 'em_uso' THEN 1 ELSE 0 END) AS em_uso,
      SUM(CASE WHEN status = 'manutencao' THEN 1 ELSE 0 END) AS manutencao
    FROM equipamento
    WHERE espaco_id = ? AND (inativo = 0 OR inativo IS NULL)
  `, [id]);

  return {
    espaco: {
      id: espaco.id,
      nome: espaco.nome,
      codigo: espaco.codigo,
      capacidade: espaco.capacidade,
      localizacao: espaco.localizacao,
      status: espaco.status,
      responsavel: espaco.responsavel
    },
    ocupacaoAtual: {
      ocupado: !!reservaAtual[0] || equipamentosEmUso.length > 0,
      reserva: reservaAtual[0] || null,
      equipamentosEmUso
    },
    proximasReservas: proximas,
    estatisticasEquipamentos: equipStats[0] || { total: 0, disponiveis: 0, em_uso: 0, manutencao: 0 },
    timestampAtualizacao: new Date().toISOString()
  };
}

function parseDateTimeComponents(val) {
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return {
      year: val.getFullYear(),
      month: val.getMonth() + 1,
      day: val.getDate(),
      dayOfWeek: val.getDay(),
      timeStr: `${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`
    };
  }
  const str = String(val || '').trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const hh = Number(match[4]);
    const mm = Number(match[5]);
    const ss = Number(match[6] || 0);
    const dt = new Date(y, m - 1, d, hh, mm, ss);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      year: y,
      month: m,
      day: d,
      dayOfWeek: dt.getDay(),
      timeStr: `${pad(hh)}:${pad(mm)}:${pad(ss)}`
    };
  }
  const dt = new Date(val);
  if (!isNaN(dt.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return {
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
      day: dt.getDate(),
      dayOfWeek: dt.getDay(),
      timeStr: `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
    };
  }
  return null;
}

function normalizeTime(val, fallback = '07:00:00') {
  if (!val) return fallback;
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return fallback;
  const h = String(match[1]).padStart(2, '0');
  const m = String(match[2]).padStart(2, '0');
  const s = String(match[3] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function parseOperatingDays(dias) {
  if (!dias) return [1, 2, 3, 4, 5, 6];
  if (Array.isArray(dias)) return dias.map(Number).filter((n) => !isNaN(n));
  const dayMap = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
  const tokens = String(dias).toLowerCase().split(/[,;|\s]+/);
  const result = [];
  for (const token of tokens) {
    if (dayMap[token] !== undefined) {
      result.push(dayMap[token]);
    } else {
      const num = Number(token);
      if (!isNaN(num) && num >= 0 && num <= 6) {
        result.push(num);
      }
    }
  }
  return result.length > 0 ? result : [1, 2, 3, 4, 5, 6];
}

/**
 * Validação formal de horário de funcionamento e status de espaço
 */
function validarHorarioFuncionamento(espaco, dataInicio, dataFim) {
  if (!espaco) {
    return { valido: true };
  }

  const status = (espaco.status || 'disponivel').toLowerCase();
  if (['manutencao', 'em_manutencao', 'inativo', 'indisponivel', 'fechado'].includes(status)) {
    return {
      valido: false,
      erro: `O espaço "${espaco.nome || 'selecionado'}" não está disponível para reservas (status: ${espaco.status}).`
    };
  }

  const cInicio = parseDateTimeComponents(dataInicio);
  const cFim = parseDateTimeComponents(dataFim);

  if (!cInicio || !cFim) {
    return { valido: false, erro: 'Data ou hora de início/término em formato inválido.' };
  }

  if (cInicio.year !== cFim.year || cInicio.month !== cFim.month || cInicio.day !== cFim.day) {
    return { valido: false, erro: 'A reserva deve iniciar e terminar no mesmo dia.' };
  }

  const diasPermitidos = parseOperatingDays(espaco.dias_funcionamento);
  if (!diasPermitidos.includes(cInicio.dayOfWeek)) {
    const nomesDias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaNome = nomesDias[cInicio.dayOfWeek] || 'este dia';
    return {
      valido: false,
      erro: `O espaço "${espaco.nome}" não possui expediente em ${diaNome}.`
    };
  }

  const abertura = normalizeTime(espaco.horario_abertura, '07:00:00');
  const fechamento = normalizeTime(espaco.horario_fechamento, '22:00:00');

  if (cInicio.timeStr < abertura) {
    return {
      valido: false,
      erro: `Horário de início (${cInicio.timeStr.substring(0, 5)}) é anterior à abertura do espaço (${abertura.substring(0, 5)}).`
    };
  }

  if (cFim.timeStr > fechamento) {
    return {
      valido: false,
      erro: `Horário de término (${cFim.timeStr.substring(0, 5)}) ultrapassa o fechamento do espaço (${fechamento.substring(0, 5)}).`
    };
  }

  if (cInicio.timeStr >= cFim.timeStr) {
    return {
      valido: false,
      erro: 'O horário de início deve ser anterior ao horário de término.'
    };
  }

  return { valido: true };
}

module.exports = {
  TABLE,
  getAllEspacos,
  getEspacoById,
  createEspaco,
  updateEspaco,
  deleteEspaco,
  getEspacoDetalhes,
  getEspacoMonitor,
  parseDateTimeComponents,
  validarHorarioFuncionamento
};

