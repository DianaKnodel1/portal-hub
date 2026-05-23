import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";
type ThemePreference = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setPreference: (p: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "app_theme_preference";

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    // Legacy: alte "app_theme" Werte
    const legacy = localStorage.getItem("app_theme") as Theme | null;
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
    if (legacy === "dark" || legacy === "light") return legacy;
    return "system";
  });
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(preference));

  // Apply theme to DOM + watch system changes
  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(preference);
      setThemeState(next);
      const root = document.documentElement;
      if (next === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    apply();
    localStorage.setItem(STORAGE_KEY, preference);
    if (preference === "system" && typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [preference]);

  // Sync from DB profile on auth changes
  useEffect(() => {
    let cancelled = false;
    const syncFromProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const pref = (data as any)?.theme_preference as ThemePreference | undefined;
      if (pref && (pref === "light" || pref === "dark" || pref === "system")) {
        setPreferenceState(pref);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) void syncFromProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void syncFromProfile(session.user.id);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPreferenceState(p);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from("profiles")
        .update({ theme_preference: p } as any)
        .eq("user_id", session.user.id);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    void setPreference(theme === "dark" ? "light" : "dark");
  }, [theme, setPreference]);

  const setTheme = useCallback((t: Theme) => { void setPreference(t); }, [setPreference]);

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
