import { dictionaries, type Locale, type MessageKey } from "@/lib/i18n/messages";

export type { Locale, MessageKey };

export const THEME_COOKIE = "sparelink-theme";
export const LOCALE_COOKIE = "sparelink-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "hi";
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = dictionaries[locale][key] || dictionaries.en[key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export const PREFERENCE_BOOTSTRAP = `(function(){try{var t=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var theme=t?decodeURIComponent(t[1]):"light";if(theme==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}var l=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]*)/);var locale=l?decodeURIComponent(l[1]):"en";document.documentElement.lang=locale==="hi"?"hi":"en";}catch(e){}})();`;
