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
  Timer
} from 'lucide-react';

function MetricCard({ title, value, details, icon: Icon, tone = 'teal' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    purple: 'bg-purple-50 text-purple-700',
    slate: 'bg-slate-100 text-slate-700'
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.teal}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{details}</p>
    </div>
  );
}

function BarList({ title, entries = [], emptyText = 'Sem dados para o período.', formatLabel }) {
  const max = Math.max(1, ...entries.map((entry) => Number(entry.total || 0)));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      {entries.length === 0 ? (
        <p className="py-4 text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={`${entry.label}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="truncate text-slate-600">{formatLabel ? formatLabel(entry.label) : entry.label}</span>
                <span className="shrink-0 font-semibold text-slate-800">{entry.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-500"
                  style={{ width: `${(Number(entry.total || 0) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDayMonth(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}` : value;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [myReservas, setMyReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        if (isAdmin) {
          try {
            const resMetrics = await api.get('/dashboard/metricas');
            setMetrics(resMetrics.data);
            setMetricsError('');
          } catch (err) {
            setMetricsError(err.response?.data?.error || 'Não foi possível carregar os indicadores do dashboard.');
          }
        }
        try {
          const resReservas = await api.get('/reservas');
          setMyReservas(resReservas.data.slice(0, 5));
        } catch (err) {
          console.warn('[Dashboard] Erro ao carregar reservas recentes:', err.message);
        }
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

      {isAdmin && metricsError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{metricsError}</span>
        </div>
      )}

      {isAdmin && loading && !metrics && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          Carregando indicadores operacionais...
        </div>
      )}

      {/* Indicadores Administrativos */}
      {isAdmin && metrics && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              O que está acontecendo agora?
            </h2>
            <span className="text-[11px] text-slate-500">
              Atualizado {metrics.gerado_em ? new Date(metrics.gerado_em).toLocaleTimeString('pt-BR') : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Equipamentos"
              value={metrics.equipamentos.total}
              details={`${metrics.equipamentos.disponiveis} disponíveis · ${metrics.equipamentos.em_uso} em uso · ${metrics.equipamentos.manutencao} manutenção · ${metrics.equipamentos.inativos} inativos · ${metrics.equipamentos.nao_localizados} não localizados`}
              icon={Cpu}
              tone="blue"
            />
            <MetricCard
              title="Espaços"
              value={metrics.espacos.total}
              details={`${metrics.espacos.disponiveis} disponíveis · ${metrics.espacos.ocupados} ocupados · ${metrics.espacos.indisponiveis} indisponíveis`}
              icon={Building2}
            />
            <MetricCard
              title="Reservas"
              value={metrics.reservas.hoje}
              details={`${metrics.reservas.futuras} futuras · ${metrics.reservas.em_andamento} em andamento · ${metrics.reservas.canceladas} canceladas · ${metrics.reservas.no_show} no-show`}
              icon={CalendarCheck}
              tone="purple"
            />
            <MetricCard
              title="Ocorrências"
              value={metrics.ocorrencias.abertas}
              details={`${metrics.ocorrencias.recentes} registradas nos últimos 30 dias · ${metrics.ocorrencias.com_manutencao} associadas a equipamento em manutenção`}
              icon={AlertTriangle}
              tone="amber"
            />
            <MetricCard
              title="Manutenções"
              value={metrics.manutencoes.abertas}
              details={`${metrics.manutencoes.concluidas} concluídas · ${metrics.manutencoes.recorrentes.length} equipamento(s) com recorrência · ${metrics.manutencoes.tempo_medio_horas === null ? 'tempo médio indisponível' : `média de ${metrics.manutencoes.tempo_medio_horas} h para conclusão`}`}
              icon={Wrench}
              tone="rose"
            />
            <MetricCard
              title="Estoque baixo"
              value={metrics.consumiveis.abaixo_minimo}
              details={`${metrics.consumiveis.criticos} item(ns) sem saldo · alerta acionado quando quantidade ≤ mínimo`}
              icon={Boxes}
              tone="amber"
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-600" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">Em utilização agora</h3>
            </div>
            {metrics.em_utilizacao_agora.length === 0 ? (
              <p className="py-3 text-xs text-slate-400">Nenhum recurso em utilização neste momento.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {metrics.em_utilizacao_agora.map((item) => (
                  <div key={`${item.tipo_recurso}-${item.id}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{item.recurso_nome || 'Recurso'}</p>
                        <p className="mt-1 text-[11px] text-slate-600">{item.usuario_nome} · {item.espaco_nome || 'Sem laboratório'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-teal-800">
                        {item.tipo_recurso}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      Início {item.data_inicio ? new Date(item.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      {' · '}
                      Término previsto {item.data_fim_previsto ? new Date(item.data_fim_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'não informado'}
                      {item.reserva_id ? ` · Reserva #${item.reserva_id}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">O que precisa de atenção?</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['Manutenções pendentes', metrics.alertas.manutencoes_pendentes, '/manutencao'],
                ['Ocorrências abertas', metrics.alertas.ocorrencias_abertas, '/ocorrencias'],
                ['Inventários em andamento', metrics.alertas.inventarios_incompletos, '/inventario'],
                ['Divergências de localização', metrics.alertas.divergencias_localizacao, '/inventario'],
                ['Não localizados', metrics.alertas.equipamentos_nao_localizados, '/inventario'],
                ['Estoque baixo', metrics.alertas.estoque_baixo, '/consumiveis'],
                ['Capacitações vencidas', metrics.alertas.capacitacoes_vencidas, '/capacitacoes'],
                ['Reservas nas próximas 24h', metrics.alertas.reservas_proximas, '/reservas'],
                ['No-shows registrados', metrics.alertas.no_shows, '/reservas']
              ].map(([label, value, href]) => (
                <Link key={label} to={href} className={`rounded-xl border p-3 transition hover:shadow-xs ${value > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                  <span className="block text-[10px] font-medium leading-snug text-slate-600">{label}</span>
                  <strong className={`mt-1 block text-lg ${value > 0 ? 'text-amber-800' : 'text-slate-800'}`}>{value}</strong>
                </Link>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <BarList title="Utilização por laboratório · 30 dias" entries={metrics.graficos.utilizacao_por_laboratorio} />
            <BarList title="Equipamentos mais utilizados" entries={metrics.graficos.equipamentos_mais_utilizados} />
            <BarList title="Reservas · últimos 7 dias" entries={metrics.graficos.reservas_ultimos_7_dias} formatLabel={formatDayMonth} />
            <BarList title="No-shows · últimos 7 dias" entries={metrics.graficos.no_shows_ultimos_7_dias} formatLabel={formatDayMonth} />
            <BarList title="Ocorrências abertas por gravidade" entries={metrics.graficos.ocorrencias_por_gravidade} />
            <BarList title="Manutenções por status" entries={metrics.graficos.manutencoes_por_status} />
            <BarList title="Manutenções recorrentes por equipamento" entries={metrics.graficos.manutencoes_recorrentes} emptyText="Nenhum equipamento tem duas ou mais manutenções registradas." />
          </div>

          {(metrics.proximas_reservas.length > 0 || metrics.ocorrencias_pendentes.length > 0 || metrics.manutencoes_pendentes.length > 0 || metrics.consumiveis.itens_criticos.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {metrics.proximas_reservas.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                    <CalendarDays className="h-4 w-4 text-teal-600" /> Próximas reservas
                  </h3>
                  <div className="space-y-2">
                    {metrics.proximas_reservas.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">{item.equipamento_nome || item.espaco_nome}</p>
                          <p className="text-[10px] text-slate-500">{item.usuario_nome} · {item.espaco_nome || 'Sem laboratório'}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-500">{new Date(item.data_inicio).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {metrics.ocorrencias_pendentes.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Ocorrências aguardando análise
                  </h3>
                  <div className="space-y-2">
                    {metrics.ocorrencias_pendentes.map((item) => (
                      <div key={item.id} className="border-b border-slate-100 pb-2 last:border-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{item.titulo || item.equipamento_nome || `Ocorrência #${item.id}`}</p>
                        <p className="text-[10px] text-slate-500">{item.gravidade || 'Sem gravidade'} · {item.equipamento_nome || item.espaco_nome || 'Recurso não informado'}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {metrics.manutencoes_pendentes.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                    <Timer className="h-4 w-4 text-rose-600" /> Manutenções abertas
                  </h3>
                  <div className="space-y-2">
                    {metrics.manutencoes_pendentes.map((item) => (
                      <div key={item.id} className="border-b border-slate-100 pb-2 last:border-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{item.equipamento_nome || `Equipamento #${item.equipamento_id}`}</p>
                        <p className="text-[10px] text-slate-500">{item.tipo} · {item.status}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {metrics.consumiveis.itens_criticos.length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xs">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-900">
                    <Boxes className="h-4 w-4" /> Itens abaixo do mínimo
                  </h3>
                  <div className="space-y-2">
                    {metrics.consumiveis.itens_criticos.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border-b border-amber-100 pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-amber-950">{item.nome}</p>
                          <p className="flex items-center gap-1 text-[10px] text-amber-800"><MapPin className="h-3 w-3" />{item.espaco_nome || 'Sem laboratório'}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-amber-900">{item.quantidade} / mín. {item.quantidade_minima} {item.unidade}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
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
