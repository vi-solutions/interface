"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setPreferenceState(saved);
      setResolved(saved);
    } else {
      // system (default) — no localStorage entry or explicit "system"
      setPreferenceState("system");
      setResolved(getSystemTheme());
    }
  }, []);

  // Listen for OS theme changes when preference is "system"
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setResolved(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    if (pref === "system") {
      localStorage.removeItem("theme");
      setResolved(getSystemTheme());
    } else {
      localStorage.setItem("theme", pref);
      setResolved(pref);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
