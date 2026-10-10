const crypto = require('node:crypto');
const dbHelper = require('./dbHelper');
const { pool, getPrimaryKey, insert, update, remove, findById, findAll, resolveColumn } = dbHelper;
const bcrypt = require('bcryptjs');

const TABLE = 'usuario';

const DOMINIOS_INSTITUCIONAIS_PERMITIDOS = [
  'ufpi.edu.br',
  'aluno.ufpi.edu.br',
  'ufpi.br',
  'labcontrol.com'
];

function validarEmailInstitucional(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return false;

  const domain = trimmed.split('@')[1];
  return DOMINIOS_INSTITUCIONAIS_PERMITIDOS.includes(domain);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { senha, password, token_confirmacao, token_confirmacao_expira, ...safeUser } = user;
  return safeUser;
}

async function findByEmail(email) {
  if (!email) return null;
  const sql = `SELECT * FROM \`${TABLE}\` WHERE LOWER(email) = LOWER(?) LIMIT 1`;
  const [rows] = await pool.query(sql, [email.trim()]);
  return rows[0] || null;
}

async function findByMatricula(matricula) {
  if (!matricula) return null;
  const sql = `SELECT * FROM \`${TABLE}\` WHERE TRIM(matricula) = TRIM(?) LIMIT 1`;
  const [rows] = await pool.query(sql, [matricula.trim()]);
  return rows[0] || null;
}

async function findByConfirmationToken(token) {
  if (!token) return null;
  const sql = `
    SELECT * FROM \`${TABLE}\` 
    WHERE token_confirmacao = ? 
      AND token_confirmacao_expira > NOW() 
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [token.trim()]);
  return rows[0] || null;
}

async function getAllUsers() {
  const pk = await getPrimaryKey(TABLE);
  const sql = `SELECT * FROM \`${TABLE}\` ORDER BY \`${pk}\` DESC`;
  const [rows] = await pool.query(sql);
  return rows.map(sanitizeUser);
}

async function getUserById(id) {
  const user = await findById(TABLE, id);
  if (!user) return null;
  return sanitizeUser(user);
}

async function createUser(userData) {
  const data = { ...userData };
  if (data.senha) {
    data.senha = await bcrypt.hash(data.senha, 10);
  }
  if (data.email_confirmado === undefined) {
    data.email_confirmado = 1; // Criações administrativas diretas já nascem confirmadas
  }
  const id = await insert(TABLE, data);
  return getUserById(id);
}

async function criarCadastroPublico({ nome, matricula, email, senha, perfil, departamento }) {
  const hashedPassword = await bcrypt.hash(senha, 10);
  const tokenConfirmacao = crypto.randomBytes(32).toString('hex');

  // Validade de 24 horas para o token de confirmação
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const data = {
    nome: nome.trim(),
    matricula: matricula ? matricula.trim() : null,
    email: email.trim().toLowerCase(),
    senha: hashedPassword,
    perfil: perfil === 'professor' ? 'professor' : 'aluno', // Estritamente restrito
    departamento: departamento ? departamento.trim() : null,
    status: 'pendente',
    email_confirmado: 0,
    token_confirmacao: tokenConfirmacao,
    token_confirmacao_expira: expiraEm
  };

  const id = await insert(TABLE, data);
  const user = await getUserById(id);
  return {
    user,
    tokenConfirmacao
  };
}

async function confirmarEmail(userId) {
  const data = {
    email_confirmado: 1,
    status: 'ativo',
    token_confirmacao: null,
    token_confirmacao_expira: null
  };
  await update(TABLE, userId, data);
  return getUserById(userId);
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

async function inativarUsuario(id) {
  const data = { status: 'inativo' };
  await update(TABLE, id, data);
  return getUserById(id);
}

async function reativarUsuario(id) {
  const data = { status: 'ativo' };
  await update(TABLE, id, data);
  return getUserById(id);
}

async function updatePasswordHash(id, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  await dbHelper.update(TABLE, id, { senha: hash });
  return hash;
}

async function verifyPassword(inputPassword, storedPassword, onLegacyMatch = null) {
  if (!storedPassword || typeof storedPassword !== 'string') return false;
  // Valida senhas com hash seguro bcrypt
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    return bcrypt.compare(inputPassword, storedPassword);
  }
  // Compatibilidade com dados legados populados em texto puro
  if (inputPassword === storedPassword) {
    if (typeof onLegacyMatch === 'function') {
      try {
        await onLegacyMatch();
      } catch (e) {
        console.error('[Auth] Erro no callback de migração de senha legada:', e.message);
      }
    }
    return true;
  }
  return false;
}

module.exports = {
  TABLE,
  DOMINIOS_INSTITUCIONAIS_PERMITIDOS,
  validarEmailInstitucional,
  findByEmail,
  findByMatricula,
  findByConfirmationToken,
  getAllUsers,
  getUserById,
  createUser,
  criarCadastroPublico,
  confirmarEmail,
  updateUser,
  inativarUsuario,
  reativarUsuario,
  updatePasswordHash,
  deleteUser: inativarUsuario,
  verifyPassword
};
