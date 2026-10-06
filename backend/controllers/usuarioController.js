const usuarioModel = require('../models/usuarioModel');

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
    const user = await usuarioModel.getUserById(req.params.id);
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

    const existing = await usuarioModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'E-mail já cadastrado no sistema' });
    }

    const newUser = await usuarioModel.createUser(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    console.error('[Usuario] Erro ao cadastrar:', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
}

async function update(req, res) {
  try {
    const updated = await usuarioModel.updateUser(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(updated);
  } catch (err) {
    console.error('[Usuario] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

async function remove(req, res) {
  try {
    const success = await usuarioModel.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json({ message: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error('[Usuario] Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover usuário' });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
