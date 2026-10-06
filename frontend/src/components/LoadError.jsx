import { AlertCircle, RotateCcw } from 'lucide-react';

export default function LoadError({ message, onRetry }) {
  if (!message) return null;

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        <div>
          <p className="text-xs font-semibold">Não foi possível carregar estes dados</p>
          <p className="mt-1 text-xs text-rose-800">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 sm:self-auto"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Tentar novamente
      </button>
    </div>
  );
}
