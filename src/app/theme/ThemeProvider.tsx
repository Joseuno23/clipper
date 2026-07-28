import { useEffect, useState, type ReactNode } from "react";

import { ThemeContext, type Theme } from "@/app/theme/themeContext";

const THEME_STORAGE_KEY = "clipper.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? "dark");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : null;
}
