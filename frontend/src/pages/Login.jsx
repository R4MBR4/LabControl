import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Cpu,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
  User,
  GraduationCap,
  Building2,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login', 'cadastro', 'confirmar'
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Estados de Login
  const [email, setEmail] = useState('admin@labcontrol.com');
  const [senha, setSenha] = useState('admin123');

  // Estados de Cadastro Público
  const [cadastroData, setCadastroData] = useState({
    nome: '',
    matricula: '',
    email: '',
    perfil: 'aluno', // 'aluno' ou 'professor'
    departamento: '',
    senha: '',
    confirmacaoSenha: ''
  });

  // Estados de Confirmação de E-mail
  const [tokenConfirmacao, setTokenConfirmacao] = useState('');

  // Feedbacks visuais
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Detecta parâmetros de URL (ex: ?token=xxx ou ?tab=cadastro)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    const tabParam = params.get('tab');

    if (tokenParam) {
      setTokenConfirmacao(tokenParam);
      setMode('confirmar');
    } else if (tabParam === 'cadastro') {
      setMode('cadastro');
    }
  }, [location.search]);

  // Limpa mensagens ao alternar de tela
  const switchMode = (newMode) => {
    setError('');
    setSuccess('');
    setMode(newMode);
  };

  // Submissão do Login
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(email, senha);
      navigate('/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Falha ao autenticar. Verifique seus dados.';
      setError(errMsg);

      // Se conta estiver pendente de confirmação, sugere fluxo de ativação
      if (err.response?.data?.pendenteConfirmacao) {
        setSuccess('Deseja ativar sua conta agora? Clique em "Ativar Conta" abaixo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Submissão do Cadastro Público
  const handleCadastroSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cadastroData.senha !== cadastroData.confirmacaoSenha) {
      setError('A senha e a confirmação de senha não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/cadastro', {
        nome: cadastroData.nome,
        matricula: cadastroData.matricula,
        email: cadastroData.email,
        perfil: cadastroData.perfil,
        departamento: cadastroData.departamento,
        senha: cadastroData.senha,
        confirmacaoSenha: cadastroData.confirmacaoSenha
      });

      setSuccess(res.data.message || 'Cadastro realizado com sucesso! Verifique seu e-mail institucional.');
      setEmail(cadastroData.email);
      setCadastroData({
        nome: '',
        matricula: '',
        email: '',
        perfil: 'aluno',
        departamento: '',
        senha: '',
        confirmacaoSenha: ''
      });
      // Move para confirmação
      setMode('confirmar');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar cadastro institucional.');
    } finally {
      setLoading(false);
    }
  };

  // Submissão da Confirmação de E-mail
  const handleConfirmarSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!tokenConfirmacao.trim()) {
      setError('Informe o token de confirmação recebido.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/confirmar-email', {
        token: tokenConfirmacao.trim()
      });

      setSuccess(res.data.message || 'E-mail confirmado com sucesso! Faça login para continuar.');
      setTokenConfirmacao('');
      setMode('login');
    } catch (err) {
      setError(err.response?.data?.error || 'Token de confirmação inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  // Login de Demonstração Rápido
  const handleQuickLogin = async (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setSenha(demoPass);
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar sessão demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      {/* Cabeçalho Institucional */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-teal-600 items-center justify-center text-white shadow-xl shadow-teal-600/30 mb-3">
          <Cpu className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">LabControl</h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
          Gestão e Rastreabilidade de Espaços e Equipamentos da UFPI
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200 space-y-6">
          {/* Mensagens de Alerta e Feedback */}
          {error && (
            <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{success}</p>
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* FLUXO 1: ENTRAR NO SISTEMA (LOGIN)                  */}
          {/* =================================================== */}
          {mode === 'login' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                  Acesso ao Sistema
                </h2>
                <button
                  type="button"
                  onClick={() => switchMode('cadastro')}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer"
                >
                  Criar conta nova →
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    E-mail Institucional
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@ufpi.edu.br"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm transition shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => switchMode('confirmar')}
                  className="hover:text-teal-700 hover:underline cursor-pointer"
                >
                  Confirmar e-mail com token
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('cadastro')}
                  className="text-teal-700 font-semibold hover:underline cursor-pointer"
                >
                  Primeiro acesso? Cadastre-se
                </button>
              </div>

              {/* Acesso em 1 Clique para Teste Acadêmico */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
                  Acesso Rápido de Testes (Perfis Homologados)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('admin@labcontrol.com', 'admin123')}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Entrar como Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('aluno@labcontrol.com', 'aluno123')}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Entrar como Aluno</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* FLUXO 2: CADASTRO PÚBLICO (ALUNO / PROFESSOR)       */}
          {/* =================================================== */}
          {mode === 'cadastro' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                    Novo Cadastro Institucional
                  </h2>
                  <p className="text-[11px] text-slate-500">Exclusivo para discentes e docentes da UFPI</p>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              </div>

              <form className="space-y-3.5" onSubmit={handleCadastroSubmit}>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={cadastroData.nome}
                      onChange={(e) => setCadastroData({ ...cadastroData, nome: e.target.value })}
                      placeholder="Ex: Ana Clara Silva"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Matrícula <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={cadastroData.matricula}
                      onChange={(e) => setCadastroData({ ...cadastroData, matricula: e.target.value })}
                      placeholder="202610100"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Vínculo / Perfil <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cadastroData.perfil}
                      onChange={(e) => setCadastroData({ ...cadastroData, perfil: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    >
                      <option value="aluno">Aluno / Graduação / Pós</option>
                      <option value="professor">Professor / Docente</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    E-mail Institucional <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={cadastroData.email}
                      onChange={(e) => setCadastroData({ ...cadastroData, email: e.target.value })}
                      placeholder="nome@ufpi.edu.br ou @aluno.ufpi.edu.br"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Deve pertencer a um domínio institucional aprovado da UFPI.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Curso ou Departamento (Opcional)
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cadastroData.departamento}
                      onChange={(e) => setCadastroData({ ...cadastroData, departamento: e.target.value })}
                      placeholder="Ex: Engenharia Elétrica / DCOMP"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Senha <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={cadastroData.senha}
                      onChange={(e) => setCadastroData({ ...cadastroData, senha: e.target.value })}
                      placeholder="Mín. 6 dígitos"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Confirmar Senha <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={cadastroData.confirmacaoSenha}
                      onChange={(e) => setCadastroData({ ...cadastroData, confirmacaoSenha: e.target.value })}
                      placeholder="Repita a senha"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Criar Conta Institucional</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-[11px] text-slate-500">
                Já possui conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  Fazer login
                </button>
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* FLUXO 3: CONFIRMAÇÃO DE E-MAIL COM TOKEN            */}
          {/* =================================================== */}
          {mode === 'confirmar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                    Ativação de Conta Institucional
                  </h2>
                  <p className="text-[11px] text-slate-500">Confirmação de e-mail obrigatória</p>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-teal-700" /> Verifique seu e-mail institucional
                </span>
                <p className="text-[11px] text-teal-800 leading-relaxed">
                  Para sua segurança, novas contas necessitam de confirmação prévia antes do primeiro login. Insira o token de ativação recebido por e-mail para desbloquear o acesso.
                </p>
              </div>

              <form className="space-y-3.5" onSubmit={handleConfirmarSubmit}>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Token de Ativação / Confirmação
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={tokenConfirmacao}
                      onChange={(e) => setTokenConfirmacao(e.target.value)}
                      placeholder="Cole o código ou token recebido..."
                      className="w-full pl-9 pr-3 py-2.5 font-mono text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Confirmar e Ativar Conta</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-[11px] text-slate-500">
                Conta já ativada?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  Ir para Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
