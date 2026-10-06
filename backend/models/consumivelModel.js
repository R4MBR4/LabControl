const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn, getTableColumns } = require('./dbHelper');

const TABLE = 'consumivel';

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

async function getConsumivelById(id) {
  const item = await findById(TABLE, id);
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

async function createConsumivel(data) {
  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);
  if (data[colQtd] !== undefined && Number(data[colQtd]) < 0) {
    throw new Error('A quantidade inicial não pode ser negativa');
  }
  const id = await insert(TABLE, data);
  return getConsumivelById(id);
}

async function updateConsumivel(id, data) {
  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);
  if (data[colQtd] !== undefined && Number(data[colQtd]) < 0) {
    throw new Error('O estoque não pode ser negativo');
  }
  await update(TABLE, id, data);
  return getConsumivelById(id);
}

/**
 * Regra de negócio crítica: O estoque de consumível não pode ser negativo.
 * Movimenta o estoque (positivo para entrada, negativo para saída).
 */
async function movimentarEstoque(id, delta) {
  const pk = await getPrimaryKey(TABLE);
  const colQtd = await resolveColumn(TABLE, ['quantidade', 'qtd', 'estoque_atual']);

  const item = await findById(TABLE, id);
  if (!item) {
    throw new Error('Consumível não encontrado');
  }

  const saldoAtual = Number(item[colQtd] || 0);
  const novoSaldo = saldoAtual + Number(delta);

  if (novoSaldo < 0) {
    throw new Error(`Estoque insuficiente. Saldo atual: ${saldoAtual}, solicitado: ${Math.abs(delta)}. O estoque não pode ficar negativo.`);
  }

  const sql = `UPDATE \`${TABLE}\` SET \`${colQtd}\` = ? WHERE \`${pk}\` = ?`;
  await pool.query(sql, [novoSaldo, id]);

  return getConsumivelById(id);
}

async function deleteConsumivel(id) {
  return remove(TABLE, id);
}

module.exports = {
  TABLE,
  getAllConsumiveis,
  getConsumivelById,
  createConsumivel,
  updateConsumivel,
  movimentarEstoque,
  deleteConsumivel
};
