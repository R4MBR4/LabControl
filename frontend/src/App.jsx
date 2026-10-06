import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Espacos from './pages/Espacos';
import Equipamentos from './pages/Equipamentos';
import EquipamentoDetalhes from './pages/EquipamentoDetalhes';
import Reservas from './pages/Reservas';
import CheckinCheckout from './pages/CheckinCheckout';
import Ocorrencias from './pages/Ocorrencias';
import Manutencao from './pages/Manutencao';
import Consumiveis from './pages/Consumiveis';
import Capacitacoes from './pages/Capacitacoes';
import Usuarios from './pages/Usuarios';
import InventarioQR from './pages/InventarioQR';
import EspacoDetalhes from './pages/EspacoDetalhes';
import EspacoMonitor from './pages/EspacoMonitor';
import Relatorios from './pages/Relatorios';

function LayoutWithNavbar() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/espacos" element={<Espacos />} />
          <Route path="/espacos/:id" element={<EspacoDetalhes />} />
          <Route path="/equipamentos" element={<Equipamentos />} />
          <Route path="/equipamentos/:id" element={<EquipamentoDetalhes />} />
          <Route path="/reservas" element={<Reservas />} />
          <Route path="/checkin-checkout" element={<CheckinCheckout />} />
          <Route path="/ocorrencias" element={<Ocorrencias />} />
          <Route path="/consumiveis" element={<Consumiveis />} />
          <Route path="/capacitacoes" element={<Capacitacoes />} />
          <Route path="/inventario" element={<InventarioQR />} />

          {/* Rotas exclusivas do Administrador */}
          <Route element={<ProtectedRoute adminOnly={true} />}>
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/manutencao" element={<Manutencao />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <footer className="py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        LabControl &copy; {new Date().getFullYear()} — Plataforma de Gestão e Rastreabilidade de Espaços e Equipamentos Educacionais
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Modo Monitor dedicado para exibição em tablets/TVs */}
          <Route path="/espacos/:id/monitor" element={<EspacoMonitor />} />

          {/* Rotas protegidas gerais com layout padrão */}
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<LayoutWithNavbar />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
