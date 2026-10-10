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
  AlertCircle,
  Clock,
  Activity,
  CalendarDays,
  MapPin,
  Timer,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Tv,
  ChevronRight,
  UserCheck
} from 'lucide-react';

function formatDayMonth(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}` : value;
}

/**
 * Gráfico Analítico: Evolução de Reservas e No-Shows nos últimos 7 dias
 * Responde à pergunta: "Como a demanda de agendamentos e o índice de faltas evoluíram na última semana?"
 */
function DailyTrendChart({ reservas = [], noShows = [] }) {
  // Constrói mapa dos últimos 7 dias para visualização combinada
  const dayMap = {};
  reservas.forEach((item) => {
    const key = String(item.dia).slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { dia: key, reservas: 0, noShows: 0 };
    dayMap[key].reservas = Number(item.total || 0);
  });

  noShows.forEach((item) => {
    const key = String(item.dia).slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { dia: key, reservas: 0, noShows: 0 };
    dayMap[key].noShows = Number(item.total || 0);
  });

  const daysList = Object.values(dayMap).sort((a, b) => a.dia.localeCompare(b.dia));
  const maxVal = Math.max(1, ...daysList.map((d) => Math.max(d.reservas, d.noShows)));

  if (daysList.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              Evolução de Reservas e Faltas (7 Dias)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Demanda diária vs. índice de ausências registradas</p>
          </div>
        </div>
        <div className="py-12 text-center text-xs text-slate-400">
          Nenhuma reserva ou no-show computado nos últimos 7 dias.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            Evolução de Reservas e Faltas (7 Dias)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Demanda diária vs. índice de ausências registradas</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-500"></span> Reservas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-400"></span> No-shows
          </span>
        </div>
      </div>

      <div className="pt-6 pb-2">
        <div className="flex items-end justify-between gap-2 h-40 border-b border-slate-200 px-2">
          {daysList.map((d) => {
            const hRes = Math.round((d.reservas / maxVal) * 100);
            const hNoShow = Math.round((d.noShows / maxVal) * 100);

            return (
              <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group">
                <div className="w-full flex items-end justify-center gap-1 h-32">
                  {/* Barra Reservas */}
                  <div
                    style={{ height: `${Math.max(d.reservas > 0 ? 8 : 2, hRes)}%` }}
                    className="w-1/2 max-w-[18px] bg-teal-500 hover:bg-teal-600 rounded-t-sm transition-all relative"
                    title={`Reservas: ${d.reservas}`}
                  >
                    {d.reservas > 0 && (
                      <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-teal-900 bg-teal-100 px-1 rounded">
                        {d.reservas}
                      </span>
                    )}
                  </div>

                  {/* Barra No-Shows */}
                  <div
                    style={{ height: `${Math.max(d.noShows > 0 ? 8 : 2, hNoShow)}%` }}
                    className="w-1/2 max-w-[18px] bg-rose-400 hover:bg-rose-500 rounded-t-sm transition-all relative"
                    title={`No-shows: ${d.noShows}`}
                  >
                    {d.noShows > 0 && (
                      <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-900 bg-rose-100 px-1 rounded">
                        {d.noShows}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate">
                  {formatDayMonth(d.dia)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-3 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Total no período: <strong>{daysList.reduce((acc, d) => acc + d.reservas, 0)} reservas</strong></span>
        <span>Ausências: <strong>{daysList.reduce((acc, d) => acc + d.noShows, 0)} no-shows</strong></span>
      </div>
    </div>
  );
}

/**
 * Gráfico Analítico: Distribuição de Carga por Laboratório
 * Responde à pergunta: "Quais laboratórios têm a maior concentração de utilização física?"
 */
function LaboratoryLoadChart({ entries = [] }) {
  const totalGeral = entries.reduce((acc, cur) => acc + Number(cur.total || 0), 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div className="pb-3 border-b border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-teal-600" />
          Distribuição de Uso por Laboratório (30 Dias)
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Carga de atividades e ocupação relativa entre espaços</p>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Nenhuma utilização computada nos laboratórios nos últimos 30 dias.
        </div>
      ) : (
        <div className="space-y-3 py-4">
          {entries.map((entry, idx) => {
            const count = Number(entry.total || 0);
            const pct = totalGeral > 0 ? Math.round((count / totalGeral) * 100) : 0;

            return (
              <div key={`${entry.label}-${idx}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    <span className="font-semibold text-slate-800 truncate">{entry.label}</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="font-bold text-slate-900">{count} {count === 1 ? 'uso' : 'usos'}</span>
                    <span className="text-[10px] text-slate-500 w-10 text-right">({pct}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 flex justify-between">
        <span>Volume total registrado:</span>
        <strong className="text-slate-800">{totalGeral} sessões</strong>
      </div>
    </div>
  );
}

/**
 * Gráfico Analítico: Gravidade de Ocorrências Pendentes
 * Responde à pergunta: "Qual o perfil de severidade dos incidentes que aguardam resolução?"
 */
function OcorrenciasSeverityChart({ entries = [] }) {
  const total = entries.reduce((acc, cur) => acc + Number(cur.total || 0), 0);

  const severityConfig = {
    critica: { label: 'Crítica', tone: 'bg-rose-600', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
    alta: { label: 'Alta', tone: 'bg-rose-500', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
    media: { label: 'Média', tone: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
    baixa: { label: 'Baixa', tone: 'bg-teal-500', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
    sem_gravidade: { label: 'Informativa', tone: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Perfil de Gravidade das Ocorrências
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Distribuição dos incidentes por impacto operacional</p>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {total} abertas
        </span>
      </div>

      {entries.length === 0 || total === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Nenhuma ocorrência em aberto no momento.
        </div>
      ) : (
        <div className="space-y-3 py-4">
          {entries.map((entry, idx) => {
            const key = String(entry.gravidade || '').toLowerCase();
            const config = severityConfig[key] || severityConfig.sem_gravidade;
            const count = Number(entry.total || 0);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;

            return (
              <div key={`${entry.gravidade}-${idx}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${config.badge}`}>
                    {config.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{count} {count === 1 ? 'item' : 'itens'}</span>
                    <span className="text-[10px] text-slate-500 w-10 text-right">({pct}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${config.tone}`}
                    style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
        <span>Prioridade de resolução:</span>
        <Link to="/ocorrencias" className="text-teal-600 hover:underline font-semibold flex items-center gap-1">
          Gerenciar incidentes <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Gráfico Analítico: Ciclo de Manutenções & Tempo Médio
 * Responde à pergunta: "Quanto tempo um equipamento fica indisponível e quais têm falhas recorrentes?"
 */
function MaintenanceCycleCard({ statusEntries = [], tempoMedioHoras, recorrentes = [] }) {
  const total = statusEntries.reduce((acc, cur) => acc + Number(cur.total || 0), 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div className="pb-3 border-b border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-rose-600" />
          Ciclo de Reparo & Confiabilidade
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Tempo médio de inoperância e identificação de reincidência</p>
      </div>

      <div className="py-4 space-y-4">
        {/* KPI: Tempo Médio de Resolução */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Tempo Médio de Reparo</p>
              <p className="text-sm font-bold text-slate-900">
                {tempoMedioHoras !== null && tempoMedioHoras !== undefined
                  ? `${tempoMedioHoras} horas até conclusão`
                  : 'Dados insuficientes'}
              </p>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">Média histórica</span>
        </div>

        {/* Status de Manutenções Atuais */}
        {statusEntries.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-600 block">Distribuição por Status:</span>
            <div className="space-y-1.5">
              {statusEntries.map((st, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-slate-600 text-[11px]">{st.label.replace('_', ' ')}</span>
                  <span className="font-bold text-slate-800">{st.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerta de Equipamentos com Reincidência */}
        {recorrentes.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
            <span className="font-bold text-amber-900 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              Equipamento(s) com Falhas Recorrentes:
            </span>
            <p className="text-[11px] text-amber-800 leading-tight">
              {recorrentes.map((r) => `${r.nome} (${r.total_manutencoes || 2} manutenções)`).join(', ')}
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
        <span>Total de ordens: <strong>{total}</strong></span>
        <Link to="/manutencao" className="text-teal-600 hover:underline font-semibold flex items-center gap-1">
          Abrir manutenções <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [myReservas, setMyReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      if (isAdmin) {
        try {
          const resMetrics = await api.get('/dashboard/metricas');
          setMetrics(resMetrics.data);
          setMetricsError('');
        } catch (err) {
          setMetricsError(err.response?.data?.error || 'Não foi possível carregar os indicadores operacionais.');
        }
      }
      try {
        const resReservas = await api.get('/reservas');
        setMyReservas(resReservas.data.slice(0, 5));
      } catch (err) {
        console.warn('[Dashboard] Erro ao carregar reservas:', err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Cálculos para o bloco AGORA
  const taxaOcupacaoEspacos = metrics?.espacos?.total > 0
    ? Math.round((metrics.espacos.ocupados / metrics.espacos.total) * 100)
    : 0;

  const taxaDisponibilidadeEquip = metrics?.equipamentos?.total > 0
    ? Math.round((metrics.equipamentos.disponiveis / metrics.equipamentos.total) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ======================================================== */}
      {/* 1. SEÇÃO AGORA: SITUAÇÃO ATUAL DO SISTEMA                */}
      {/* ======================================================== */}
      <section className="space-y-4" aria-label="Situação atual do sistema">
        {/* Banner de Boas-Vindas e Ações Operacionais Imediatas */}
        <div className="bg-gradient-to-r from-slate-900 to-teal-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {isAdmin ? 'Painel de Gestão Operacional' : 'Portal do Usuário / Pesquisador'}
              </span>
              {metrics?.gerado_em && (
                <span className="text-[11px] text-slate-400">
                  Atualizado às {new Date(metrics.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Olá, {user?.nome || 'Usuário'}!
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              Gestão centralizada de laboratórios, controle patrimonial por QR Code e rastreabilidade de agendamentos da UFPI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/checkin-checkout"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition shadow-md cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Check-in / Check-out QR
            </Link>
            <Link
              to="/reservas"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              Nova Reserva
            </Link>
            {isAdmin && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Sincronizar dados do dashboard"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {isAdmin && metricsError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold text-sm">Falha na sincronização dos dados</p>
              <p className="mt-0.5 text-rose-800">{metricsError}</p>
            </div>
          </div>
        )}

        {/* Indicadores Principais em Destaque (AGORA) */}
        {isAdmin && metrics && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  AGORA · Situação Operacional em Tempo Real
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Capacidade instalada e ocupação física
              </span>
            </div>

            {/* Destaque Hierárquico: Espaços vs Equipamentos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card 1: Espaços e Laboratórios */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">Laboratórios & Espaços</p>
                      <h3 className="text-2xl font-extrabold text-slate-900">
                        {metrics.espacos.total} <span className="text-sm font-normal text-slate-500">laboratórios</span>
                      </h3>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    taxaOcupacaoEspacos > 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {taxaOcupacaoEspacos}% Ocupado
                  </span>
                </div>

                {/* Barra Proporcional de Ocupação dos Espaços */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                    <span>{metrics.espacos.disponiveis} disponíveis</span>
                    <span>{metrics.espacos.ocupados} ocupados</span>
                    <span>{metrics.espacos.indisponiveis} indisponíveis</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      style={{ width: `${metrics.espacos.total > 0 ? (metrics.espacos.disponiveis / metrics.espacos.total) * 100 : 0}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Disponíveis: ${metrics.espacos.disponiveis}`}
                    ></div>
                    <div
                      style={{ width: `${metrics.espacos.total > 0 ? (metrics.espacos.ocupados / metrics.espacos.total) * 100 : 0}%` }}
                      className="bg-amber-500 h-full"
                      title={`Ocupados: ${metrics.espacos.ocupados}`}
                    ></div>
                    <div
                      style={{ width: `${metrics.espacos.total > 0 ? (metrics.espacos.indisponiveis / metrics.espacos.total) * 100 : 0}%` }}
                      className="bg-rose-500 h-full"
                      title={`Indisponíveis: ${metrics.espacos.indisponiveis}`}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link to="/espacos" className="text-teal-600 font-semibold hover:underline flex items-center gap-1">
                    Ver catálogo de espaços <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <span className="text-[11px] text-slate-400">Atualização instantânea</span>
                </div>
              </div>

              {/* Card 2: Equipamentos do Campus */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">Parque de Equipamentos</p>
                      <h3 className="text-2xl font-extrabold text-slate-900">
                        {metrics.equipamentos.total} <span className="text-sm font-normal text-slate-500">itens registrados</span>
                      </h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {taxaDisponibilidadeEquip}% Disponível
                  </span>
                </div>

                {/* Breakdown de Status dos Equipamentos */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Prontos</span>
                    <strong className="text-base text-emerald-900">{metrics.equipamentos.disponiveis}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-700 uppercase block">Em Uso</span>
                    <strong className="text-base text-blue-900">{metrics.equipamentos.em_uso}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block">Manutenção</span>
                    <strong className="text-base text-rose-900">{metrics.equipamentos.manutencao}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-600 uppercase block">Inativos</span>
                    <strong className="text-base text-slate-800">{metrics.equipamentos.inativos}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link to="/equipamentos" className="text-teal-600 font-semibold hover:underline flex items-center gap-1">
                    Ver todos os equipamentos <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  {metrics.equipamentos.nao_localizados > 0 && (
                    <span className="text-[11px] text-rose-600 font-bold">
                      ⚠ {metrics.equipamentos.nao_localizados} não localizado(s)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Painel: O que está em utilização neste exato momento */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Em Utilização Agora ({metrics.em_utilizacao_agora.length})
                  </h3>
                </div>
                <Link to="/checkin-checkout" className="text-[11px] font-semibold text-teal-600 hover:underline">
                  Registrar devolução / check-out →
                </Link>
              </div>

              {metrics.em_utilizacao_agora.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">Nenhum recurso em utilização no momento</p>
                  <p className="text-[11px] text-slate-500">
                    Todos os laboratórios e equipamentos disponíveis estão livres para novas reservas ou check-ins.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {metrics.em_utilizacao_agora.map((item) => (
                    <div key={`${item.tipo_recurso}-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{item.recurso_nome || 'Recurso'}</p>
                          <p className="text-[11px] text-slate-600 truncate">{item.usuario_nome}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold capitalize text-teal-800">
                          {item.tipo_recurso}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-200/70">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>Início {item.data_inicio ? new Date(item.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="truncate">{item.espaco_nome || 'Sem laboratório'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 2. SEÇÃO ATENÇÃO: PROBLEMAS QUE PRECISAM DE AÇÃO        */}
      {/* ======================================================== */}
      {isAdmin && metrics && (
        <section className="space-y-4" aria-label="Problemas que precisam de ação">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                ATENÇÃO · Problemas que Precisam de Ação
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">
              Alertas prioritários e resolução administrativa direta
            </span>
          </div>

          {/* Cards de Alerta Acionáveis (CTAs Diretos) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Alerta 1: Ocorrências Abertas */}
            <div className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
              metrics.alertas.ocorrencias_abertas > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Ocorrências Pendentes</span>
                  <p className={`text-2xl font-extrabold mt-0.5 ${
                    metrics.alertas.ocorrencias_abertas > 0 ? 'text-amber-800' : 'text-slate-800'
                  }`}>
                    {metrics.alertas.ocorrencias_abertas}
                  </p>
                </div>
                <div className={`p-2 rounded-xl ${
                  metrics.alertas.ocorrencias_abertas > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Incidentes relatados por usuários que exigem triagem ou reparo.
              </p>
              <Link
                to="/ocorrencias"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-amber-400 hover:text-amber-800 transition"
              >
                Analisar Ocorrências <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Alerta 2: Divergências de Localização (Inventário) */}
            <div className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
              metrics.alertas.divergencias_localizacao > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Divergências no Inventário</span>
                  <p className={`text-2xl font-extrabold mt-0.5 ${
                    metrics.alertas.divergencias_localizacao > 0 ? 'text-amber-800' : 'text-slate-800'
                  }`}>
                    {metrics.alertas.divergencias_localizacao}
                  </p>
                </div>
                <div className={`p-2 rounded-xl ${
                  metrics.alertas.divergencias_localizacao > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  <MapPin className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Itens detectados em local diferente do cadastrado aguardando decisão.
              </p>
              <Link
                to="/inventario"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-amber-400 hover:text-amber-800 transition"
              >
                Deliberar no Inventário <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Alerta 3: Manutenções Abertas */}
            <div className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
              metrics.alertas.manutencoes_pendentes > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Manutenções em Andamento</span>
                  <p className={`text-2xl font-extrabold mt-0.5 ${
                    metrics.alertas.manutencoes_pendentes > 0 ? 'text-rose-800' : 'text-slate-800'
                  }`}>
                    {metrics.alertas.manutencoes_pendentes}
                  </p>
                </div>
                <div className={`p-2 rounded-xl ${
                  metrics.alertas.manutencoes_pendentes > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Wrench className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Ordens de serviço ativas bloqueando equipamentos para uso.
              </p>
              <Link
                to="/manutencao"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-rose-400 hover:text-rose-800 transition"
              >
                Gerenciar Manutenções <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Alerta 4: Estoque Crítico de Consumíveis */}
            <div className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
              metrics.alertas.estoque_baixo > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Itens Abaixo do Mínimo</span>
                  <p className={`text-2xl font-extrabold mt-0.5 ${
                    metrics.alertas.estoque_baixo > 0 ? 'text-amber-800' : 'text-slate-800'
                  }`}>
                    {metrics.alertas.estoque_baixo}
                  </p>
                </div>
                <div className={`p-2 rounded-xl ${
                  metrics.alertas.estoque_baixo > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Materiais laboratoriais com saldo igual ou inferior ao estoque mínimo.
              </p>
              <Link
                to="/consumiveis"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-amber-400 hover:text-amber-800 transition"
              >
                Repor Consumíveis <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Alerta 5: No-Shows Registrados */}
            <div className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
              metrics.alertas.no_shows > 0 ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">No-Shows Recentes</span>
                  <p className="text-2xl font-extrabold text-slate-800 mt-0.5">
                    {metrics.alertas.no_shows}
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Reservas com ausência de check-in dentro da tolerância regulamentar.
              </p>
              <Link
                to="/reservas"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Auditar Reservas <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Alerta 6: Capacitações Vencidas */}
            <div className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
              metrics.alertas.capacitacoes_vencidas > 0 ? 'bg-purple-50/70 border-purple-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Capacitações Vencidas</span>
                  <p className={`text-2xl font-extrabold mt-0.5 ${
                    metrics.alertas.capacitacoes_vencidas > 0 ? 'text-purple-800' : 'text-slate-800'
                  }`}>
                    {metrics.alertas.capacitacoes_vencidas}
                  </p>
                </div>
                <div className={`p-2 rounded-xl ${
                  metrics.alertas.capacitacoes_vencidas > 0 ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Habilitações de segurança e operação técnica expiradas.
              </p>
              <Link
                to="/capacitacoes"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-purple-400 hover:text-purple-800 transition"
              >
                Revalidar Usuários <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 3. SEÇÃO ANÁLISE: TENDÊNCIAS, COMPARAÇÕES E MÉTRICAS     */}
      {/* ======================================================== */}
      {isAdmin && metrics && (
        <section className="space-y-4" aria-label="Análise e tendências operacionais">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                ANÁLISE · Tendências, Comparações e Métricas
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">
              Visualizações estruturadas para tomada de decisão
            </span>
          </div>

          {/* Grid 2x2 com Visualizações Analíticas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Visualização 1: Evolução Diária (Colunas Verticais) */}
            <DailyTrendChart
              reservas={metrics.graficos.reservas_ultimos_7_dias}
              noShows={metrics.graficos.no_shows_ultimos_7_dias}
            />

            {/* Visualização 2: Carga por Laboratório */}
            <LaboratoryLoadChart
              entries={metrics.graficos.utilizacao_por_laboratorio}
            />

            {/* Visualização 3: Gravidade das Ocorrências */}
            <OcorrenciasSeverityChart
              entries={metrics.graficos.ocorrencias_por_gravidade}
            />

            {/* Visualização 4: Ciclo de Manutenção & Reparo */}
            <MaintenanceCycleCard
              statusEntries={metrics.graficos.manutencoes_por_status}
              tempoMedioHoras={metrics.manutencoes.tempo_medio_horas}
              recorrentes={metrics.manutencoes.recorrentes}
            />
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 4. SEÇÃO AGENDA: PRÓXIMAS RESERVAS E EVENTOS             */}
      {/* ======================================================== */}
      <section className="space-y-4" aria-label="Agenda e próximas reservas">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              AGENDA · Próximas Reservas & Agendamentos
            </h2>
          </div>
          <Link to="/reservas" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
            Ver todas as reservas →
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          {(!myReservas || myReservas.length === 0) ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhuma reserva registrada no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myReservas.map((r) => {
                const resId = r.id || r.id_reserva;
                const status = (r.status || 'confirmada').toLowerCase();
                return (
                  <div key={resId} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        {r.equipamento_nome ? <Cpu className="w-4 h-4 text-blue-600" /> : <Building2 className="w-4 h-4 text-teal-600" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {r.equipamento_nome || r.espaco_nome || `Reserva #${resId}`}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{r.usuario_nome || user?.nome}</span>
                          <span className="text-slate-300">·</span>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Início: {r.data_inicio ? new Date(r.data_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        status === 'confirmada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        status === 'cancelada' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        status === 'no_show' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Acesso Rápido a Módulos do Sistema */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2" aria-label="Módulos operacionais">
        <Link
          to="/espacos"
          className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Espaços e Laboratórios</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consulte capacidade, bancadas e abra o Painel de Ocupação Kiosk para portas de entrada.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-teal-600 gap-1">
            <span>Explorar espaços</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/equipamentos"
          className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Equipamentos & QR Code</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Gere etiquetas padronizadas para impressão, consulte status e histórico de manutenção.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 gap-1">
            <span>Ver equipamentos</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/checkin-checkout"
          className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Check-in / Check-out</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Leitura óptica de QR Code com validação instantânea e coleta de evidências físicas por câmera.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-purple-600 gap-1">
            <span>Escanear QR Code</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </section>
    </div>
  );
}
