const usuarioModel = require('../models/usuarioModel');
const auditoriaModel = require('../models/auditoriaModel');
const { generateToken, isUserActive } = require('../middlewares/auth');

/**
 * Cadastro público de novos usuários (alunos e professores)
 * Dados mínimos: nome, matrícula, e-mail institucional, senha, confirmação de senha.
 * Vedada elevação para perfil administrador.
 */
async function cadastro(req, res) {
  try {
    const {
      nome,
      matricula,
      email,
      senha,
      confirmacao_senha,
      confirmacaoSenha,
      perfil,
      departamento
    } = req.body;

    // 1. Validação de presença dos campos mínimos
    if (!nome || !matricula || !email || !senha) {
      return res.status(400).json({
        error: 'Nome, matrícula, e-mail institucional e senha são obrigatórios.'
      });
    }

    if (typeof nome !== 'string' || nome.trim().length < 3) {
      return res.status(400).json({
        error: 'O nome informado deve conter no mínimo 3 caracteres.'
      });
    }

    if (typeof matricula !== 'string' || matricula.trim().length < 2) {
      return res.status(400).json({
        error: 'A matrícula informada é inválida.'
      });
    }

    // 2. Validação da senha e confirmação de senha
    const confirmacao = confirmacao_senha || confirmacaoSenha;
    if (!confirmacao) {
      return res.status(400).json({
        error: 'A confirmação de senha é obrigatória.'
      });
    }

    if (typeof senha !== 'string' || senha.length < 6) {
      return res.status(400).json({
        error: 'A senha deve conter no mínimo 6 caracteres.'
      });
    }

    if (senha !== confirmacao) {
      return res.status(400).json({
        error: 'A senha e a confirmação de senha não coincidem.'
      });
    }

    // 3. Regra de Segurança: Bloqueio estrito de perfil administrador no cadastro público
    if (perfil) {
      const perfilLower = String(perfil).trim().toLowerCase();
      if (perfilLower === 'admin' || perfilLower === 'administrador') {
        return res.status(400).json({
          error: 'O perfil de administrador não é permitido no cadastro público. Contate a coordenação técnica.'
        });
      }
      if (perfilLower !== 'aluno' && perfilLower !== 'professor' && perfilLower !== 'usuario') {
        return res.status(400).json({
          error: 'Perfil de usuário inválido. Escolha entre aluno ou professor.'
        });
      }
    }

    // 4. Validação do formato e domínio institucional
    if (!usuarioModel.validarEmailInstitucional(email)) {
      return res.status(400).json({
        error: 'O e-mail deve ser um endereço institucional válido (ex: @ufpi.edu.br, @aluno.ufpi.edu.br ou @ufpi.br).'
      });
    }

    // 5. Verificação de duplicidade de e-mail e matrícula
    const emailExistente = await usuarioModel.findByEmail(email);
    if (emailExistente) {
      return res.status(400).json({
        error: 'E-mail institucional já cadastrado no sistema.'
      });
    }

    const matriculaExistente = await usuarioModel.findByMatricula(matricula);
    if (matriculaExistente) {
      return res.status(400).json({
        error: 'Matrícula já cadastrada no sistema.'
      });
    }

    // 6. Criação do usuário com status pendente de confirmação
    const perfilFinal = perfil && String(perfil).toLowerCase() === 'professor' ? 'professor' : 'aluno';
    const { user } = await usuarioModel.criarCadastroPublico({
      nome,
      matricula,
      email,
      senha,
      perfil: perfilFinal,
      departamento
    });

    // 7. Registro de auditoria
    await auditoriaModel.registrarEvento({
      entidade: 'usuario',
      entidade_id: String(user.id || user.id_usuario),
      acao: 'cadastro_publico_solicitado',
      usuario_id: user.id || user.id_usuario,
      detalhes: {
        nome: user.nome,
        email: user.email,
        matricula: user.matricula,
        perfil: user.perfil
      }
    });

    // 8. Resposta de sucesso sem vazar o token de confirmação
    res.status(201).json({
      message: 'Cadastro realizado com sucesso! Verifique a mensagem de confirmação enviada para o seu e-mail institucional.',
      email: user.email,
      pendenteConfirmacao: true
    });
  } catch (err) {
    console.error('[Auth] Erro no cadastro público:', err.message);
    res.status(500).json({ error: 'Erro ao processar solicitação de cadastro.' });
  }
}

/**
 * Confirmação de e-mail institucional mediante token único
 */
async function confirmarEmail(req, res) {
  try {
    const token = req.body?.token || req.query?.token;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ error: 'Token de confirmação não informado.' });
    }

    const user = await usuarioModel.findByConfirmationToken(token.trim());
    if (!user) {
      return res.status(400).json({
        error: 'Token de confirmação inválido ou expirado. Solicite novo link se necessário.'
      });
    }

    const userId = user.id || user.id_usuario;
    await usuarioModel.confirmarEmail(userId);

    await auditoriaModel.registrarEvento({
      entidade: 'usuario',
      entidade_id: String(userId),
      acao: 'email_confirmado',
      usuario_id: userId,
      detalhes: {
        email: user.email,
        nome: user.nome
      }
    });

    res.json({
      message: 'E-mail institucional confirmado com sucesso! Sua conta está ativa. Faça login para continuar.'
    });
  } catch (err) {
    console.error('[Auth] Erro ao confirmar e-mail:', err.message);
    res.status(500).json({ error: 'Erro ao validar confirmação de e-mail.' });
  }
}

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
    const isValid = await usuarioModel.verifyPassword(senha, storedPass, async () => {
      try {
        const userId = user.id || user.id_usuario;
        await usuarioModel.updatePasswordHash(userId, senha);
        console.warn(`[Auth] Senha legada do usuário #${userId} convertida para hash bcrypt.`);
      } catch (upgradeErr) {
        console.error('[Auth] Erro ao converter hash de senha legada:', upgradeErr.message);
      }
    });
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Validação 1: E-mail não confirmado
    if (user.email_confirmado !== undefined && (user.email_confirmado === 0 || user.email_confirmado === false || String(user.email_confirmado) === '0')) {
      return res.status(403).json({
        error: 'E-mail não confirmado. Verifique a mensagem enviada para o seu e-mail institucional para ativar sua conta.',
        pendenteConfirmacao: true
      });
    }

    // Validação 2: Usuário inativo
    if (!isUserActive(user) || String(user.status).toLowerCase() === 'inativo') {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    const { senha: _, password: __, token_confirmacao: ___, token_confirmacao_expira: ____, ...safeUser } = user;
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
      const { senha: _, password: __, ...safeUser } = req.user;
      return res.json(safeUser);
    }
    const { senha: _, password: __, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    const { senha: _, password: __, ...safeUser } = req.user;
    res.json(safeUser);
  }
}

module.exports = {
  cadastro,
  confirmarEmail,
  login,
  me
};
