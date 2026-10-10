import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from './QRScanner';
import api from '../services/api';
import { X, CheckCircle2, AlertTriangle, Cpu, Tag, Barcode, ArrowRight, ShieldCheck, PowerOff, Wrench } from 'lucide-react';

export default function QRPostInstallTester({ isOpen, onClose, equipamentos = [] }) {
  const navigate = useNavigate();
  const [scannedResult, setScannedResult] = useState(null);
  const [matchedEquip, setMatchedEquip] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleScan = async (scannedCode, parsedPayload = null, rawString = null) => {
    setErrorMsg('');
    setScannedResult({ scannedCode, parsedPayload });

    try {
      const termToIdentify = rawString || (typeof scannedCode === 'object' ? JSON.stringify(scannedCode) : String(scannedCode));
      const res = await api.post('/equipamentos/identificar-qr', {
        scanned_value: termToIdentify
      });
      if (res.data?.equipamento) {
        setMatchedEquip(res.data.equipamento);
        return;
      }
    } catch {
      // Fallback para verificação local caso offline
    }

    // Encontra o equipamento correspondente no inventário
    const equip = equipamentos.find((e) => {
      const idStr = String(e.id || e.id_equipamento);
      const codLab = (e.codigo_labcontrol || '').toUpperCase();
      const codUfpi = (e.patrimonio_ufpi || e.codigo_patrimonio || '').toUpperCase();
      const search = String(scannedCode).toUpperCase().trim();

      return idStr === search || codLab === search || codUfpi === search;
    });

    if (equip) {
      setMatchedEquip(equip);
    } else {
      setMatchedEquip(null);
      setErrorMsg(`Equipamento referente a "${scannedCode}" não foi localizado no cadastro.`);
    }
  };

  const handleReset = () => {
    setScannedResult(null);
    setMatchedEquip(null);
    setErrorMsg('');
  };

  const equipStatus = (matchedEquip?.status || '').toLowerCase();
  const isInactive = matchedEquip?.inativo === 1 || matchedEquip?.inativo === true || equipStatus === 'inativo';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <span>Teste Pós-Instalação de Etiquetas QR</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Após imprimir e fixar a etiqueta no equipamento, escaneie com a câmera para verificar a integridade da leitura e as ações contextuais habilitadas.
        </p>

        {/* Scanner */}
        {!matchedEquip ? (
          <div className="space-y-3">
            <QRScanner onScan={handleScan} placeholder="Ex: LC-EQ-0001 ou UFPI-PAT-001" />
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        ) : (
          /* Resultado da Leitura com Ações Contextuais */
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Etiqueta Validada com Sucesso!
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-semibold uppercase">
                  Leitura Concluída
                </span>
              </div>

              <h4 className="font-bold text-slate-900 text-sm">{matchedEquip.nome}</h4>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-mono text-[11px] font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {matchedEquip.codigo_labcontrol || `LC-EQ-${matchedEquip.id}`}
                </span>
                <span className="font-mono text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  UFPI: {matchedEquip.patrimonio_ufpi || matchedEquip.codigo_patrimonio}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isInactive
                      ? 'bg-slate-200 text-slate-700'
                      : equipStatus === 'disponivel'
                      ? 'bg-emerald-200 text-emerald-800'
                      : equipStatus === 'em_uso'
                      ? 'bg-amber-200 text-amber-800'
                      : equipStatus === 'manutencao'
                      ? 'bg-rose-200 text-rose-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Status: {equipStatus}
                </span>
              </div>

              <p className="text-[11px] text-slate-600">
                Espaço: {matchedEquip.espaco_nome || 'Nenhum espaço'}
                {matchedEquip.localizacao_detalhada ? ` • ${matchedEquip.localizacao_detalhada}` : ''}
              </p>
            </div>

            {/* Ações contextuais de acordo com o status atual */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Ações Contextuais Disponíveis:
              </span>

              {isInactive ? (
                <div className="p-2.5 bg-rose-100/60 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <PowerOff className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Equipamento inativo. Utilização e reservas bloqueadas para este recurso.</span>
                </div>
              ) : equipStatus === 'disponivel' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/checkin-checkout');
                    }}
                    className="flex items-center justify-center gap-1.5 p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <span>Fazer Check-in</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/reservas');
                    }}
                    className="flex items-center justify-center gap-1.5 p-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    <span>Agendar Reserva</span>
                  </button>
                </div>
              ) : equipStatus === 'em_uso' ? (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/checkin-checkout');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <span>Equipamento em uso • Concluir Check-out</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : equipStatus === 'manutencao' ? (
                <div className="p-2.5 bg-rose-100/60 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Equipamento em manutenção. Reservas e check-in temporariamente suspensos.</span>
                </div>
              ) : null}

              <button
                onClick={() => {
                  onClose();
                  navigate(`/equipamentos/${matchedEquip.id}`);
                }}
                className="w-full text-center text-xs font-semibold text-teal-700 hover:underline pt-1 block"
              >
                Ver histórico e rastreabilidade completa →
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Escanear Outro
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Concluir Teste
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
