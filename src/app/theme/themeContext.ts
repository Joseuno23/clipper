import { createContext, useContext } from "react";

export type Theme = "dark" | "light";

export interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: "dark" as Theme, toggle: () => {} };
  return ctx;
}
