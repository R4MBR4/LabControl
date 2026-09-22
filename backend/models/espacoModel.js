const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn } = require('./dbHelper');

const TABLE = 'espaco';

async function getAllEspacos() {
  const pk = await getPrimaryKey(TABLE);
  const sql = `SELECT * FROM \`${TABLE}\` ORDER BY \`${pk}\` ASC`;
  const [rows] = await pool.query(sql);
  return rows;
}

async function getEspacoById(id) {
  return findById(TABLE, id);
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

module.exports = {
  TABLE,
  getAllEspacos,
  getEspacoById,
  createEspaco,
  updateEspaco,
  deleteEspaco
};
