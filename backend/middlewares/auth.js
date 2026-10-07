const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuarioModel');

const JWT_SECRET = process.env.JWT_SECRET;
const LEGACY_INSECURE_SECRET = 'labcontrol_secret_token_academico_2026';

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET, 'utf8') < 32 || JWT_SECRET === LEGACY_INSECURE_SECRET) {
  throw new Error(
    'JWT_SECRET deve ser configurado com pelo menos 32 bytes e não pode usar o segredo padrão público. Gere um valor aleatório seguro.'
  );
}

function generateToken(user) {
  const payload = {
    id: user.id || user.id_usuario,
    nome: user.nome,
    email: user.email,
    perfil: (user.perfil || 'usuario').toLowerCase()
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function isUserActive(user) {
  if (user.ativo !== undefined && user.ativo !== null) {
    const activeFlag = String(user.ativo).toLowerCase();
    if (activeFlag !== '1' && activeFlag !== 'true') return false;
  }

  if (user.status !== undefined && user.status !== null && String(user.status).trim()) {
    const status = String(user.status).trim().toLowerCase();
    if (status !== 'ativo' && status !== 'active') return false;
  }

  return true;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Acesso não autorizado: token JWT não informado' 
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Sessão expirada ou token inválido' 
      });
    }
    try {
      if (!user.id && !user.id_usuario) {
        return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
      }

      const currentUser = await usuarioModel.getUserById(user.id || user.id_usuario);
      if (!currentUser) {
        return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
      }
      if (!isUserActive(currentUser)) {
        return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
      }

      req.user = {
        ...currentUser,
        id: currentUser.id || currentUser.id_usuario || user.id || user.id_usuario
      };
      next();
    } catch (authError) {
      console.error('[Auth] Erro ao validar usuário da sessão:', authError.message);
      return res.status(503).json({ error: 'Não foi possível validar a sessão no momento.' });
    }
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
  isUserActive,
  authenticateToken,
  authorizeAdmin
};
