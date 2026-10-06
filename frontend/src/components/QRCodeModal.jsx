import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Printer, Cpu, Tag } from 'lucide-react';

export default function QRCodeModal({ isOpen, onClose, equipamento }) {
  const qrRef = useRef(null);

  if (!isOpen || !equipamento) return null;

  const equipId = equipamento.id || equipamento.id_equipamento;
  const codigo = equipamento.codigo_patrimonio || equipamento.patrimonio || equipamento.codigo || `EQ-${equipId}`;

  const qrPayload = JSON.stringify({
    id: equipId,
    codigo,
    nome: equipamento.nome,
    action: 'LABCONTROL_CHECKIN_CHECKOUT'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 750;
      const context = canvas.getContext('2d');
      
      // Fundo branco
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Desenha QR Code
      context.drawImage(image, 75, 80, 450, 450);

      // Textos da etiqueta
      context.font = 'bold 26px sans-serif';
      context.fillStyle = '#0f172a';
      context.textAlign = 'center';
      context.fillText(equipamento.nome, 300, 580);

      context.font = '20px monospace';
      context.fillStyle = '#0d9488';
      context.fillText(`PATRIMÔNIO: ${codigo}`, 300, 620);

      context.font = '16px sans-serif';
      context.fillStyle = '#64748b';
      context.fillText('LabControl - Rastreabilidade Educacional', 300, 660);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `etiqueta-qrcode-${codigo}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    image.src = blobURL;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Etiqueta com QR Code</h3>
            <p className="text-xs text-slate-500">Rastreabilidade e Check-in automático</p>
          </div>
        </div>

        {/* Printable Card Area */}
        <div 
          ref={qrRef} 
          className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center text-center shadow-inner"
        >
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4">
            <QRCodeSVG
              value={qrPayload}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#0f172a"
            />
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-100/80 text-teal-800 text-xs font-mono font-bold rounded-md mb-2">
            <Tag className="w-3.5 h-3.5" />
            {codigo}
          </span>

          <h4 className="font-semibold text-sm text-slate-800 max-w-xs">{equipamento.nome}</h4>
          {equipamento.espaco_nome && (
            <p className="text-xs text-slate-500 mt-1">Localização: {equipamento.espaco_nome}</p>
          )}

          <div className="mt-4 pt-3 border-t border-slate-200/80 w-full flex items-center justify-between text-[11px] text-slate-400">
            <span>LabControl System</span>
            <span>ID #{equipId}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Baixar Imagem
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
