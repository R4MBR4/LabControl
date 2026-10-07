import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Tag, Barcode, CheckSquare, Building2, MapPin, Sliders, Info } from 'lucide-react';

export default function BatchQRCodeModal({ isOpen, onClose, equipamentos = [] }) {
  const printAreaRef = useRef(null);
  const [columns, setColumns] = useState(2); // 2 ou 3 colunas na folha
  const [includeLocation, setIncludeLocation] = useState(true);

  if (!isOpen || equipamentos.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="relative bg-white rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:p-0">
        {/* Header não imprimível */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Folha de Etiquetas QR Code em Lote ({equipamentos.length} itens)
              </h3>
              <p className="text-xs text-slate-500">
                Geração padronizada com identificador estável, nome e código patrimonial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Opções de Diagramação */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Colunas:</span>
              <button
                type="button"
                onClick={() => setColumns(2)}
                className={`px-2 py-0.5 rounded-md font-semibold transition ${
                  columns === 2 ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                2
              </button>
              <button
                type="button"
                onClick={() => setColumns(3)}
                className={`px-2 py-0.5 rounded-md font-semibold transition ${
                  columns === 3 ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                3
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 py-2 px-4 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir Folha
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alerta de Orientação de Instalação Física */}
        <div className="my-3 p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2 print:hidden shrink-0">
          <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <span>
            <strong>Fluxo de Identificação Física:</strong> Imprima a folha em papel adesivo ou sulfite, fixe as etiquetas no chassi de cada equipamento e utilize a câmera do smartphone para testar a leitura e a ação contextual.
          </span>
        </div>

        {/* Área de Impressão das Etiquetas (Scrollable na tela, página contínua na impressão) */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl print:p-0 print:border-none print:bg-white print:overflow-visible"
        >
          <div
            className={`grid gap-4 print:gap-3 ${
              columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
            }`}
          >
            {equipamentos.map((equip) => {
              const equipId = equip.id || equip.id_equipamento;
              const codigoLab = equip.codigo_labcontrol || `LC-EQ-${String(equipId).padStart(4, '0')}`;
              const codigoUfpi = equip.patrimonio_ufpi || equip.codigo_patrimonio || equip.codigo || `UFPI-${equipId}`;

              const qrPayload = JSON.stringify({
                id: equipId,
                codigo_labcontrol: codigoLab,
                patrimonio_ufpi: codigoUfpi,
                nome: equip.nome,
                action: 'LABCONTROL_CHECKIN_CHECKOUT'
              });

              return (
                <div
                  key={equipId}
                  className="bg-white border-2 border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs print:shadow-none print:border-2 print:border-black print:break-inside-avoid print:p-3"
                  style={{ minHeight: '260px' }}
                >
                  {/* Cabeçalho da Etiqueta */}
                  <div className="border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                        LC
                      </div>
                      <span className="font-extrabold text-[11px] text-slate-900 tracking-tight">
                        UFPI • LabControl
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                      ID #{equipId}
                    </span>
                  </div>

                  {/* Miolo: QR Code + Textos de Identificação */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white border border-slate-300 rounded-lg shrink-0 flex items-center justify-center">
                      <QRCodeSVG
                        value={qrPayload}
                        size={columns === 3 ? 100 : 120}
                        level="H"
                        includeMargin={false}
                        fgColor="#0f172a"
                      />
                    </div>

                    <div className="flex-1 space-y-1.5 min-w-0">
                      {/* Código LabControl */}
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">
                          Código LabControl
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          <Barcode className="w-3 h-3 text-teal-600" />
                          {codigoLab}
                        </span>
                      </div>

                      {/* Patrimônio Oficial */}
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">
                          Patrimônio UFPI
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          <Tag className="w-3 h-3 text-slate-500" />
                          {codigoUfpi}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé da Etiqueta */}
                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                      {equip.nome}
                    </h4>

                    {(equip.espaco_nome || equip.localizacao_detalhada) && (
                      <div className="text-[10px] text-slate-600 flex items-center gap-1 mt-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {equip.espaco_nome || ''}
                          {equip.localizacao_detalhada ? ` • ${equip.localizacao_detalhada}` : ''}
                        </span>
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-between text-[8px] text-slate-400 uppercase tracking-widest font-semibold">
                      <span>Rastreabilidade Institucional</span>
                      <span>Etiqueta Estável</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
