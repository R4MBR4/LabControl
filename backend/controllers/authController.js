const usuarioModel = require('../models/usuarioModel');
const { generateToken, isUserActive } = require('../middlewares/auth');

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

    if (!isUserActive(user)) {
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
    res.status(500).json({ error: 'Não foi possível autenticar no momento. Tente novamente.' });
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
