import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Keyboard, Upload, AlertCircle } from 'lucide-react';

export default function QRScanner({ onScan, placeholder = "EQ-001 ou ID do equipamento" }) {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    let scanner = null;
    if (cameraActive) {
      scanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          handleDetected(decodedText);
          scanner.clear();
          setCameraActive(false);
        },
        (error) => {
          // erros comuns de frame contínuo sem detecção são ignorados
        }
      );
      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [cameraActive]);

  const handleDetected = (text) => {
    setScanError(null);
    try {
      // Tenta parsear caso seja um JSON gerado pelo LabControl
      const parsed = JSON.parse(text);
      if (parsed.id || parsed.codigo) {
        onScan(parsed.id ? String(parsed.id) : parsed.codigo, parsed);
        return;
      }
    } catch {
      // É uma string simples (código patrimônio ou ID)
    }
    onScan(text.trim());
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetected(manualCode.trim());
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode("reader-file-temp");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      handleDetected(decodedText);
    } catch (err) {
      setScanError("Não foi possível detectar um QR Code válido na imagem selecionada.");
    } finally {
      html5QrCode.clear();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Camera className="w-4 h-4 text-teal-600" />
          <span>Leitor de QR Code / Código</span>
        </div>
        <button
          type="button"
          onClick={() => setCameraActive(!cameraActive)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            cameraActive
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}
        >
          {cameraActive ? (
            <>
              <CameraOff className="w-3.5 h-3.5" />
              Desativar Câmera
            </>
          ) : (
            <>
              <Camera className="w-3.5 h-3.5" />
              Ativar Câmera
            </>
          )}
        </button>
      </div>

      {scanError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Área da Câmera */}
      {cameraActive && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-black flex justify-center">
          <div id="reader" className="w-full max-w-sm"></div>
        </div>
      )}
      <div id="reader-file-temp" style={{ display: 'none' }}></div>

      {/* Upload de Imagem de QR Code */}
      <div className="flex items-center gap-3">
        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 border-dashed rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition">
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Carregar foto com QR Code</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Entrada manual de código / ID */}
      <form onSubmit={handleManualSubmit} className="pt-2">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Ou informe o Código de Patrimônio / ID manualmente:
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition"
          >
            Buscar
          </button>
        </div>
      </form>
    </div>
  );
}
