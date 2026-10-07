import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Cpu,
  Boxes,
  Search,
  LoaderCircle,
  Wrench,
  X
} from 'lucide-react';
import api from '../services/api';

const TYPE_ICONS = {
  Equipamento: Cpu,
  Espaço: Building2,
  Reserva: CalendarCheck,
  Ocorrência: AlertTriangle,
  Consumível: Boxes,
  Manutenção: Wrench,
  Inventário: ClipboardCheck
};

export default function BuscaGlobal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestNumber = useRef(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const searchTerm = query.trim();
    const requestId = ++requestNumber.current;
    setError('');
    setResults([]);
    if (searchTerm.length < 2) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.get('/busca', { params: { q: searchTerm } });
        if (active && requestNumber.current === requestId) setResults(response.data.results || []);
      } catch (requestError) {
        if (!active || requestNumber.current !== requestId) return;
        console.error('[BuscaGlobal] Erro ao pesquisar:', requestError);
        setError(requestError.response?.data?.error || 'A busca falhou. Verifique a conexão e tente novamente.');
      } finally {
        if (active && requestNumber.current === requestId) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') onClose();
  };

  const openResult = (item) => {
    onClose();
    navigate(item.path);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 px-3 pt-[10vh] backdrop-blur-sm sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-teal-600" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar equipamentos, espaços, reservas, ocorrências..."
            aria-label="Buscar em todo o LabControl"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
          />
          {loading && <LoaderCircle className="h-4 w-4 animate-spin text-teal-600" aria-label="Pesquisando" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-2" aria-live="polite">
          {!error && query.trim().length < 2 && (
            <p className="px-3 py-6 text-center text-xs text-slate-500">Digite pelo menos 2 caracteres para pesquisar.</p>
          )}
          {error && (
            <div role="alert" className="m-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-800">
              {error}
            </div>
          )}
          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">Nenhum resultado encontrado</p>
              <p className="mt-1 text-xs text-slate-500">Tente outro nome, código, local ou palavra-chave.</p>
            </div>
          )}
          {results.map((item, index) => {
            const Icon = TYPE_ICONS[item.type] || Search;
            return (
              <button
                key={`${item.type}-${item.id}-${index}`}
                type="button"
                onClick={() => openResult(item)}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"
              >
                <span className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{item.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.type}{item.subtitle ? ` · ${item.subtitle}` : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
          Resultados limitados às informações permitidas para sua conta.
        </div>
      </section>
    </div>
  );
}
