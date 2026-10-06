import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CameraOff, CheckCircle2, LoaderCircle, ScanLine } from 'lucide-react';

export function extractAssetCodes(text) {
  const source = String(text || '').toUpperCase().replace(/[–—]/g, '-');
  const codeSuffix = '[A-Z0-9]+(?:[\\s-]+(?!(?:UFPI|LC|PAT)\\b)[A-Z0-9]+)*';
  const patterns = [
    new RegExp(`\\bUFPI[\\s-]*PAT[\\s-]*${codeSuffix}`, 'g'),
    new RegExp(`\\bLC[\\s-]*EQ[\\s-]*${codeSuffix}`, 'g'),
    new RegExp(`\\bPAT[\\s-]*${codeSuffix}`, 'g')
  ];
  const codes = [];
  const occupiedRanges = [];

  patterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) {
      const range = { start: match.index, end: match.index + match[0].length };
      if (occupiedRanges.some((occupied) => range.start < occupied.end && range.end > occupied.start)) continue;
      let code = match[0].replace(/\s*-\s*/g, '-').replace(/\s+/g, '-').replace(/-{2,}/g, '-');
      code = code
        .replace(/^UFPI-?PAT-?/, 'UFPI-PAT-')
        .replace(/^LC-?EQ-?/, 'LC-EQ-')
        .replace(/^PAT-?/, 'PAT-');
      if (!codes.includes(code)) codes.push(code);
      occupiedRanges.push(range);
    }
  });

  return codes;
}

export default function OCRPatrimonio({ onCodeRecognized }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [recognizedText, setRecognizedText] = useState('');
  const [codes, setCodes] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch((cameraError) => {
      console.error('[OCRPatrimonio] Erro ao iniciar a pré-visualização:', cameraError);
      setError('Não foi possível exibir a pré-visualização da câmera.');
    });
  }, [cameraActive]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    workerRef.current?.terminate();
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError('');
    setRecognizedText('');
    setCodes([]);
    setSelectedCode('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não disponibiliza acesso à câmera.');
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        audio: false
      });
      setCameraActive(true);
    } catch (cameraError) {
      console.error('[OCRPatrimonio] Erro ao acessar a câmera:', cameraError);
      setError(cameraError.name === 'NotAllowedError'
        ? 'Permita o acesso à câmera para reconhecer o patrimônio.'
        : 'Não foi possível acessar a câmera. Verifique se ela está disponível e tente novamente.');
    }
  };

  const captureAndRecognize = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setError('Aguarde a câmera iniciar antes de capturar a etiqueta.');
      return;
    }

    const canvas = document.createElement('canvas');
    const scale = Math.min(2, 2000 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Não foi possível preparar a imagem capturada.');
      return;
    }
    context.filter = 'grayscale(1) contrast(1.35)';
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCamera();
    setProcessing(true);
    setError('');
    setProgress('Preparando OCR...');
    setRecognizedText('');
    setCodes([]);
    setSelectedCode('');

    let worker;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            setProgress(`Reconhecendo texto: ${Math.round((message.progress || 0) * 100)}%`);
          } else if (message.status) {
            setProgress('Carregando o mecanismo de OCR...');
          }
        }
      });
      workerRef.current = worker;
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
      });
      const { data } = await worker.recognize(canvas);
      const text = (data.text || '').trim();
      const matches = extractAssetCodes(text);
      setRecognizedText(text);
      setCodes(matches);
      setProgress('');
      if (!text) setError('Nenhum texto foi reconhecido. Aproxime a câmera e tente outra captura.');
      else if (matches.length === 0) setError('O texto foi lido, mas nenhum código patrimonial compatível foi identificado. Confira e digite o código manualmente.');
    } catch (ocrError) {
      console.error('[OCRPatrimonio] Erro no reconhecimento:', ocrError);
      setError('Não foi possível processar a imagem com OCR. Verifique a conexão e tente novamente.');
      setProgress('');
    } finally {
      workerRef.current = null;
      if (worker) await worker.terminate();
      setProcessing(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-3" aria-label="OCR de patrimônio pela câmera">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <ScanLine className="h-4 w-4 text-teal-600" />
          <span>Ler patrimônio por OCR</span>
        </div>
        <button
          type="button"
          disabled={processing}
          onClick={cameraActive ? stopCamera : startCamera}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50 ${
            cameraActive ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}
        >
          {cameraActive ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
          {cameraActive ? 'Desativar' : 'Ativar câmera'}
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Centralize a etiqueta na imagem e capture. A leitura é processada neste navegador; revise o código antes de confirmar a conferência.
      </p>

      {cameraActive && (
        <div className="space-y-2">
          <video ref={videoRef} autoPlay muted playsInline className="max-h-48 w-full rounded-lg bg-slate-950 object-contain" />
          <button
            type="button"
            onClick={captureAndRecognize}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900"
          >
            <Camera className="h-4 w-4" />
            Capturar etiqueta e ler
          </button>
        </div>
      )}

      {processing && (
        <p className="flex items-center gap-2 text-[11px] text-teal-700" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {progress}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {recognizedText && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] text-slate-500">Texto reconhecido: <span className="font-mono text-slate-700">{recognizedText}</span></p>
          {codes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setSelectedCode(code);
                onCodeRecognized(code);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-teal-200 bg-white px-2.5 py-2 text-left text-xs font-mono font-semibold text-teal-800 hover:bg-teal-50"
            >
              <span>Usar {code}</span>
              {selectedCode === code && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
