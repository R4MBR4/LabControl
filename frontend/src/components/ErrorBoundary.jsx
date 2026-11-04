import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro capturado na interface:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#/dashboard';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-900">Algo inesperado ocorreu</h2>
              <p className="text-xs text-slate-500 mt-1">
                Uma falha momentânea de renderização foi interceptada com segurança pelo LabControl para proteger sua sessão.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] font-mono text-slate-600 break-all">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </button>

              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
              >
                <Home className="w-4 h-4" />
                Retornar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
