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
  /* The active chip fills with a light surface and brand ink. Every value is a
     token pair rather than `bg-white` + a raw brand colour: globals.css remaps
     the `.bg-white` CLASS to a slate near-black under `html.dark`, so the old
     pairing collapsed to burgundy on near-black (1.61:1) in dark mode. Tokens
     remap with the theme, so the chip means the same thing in both. */
  if (active) {
    return `${size} inline-flex items-center justify-center gap-1 rounded-[var(--sl-r-xs)] bg-[var(--sl-surface)] font-bold text-[var(--sl-brand-ink)] shadow-sm`;
  }
  return `${size} inline-flex items-center justify-center gap-1 rounded-[var(--sl-r-xs)] font-semibold text-white/75 hover:text-white`;
}

function languageClass(active: boolean, compact: boolean) {
  const size = compact ? "h-7 min-w-8 px-1.5 text-[10px]" : "h-8 min-w-11 px-2.5 text-[11px]";
  /* The active chip is filled brand with white ink on light, and a filled
     light ink on a dark brand plate in dark — explicit token pairs instead of
     `bg-white text-[var(--brand)]`, which globals.css's `.bg-white` remap
     collapsed to burgundy on near-black (1.61:1). */
  if (active) {
    return `${size} inline-flex items-center justify-center rounded-[var(--sl-r-xs)] bg-[var(--sl-brand)] font-bold text-white shadow-sm dark:bg-[var(--sl-brand-soft)] dark:text-[var(--sl-brand-ink)]`;
  }
  /* Inactive on the dark utility strip the group sits on a translucent white
     tint, where `text-white/70` measured 4.15:1. /85 clears AA. */
  if (compact) {
    return `${size} inline-flex items-center justify-center rounded-[var(--sl-r-xs)] font-semibold text-white/85 hover:text-white`;
  }
  return `${size} inline-flex items-center justify-center rounded-[var(--sl-r-xs)] font-semibold text-[var(--sl-ink-2)] hover:text-[var(--sl-ink)]`;
}

export function HeaderPreferenceToggle({ compact = false }: { compact?: boolean }) {
  const { t, theme, locale, setTheme, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label={`${t("settings.theme")} / ${t("settings.language")}`}
      className={
        compact
          ? "inline-flex h-8 max-w-[210px] items-center gap-1 rounded-[var(--sl-r-sm)] border border-white/25 bg-white/15 px-1 shadow-sm backdrop-blur-sm"
          : "inline-flex h-10 max-w-full shrink items-center gap-1 rounded-[var(--sl-r-sm)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] px-1 shadow-[var(--sl-e-1)] lg:h-11"
      }
    >
      <div
        role="group"
        aria-label={t("settings.theme")}
        className="flex items-center rounded-[var(--sl-r-sm)] bg-[var(--sl-brand)] p-0.5"
      >
        <button
          type="button"
          aria-label={t("settings.light")}
          title={t("settings.light")}
          aria-pressed={theme === "light"}
          onClick={() => setTheme("light")}
          className={optionClass(theme === "light", compact)}
        >
          <SunIcon className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          {compact ? null : <span>{t("settings.light")}</span>}
        </button>
        <button
          type="button"
          aria-label={t("settings.dark")}
          title={t("settings.dark")}
          aria-pressed={theme === "dark"}
          onClick={() => setTheme("dark")}
          className={
            theme === "dark"
              ? `${compact ? "h-7 min-w-7 px-1.5 text-[10px]" : "h-8 min-w-0 px-2 text-[11px] xl:min-w-[4.25rem] xl:px-2.5"} inline-flex items-center justify-center gap-1 rounded-[var(--sl-r-xs)] bg-[color-mix(in_srgb,var(--sl-brand)_72%,black)] font-bold text-white shadow-sm`
              : optionClass(false, compact)
          }
        >
          <MoonIcon className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          {compact ? null : <span>{t("settings.dark")}</span>}
        </button>
      </div>
      <div
        role="group"
        aria-label={t("settings.language")}
        className={
          compact
            ? "flex items-center rounded-[var(--sl-r-sm)] bg-white/20 p-0.5"
            : "flex items-center rounded-[var(--sl-r-sm)] bg-[var(--sl-sunken)] p-0.5"
        }
      >
        {/* axe requires the accessible name to CONTAIN the visible label.
            "हि"/"हिंदी" never matched a name that only said "Hindi", which
            failed label-content-name-mismatch on the compact chip. Each name
            now leads with exactly what is painted, then names the language
            through the dictionary. */}
        <button
          type="button"
          aria-label={`EN (${t("settings.english")})`}
          title={t("settings.english")}
          aria-pressed={locale === "en"}
          lang="en"
          onClick={() => setLocale("en")}
          className={languageClass(locale === "en", compact)}
        >
          EN
        </button>
        <button
          type="button"
          aria-label={compact ? `हि (${t("settings.hindi")})` : `हिंदी (${t("settings.hindi")})`}
          title={t("settings.hindi")}
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
