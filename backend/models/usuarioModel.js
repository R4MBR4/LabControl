const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn } = require('./dbHelper');
const bcrypt = require('bcryptjs');

const TABLE = 'usuario';

async function findByEmail(email) {
  const sql = `SELECT * FROM \`${TABLE}\` WHERE LOWER(email) = LOWER(?) LIMIT 1`;
  const [rows] = await pool.query(sql, [email.trim()]);
  return rows[0] || null;
}

async function getAllUsers() {
  const pk = await getPrimaryKey(TABLE);
  const sql = `SELECT * FROM \`${TABLE}\` ORDER BY \`${pk}\` DESC`;
  const [rows] = await pool.query(sql);
  return rows.map(u => {
    const { senha, password, ...safeUser } = u;
    return safeUser;
  });
}

async function getUserById(id) {
  const user = await findById(TABLE, id);
  if (!user) return null;
  const { senha, password, ...safeUser } = user;
  return safeUser;
}

async function createUser(userData) {
  const data = { ...userData };
  if (data.senha) {
    data.senha = await bcrypt.hash(data.senha, 10);
  }
  const id = await insert(TABLE, data);
  return getUserById(id);
}

async function updateUser(id, userData) {
  const data = { ...userData };
  if (data.senha && data.senha.trim() !== '') {
    data.senha = await bcrypt.hash(data.senha, 10);
  } else {
    delete data.senha;
    delete data.password;
  }
  await update(TABLE, id, data);
  return getUserById(id);
}

async function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  // Suporta senhas em hash bcrypt
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    return bcrypt.compare(inputPassword, storedPassword);
  }
  // Suporta senha em texto plano se o banco já tiver sido populado assim academicamente
  return inputPassword === storedPassword;
}

module.exports = {
  TABLE,
  findByEmail,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser: (id) => remove(TABLE, id),
  verifyPassword
};
