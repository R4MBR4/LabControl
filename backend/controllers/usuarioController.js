const usuarioModel = require('../models/usuarioModel');
const auditoriaModel = require('../models/auditoriaModel');

function parseUserId(idParam) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

async function list(req, res) {
  try {
    const users = await usuarioModel.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error('[Usuario] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

async function getById(req, res) {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }
    const user = await usuarioModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (err) {
    console.error('[Usuario] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

async function create(req, res) {
  try {
    const { nome, email, senha, perfil } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    }
    if (typeof senha !== 'string' || senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
    }

    const existing = await usuarioModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'E-mail já cadastrado no sistema' });
    }

    if (req.body.matricula && String(req.body.matricula).trim() !== '') {
      const existingMatricula = await usuarioModel.findByMatricula(req.body.matricula);
      if (existingMatricula) {
        return res.status(400).json({ error: 'Matrícula já cadastrada no sistema' });
      }
    }

    const newUser = await usuarioModel.createUser(req.body);
    await auditoriaModel.registrarEvento({
      entidade: 'usuario',
      entidade_id: String(newUser.id || newUser.id_usuario),
      acao: 'usuario_criado',
      usuario_id: req.user.id,
      detalhes: { nome: newUser.nome, email: newUser.email, perfil: newUser.perfil }
    });
    res.status(201).json(newUser);
  } catch (err) {
    console.error('[Usuario] Erro ao cadastrar:', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
}

async function update(req, res) {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }

    // Proteção contra auto-revogação de privilégios ou auto-desativação
    if (String(req.user.id) === String(id)) {
      if (req.body.perfil && !['admin', 'administrador'].includes(String(req.body.perfil).toLowerCase())) {
        return res.status(400).json({ error: 'Não é permitido revogar seus próprios privilégios de administrador.' });
      }
      if (req.body.status === 'inativo' || req.body.ativo === 0 || req.body.ativo === false) {
        return res.status(400).json({ error: 'Não é permitido desativar sua própria conta de administrador em uso.' });
      }
    }

    if (req.body.senha !== undefined && req.body.senha.trim() !== '') {
      if (typeof req.body.senha !== 'string' || req.body.senha.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve conter no mínimo 6 caracteres.' });
      }
    }

    const updated = await usuarioModel.updateUser(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await auditoriaModel.registrarEvento({
      entidade: 'usuario',
      entidade_id: String(id),
      acao: 'usuario_atualizado',
      usuario_id: req.user.id,
      detalhes: { nome: updated.nome, email: updated.email, perfil: updated.perfil, status: updated.status }
    });

    res.json(updated);
  } catch (err) {
    console.error('[Usuario] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

async function inativar(req, res) {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'Não é permitido inativar a própria conta de administrador em uso.' });
    }

    const user = await usuarioModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const inativado = await usuarioModel.inativarUsuario(id);
    await auditoriaModel.registrarEvento({
      entidade: 'usuario',
      entidade_id: String(id),
      acao: 'usuario_inativado',
      usuario_id: req.user.id,
      detalhes: {
        email: user.email,
        nome: user.nome,
        motivo: req.body?.motivo || 'Inativação lógica administrativa para preservação do histórico'
      }
    });

    res.json({ message: 'Usuário inativado com sucesso. Histórico preservado.', usuario: inativado });
  } catch (err) {
    console.error('[Usuario] Erro ao inativar:', err);
    res.status(500).json({ error: 'Erro ao inativar usuário' });
  }
}

async function reativar(req, res) {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }

    const user = await usuarioModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const reativado = await usuarioModel.reativarUsuario(id);
    await auditoriaModel.registrarEvento({
      entidade: 'usuario',
      entidade_id: String(id),
      acao: 'usuario_reativado',
      usuario_id: req.user.id,
      detalhes: { email: user.email, nome: user.nome }
    });

    res.json({ message: 'Usuário reativado com sucesso.', usuario: reativado });
  } catch (err) {
    console.error('[Usuario] Erro ao reativar:', err);
    res.status(500).json({ error: 'Erro ao reativar usuário' });
  }
}

async function remove(req, res) {
  // A exclusão física é convertida em inativação lógica para preservar todo o histórico
  return inativar(req, res);
}

module.exports = {
  list,
  getById,
  create,
  update,
  inativar,
  reativar,
  remove
};
