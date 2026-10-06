import { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileUp, LoaderCircle, X } from 'lucide-react';
import api from '../services/api';

const EXPORT_DATASETS = [
  ['equipamentos', 'Equipamentos'],
  ['laboratorios', 'Laboratórios'],
  ['reservas', 'Reservas'],
  ['utilizacoes', 'Utilizações'],
  ['ocorrencias', 'Ocorrências'],
  ['manutencoes', 'Manutenções'],
  ['consumiveis', 'Consumíveis'],
  ['inventarios', 'Inventários'],
  ['itens_inventario', 'Itens dos inventários']
];

export default function ImportacaoExportacaoCSV({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    setPreview(null);
    setError('');
    setNotice('');
    setFile(null);
    setCsv('');
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Selecione um arquivo CSV.');
      event.target.value = '';
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('O arquivo excede o limite de 10 MB.');
      event.target.value = '';
      return;
    }
    try {
      const contents = await selected.text();
      setFile(selected);
      setCsv(contents);
    } catch (readError) {
      console.error('[CSV] Erro ao ler arquivo:', readError);
      setError('Não foi possível ler o arquivo selecionado.');
    }
  };

  const handlePreview = async () => {
    if (!csv) return;
    setBusy('preview');
    setError('');
    setNotice('');
    try {
      const response = await api.post('/integracao/equipamentos/preview', csv, {
        headers: { 'Content-Type': 'text/csv' },
        timeout: 0
      });
      if (response.status >= 400) throw new Error(response.data?.error || 'A API recusou a validação do arquivo.');
      setPreview(response.data);
    } catch (requestError) {
      console.error('[CSV] Erro ao validar arquivo:', requestError);
      setError(requestError.response?.data?.error || 'Não foi possível validar o CSV.');
      if (requestError.response?.data?.issues) {
        setPreview({
          summary: requestError.response.data.summary,
          issues: requestError.response.data.issues
        });
      }
    } finally {
      setBusy('');
    }
  };

  const handleImport = async () => {
    if (!csv || !preview || preview.summary?.invalidos !== 0 || preview.summary?.total < 1) return;
    setBusy('import');
    setError('');
    setNotice('');
    try {
      const response = await api.post('/integracao/equipamentos/importar', csv, {
        headers: { 'Content-Type': 'text/csv' },
        timeout: 0
      });
      if (response.status >= 400) throw new Error(response.data?.error || 'A API recusou a importação do arquivo.');
      setNotice(response.data.message);
      await onImported?.();
      setFile(null);
      setCsv('');
      setPreview(null);
    } catch (requestError) {
      console.error('[CSV] Erro ao importar arquivo:', requestError);
      setError(requestError.response?.data?.error || 'Não foi possível importar os equipamentos.');
      if (requestError.response?.data?.summary) {
        setPreview({
          summary: requestError.response.data.summary,
          issues: requestError.response.data.issues || []
        });
      }
    } finally {
      setBusy('');
    }
  };

  const handleExport = async (dataset, label) => {
    setBusy(`export-${dataset}`);
    setError('');
    setNotice('');
    try {
      const response = await api.get(`/integracao/exportar/${dataset}`, {
        responseType: 'blob',
        timeout: 0
      });
      if (response.status >= 400) throw new Error(`A API recusou a exportação de ${label.toLowerCase()}.`);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `labcontrol-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`Exportação de ${label.toLowerCase()} iniciada.`);
    } catch (requestError) {
      console.error(`[CSV] Erro ao exportar ${dataset}:`, requestError);
      setError(requestError.response?.data?.error || `Não foi possível exportar ${label.toLowerCase()}.`);
    } finally {
      setBusy('');
    }
  };

  const canImport = preview?.summary?.total > 0 && preview?.summary?.invalidos === 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="my-6 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Importação e exportação CSV</h2>
            <p className="mt-1 text-xs text-slate-500">Importe equipamentos após validar todas as linhas ou exporte dados do sistema.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-800">Importar equipamentos</h3>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            CSV deve conter patrimônio UFPI, nome e laboratório. Colunas aceitas incluem categoria, marca, modelo, número de série,
            localização, status, capacitação e observações. Laboratório pode ser identificado pelo nome ou código.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
          />
          {file && <p className="text-[11px] text-slate-500">Arquivo: {file.name}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!csv || Boolean(busy)}
              onClick={handlePreview}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'preview' ? 'Validando...' : 'Validar e exibir prévia'}
            </button>
            <button
              type="button"
              disabled={!canImport || Boolean(busy)}
              onClick={handleImport}
              className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'import' ? 'Importando...' : `Importar ${preview?.summary?.validos || 0} válido(s)`}
            </button>
          </div>
          {preview?.summary && (
            <div aria-live="polite" className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {[
                  ['Total', preview.summary.total],
                  ['Válidos', preview.summary.validos],
                  ['Duplicados', preview.summary.duplicados],
                  ['Laboratório inexistente', preview.summary.laboratorios_inexistentes],
                  ['Com erros', preview.summary.invalidos]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-white p-2">
                    <span className="block text-[10px] text-slate-500">{label}</span>
                    <strong className="text-slate-800">{value}</strong>
                  </div>
                ))}
              </div>
              {preview.issues?.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold text-amber-900">Corrija os problemas indicados. Nenhuma linha será inserida enquanto houver erros.</p>
                  <ul className="space-y-1 text-[11px] text-amber-900">
                    {preview.issues.map((issue) => (
                      <li key={issue.line}>Linha {issue.line}: {issue.errors.join(' ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-800">Exportar dados</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_DATASETS.map(([dataset, label]) => (
              <button
                key={dataset}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => handleExport(dataset, label)}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50"
              >
                <span>{label}</span>
                {busy === `export-${dataset}`
                  ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5 text-slate-400" />}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Exportações não incluem fotos, evidências ou outros campos de imagem.</p>
        </section>
      </div>
    </div>
  );
}
