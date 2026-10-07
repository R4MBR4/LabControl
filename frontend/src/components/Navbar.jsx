import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Cpu,
  CalendarCheck,
  QrCode,
  AlertTriangle,
  Wrench,
  Boxes,
  GraduationCap,
  Users,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  User as UserIcon,
  ClipboardCheck,
  FileBarChart2,
  Search,
  Moon,
  Sun
} from 'lucide-react';
import BuscaGlobal from './BuscaGlobal';
import Notificacoes from './Notificacoes';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Espaços', path: '/espacos', icon: Building2 },
    { name: 'Equipamentos', path: '/equipamentos', icon: Cpu },
    { name: 'Reservas', path: '/reservas', icon: CalendarCheck },
    { name: 'Check-in / Out', path: '/checkin-checkout', icon: QrCode },
    { name: 'Ocorrências', path: '/ocorrencias', icon: AlertTriangle },
    { name: 'Consumíveis', path: '/consumiveis', icon: Boxes },
    { name: 'Capacitações', path: '/capacitacoes', icon: GraduationCap },
  ];

  if (isAdmin) {
    navLinks.push({ name: 'Inventário QR', path: '/inventario', icon: ClipboardCheck });
    navLinks.push({ name: 'Relatórios', path: '/relatorios', icon: FileBarChart2 });
    navLinks.push({ name: 'Manutenção', path: '/manutencao', icon: Wrench });
    navLinks.push({ name: 'Usuários', path: '/usuarios', icon: Users });
  }

  const isActive = (path) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs w-full">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex justify-between items-center h-14 sm:h-16 gap-1 min-w-0">
          {/* Lado Esquerdo: Logo + Links Compactos sem Vão */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm sm:text-base text-slate-800 tracking-tight leading-none shrink-0">LabControl</span>
            </Link>

            {/* Links Desktop: rolagem contida para manter os controles acessíveis */}
            <div
              className="hidden lg:flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain"
              role="region"
              aria-label="Opções principais do menu com rolagem horizontal"
              tabIndex={0}
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex shrink-0 items-center gap-1 px-1.5 xl:px-2 py-1 rounded-md text-[11px] xl:text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-teal-50 text-teal-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <Notificacoes />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Lado Direito Desktop: Perfil do Usuário e Botão Sair com Ícone (como antes) */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-200">
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              aria-label="Abrir busca global"
              title="Buscar em todo o LabControl"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-end leading-tight pr-1">
              <span className="text-xs font-semibold text-slate-800 max-w-[110px] truncate" title={user?.nome}>
                {user?.nome || 'Usuário'}
              </span>
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                {user?.perfil || 'Usuário'}
              </span>
            </div>

            {/* Botão de Sair com ícone direto à mostra sem rolagem lateral */}
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Lado Direito Celular e Tablet: Botão Sair Ícone + Menu Hambúrguer */}
          <div className="flex items-center gap-1 lg:hidden shrink-0">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setGlobalSearchOpen(true);
              }}
              aria-label="Abrir busca global"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Aberto no Celular (Gaveta Mobile Otimizada) */}
      {mobileMenuOpen && (
        <div className="lg:hidden min-w-0 border-t border-slate-200 bg-white px-3 pt-3 pb-6 space-y-3 shadow-xl">
          {/* Card do Usuário Logado no Celular */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 leading-tight">{user?.nome || 'Usuário'}</p>
                <span className={`inline-flex items-center gap-1 px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                  isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {user?.perfil || 'Usuário'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          {/* Grade de Navegação no Celular (2 colunas) */}
          <div className="grid grid-cols-2 gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-1.5 p-2 rounded-lg text-xs font-medium transition ${
                    active
                      ? 'bg-teal-50 border border-teal-200 text-teal-700 font-bold shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span className="truncate">{link.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {globalSearchOpen && <BuscaGlobal onClose={() => setGlobalSearchOpen(false)} />}
    </nav>
  );
}
