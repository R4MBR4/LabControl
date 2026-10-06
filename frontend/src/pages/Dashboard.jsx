import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Building2,
  Cpu,
  CalendarCheck,
  QrCode,
  AlertTriangle,
  Wrench,
  Boxes,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [myReservas, setMyReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (isAdmin) {
          const resMetrics = await api.get('/dashboard/metricas');
          setMetrics(resMetrics.data);
        }
        // Carrega reservas recentes do usuário ou gerais
        const resReservas = await api.get('/reservas');
        setMyReservas(resReservas.data.slice(0, 5));
      } catch (err) {
        console.warn('[Dashboard] Erro ao carregar dados:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAdmin]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header de Boas-vindas */}
      <div className="bg-gradient-to-r from-slate-900 to-teal-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-3">
            {isAdmin ? 'Painel Administrativo do Gestor' : 'Portal do Usuário / Pesquisador'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Olá, {user?.nome || 'Usuário'}!
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Bem-vindo ao LabControl. Acompanhe a disponibilidade de laboratórios, rastreabilidade de equipamentos e realize check-ins via QR Code.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/checkin-checkout"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition shadow-md"
          >
            <QrCode className="w-4 h-4" />
            Check-in / Check-out QR
          </Link>
          <Link
            to="/reservas"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition"
          >
            <CalendarCheck className="w-4 h-4" />
            Nova Reserva
          </Link>
        </div>
      </div>

      {/* Indicadores Básicos para o Administrador */}
      {isAdmin && metrics && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Indicadores Operacionais do Laboratório
            </h2>
            <span className="text-xs text-slate-500">Atualizado em tempo real</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card Espaços */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Espaços / Labs</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.espacos?.total || 0}</p>
                <span className="text-[11px] text-teal-600 font-medium">Cadastrados no sistema</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            {/* Card Equipamentos */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Equipamentos</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.equipamentos?.total || 0}</p>
                <div className="flex gap-2 text-[10px] text-slate-500 font-medium mt-1">
                  <span className="text-emerald-600 font-semibold">{metrics.equipamentos?.disponiveis || 0} Disp.</span>
                  <span>•</span>
                  <span className="text-amber-600 font-semibold">{metrics.equipamentos?.em_uso || 0} Em uso</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
            </div>

            {/* Card Manutenções */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Em Manutenção</span>
                <p className="text-2xl font-bold text-rose-600 mt-1">
                  {metrics.equipamentos?.manutencao || metrics.manutencoes?.em_andamento || 0}
                </p>
                <span className="text-[11px] text-rose-600 font-medium">Bloqueados para reserva</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Wrench className="w-6 h-6" />
              </div>
            </div>

            {/* Card Ocorrências */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Ocorrências Abertas</span>
                <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.ocorrencias?.abertas || 0}</p>
                <span className="text-[11px] text-amber-600 font-medium">Aguardando decisão</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Alerta de Consumíveis em Estoque Crítico */}
          {metrics.consumiveis?.total_criticos > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Atenção: {metrics.consumiveis.total_criticos} item(ns) com estoque no nível mínimo ou esgotado!
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Itens críticos: {metrics.consumiveis.itens_criticos?.map(i => i.nome).join(', ')}
                  </p>
                </div>
              </div>
              <Link
                to="/consumiveis"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shrink-0 transition text-center"
              >
                Gerenciar Estoque
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Acesso Rápido a Funcionalidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/espacos"
          className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Espaços e Laboratórios</h3>
            <p className="text-xs text-slate-500 mt-1">
              Consulte a lotação, localização e disponibilidade de bancadas e salas de aula.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-teal-600 gap-1">
            <span>Explorar espaços</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          to="/equipamentos"
          className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Equipamentos & QR Code</h3>
            <p className="text-xs text-slate-500 mt-1">
              Gere etiquetas com QR Code, visualize históricos de uso e controle status.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 gap-1">
            <span>Ver equipamentos</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          to="/checkin-checkout"
          className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Check-in / Check-out</h3>
            <p className="text-xs text-slate-500 mt-1">
              Faça a leitura rápida do QR Code e registre a condição física obrigatória de devolução.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-purple-600 gap-1">
            <span>Escanear QR Code</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* Próximas Reservas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
              {isAdmin ? 'Últimas Reservas Registradas' : 'Minhas Reservas Recentes'}
            </h3>
          </div>
          <Link to="/reservas" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
            Ver todas →
          </Link>
        </div>

        {myReservas.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhuma reserva encontrada no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myReservas.map((r) => {
              const resId = r.id || r.id_reserva;
              const status = (r.status || 'confirmada').toLowerCase();
              return (
                <div key={resId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      {r.equipamento_nome ? <Cpu className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {r.equipamento_nome || r.espaco_nome || 'Reserva #' + resId}
                      </p>
                      <p className="text-xs text-slate-500">
                        Início: {r.data_inicio ? new Date(r.data_inicio).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>
                  </div>
                  <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    status === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    status === 'cancelada' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
