import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, Trash2, ShieldCheck, AlertCircle, VideoOff } from 'lucide-react';

/**
 * CameraEvidenceCapture
 * 
 * Componente exclusivo para coleta de evidências probatórias (check-out, avarias e ocorrências).
 * REGRA ABSOLUTA DA ESPECIFICAÇÃO:
 * - SOMENTE captura pela câmera ao vivo (getUserMedia).
 * - NENHUM seletor de arquivos ou galeria de fotos é disponibilizado neste fluxo.
 * - Carimba metadados contextuais (usuário, equipamento, data/hora e fonte de captura) para integridade.
 */
export default function CameraEvidenceCapture({
  onCapture,
  onClear,
  initialPhoto = null,
  contextInfo = {}, // { user, equipamento, tipoContexto }
  required = false,
  label = 'Fotografia de Evidência (Câmera Obrigatória)'
}) {
  const [photo, setPhoto] = useState(initialPhoto);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // Prioriza câmera traseira no celular

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  // Lista câmeras disponíveis
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          setCameraDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        })
        .catch(err => console.warn('[CameraEvidence] Erro ao listar câmeras:', err));
    }
  }, []);

  // Inicia streaming da câmera ao vivo
  const startCamera = async () => {
    setCameraError('');
    setIsCameraActive(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('[CameraEvidence] Erro ao acessar câmera:', err);
      let errMsg = 'Não foi possível acessar a câmera. Verifique as permissões do navegador.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Permissão de acesso à câmera foi negada. Permita o uso da câmera para registrar a evidência.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'Nenhum dispositivo de câmera foi detectado no sistema.';
      }
      setCameraError(errMsg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Desliga o stream se o componente for desmontado
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Alterna entre câmera frontal e traseira
  const switchFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedDeviceId(''); // Limpa deviceId fixo para aplicar facingMode
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  };

  // Captura o frame atual do vídeo
  const takeSnapshot = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Desenha o frame do vídeo
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Carimbo visual contextual de evidência (rodapé semi-transparente)
    const now = new Date();
    const dateFormatted = now.toLocaleString('pt-BR');
    const userText = contextInfo.user?.nome ? `Resp: ${contextInfo.user.nome}` : '';
    const equipText = contextInfo.equipamento?.nome 
      ? `Equip: ${contextInfo.equipamento.nome} (${contextInfo.equipamento.codigo_patrimonio || contextInfo.equipamento.codigo_labcontrol || ''})`
      : '';
    const contextType = contextInfo.tipoContexto || 'Evidência Probatória';

    const barHeight = Math.max(34, Math.floor(canvas.height * 0.08));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'; // Slate 900 semi-transparente
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    ctx.fillStyle = '#14b8a6'; // Teal 500
    ctx.font = `bold ${Math.max(11, Math.floor(barHeight * 0.35))}px monospace`;
    ctx.fillText(`[LABCONTROL EVIDÊNCIA] ${contextType.toUpperCase()} - ${dateFormatted}`, 12, canvas.height - (barHeight * 0.55));

    ctx.fillStyle = '#f8fafc'; // Slate 50
    ctx.font = `${Math.max(10, Math.floor(barHeight * 0.30))}px sans-serif`;
    const detailsText = [userText, equipText].filter(Boolean).join(' | ');
    if (detailsText) {
      ctx.fillText(detailsText, 12, canvas.height - (barHeight * 0.20));
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const metadata = {
      timestamp: now.toISOString(),
      timestampFormatado: dateFormatted,
      usuarioId: contextInfo.user?.id || null,
      usuarioNome: contextInfo.user?.nome || 'Anônimo',
      equipamentoId: contextInfo.equipamento?.id || null,
      equipamentoNome: contextInfo.equipamento?.nome || null,
      tipoContexto: contextType,
      modoCaptura: 'camera_ao_vivo_estrita',
      resolucao: `${canvas.width}x${canvas.height}`
    };

    setPhoto(dataUrl);
    stopCamera();

    if (onCapture) {
      onCapture(dataUrl, metadata);
    }
  };

  const handleClear = () => {
    setPhoto(null);
    if (onClear) onClear();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-teal-600" />
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-teal-600" />
          Câmera ao vivo estrita
        </span>
      </div>

      {cameraError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{cameraError}</p>
            <p className="text-[11px] text-rose-600 mt-0.5">
              Por motivos de auditoria e segurança, esta ação requer comprovação por câmera ao vivo.
            </p>
          </div>
        </div>
      )}

      {/* Caso 1: Câmera Ativa para Captura */}
      {isCameraActive ? (
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="w-full h-64 sm:h-80 object-cover bg-black"
          />

          {/* Grid de mira no visor */}
          <div className="absolute inset-0 pointer-events-none border border-white/10 m-4 rounded-xl flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-teal-400/50 rounded-lg"></div>
          </div>

          {/* Barra de controle da câmera */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={switchFacingMode}
              title="Inverter Câmera (Frontal / Traseira)"
              className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-xs transition text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Virar</span>
            </button>

            <button
              type="button"
              onClick={takeSnapshot}
              className="px-6 py-2.5 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/30 flex items-center gap-2 transform active:scale-95 transition"
            >
              <Camera className="w-4 h-4" />
              Capturar Foto
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="p-2.5 rounded-xl bg-white/20 hover:bg-rose-600/80 text-white backdrop-blur-xs transition text-xs flex items-center gap-1.5"
            >
              <VideoOff className="w-4 h-4" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          </div>
        </div>
      ) : photo ? (
        /* Caso 2: Foto Capturada com Sucesso */
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-xs">
          <img
            src={photo}
            alt="Evidência Fotográfica"
            className="w-full h-56 sm:h-64 object-cover"
          />

          <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Evidência Coletada
          </div>

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-xs font-semibold backdrop-blur-xs shadow-md transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Repetir Foto
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white backdrop-blur-xs shadow-md transition"
              title="Excluir Evidência"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Caso 3: Nenhuma Foto - Botão para Acionar a Câmera */
        <div className="p-6 border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl bg-slate-50/60 transition text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              Captura Probatória via Câmera
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
              Por determinação de segurança, esta evidência só pode ser registrada através da câmera em tempo real. Galeria de arquivos desabilitada.
            </p>
          </div>

          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition active:scale-95"
          >
            <Camera className="w-4 h-4" />
            Abrir Câmera e Capturar
          </button>
        </div>
      )}
    </div>
  );
}
