import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import QRScanner from '../components/QRScanner';
import OCRPatrimonio from '../components/OCRPatrimonio';
import {
  ClipboardCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Plus,
  Play,
  RotateCcw,
  Check,
  X,
  ArrowRight,
  Clock,
  Search,
  Cpu,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Sparkles,
  QrCode
} from 'lucide-react';

export default function InventarioQR() {
  const { user, isAdmin } = useAuth();
  const [inventarios, setInventarios] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal Novo Inventário
  const [modalNewOpen, setModalNewOpen] = useState(false);
  const [selectedEspacoId, setSelectedEspacoId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Scanner e leitura manual
  const [manualCode, setManualCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [scanningActive, setScanningActive] = useState(true);

  // Modal / Decisão de Divergência
  const [divergenciaAtiva, setDivergenciaAtiva] = useState(null);

  // Filtro de abas na sessão ativa
  const [tabFiltro, setTabFiltro] = useState('esperados'); // 'esperados', 'conferidos', 'divergencias', 'naolocalizados'

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resInv, resEsp] = await Promise.all([
        api.get('/inventarios'),
        api.get('/espacos')
      ]);
      setInventarios(resInv.data);
      setEspacos(resEsp.data);

      if (resEsp.data.length > 0 && !selectedEspacoId) {
        setSelectedEspacoId(resEsp.data[0].id);
      }
    } catch (err) {
      console.error('[Inventario] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openSession = async (id) => {
    try {
      setLoading(true);
      const res = await api.get(`/inventarios/${id}`);
      setActiveSession(res.data);
      setScanFeedback(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar sessão de inventário');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNew = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/inventarios', {
        espaco_id: selectedEspacoId,
        observacoes
      });
      setModalNewOpen(false);
      setObservacoes('');
      await loadData();
      await openSession(res.data.id);
      setSuccess('Sessão de inventário iniciada com sucesso!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar inventário');
    }
  };

  const handleScanDetected = async (scannedValue) => {
    if (!activeSession || activeSession.status !== 'em_andamento') return;
    setError('');

    try {
      const res = await api.post(`/inventarios/${activeSession.id}/scan`, {
        scanned_value: scannedValue
      });

      const { jaConferido, item, equipamento, isDivergente, message } = res.data;

      setScanFeedback({
        tipo: isDivergente ? 'warning' : jaConferido ? 'info' : 'success',
        texto: message,
        equipamento
      });

      // Se for divergente, abre o modal de decisão administrativa imediata
      if (isDivergente && item.decisao_admin === 'pendente') {
        setDivergenciaAtiva(item);
      }

      // Recarrega os dados da sessão
      const resAtualizada = await api.get(`/inventarios/${activeSession.id}`);
      setActiveSession(resAtualizada.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar leitura do QR Code');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScanDetected(manualCode.trim());
    setManualCode('');
  };

  const handleDecidirDivergencia = async (itemId, acao) => {
    try {
      await api.post(`/inventarios/${activeSession.id}/decidir-divergencia`, {
        item_id: itemId,
        acao
      });

      setDivergenciaAtiva(null);
      setSuccess(
        acao === 'transferir'
          ? 'Equipamento transferido com sucesso para este laboratório!'
          : 'Localização original do equipamento preservada.'
      );
      setTimeout(() => setSuccess(''), 4000);

      const resAtualizada = await api.get(`/inventarios/${activeSession.id}`);
      setActiveSession(resAtualizada.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar decisão');
    }
  };

  const handleFinalizar = async () => {
    if (!window.confirm('Deseja realmente finalizar esta sessão de inventário? Equipamentos não escaneados serão marcados como "não localizados".')) {
      return;
    }

    try {
      const res = await api.post(`/inventarios/${activeSession.id}/finalizar`);
      setActiveSession(res.data.inventario);
      setSuccess('Sessão de inventário finalizada com sucesso!');
      setTimeout(() => setSuccess(''), 4000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao finalizar inventário');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventário Físico por QR Code</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
              Conferência Ativa
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Conferência sequencial por laboratório, confronto de localização e tomada de decisão administrativa
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {activeSession && (
              <button
                onClick={() => setActiveSession(null)}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
              >
                Voltar à Lista de Sessões
              </button>
            )}
            <button
              onClick={() => { setModalNewOpen(true); setError(''); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Nova Sessão de Inventário
            </button>
          </div>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Visão 1: Se NÃO há sessão ativa selecionada, lista histórico de inventários */}
      {!activeSession ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-teal-600" />
              Sessões de Inventário Registradas
            </h2>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : inventarios.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl">
                Nenhuma sessão de inventário foi realizada ainda. Clique em "Nova Sessão de Inventário" para começar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventarios.map((inv) => {
                  const pct = inv.total_esperados > 0 
                    ? Math.round((inv.total_conferidos / inv.total_esperados) * 100) 
                    : 100;
                  const isConcluido = inv.status === 'concluido';

                  return (
                    <div
                      key={inv.id}
                      onClick={() => openSession(inv.id)}
                      className="cursor-pointer bg-white rounded-2xl border border-slate-200 p-5 hover:border-teal-500 hover:shadow-md transition space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60 uppercase">
                            Sessão #{inv.id}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm mt-1 group-hover:text-teal-700 transition">
                            {inv.espaco_nome || `Espaço #${inv.espaco_id}`}
                          </h3>
                          <span className="text-[11px] text-slate-400">
                            Responsável: {inv.usuario_nome || 'Admin'}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isConcluido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isConcluido ? 'Concluído' : 'Em Andamento'}
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                          <span>Progresso da Conferência</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isConcluido ? 'bg-emerald-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Métricas Rápidas */}
                      <div className="grid grid-cols-4 gap-1 text-center pt-2 border-t border-slate-100 text-[10px]">
                        <div className="p-1 rounded bg-slate-50">
                          <span className="text-slate-400 block">Esperados</span>
                          <strong className="text-slate-700 text-xs">{inv.total_esperados}</strong>
                        </div>
                        <div className="p-1 rounded bg-emerald-50">
                          <span className="text-emerald-600 block">Conferidos</span>
                          <strong className="text-emerald-700 text-xs">{inv.total_conferidos}</strong>
                        </div>
                        <div className="p-1 rounded bg-amber-50">
                          <span className="text-amber-600 block">Divergentes</span>
                          <strong className="text-amber-700 text-xs">{inv.total_divergentes}</strong>
                        </div>
                        <div className="p-1 rounded bg-rose-50">
                          <span className="text-rose-600 block">Não Loc.</span>
                          <strong className="text-rose-700 text-xs">{inv.total_nao_localizados}</strong>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>{new Date(inv.data_inicio).toLocaleDateString('pt-BR')}</span>
                        <span className="text-teal-600 font-semibold group-hover:underline flex items-center gap-1">
                          Abrir <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Visão 2: SESSÃO ATIVA DE INVENTÁRIO */
        <div className="space-y-6">
          {/* Card da Sessão Ativa */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase">
                  Sessão #{activeSession.id}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  activeSession.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {activeSession.status === 'concluido' ? 'Concluído' : 'Em Andamento'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {activeSession.espaco_nome || `Espaço #${activeSession.espaco_id}`}
              </h2>
              <p className="text-xs text-slate-500">
                Iniciado por {activeSession.usuario_nome || 'Admin'} em {new Date(activeSession.data_inicio).toLocaleString('pt-BR')}
                {activeSession.observacoes && ` • Obs: ${activeSession.observacoes}`}
              </p>
            </div>

            {/* Totalizadores e Botão de Finalizar */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[70px]">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Esperados</span>
                  <strong className="text-slate-800 text-base">{activeSession.total_esperados}</strong>
                </div>
                <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center min-w-[70px]">
                  <span className="text-[10px] text-emerald-600 block font-semibold uppercase">Conferidos</span>
                  <strong className="text-emerald-700 text-base">{activeSession.total_conferidos}</strong>
                </div>
                <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center min-w-[70px]">
                  <span className="text-[10px] text-amber-600 block font-semibold uppercase">Divergentes</span>
                  <strong className="text-amber-700 text-base">{activeSession.total_divergentes}</strong>
                </div>
                <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-center min-w-[70px]">
                  <span className="text-[10px] text-rose-600 block font-semibold uppercase">Não Loc.</span>
                  <strong className="text-rose-700 text-base">{activeSession.total_nao_localizados}</strong>
                </div>
              </div>

              {activeSession.status === 'em_andamento' && isAdmin && (
                <button
                  onClick={handleFinalizar}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Finalizar Inventário
                </button>
              )}
            </div>
          </div>

          {/* Scanner de QR Code e Leitura Manual (Se sessão estiver ativa) */}
          {activeSession.status === 'em_andamento' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Leitor de Câmera (2 colunas) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-teal-600" />
                    Leitor de QR Code para Conferência
                  </h3>
                  <button
                    onClick={() => setScanningActive(!scanningActive)}
                    className="text-[11px] text-teal-600 font-semibold hover:underline"
                  >
                    {scanningActive ? 'Pausar Câmera' : 'Ativar Câmera'}
                  </button>
                </div>

                {scanningActive && (
                  <QRScanner onScan={handleScanDetected} />
                )}

                {/* Feedback da última leitura */}
                {scanFeedback && (
                  <div className={`p-4 rounded-xl text-xs flex items-start gap-2 border ${
                    scanFeedback.tipo === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : scanFeedback.tipo === 'info'
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    {scanFeedback.tipo === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{scanFeedback.texto}</p>
                      {scanFeedback.equipamento && (
                        <p className="text-[11px] mt-0.5">
                          {scanFeedback.equipamento.nome} — Código: {scanFeedback.equipamento.codigo_labcontrol || scanFeedback.equipamento.codigo_patrimonio}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Leitura Manual via Teclado / Leitor USB */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <OCRPatrimonio
                    onCodeRecognized={(code) => {
                      setManualCode(code);
                      setScanFeedback({
                        tipo: 'info',
                        texto: `OCR leu ${code}. Revise o código e confirme a conferência.`
                      });
                    }}
                  />
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Search className="w-4 h-4 text-teal-600" />
                    Entrada Manual de Código
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Se a etiqueta física estiver danificada ou utilizar leitor de código de barras USB:
                  </p>

                  <form onSubmit={handleManualSubmit} className="space-y-3">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Ex: PAT-2024-001, LC-EQ-0001 ou ID"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      Conferir Código
                    </button>
                  </form>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-700">Dica de Inventário:</span>
                  <p>Equipamentos conferidos são salvos instantaneamente. O progresso é mantido mesmo se a página for recarregada.</p>
                </div>
              </div>
            </div>
          )}

          {/* Abas de Detalhamento do Inventário */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex space-x-2 text-xs font-semibold">
                <button
                  onClick={() => setTabFiltro('esperados')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFiltro === 'esperados'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Esperados no Laboratório ({activeSession.esperados?.length || 0})
                </button>

                <button
                  onClick={() => setTabFiltro('conferidos')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFiltro === 'conferidos'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Conferidos ({activeSession.itens?.filter(i => i.status_conferencia === 'conferido').length || 0})
                </button>

                <button
                  onClick={() => setTabFiltro('divergencias')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFiltro === 'divergencias'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Divergências ({activeSession.itens?.filter(i => i.status_conferencia === 'divergente').length || 0})
                </button>

                <button
                  onClick={() => setTabFiltro('naolocalizados')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFiltro === 'naolocalizados'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Não Localizados ({activeSession.itens?.filter(i => i.status_conferencia === 'nao_localizado').length || 0})
                </button>
              </div>
            </div>

            {/* Conteúdo da Aba 1: Esperados */}
            {tabFiltro === 'esperados' && (
              <div className="divide-y divide-slate-100">
                {activeSession.esperados?.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">
                    Nenhum equipamento registrado previamente neste espaço.
                  </p>
                ) : (
                  activeSession.esperados.map((eq) => {
                    const foiLido = activeSession.itens?.some(
                      (i) => i.equipamento_id === eq.id && i.status_conferencia === 'conferido'
                    );

                    return (
                      <div key={eq.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            foiLido ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {foiLido ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900">{eq.nome}</h4>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span>Patrimônio: <strong>{eq.codigo_patrimonio}</strong></span>
                              {eq.patrimonio_ufpi && <span>UFPI: <strong>{eq.patrimonio_ufpi}</strong></span>}
                              {eq.codigo_labcontrol && <span>LabControl: <strong>{eq.codigo_labcontrol}</strong></span>}
                            </div>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          foiLido ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {foiLido ? 'Conferido' : 'Pendente'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Conteúdo da Aba 2: Conferidos */}
            {tabFiltro === 'conferidos' && (
              <div className="divide-y divide-slate-100">
                {activeSession.itens?.filter(i => i.status_conferencia === 'conferido').length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">
                    Nenhum equipamento conferido até o momento.
                  </p>
                ) : (
                  activeSession.itens.filter(i => i.status_conferencia === 'conferido').map((it) => (
                    <div key={it.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{it.equipamento_nome}</h4>
                          <span className="text-[11px] text-slate-400">
                            Lido em: {new Date(it.data_leitura).toLocaleTimeString('pt-BR')} • {it.codigo_patrimonio}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        Conforme
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Conteúdo da Aba 3: Divergências (Decisão Administrativa) */}
            {tabFiltro === 'divergencias' && (
              <div className="space-y-3">
                {activeSession.itens?.filter(i => i.status_conferencia === 'divergente').length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">
                    Nenhuma divergência de localização encontrada.
                  </p>
                ) : (
                  activeSession.itens.filter(i => i.status_conferencia === 'divergente').map((it) => {
                    const isPendente = it.decisao_admin === 'pendente';
                    return (
                      <div key={it.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <div>
                              <h4 className="font-bold text-xs text-slate-900">{it.equipamento_nome}</h4>
                              <span className="text-[11px] text-slate-500">
                                {it.codigo_patrimonio} {it.patrimonio_ufpi ? `| ${it.patrimonio_ufpi}` : ''}
                              </span>
                            </div>
                          </div>
                          <span className={`self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isPendente ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {it.decisao_admin}
                          </span>
                        </div>

                        {/* Confronto de Localização */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-amber-200">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Laboratório Cadastrado:</span>
                            <strong className="text-slate-800">{it.espaco_esperado_nome || 'Outro Espaço'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-teal-600 uppercase block">Onde foi Encontrado:</span>
                            <strong className="text-teal-800">{it.espaco_encontrado_nome || activeSession.espaco_nome}</strong>
                          </div>
                        </div>

                        {/* Decisão do Administrador */}
                        {isPendente && isAdmin && activeSession.status === 'em_andamento' && (
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            <span className="text-[11px] text-slate-600 mr-2">Decisão Administrativa:</span>
                            <button
                              onClick={() => handleDecidirDivergencia(it.id, 'manter')}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                            >
                              Manter no Local Original
                            </button>
                            <button
                              onClick={() => handleDecidirDivergencia(it.id, 'transferir')}
                              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs"
                            >
                              Transferir para Este Laboratório
                            </button>
                          </div>
                        )}

                        {!isPendente && (
                          <div className="text-[11px] text-slate-500 pt-1 border-t border-amber-100 flex items-center justify-between">
                            <span>Decidido por: {it.decisao_usuario_nome || 'Administrador'}</span>
                            <span>{it.decisao_data ? new Date(it.decisao_data).toLocaleString('pt-BR') : ''}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Conteúdo da Aba 4: Não Localizados */}
            {tabFiltro === 'naolocalizados' && (
              <div className="divide-y divide-slate-100">
                {activeSession.itens?.filter(i => i.status_conferencia === 'nao_localizado').length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">
                    {activeSession.status === 'em_andamento'
                      ? 'Ao finalizar a sessão de inventário, os equipamentos esperados não lidos serão listados aqui.'
                      : 'Nenhum equipamento ficou pendente nesta sessão.'}
                  </p>
                ) : (
                  activeSession.itens.filter(i => i.status_conferencia === 'nao_localizado').map((it) => (
                    <div key={it.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{it.equipamento_nome}</h4>
                          <span className="text-[11px] text-rose-600">
                            Equipamento não localizado na conferência física • {it.codigo_patrimonio}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                        Não Localizado
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Nova Sessão de Inventário */}
      {modalNewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Iniciar Sessão de Inventário</h3>
              <button onClick={() => setModalNewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartNew} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selecione o Laboratório / Espaço a Inventariar:
                </label>
                <select
                  value={selectedEspacoId}
                  onChange={(e) => setSelectedEspacoId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {espacos.map((esp) => (
                    <option key={esp.id} value={esp.id}>
                      {esp.nome} ({esp.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações / Objetivo da Sessão:
                </label>
                <textarea
                  rows="3"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Inventário semestral regular de patrimônio..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNewOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm"
                >
                  Iniciar Inventário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Imediato de Decisão sobre Divergência */}
      {divergenciaAtiva && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-300 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-amber-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Divergência de Localização Detectada!</h3>
                <p className="text-[11px] text-slate-500">O equipamento lido não pertence originalmente a este laboratório.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">{divergenciaAtiva.equipamento_nome}</h4>
              <p className="text-xs text-slate-600">Código: <strong>{divergenciaAtiva.codigo_patrimonio}</strong></p>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Cadastrado em:</span>
                  <strong className="text-slate-800">{divergenciaAtiva.espaco_esperado_nome}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-teal-600 uppercase block">Encontrado em:</span>
                  <strong className="text-teal-800">{divergenciaAtiva.espaco_encontrado_nome || activeSession.espaco_nome}</strong>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Conforme as diretrizes institucionais, a localização do equipamento NÃO é alterada automaticamente. Como administrador, escolha a providência:
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDecidirDivergencia(divergenciaAtiva.id, 'manter')}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Manter no Local Original
              </button>
              <button
                type="button"
                onClick={() => handleDecidirDivergencia(divergenciaAtiva.id, 'transferir')}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md"
              >
                Transferir para Este Laboratório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
