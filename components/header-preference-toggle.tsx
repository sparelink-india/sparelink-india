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

/* SQUARE, NOT PILL.

   This control is two segmented groups sitting inside a third box. Every level
   was `rounded-full`, so the header carried three concentric pills on a 44px
   strip - the "excessive pills" the design brief rules out, and it read as a
   toy next to the tight, squared V3 header around it. `var(--v3-r)` is the same
   radius the rest of the chrome uses, so the control now belongs to its bar. */
/* THE ACTIVE OPTION'S COLOUR IS THE POINT OF THIS WHOLE FILE.

   It used to read `bg-white ... text-[var(--brand)]`. `--brand` is #7a1233 in
   both themes - it is a FILL token with no dark override, and v3.css documents
   that using it as ink measures 1.61:1 on a dark ground. Meanwhile `bg-white`
   is remapped to #161b24 in dark mode. So in dark mode the SELECTED theme and
   language option rendered #7a1233 text on a #161b24 pill: 1.4:1, i.e. the one
   thing a user must be able to read.

   Fixed by separating the two jobs the way the token system intends:
     - the pill's GROUND is `var(--v3-panel)`, stated rather than inherited from
       the `bg-white` remap, so it is correct by construction in both themes;
     - its INK is `var(--v3-brand-ink)`, the token that is #7a1233 in light and
       #e8a0b8 in dark precisely so it stays readable on a panel in both. */
function optionClass(active: boolean, compact: boolean) {
  const size = compact
    ? "h-7 min-w-7 px-1.5 text-[10px]"
    : "h-8 min-w-0 px-2 text-[11px] xl:min-w-[4.25rem] xl:px-2.5";
  if (active) {
    return `${size} v3-focus inline-flex items-center justify-center gap-1 rounded-[var(--v3-r)] bg-[var(--v3-panel)] font-bold text-[var(--v3-brand-ink)]`;
  }
  return `${size} v3-focus inline-flex items-center justify-center gap-1 rounded-[var(--v3-r)] font-semibold text-white/75 hover:text-white`;
}

function languageClass(active: boolean, compact: boolean) {
  const size = compact ? "h-7 min-w-8 px-1.5 text-[10px]" : "h-8 min-w-11 px-2.5 text-[11px]";
  if (active) {
    return `${size} v3-focus inline-flex items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-panel)] font-bold text-[var(--v3-brand-ink)]`;
  }
  if (compact) {
    return `${size} v3-focus inline-flex items-center justify-center rounded-[var(--v3-r)] font-semibold text-white/70 hover:text-white`;
  }
  /* On the opaque desktop bar the inactive language label sits on
     `var(--v3-panel)`, so it takes the muted panel ink rather than white ink. */
  return `${size} v3-focus inline-flex items-center justify-center rounded-[var(--v3-r)] font-semibold text-[var(--v3-text-3)] hover:text-[var(--v3-text)]`;
}

export function HeaderPreferenceToggle({ compact = false }: { compact?: boolean }) {
  const { t, theme, locale, setTheme, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("a11y.themeAndLanguage")}
      className={
        compact
          ? "inline-flex h-8 max-w-[210px] items-center gap-1 rounded-[var(--v3-r)] border border-white/25 bg-white/15 px-1"
          : "inline-flex h-10 max-w-full shrink items-center gap-1 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-1 lg:h-11"
      }
    >
      <div
        role="group"
        aria-label={t("a11y.themeGroup")}
        className="flex items-center rounded-[var(--v3-r)] bg-[var(--brand)] p-0.5"
      >
        <button
          type="button"
          aria-label={t("a11y.lightTheme")}
          title={t("a11y.lightTheme")}
          aria-pressed={theme === "light"}
          onClick={() => setTheme("light")}
          className={optionClass(theme === "light", compact)}
        >
          <SunIcon className="h-3.5 w-3.5" />
          {compact ? null : <span>{t("theme.light")}</span>}
        </button>
        <button
          type="button"
          aria-label={t("a11y.darkTheme")}
          title={t("a11y.darkTheme")}
          aria-pressed={theme === "dark"}
          onClick={() => setTheme("dark")}
          className={
            theme === "dark"
              ? `${compact ? "h-7 min-w-7 px-1.5 text-[10px]" : "h-8 min-w-0 px-2 text-[11px] xl:min-w-[4.25rem] xl:px-2.5"} v3-focus inline-flex items-center justify-center gap-1 rounded-[var(--v3-r)] bg-[color-mix(in_srgb,var(--brand)_72%,black)] font-bold text-white`
              : optionClass(false, compact)
          }
        >
          <MoonIcon className="h-3.5 w-3.5" />
          {compact ? null : <span>{t("theme.dark")}</span>}
        </button>
      </div>
      <div
        role="group"
        aria-label={t("a11y.languageGroup")}
        className={
          compact
            ? "flex items-center rounded-[var(--v3-r)] bg-white/20 p-0.5"
            : "flex items-center rounded-[var(--v3-r)] bg-[var(--v3-sunk)] p-0.5"
        }
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
