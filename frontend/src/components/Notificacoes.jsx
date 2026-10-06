import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock3, LoaderCircle, X } from 'lucide-react';
import api from '../services/api';
import LoadError from './LoadError';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

export default function Notificacoes() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.get('/notificacoes', { params: { limit: 50 } });
      if (!Array.isArray(response.data?.items) || !Number.isFinite(Number(response.data?.unread))) {
        throw new Error('A resposta de notificações tem formato inválido.');
      }
      setNotifications(response.data.items);
      setUnread(Number(response.data.unread));
    } catch (requestError) {
      console.error('[Notificacoes] Erro ao carregar:', requestError);
      setError(requestError.response?.data?.error || requestError.message || 'Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const markAsRead = async (notification) => {
    if (notification.lida_em) return true;
    setUpdating(true);
    setError('');
    try {
      await api.patch(`/notificacoes/${notification.id}/lida`);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, lida_em: new Date().toISOString() } : item
      )));
      setUnread((current) => Math.max(0, current - 1));
      return true;
    } catch (requestError) {
      console.error('[Notificacoes] Erro ao marcar como lida:', requestError);
      setError(requestError.response?.data?.error || 'Não foi possível marcar a notificação como lida.');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const markAllAsRead = async () => {
    setUpdating(true);
    setError('');
    try {
      await api.patch('/notificacoes/lidas');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, lida_em: item.lida_em || readAt })));
      setUnread(0);
    } catch (requestError) {
      console.error('[Notificacoes] Erro ao marcar todas como lidas:', requestError);
      setError(requestError.response?.data?.error || 'Não foi possível marcar as notificações como lidas.');
    } finally {
      setUpdating(false);
    }
  };

  const openNotification = async (notification) => {
    if (!(await markAsRead(notification))) return;
    setOpen(false);
    navigate(notification.link || '/dashboard');
  };

  return (
    <>
      <span className="contents">
        <button
          type="button"
          onClick={() => { setOpen(true); loadNotifications(); }}
          aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
          title="Notificações"
          className="relative hidden rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700 lg:inline-flex"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[9px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(true); loadNotifications(); }}
          aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
          title="Notificações"
          className="relative inline-flex rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700 lg:hidden"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[9px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </span>

      {open && (
        <div
          className="fixed inset-0 z-[55] flex justify-end bg-slate-950/30 sm:p-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Notificações internas"
            className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl sm:rounded-2xl sm:border"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Notificações</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">{unread} não lida(s)</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={unread === 0 || updating}
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas como lidas
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar notificações"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {error && <div className="p-3"><LoadError message={error} onRetry={loadNotifications} /></div>}
            <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
              {loading && notifications.length === 0 && (
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando notificações...
                </div>
              )}
              {!loading && !error && notifications.length === 0 && (
                <p className="px-4 py-10 text-center text-xs text-slate-500">Você não tem notificações.</p>
              )}
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  disabled={updating}
                  onClick={() => openNotification(notification)}
                  className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-teal-50 disabled:opacity-60 ${
                    notification.lida_em ? 'bg-white' : 'bg-teal-50/70'
                  }`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.lida_em ? 'bg-slate-300' : 'bg-teal-600'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-800">{notification.titulo}</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">{notification.mensagem}</span>
                    <span className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock3 className="h-3 w-3" />
                      {formatDate(notification.criada_em)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
