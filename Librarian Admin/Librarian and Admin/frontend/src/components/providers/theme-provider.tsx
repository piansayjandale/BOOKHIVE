"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ThemeMode } from "@/lib/types";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: ReactNode;
  initialTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  // Sync with client-side localStorage on mount (runs after hydration without mismatch)
  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem("bookhive-theme") as ThemeMode | null;
      if ((storedTheme === "dark" || storedTheme === "light") && storedTheme !== initialTheme) {
        setThemeState(storedTheme);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [initialTheme]);

  // Persist to document dataset, localStorage, and cookie for SSR parity
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("bookhive-theme", theme);
      document.cookie = `bookhive-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore storage/cookie access errors
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
