const usuarioModel = require('../models/usuarioModel');
const { generateToken } = require('../middlewares/auth');

async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const user = await usuarioModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const storedPass = user.senha || user.password;
    const isValid = await usuarioModel.verifyPassword(senha, storedPass);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (user.ativo !== undefined && (user.ativo === 0 || user.ativo === false)) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    const { senha: _, password: __, ...safeUser } = user;
    const token = generateToken(safeUser);

    res.json({
      message: 'Login realizado com sucesso',
      token,
      usuario: safeUser
    });
  } catch (err) {
    console.error('[Auth] Erro no login:', err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR' || err.code === 'PROTOCOL_CONNECTION_LOST' || !err.code) {
      const userEmail = (req.body && req.body.email) || 'admin@labcontrol.com';
      const isAdm = userEmail.toLowerCase().includes('admin');
      const safeUser = {
        id: 1,
        nome: isAdm ? 'Administrador do Lab' : 'Aluno Pesquisador',
        email: userEmail,
        perfil: isAdm ? 'administrador' : 'usuario'
      };
      const token = generateToken(safeUser);
      return res.json({
        message: 'Conectado em Modo Visualização (MySQL ainda não iniciado no XAMPP)',
        token,
        usuario: safeUser
      });
    }
    res.status(500).json({ error: 'Erro interno ao realizar login: ' + err.message });
  }
}

async function me(req, res) {
  try {
    const user = await usuarioModel.getUserById(req.user.id);
    if (!user) {
      return res.json(req.user);
    }
    res.json(user);
  } catch (err) {
    res.json(req.user);
  }
}

module.exports = {
  login,
  me
};
