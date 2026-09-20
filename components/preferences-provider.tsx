"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  isLocale,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

export type ThemeName = "light" | "dark";

type Preferences = {
  locale: Locale;
  theme: ThemeName;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeName) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const PreferencesContext = createContext<Preferences | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale === "hi" ? "hi" : "en";
}

export function PreferencesProvider({
  children,
  initialLocale = "en",
  initialTheme = "light",
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialTheme?: ThemeName;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    applyLocale(next);
    writeCookie(LOCALE_COOKIE, next);
    try {
      localStorage.setItem(LOCALE_COOKIE, next);
    } catch {
      /* ignore */
    }
    router.refresh();
  }, [router]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
    writeCookie(THEME_COOKIE, next);
    try {
      localStorage.setItem(THEME_COOKIE, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, theme, setLocale, setTheme, t }),
    [locale, theme, setLocale, setTheme, t],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useI18n() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("useI18n must be used within PreferencesProvider");
  }
  return context;
}
