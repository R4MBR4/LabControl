import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'labcontrol_theme';
const ThemeContext = createContext(null);

function readInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('[ThemeContext] Não foi possível ler a preferência de tema:', error);
    return 'light';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn('[ThemeContext] Não foi possível salvar a preferência de tema:', error);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de ThemeProvider.');
  }
  return context;
}
