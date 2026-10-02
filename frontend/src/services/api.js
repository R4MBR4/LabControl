import axios from 'axios';
import { handleMockRequest } from './mockData';

const isGitHubPages = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.protocol === 'file:'
);

const isExplicitDemo = typeof window !== 'undefined' && localStorage.getItem('labcontrol_demo_mode') === 'true';

// Em modo GitHub Pages estático sem URL de API na nuvem, utiliza o Mock Store para navegação
const shouldUseMock = (isGitHubPages && !import.meta.env.VITE_API_URL) || isExplicitDemo;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000
});

// Interceptor de requisição: injeta token e intercepta requisições se estiver em modo mock/demo
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('labcontrol_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (shouldUseMock) {
      config.adapter = async (cfg) => {
        const method = (cfg.method || 'GET').toUpperCase();
        let bodyData = null;
        try {
          bodyData = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
        } catch (e) {
          bodyData = cfg.data;
        }
        
        // Simula leve latência de 80ms para sensação fluida e realista
        await new Promise((r) => setTimeout(r, 80));
        const res = handleMockRequest(method, cfg.url, bodyData);
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

// Interceptor de resposta: fallback automático para mock se houver falha de rede ou servidor inexistente
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response || error.code === 'ERR_NETWORK' || error.response?.status === 404) {
      try {
        const cfg = error.config;
        if (cfg) {
          const method = (cfg.method || 'GET').toUpperCase();
          let bodyData = null;
          try {
            bodyData = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
          } catch (e) {
            bodyData = cfg.data;
          }
          const res = handleMockRequest(method, cfg.url, bodyData);
          return {
            data: res.data,
            status: res.status,
            statusText: res.statusText,
            headers: {},
            config: cfg,
            request: {}
          };
        }
      } catch (mockErr) {
        console.warn('[MockFallback] Erro no fallback simulado:', mockErr);
      }
    }

    // Redireciona para o login caso token expire
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('labcontrol_token');
      localStorage.removeItem('labcontrol_user');
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
