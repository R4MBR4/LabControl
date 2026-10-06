import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('labcontrol_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoredUser() {
      const storedToken = localStorage.getItem('labcontrol_token');
      const storedUser = localStorage.getItem('labcontrol_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('labcontrol_user', JSON.stringify(res.data));
        } catch (err) {
          console.warn('[AuthContext] Sessão não pôde ser revalidada:', err.message);
        }
      }
      setLoading(false);
    }
    loadStoredUser();
  }, []);

  const login = async (email, senha) => {
    const res = await api.post('/auth/login', { email, senha });
    const { token: jwtToken, usuario } = res.data;
    setToken(jwtToken);
    setUser(usuario);
    localStorage.setItem('labcontrol_token', jwtToken);
    localStorage.setItem('labcontrol_user', JSON.stringify(usuario));
    return usuario;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('labcontrol_token');
    localStorage.removeItem('labcontrol_user');
  };

  const role = (user?.perfil || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'administrador';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!token,
      isAdmin,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
