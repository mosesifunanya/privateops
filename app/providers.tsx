'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext =
  createContext<ThemeContextValue | null>(null);

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useAppTheme must be used inside Providers',
    );
  }

  return context;
}

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] =
    useState<Theme>('light');

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        'privateops-theme',
      ) as Theme | null;

    const systemDark =
      window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;

    const initialTheme =
      savedTheme ??
      (systemDark ? 'dark' : 'light');

    setThemeState(initialTheme);

    document.documentElement.classList.toggle(
      'dark',
      initialTheme === 'dark',
    );
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);

    window.localStorage.setItem(
      'privateops-theme',
      nextTheme,
    );

    document.documentElement.classList.toggle(
      'dark',
      nextTheme === 'dark',
    );
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
