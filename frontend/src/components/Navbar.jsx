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
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16 gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg text-slate-800 tracking-tight leading-none">LabControl</span>
                <span className="text-[9px] uppercase font-semibold tracking-wider text-teal-600">Rastreabilidade</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-0.5 xl:gap-1 flex-wrap justify-center flex-1 px-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-[11px] xl:text-xs font-medium transition-colors whitespace-nowrap ${
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

          {/* User Profile & Actions */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-800 max-w-[130px] truncate" title={user?.nome}>
                {user?.nome || 'Usuário'}
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                {user?.perfil || 'Usuário'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Encerrar sessão (Sair)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition shrink-0 cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Sair</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
          <div className="py-2 mb-2 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{user?.nome}</p>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                {user?.perfil || 'Usuário'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    active ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
