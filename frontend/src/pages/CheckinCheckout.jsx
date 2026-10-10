import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import QRScanner from '../components/QRScanner';
import CameraEvidenceCapture from '../components/CameraEvidenceCapture';
import {
  QrCode,
  LogIn,
  LogOut,
  Cpu,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  ShieldAlert,
  Camera
} from 'lucide-react';

export default function CheckinCheckout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('checkin'); // 'checkin' ou 'checkout'
  const [equipamentos, setEquipamentos] = useState([]);
  const [utilizacoesAtivas, setUtilizacoesAtivas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Equipamento e Utilização identificados via QR
  const [identifiedEquip, setIdentifiedEquip] = useState(null);
  const [identifiedUtilizacao, setIdentifiedUtilizacao] = useState(null);
  const [manualFallbackOpen, setManualFallbackOpen] = useState(false);

  // Formulário Check-in
  const [checkinEquipId, setCheckinEquipId] = useState('');
  const [condicaoInicial, setCondicaoInicial] = useState('Operacional / Limpo');
  const [checkinObs, setCheckinObs] = useState('');

  // Formulário Check-out
  const [checkoutUtilizacaoId, setCheckoutUtilizacaoId] = useState('');
  const [condicaoDevolucao, setCondicaoDevolucao] = useState('');
  const [houveAvaria, setHouveAvaria] = useState(false);
  const [relatoAvaria, setRelatoAvaria] = useState('');
  const [checkoutObs, setCheckoutObs] = useState('');
  const [checkoutFoto, setCheckoutFoto] = useState(null);
  const [checkoutFotoMeta, setCheckoutFotoMeta] = useState(null);

  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resEquip, resUtil] = await Promise.all([
        api.get('/equipamentos'),
        api.get('/utilizacoes?status=em_uso')
      ]);
      setEquipamentos(resEquip.data);
      setUtilizacoesAtivas(resUtil.data);
    } catch (err) {
      console.error('[CheckinCheckout] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQRDetected = async (scannedValue, parsedObj = null, rawString = null) => {
    setError('');
    setMessage(null);

    const termToIdentify = rawString || (typeof scannedValue === 'object' ? JSON.stringify(scannedValue) : String(scannedValue));

    try {
      // Identificação e validação no backend
      const res = await api.post('/equipamentos/identificar-qr', {
        scanned_value: termToIdentify
      });

      const {
        equipamento,
        utilizacaoAtiva,
        fluxoRecomendado,
        motivoBloqueio
      } = res.data;

      setIdentifiedEquip(equipamento);
      setIdentifiedUtilizacao(utilizacaoAtiva);

      if (fluxoRecomendado === 'bloqueado') {
        setError(motivoBloqueio || 'Equipamento bloqueado para uso no momento.');
        setCheckinEquipId('');
        setCheckoutUtilizacaoId('');
        return;
      }

      if (fluxoRecomendado === 'checkout') {
        setActiveTab('checkout');
        setCheckoutUtilizacaoId(utilizacaoAtiva?.id || utilizacaoAtiva?.id_utilizacao || '');
        setMessage({
          type: 'info',
          text: `QR Code lido com sucesso! Equipamento "${equipamento.nome}" possui check-in em andamento. Preencha a condição de devolução para realizar o check-out.`
        });
      } else {
        setActiveTab('checkin');
        setCheckinEquipId(equipamento.id || equipamento.id_equipamento);
        setMessage({
          type: 'info',
          text: `QR Code lido com sucesso! Equipamento "${equipamento.nome}" está disponível. Confirme o check-in de retirada.`
        });
      }
    } catch (err) {
      // Fallback para busca local caso backend retorne erro de formato
      const search = String(scannedValue).toUpperCase().trim();
      const localMatch = equipamentos.find(
        (e) =>
          String(e.id || e.id_equipamento) === search ||
          (e.codigo_labcontrol && e.codigo_labcontrol.toUpperCase() === search) ||
          (e.codigo_patrimonio && e.codigo_patrimonio.toUpperCase() === search) ||
          (e.patrimonio_ufpi && e.patrimonio_ufpi.toUpperCase() === search)
      );

      if (!localMatch) {
        setError(err.response?.data?.error || `Nenhum equipamento cadastrado corresponde a "${scannedValue}".`);
        setIdentifiedEquip(null);
        setIdentifiedUtilizacao(null);
        return;
      }

      const eqId = localMatch.id || localMatch.id_equipamento;
      const status = (localMatch.status || '').toLowerCase();

      setIdentifiedEquip(localMatch);

      if (status === 'manutencao' || status === 'em_manutencao') {
        setError('Equipamento em manutenção. Check-in bloqueado.');
        return;
      }
      if (localMatch.inativo === 1 || localMatch.inativo === true || status === 'inativo') {
        setError('Equipamento inativo. Não pode ser utilizado.');
        return;
      }

      const utilAtiva = utilizacoesAtivas.find(
        (u) => String(u.equipamento_id || u.id_equipamento) === String(eqId)
      );

      if (utilAtiva) {
        setActiveTab('checkout');
        setIdentifiedUtilizacao(utilAtiva);
        setCheckoutUtilizacaoId(utilAtiva.id || utilAtiva.id_utilizacao);
        setMessage({
          type: 'info',
          text: `QR Code lido! Equipamento "${localMatch.nome}" possui utilização ativa. Preencha o formulário de devolução.`
        });
      } else {
        setActiveTab('checkin');
        setIdentifiedUtilizacao(null);
        setCheckinEquipId(eqId);
        setMessage({
          type: 'info',
          text: `QR Code lido! Equipamento "${localMatch.nome}" selecionado para Check-in.`
        });
      }
    }
  };

  const handleClearIdentified = () => {
    setIdentifiedEquip(null);
    setIdentifiedUtilizacao(null);
    setCheckinEquipId('');
    setCheckoutUtilizacaoId('');
    setMessage(null);
    setError('');
  };

  const handleCheckinSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage(null);

    if (!checkinEquipId) {
      setError('Por favor, selecione um equipamento');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/utilizacoes/checkin', {
        equipamento_id: checkinEquipId,
        condicao_inicial: condicaoInicial,
        observacoes: checkinObs
      });

      setMessage({
        type: 'success',
        text: `Check-in realizado com sucesso para o equipamento! Status atualizado para "em_uso".`
      });
      setCheckinObs('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage(null);

    // Regra crítica: Condição na devolução é OBRIGATÓRIA
    if (!condicaoDevolucao.trim()) {
      setError('Atenção: A condição do equipamento na devolução é OBRIGATÓRIA para concluir o check-out.');
      return;
    }

    // Regra da especificação: Se houver avaria, a evidência por câmera é obrigatória
    if (houveAvaria && !checkoutFoto) {
      setError('Atenção: Para registrar avaria na devolução, é obrigatório capturar uma fotografia probatória via câmera ao vivo.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/utilizacoes/checkout', {
        utilizacao_id: checkoutUtilizacaoId,
        condicao_devolucao: condicaoDevolucao,
        houve_avaria: houveAvaria,
        relato_avaria: relatoAvaria,
        observacoes: checkoutObs,
        foto_evidencia: checkoutFoto,
        foto_metadata: checkoutFotoMeta
      });

      let successMsg = 'Check-out concluído com sucesso! Equipamento retornado ao status disponível.';
      if (res.data.avaria_registrada) {
        successMsg = 'Check-out concluído. Avaria e evidência fotográfica registradas! Equipamento bloqueado para manutenção.';
      }

      setMessage({
        type: 'success',
        text: successMsg
      });

      setCondicaoDevolucao('');
      setHouveAvaria(false);
      setRelatoAvaria('');
      setCheckoutObs('');
      setCheckoutFoto(null);
      setCheckoutFotoMeta(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar check-out');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Estação de Check-in e Check-out</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Leitura de QR Code, controle de posse e registro obrigatório do estado de conservação
        </p>
      </div>

      {/* Leitor de QR Code */}
      <QRScanner onScan={handleQRDetected} />

      {/* Mensagens de Notificação */}
      {message && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-teal-50 border-teal-200 text-teal-800'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Equipamento Identificado via QR Code */}
      {identifiedEquip && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Equipamento Identificado via QR Code
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearIdentified}
              className="text-xs text-slate-300 hover:text-white underline font-medium"
            >
              Escanear Outro / Limpar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">{identifiedEquip.nome}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                <span>
                  Código LabControl: <strong className="font-mono text-teal-300">{identifiedEquip.codigo_labcontrol || `LC-EQ-${identifiedEquip.id}`}</strong>
                </span>
                {identifiedEquip.patrimonio_ufpi && (
                  <span>
                    Patrimônio UFPI: <strong className="font-mono text-slate-200">{identifiedEquip.patrimonio_ufpi}</strong>
                  </span>
                )}
                {identifiedEquip.espaco_nome && (
                  <span>
                    Laboratório: <strong className="text-slate-200">{identifiedEquip.espaco_nome}</strong>
                  </span>
                )}
              </div>
            </div>

            <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              identifiedEquip.status === 'disponivel'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : identifiedEquip.status === 'em_uso'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              {identifiedEquip.status === 'em_uso' ? 'Em Uso' : identifiedEquip.status === 'disponivel' ? 'Disponível' : identifiedEquip.status}
            </span>
          </div>
        </div>
      )}

      {/* Seleção de Modo: Check-in vs Check-out */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex border-b border-slate-200 pb-4">
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={() => { setActiveTab('checkin'); setError(''); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'checkin'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              1. Realizar Check-in (Retirada)
            </button>

            <button
              onClick={() => { setActiveTab('checkout'); setError(''); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'checkout'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LogOut className="w-4 h-4" />
              2. Realizar Check-out (Devolução Obrigatória)
            </button>
          </div>
        </div>

        {/* Formulário de Check-in */}
        {activeTab === 'checkin' && (
          <form onSubmit={handleCheckinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Equipamento para Retirada
              </label>

              {identifiedEquip ? (
                /* Fluxo QR primário: Equipamento fixado sem necessidade de dropdown */
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{identifiedEquip.nome}</h4>
                      <p className="text-[11px] text-teal-800">
                        Identificado via QR: <span className="font-mono font-bold">{identifiedEquip.codigo_labcontrol || identifiedEquip.codigo_patrimonio}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualFallbackOpen(!manualFallbackOpen)}
                    className="text-[11px] text-teal-700 hover:underline font-semibold"
                  >
                    {manualFallbackOpen ? 'Ocultar Lista' : 'Trocar Manualmente'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mb-2">
                  Dica: utilize a câmera acima para escanear a etiqueta QR do equipamento e preencher automaticamente.
                </p>
              )}

              {/* Dropdown manual secundário / fallback */}
              {(!identifiedEquip || manualFallbackOpen) && (
                <div className={identifiedEquip ? 'mt-2 pt-2 border-t border-slate-100' : ''}>
                  <select
                    value={checkinEquipId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setCheckinEquipId(selId);
                      const equipFound = equipamentos.find(eq => String(eq.id || eq.id_equipamento) === String(selId));
                      if (equipFound) setIdentifiedEquip(equipFound);
                    }}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">Selecione o equipamento da lista...</option>
                    {equipamentos.map((eq) => {
                      const id = eq.id || eq.id_equipamento;
                      const status = (eq.status || '').toLowerCase();
                      const isAvailable = status === 'disponivel';
                      return (
                        <option key={id} value={id} disabled={!isAvailable}>
                          {eq.nome} ({eq.codigo_patrimonio || `ID ${id}`}) - [{status.toUpperCase()}] {eq.exige_capacitacao ? '🔒 Exige Capacitação' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Condição Física Inicial (Retirada)
              </label>
              <input
                type="text"
                required
                value={condicaoInicial}
                onChange={(e) => setCondicaoInicial(e.target.value)}
                placeholder="Ex: Operacional, sem avarias aparentes, limpo"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Adicionais</label>
              <textarea
                rows="2"
                value={checkinObs}
                onChange={(e) => setCheckinObs(e.target.value)}
                placeholder="Ex: Utilização durante aula prática no Lab 3..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={!checkinEquipId || submitting}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {submitting ? 'Processando Check-in...' : 'Confirmar Check-in de Retirada'}
            </button>
          </form>
        )}

        {/* Formulário de Check-out */}
        {activeTab === 'checkout' && (
          <form onSubmit={handleCheckoutSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Utilização em Andamento
              </label>

              {identifiedEquip && identifiedUtilizacao ? (
                /* Fluxo QR primário: Utilização fixada sem dependência de dropdown */
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{identifiedEquip.nome}</h4>
                      <p className="text-[11px] text-purple-800">
                        Check-in #{identifiedUtilizacao.id || identifiedUtilizacao.id_utilizacao} • Retirado em {new Date(identifiedUtilizacao.data_checkin).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualFallbackOpen(!manualFallbackOpen)}
                    className="text-[11px] text-purple-700 hover:underline font-semibold"
                  >
                    {manualFallbackOpen ? 'Ocultar Lista' : 'Trocar Utilização'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mb-2">
                  Dica: escaneie a etiqueta QR do equipamento para selecionar a utilização ativa automaticamente.
                </p>
              )}

              {/* Dropdown manual secundário / fallback */}
              {(!identifiedEquip || !identifiedUtilizacao || manualFallbackOpen) && (
                <div className={identifiedEquip ? 'mt-2 pt-2 border-t border-slate-100' : ''}>
                  {utilizacoesAtivas.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs">
                      Não há equipamentos com check-in em andamento no momento.
                    </div>
                  ) : (
                    <select
                      value={checkoutUtilizacaoId}
                      onChange={(e) => {
                        const selId = e.target.value;
                        setCheckoutUtilizacaoId(selId);
                        const selUtil = utilizacoesAtivas.find(u => String(u.id || u.id_utilizacao) === String(selId));
                        if (selUtil) {
                          setIdentifiedUtilizacao(selUtil);
                          const eqFound = equipamentos.find(eq => String(eq.id || eq.id_equipamento) === String(selUtil.equipamento_id || selUtil.id_equipamento));
                          if (eqFound) setIdentifiedEquip(eqFound);
                        }
                      }}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    >
                      <option value="">Selecione a utilização ativa da lista...</option>
                      {utilizacoesAtivas.map((u) => {
                        const id = u.id || u.id_utilizacao;
                        return (
                          <option key={id} value={id}>
                            #{id} - {u.equipamento_nome || `Equipamento ${u.equipamento_id}`} | Usuário: {u.usuario_nome || u.usuario_id}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* REGRA OBRIGATÓRIA */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-amber-900">
                Condição do Equipamento na Devolução (OBRIGATÓRIO) *
              </label>
              <input
                type="text"
                required
                value={condicaoDevolucao}
                onChange={(e) => setCondicaoDevolucao(e.target.value)}
                placeholder="Ex: Em perfeito estado, limpo e calibrado / Com cabo desgastado / Danificado"
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              />
              <p className="text-[11px] text-amber-700">
                * Conforme regra de negócio, a devolução só é aceita mediante registro formal da condição física.
              </p>
            </div>

            {/* Checkbox Avaria */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={houveAvaria}
                  onChange={(e) => setHouveAvaria(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Houve avaria, quebra ou mau funcionamento?</span>
                  <p className="text-slate-500 text-[11px]">
                    Marque caso o equipamento precise de manutenção e registro de ocorrência.
                  </p>
                </div>
              </label>
            </div>

            {houveAvaria && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-rose-900">
                  Relato da Avaria para Registro de Ocorrência e Manutenção:
                </label>
                <textarea
                  rows="3"
                  required={houveAvaria}
                  value={relatoAvaria}
                  onChange={(e) => setRelatoAvaria(e.target.value)}
                  placeholder="Descreva detalhadamente a falha ocorrida..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                ></textarea>
              </div>
            )}

            {/* Evidência Fotográfica Probatória via Câmera (Sem Galeria) */}
            <div className="pt-3 border-t border-slate-100">
              <CameraEvidenceCapture
                label={houveAvaria ? "Evidência Fotográfica da Avaria (Câmera Obrigatória)" : "Registro Fotográfico do Equipamento (Opcional - Câmera)"}
                initialPhoto={checkoutFoto}
                required={houveAvaria}
                contextInfo={{
                  user,
                  equipamento: (() => {
                    const selU = utilizacoesAtivas.find(u => String(u.id || u.id_utilizacao) === String(checkoutUtilizacaoId));
                    return selU ? equipamentos.find(e => String(e.id || e.id_equipamento) === String(selU.equipamento_id || selU.id_equipamento)) : null;
                  })(),
                  tipoContexto: houveAvaria ? 'Avaria Detectada no Check-out' : 'Check-out Regular'
                }}
                onCapture={(dataUrl, meta) => {
                  setCheckoutFoto(dataUrl);
                  setCheckoutFotoMeta(meta);
                }}
                onClear={() => {
                  setCheckoutFoto(null);
                  setCheckoutFotoMeta(null);
                }}
              />
            </div>

            <button
              type="submit"
              disabled={utilizacoesAtivas.length === 0 || submitting}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              {submitting ? 'Processando Check-out...' : 'Finalizar Check-out e Registrar Condição'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
