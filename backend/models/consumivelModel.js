const { pool, getPrimaryKey, insert, update, remove, resolveColumn } = require('./dbHelper');

const TABLE = 'consumivel';
const MOVEMENT_TABLE = 'consumivel_movimentacao';

const MOVEMENT_TYPES = new Set(['entrada', 'saida', 'consumo', 'reposicao']);

function stockError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getAllConsumiveis() {
  const pk = await getPrimaryKey(TABLE);
  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);
  const colMin = await resolveColumn(TABLE, ['quantidade_minima', 'estoque_minimo', 'qtd_minima']);

  const sql = `SELECT * FROM \`${TABLE}\` ORDER BY \`${pk}\` ASC`;
  const [rows] = await pool.query(sql);

  return rows.map(item => {
    const qtd = Number(item[colQtd] || 0);
    const min = Number(item[colMin] || 0);
    return {
      ...item,
      estoque_critico: qtd <= min
    };
  });
}

async function getConsumivelById(id, executor = pool) {
  const pk = await getPrimaryKey(TABLE);
  const [rows] = await executor.query(`SELECT * FROM \`${TABLE}\` WHERE \`${pk}\` = ? LIMIT 1`, [id]);
  const item = rows[0];
  if (!item) return null;

  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);
  const colMin = await resolveColumn(TABLE, ['quantidade_minima', 'estoque_minimo', 'qtd_minima']);

  const qtd = Number(item[colQtd] || 0);
  const min = Number(item[colMin] || 0);
  return {
    ...item,
    estoque_critico: qtd <= min
  };
}

async function createConsumivel(data, usuarioId, executor = pool) {
  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);
  const quantidade = data[colQtd] === undefined ? 0 : Number(data[colQtd]);
  if (!Number.isFinite(quantidade) || quantidade < 0 || Math.round(quantidade * 100) !== quantidade * 100) {
    throw stockError('A quantidade inicial deve ser não negativa e ter no máximo duas casas decimais.');
  }
  const id = await insert(TABLE, data, executor);
  if (quantidade > 0) {
    const created = await getConsumivelById(id, executor);
    await registerMovement({
      consumivelId: id,
      consumivelNome: created.nome,
      tipo: 'entrada',
      quantidadeAnterior: 0,
      quantidadeMovimentada: quantidade,
      quantidadeResultante: quantidade,
      usuarioId,
      observacao: 'Estoque inicial do cadastro'
    }, executor);
  }
  return getConsumivelById(id, executor);
}

async function updateConsumivel(id, data) {
  const quantityColumns = ['quantidade', 'qtd', 'estoque_atual'];
  if (quantityColumns.some((column) => Object.prototype.hasOwnProperty.call(data, column))) {
    throw stockError('Altere o saldo usando uma movimentação de estoque para preservar o histórico.');
  }
  await update(TABLE, id, data);
  return getConsumivelById(id);
}

async function registerMovement({
  consumivelId,
  consumivelNome,
  tipo,
  quantidadeAnterior,
  quantidadeMovimentada,
  quantidadeResultante,
  usuarioId,
  observacao
}, executor) {
  const [result] = await executor.query(`
    INSERT INTO \`${MOVEMENT_TABLE}\`
      (consumivel_id, consumivel_nome, tipo, quantidade_anterior, quantidade_movimentada,
       quantidade_resultante, usuario_id, observacao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    consumivelId,
    consumivelNome,
    tipo,
    quantidadeAnterior,
    quantidadeMovimentada,
    quantidadeResultante,
    usuarioId || null,
    observacao || null
  ]);
  return result.insertId;
}

async function movimentarEstoque(id, tipo, quantidade, usuarioId, observacao = '', executor = pool) {
  if (!MOVEMENT_TYPES.has(tipo)) {
    throw stockError('Tipo de movimentação inválido.');
  }
  const amount = Number(quantidade);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    throw stockError('A quantidade movimentada deve ser positiva e ter no máximo duas casas decimais.');
  }

  const pk = await getPrimaryKey(TABLE);
  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);
  const [rows] = await executor.query(`
    SELECT * FROM \`${TABLE}\`
    WHERE \`${pk}\` = ?
    LIMIT 1
    FOR UPDATE
  `, [id]);
  const item = rows[0];
  if (!item) {
    throw stockError('Consumível não encontrado.', 404);
  }

  const saldoAtual = Number(item[colQtd] || 0);
  const isAddition = tipo === 'entrada' || tipo === 'reposicao';
  const novoSaldo = Number((saldoAtual + (isAddition ? amount : -amount)).toFixed(2));

  if (novoSaldo < 0) {
    throw stockError(`Estoque insuficiente. Saldo atual: ${saldoAtual}, solicitado: ${amount}. O estoque não pode ficar negativo.`);
  }

  const sql = `UPDATE \`${TABLE}\` SET \`${colQtd}\` = ? WHERE \`${pk}\` = ? AND \`${colQtd}\` = ?`;
  const [result] = await executor.query(sql, [novoSaldo, id, saldoAtual]);
  if (result.affectedRows !== 1) {
    throw stockError('O saldo foi alterado simultaneamente. Recarregue e tente novamente.', 409);
  }

  const movimentoId = await registerMovement({
    consumivelId: id,
    consumivelNome: item.nome,
    tipo,
    quantidadeAnterior: saldoAtual,
    quantidadeMovimentada: amount,
    quantidadeResultante: novoSaldo,
    usuarioId,
    observacao
  }, executor);

  return {
    consumivel: await getConsumivelById(id, executor),
    movimentacao: {
      consumivel_id: id,
      consumivel_nome: item.nome,
      tipo,
      quantidade_anterior: saldoAtual,
      quantidade_movimentada: amount,
      quantidade_resultante: novoSaldo,
      id: movimentoId,
      usuario_id: usuarioId,
      observacao: observacao || null
    }
  };
}

async function getHistoricoMovimentacoes(id, executor = pool) {
  const [rows] = await executor.query(`
    SELECT m.*, u.nome AS usuario_nome
    FROM \`${MOVEMENT_TABLE}\` m
    LEFT JOIN usuario u ON u.id = m.usuario_id
    WHERE m.consumivel_id = ?
    ORDER BY m.criado_em DESC, m.id DESC
  `, [id]);
  return rows;
}

async function getAllHistoricoMovimentacoes() {
  const [rows] = await pool.query(`
    SELECT m.*, u.nome AS usuario_nome,
           c.espaco_id, s.nome AS espaco_nome,
           COALESCE(c.nome, m.consumivel_nome) AS consumivel_nome
    FROM \`${MOVEMENT_TABLE}\` m
    LEFT JOIN \`${TABLE}\` c ON c.id = m.consumivel_id
    LEFT JOIN espaco s ON s.id = c.espaco_id
    LEFT JOIN usuario u ON u.id = m.usuario_id
    ORDER BY m.criado_em DESC, m.id DESC
  `);
  return rows;
}

async function deleteConsumivel(id) {
  return remove(TABLE, id);
}

module.exports = {
  TABLE,
  MOVEMENT_TABLE,
  MOVEMENT_TYPES,
  getAllConsumiveis,
  getConsumivelById,
  createConsumivel,
  updateConsumivel,
  movimentarEstoque,
  getHistoricoMovimentacoes,
  getAllHistoricoMovimentacoes,
  deleteConsumivel
};
