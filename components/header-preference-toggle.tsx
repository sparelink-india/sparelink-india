"use client";

import { useI18n } from "@/components/preferences-provider";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0-16.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V2.5A.75.75 0 0112 1.75zm0 16.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM4.22 4.22a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06L4.22 5.28a.75.75 0 010-1.06zm13.44 13.44a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM1.75 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H2.5A.75.75 0 011.75 12zm16.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM4.22 19.78a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0zm13.44-13.44a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 14.3A8.5 8.5 0 1110.2 3a7 7 0 1010.8 11.3z" />
    </svg>
  );
}

function optionClass(active: boolean, compact: boolean) {
  const size = compact
    ? "h-7 min-w-7 px-1.5 text-[10px]"
    : "h-8 min-w-0 px-2 text-[11px] xl:min-w-[4.25rem] xl:px-2.5";
  if (active) {
    return `${size} inline-flex items-center justify-center gap-1 rounded-full bg-white font-bold text-[var(--brand)] shadow-sm dark:bg-white`;
  }
  return `${size} inline-flex items-center justify-center gap-1 rounded-full font-semibold text-white/75 hover:text-white`;
}

function languageClass(active: boolean, compact: boolean) {
  const size = compact ? "h-7 min-w-8 px-1.5 text-[10px]" : "h-8 min-w-11 px-2.5 text-[11px]";
  if (active) {
    return `${size} inline-flex items-center justify-center rounded-full bg-white font-bold text-[var(--brand)] shadow-sm`;
  }
  if (compact) {
    return `${size} inline-flex items-center justify-center rounded-full font-semibold text-white/70 hover:text-white`;
  }
  return `${size} inline-flex items-center justify-center rounded-full font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200`;
}

export function HeaderPreferenceToggle({ compact = false }: { compact?: boolean }) {
  const { theme, locale, setTheme, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label="Theme and language"
      className={
        compact
          ? "inline-flex h-8 max-w-[210px] items-center gap-1 rounded-full border border-white/25 bg-white/15 px-1 shadow-sm backdrop-blur-sm"
          : "inline-flex h-10 max-w-full shrink items-center gap-1 rounded-full border border-slate-200 bg-white px-1 shadow-[0_6px_16px_rgba(122,18,51,0.12)] lg:h-11 dark:border-[#2d3545] dark:bg-[#161b24]"
      }
    >
      <div
        role="group"
        aria-label="Theme"
        className="flex items-center rounded-full bg-[var(--brand)] p-0.5"
      >
        <button
          type="button"
          aria-label="Light theme"
          title="Light theme"
          aria-pressed={theme === "light"}
          onClick={() => setTheme("light")}
          className={optionClass(theme === "light", compact)}
        >
          <SunIcon className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          {compact ? null : <span>Light</span>}
        </button>
        <button
          type="button"
          aria-label="Dark theme"
          title="Dark theme"
          aria-pressed={theme === "dark"}
          onClick={() => setTheme("dark")}
          className={
            theme === "dark"
              ? `${compact ? "h-7 min-w-7 px-1.5 text-[10px]" : "h-8 min-w-0 px-2 text-[11px] xl:min-w-[4.25rem] xl:px-2.5"} inline-flex items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--brand)_72%,black)] font-bold text-white shadow-sm`
              : optionClass(false, compact)
          }
        >
          <MoonIcon className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          {compact ? null : <span>Dark</span>}
        </button>
      </div>
      <span className={compact ? "h-4 w-px bg-white/40" : "h-5 w-px bg-slate-200 dark:bg-[#3d4658]"} aria-hidden />
      <div
        role="group"
        aria-label="Language"
        className={compact ? "flex items-center rounded-full bg-white/20 p-0.5" : "flex items-center rounded-full bg-slate-100 p-0.5 dark:bg-[#10141c]"}
      >
        <button
          type="button"
          aria-label="English"
          title="English"
          aria-pressed={locale === "en"}
          lang="en"
          onClick={() => setLocale("en")}
          className={languageClass(locale === "en", compact)}
        >
          EN
        </button>
        <button
          type="button"
          aria-label="Hindi"
          title="Hindi"
          aria-pressed={locale === "hi"}
          lang="hi"
          onClick={() => setLocale("hi")}
          className={languageClass(locale === "hi", compact)}
        >
          {compact ? "हि" : "हिंदी"}
        </button>
      </div>
    </div>
  );
}
