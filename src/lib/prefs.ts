import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  localStorage.setItem("w2a-theme", t);
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(localStorage.getItem("w2a-theme") === "dark" ? "dark" : "light");
  }, []);
  return { theme, setTheme: (t: Theme) => { applyTheme(t); setTheme(t); } };
}
export function usePref<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    const raw = localStorage.getItem("w2a-" + key);
    if (raw) try { setV(JSON.parse(raw)); } catch { /* ignore */ }
  }, [key]);
  return [v, (n: T) => { localStorage.setItem("w2a-" + key, JSON.stringify(n)); setV(n); }] as const;
}
