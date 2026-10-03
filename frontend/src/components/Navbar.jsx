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
  User as UserIcon
} from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    navLinks.push({ name: 'Manutenção', path: '/manutencao', icon: Wrench });
    navLinks.push({ name: 'Usuários', path: '/usuarios', icon: Users });
  }

  const isActive = (path) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Lado Esquerdo: Logo junto dos Links (sem vão exagerado) */}
          <div className="flex items-center gap-4 xl:gap-6">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-slate-800 tracking-tight leading-none">LabControl</span>
                <span className="text-[9px] uppercase font-semibold tracking-wider text-teal-600">Rastreabilidade</span>
              </div>
            </Link>

            {/* Links Desktop (agrupados ao lado do logo) */}
            <div className="hidden xl:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-teal-50 text-teal-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Lado Direito Desktop: Perfil do Usuário e Botão Sair */}
          <div className="hidden xl:flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end pr-2 border-r border-slate-200">
              <span className="text-xs font-semibold text-slate-800 max-w-[140px] truncate" title={user?.nome}>
                {user?.nome || 'Usuário'}
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                {user?.perfil || 'Usuário'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Encerrar sessão e sair do sistema"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition shrink-0 cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Sair</span>
            </button>
          </div>

          {/* Lado Direito Celular e Tablet: Botão Sair Rápido + Menu Hambúrguer */}
          <div className="flex items-center gap-2 xl:hidden">
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Aberto no Celular (Gaveta Mobile Otimizada) */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4 shadow-xl">
          {/* Card do Usuário Logado no Celular */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 leading-tight">{user?.nome || 'Usuário'}</p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {user?.perfil || 'Usuário'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          {/* Grade de Navegação no Celular (2 colunas grandes para toque fácil) */}
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition ${
                    active
                      ? 'bg-teal-50 border border-teal-200 text-teal-700 font-bold shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span className="truncate">{link.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
