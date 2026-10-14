"use client";

import { useI18n } from "@/components/preferences-provider";

export function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--v3-wa-ink)"
        d="M12.04 2C6.58 2 2.15 6.43 2.15 11.89c0 1.76.46 3.48 1.34 5L2 22l5.26-1.38a9.86 9.86 0 004.78 1.22h.01c5.46 0 9.89-4.43 9.89-9.89C21.94 6.43 17.5 2 12.04 2z"
      />
      <path
        fill="white"
        d="M17.47 14.38c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.62.14-.18.27-.71.88-.87 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.46h-.53c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.84.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.83-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.32z"
      />
    </svg>
  );
}

export function WhatsAppCta({
  href,
  className = "",
  label,
  tone = "brand",
}: {
  href: string | null;
  className?: string;
  label?: string;
  /**
   * "brand" tints the label WhatsApp green (--v3-wa-ink). "inherit" drops that
   * tint so the caller's own class decides the colour.
   *
   * This prop exists because the green used to be hardcoded into this
   * component's base classes, where it quietly overrode every caller: on
   * `sl-btn sl-btn-primary` it put green on burgundy (2.47:1), and inside
   * `.v3-footer-link` it repainted a footer-ink link green (3.94:1). Both of
   * those are the caller's decision, not this component's, so a caller that
   * supplies its own colour now has to say so.
   */
  tone?: "brand" | "inherit";
}) {
  const { t } = useI18n();
  const display = label ?? t("wa.us");
  /* "inherit" must emit NO colour class at all. Emitting a different utility
     would not help: Tailwind utilities sit in the utilities layer, which
     outranks the components layer that .sl-btn-primary and .v3-footer-link now
     live in, so any colour set here would beat the caller's own class all over
     again. Omitting it is the only way to genuinely hand the decision back. */
  const toneClass = tone === "brand" ? "text-[var(--v3-wa-ink)]" : "";
  const classes = `inline-flex items-center gap-2 font-semibold hover:underline ${toneClass} ${className}`;
  if (!href) {
    return (
      <span className={`${classes} cursor-not-allowed opacity-60`} title={t("wa.notConfigured")}>
        <WhatsAppIcon />
        {display}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      <WhatsAppIcon />
      {display}
    </a>
  );
}
