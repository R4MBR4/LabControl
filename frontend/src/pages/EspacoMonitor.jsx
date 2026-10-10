import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  Clock,
  Maximize2,
  Minimize2,
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Cpu,
  ArrowLeft,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function EspacoMonitor() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');

  // Atualização do relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Busca dados do monitor
  const loadMonitorData = async () => {
    try {
      const res = await api.get(`/espacos/${id}/monitor`);
      setData(res.data);
      setError('');
    } catch (err) {
      console.error('[EspacoMonitor] Erro ao carregar dados:', err);
      setError('Não foi possível sincronizar o status do laboratório.');
    } finally {
      setLoading(false);
    }
  };

  // Poll a cada 20 segundos para manter painel sempre atualizado
  useEffect(() => {
    loadMonitorData();
    const pollInterval = setInterval(() => {
      loadMonitorData();
    }, 20000);

    return () => clearInterval(pollInterval);
  }, [id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm font-mono tracking-widest uppercase">Iniciando Painel de Ocupação (Kiosk de Porta)...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-100">Erro de Sincronização</h2>
        <p className="text-slate-400 text-sm mt-1 mb-6">{error}</p>
        <Link to={`/espacos/${id}`} className="px-5 py-2.5 rounded-xl bg-slate-800 text-teal-400 text-xs font-bold hover:bg-slate-700">
          Voltar para Detalhes
        </Link>
      </div>
    );
  }

  const { espaco, ocupacaoAtual, proximasReservas, estatisticasEquipamentos } = data || {};
  const isOcupado = ocupacaoAtual?.ocupado;
  const reservaAtiva = ocupacaoAtual?.reserva;

  // Formatação de hora e data do relógio institucional
  const horaFormatada = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dataFormatada = currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Barra Superior: Identificação do Laboratório e Relógio */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase bg-teal-950/80 px-2.5 py-0.5 rounded border border-teal-800">
                {espaco?.codigo || 'LAB'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {espaco?.localizacao || 'Campus UFPI'}
              </span>
              <span className="hidden sm:inline text-[11px] text-teal-400/90 font-mono">
                · Painel de Ocupação (Kiosk de Porta)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              {espaco?.nome || 'Laboratório'}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Exibição pública em tempo real para identificação visual e conferência de agendamento na entrada do espaço.
            </p>
          </div>
        </div>

        {/* Relógio Digital em Alta Legibilidade */}
        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="text-right">
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-wider">
              {horaFormatada}
            </div>
            <div className="text-xs text-slate-400 capitalize">
              {dataFormatada}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Seção Central: Status de Ocupação e Utilização Atual */}
      <main className="my-8 flex-1 flex flex-col justify-center">
        {isOcupado ? (
          /* Estado 1: OCUPADO */
          <div className="relative rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/60 shadow-2xl shadow-amber-500/10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-950"></span>
                Em Utilização no Momento
              </div>
              <span className="text-xs font-mono text-amber-400">
                Capacidade: {espaco?.capacidade} ocupantes
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                {reservaAtiva?.finalidade || 'Atividade Acadêmica em Andamento'}
              </h2>
              <p className="text-lg sm:text-xl text-amber-200/90 font-medium">
                Responsável: <strong className="text-white">{reservaAtiva?.usuario_nome || 'Docente / Pesquisador'}</strong>
              </p>
            </div>

            {reservaAtiva?.data_inicio && reservaAtiva?.data_fim && (
              <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-800 text-sm font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block text-xs">Início:</span>
                  <strong className="text-white text-base">
                    {new Date(reservaAtiva.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Término Previsto:</span>
                  <strong className="text-amber-400 text-base">
                    {new Date(reservaAtiva.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Estado 2: LIVRE / DISPONÍVEL */
          <div className="relative rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" />
              Livre / Disponível
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Espaço Aberto para Agendamento
              </h2>
              <p className="text-base sm:text-xl text-emerald-200/80">
                Pronto para uso acadêmico orientado ou próximo agendamento institucional.
              </p>
            </div>

            <div className="flex flex-wrap gap-8 pt-4 border-t border-slate-800 text-sm font-mono">
              <div>
                <span className="text-slate-500 block text-xs">Equipamentos no Espaço:</span>
                <strong className="text-emerald-400 text-base">{estatisticasEquipamentos?.disponiveis || 0} Disponíveis</strong>
                <span className="text-slate-500 text-xs"> / {estatisticasEquipamentos?.total || 0} total</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Responsável Técnico:</span>
                <strong className="text-white text-base">{espaco?.responsavel || 'Coordenação'}</strong>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Seção Inferior: Próximas Reservas da Agenda */}
      <footer className="space-y-4 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-teal-400" />
            Próximos Agendamentos Programados
          </h3>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Atualiza automaticamente
          </span>
        </div>

        {(!proximasReservas || proximasReservas.length === 0) ? (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 text-center text-xs text-slate-500 font-mono">
            Nenhum outro agendamento programado para hoje.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {proximasReservas.map((res) => {
              const inicioHora = new Date(res.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const fimHora = new Date(res.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={res.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-mono text-teal-400 font-bold">
                    <span>{inicioHora} - {fimHora}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{new Date(res.data_inicio).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 line-clamp-1">
                    {res.finalidade || 'Sessão Prática'}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {res.usuario_nome || 'Docente'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </footer>
    </div>
  );
}
