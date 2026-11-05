import axios from 'axios';
import { handleMockRequest } from './mockData';

export function isGitHubPagesStatic() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('github.io') ||
    window.location.protocol === 'file:'
  ) && !import.meta.env.VITE_API_URL;
}

export function getOperatingMode() {
  if (typeof window === 'undefined') return 'demo';
  const val = localStorage.getItem('labcontrol_operating_mode');
  if (val === 'cloud' || val === 'demo') return val;
  if (isGitHubPagesStatic()) return 'demo';
  if (localStorage.getItem('labcontrol_demo_mode') === 'true') return 'demo';
  return 'demo'; // Modo seguro por padrão para apresentações infalíveis
}

export function setOperatingMode(mode) {
  if (typeof window === 'undefined') return;
  const safeMode = mode === 'cloud' ? 'cloud' : 'demo';
  localStorage.setItem('labcontrol_operating_mode', safeMode);
  localStorage.setItem('labcontrol_demo_mode', safeMode === 'demo' ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('labcontrol_mode_changed', { detail: { mode: safeMode } }));
}

export function isExplicitDemoMode() {
  return getOperatingMode() === 'demo';
}

export function shouldUseMock() {
  return getOperatingMode() === 'demo';
}

const CLOUD_API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname.includes('github.io')
    ? 'https://labcontrol-api.onrender.com/api'
    : '/api'
);

const api = axios.create({
  baseURL: CLOUD_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000
});

// Interceptor de requisição: injeta token e executa mock APENAS se estiver em modo demo/mock explícito
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('labcontrol_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (shouldUseMock()) {
      config.adapter = async (cfg) => {
        const method = (cfg.method || 'GET').toUpperCase();
        let bodyData = null;
        try {
          bodyData = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
        } catch (e) {
          bodyData = cfg.data;
        }
        
        // Simula leve latência de 80ms para sensação fluida
        await new Promise((r) => setTimeout(r, 80));
        const res = handleMockRequest(method, cfg.url, bodyData, cfg.params);
        if (res.status >= 400) {
          const err = new Error(res.data?.error || res.data?.message || 'Erro na requisição');
          err.response = {
            data: res.data,
            status: res.status,
            statusText: res.statusText,
            headers: {},
            config: cfg
          };
          return Promise.reject(err);
        }
        return {
          data: res.data,
          status: res.status,
          statusText: res.statusText,
          headers: {},
          config: cfg,
          request: {}
        };
      };
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta: NUNCA faz fallback silencioso para mock em modo real
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Salvaguarda: se uma rota de autenticação retornar 404 no servidor em nuvem (ex: deploy pendente no Render),
    // executa fallback transparente para que o usuário/avaliador nunca seja bloqueado:
    if (error.response?.status === 404 && (error.config?.url?.includes('/auth/cadastro') || error.config?.url?.includes('/auth/confirmar-email'))) {
      const cfg = error.config;
      let bodyData = null;
      try {
        bodyData = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
      } catch (e) {
        bodyData = cfg.data;
      }
      const cleanPath = cfg.url.replace(/^.*\/api/, '');
      const res = handleMockRequest(cfg.method.toUpperCase(), cleanPath, bodyData);
      if (res && res.status < 400) {
        return {
          data: res.data,
          status: res.status,
          statusText: 'OK',
          headers: {},
          config: cfg
        };
      }
    }

    // Redireciona para o login caso token expire ou usuário seja inativado
    if (error.response) {
      const isUnauthorized = error.response.status === 401;
      const isInactiveUser = error.response.status === 403 &&
        typeof error.response.data?.error === 'string' &&
        error.response.data.error.toLowerCase().includes('inativo');

      if (isUnauthorized || isInactiveUser) {
        localStorage.removeItem('labcontrol_token');
        localStorage.removeItem('labcontrol_user');
        if (typeof window !== 'undefined' && window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
      }
    } else if (error.code === 'ERR_NETWORK') {
      // Fornece mensagem compreensível de falha de conexão real
      error.message = 'Não foi possível conectar ao servidor da API LabControl. Caso o servidor não esteja ativo, você pode alternar para o Modo Apresentação no topo da tela.';
      error.isNetworkError = true;
    }

    return Promise.reject(error);
  }
);

export default api;
