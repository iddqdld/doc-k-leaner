import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'dockcleaner_theme';

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

function getInitialTheme(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch { /* SSR / restricted storage */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(isDark);
    try { localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light'); } catch { /* noop */ }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((d) => !d), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
