const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'labcontrol_secret_token_academico_2026';

function generateToken(user) {
  const payload = {
    id: user.id || user.id_usuario,
    nome: user.nome,
    email: user.email,
    perfil: (user.perfil || 'usuario').toLowerCase()
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Acesso não autorizado: token JWT não informado' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Sessão expirada ou token inválido' 
      });
    }
    req.user = user;
    next();
  });
}

function authorizeAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const role = (req.user.perfil || '').toLowerCase();
  if (role !== 'admin' && role !== 'administrador') {
    return res.status(403).json({ 
      error: 'Acesso negado: operação permitida apenas para administradores' 
    });
  }

  next();
}

module.exports = {
  generateToken,
  authenticateToken,
  authorizeAdmin
};
