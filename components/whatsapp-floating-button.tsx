"use client";

import { WhatsAppIcon } from "@/components/whatsapp-cta";

/**
 * A single floating WhatsApp control, bottom-LEFT.
 *
 * WHY A NEW COMPONENT RATHER THAN A PROP ON `WhatsAppCta`. `WhatsAppCta` is an
 * inline link with a hardcoded brand green that several pages style with the
 * V3 button classes - the footer's directory band and the header's primary nav
 * both override its colour. A floating control has the opposite problem: it
 * sits on an unknown surface, so it needs its own surface, its own shadow and
 * its own focus treatment, and it must not be reachable from a prop that a
 * footer call site could set by accident.
 *
 * WHY THE SLOW EXPAND ON HOVER. The control is a circle at rest. On a pointer
 * device it widens to show the label, which is what makes it legible to someone
 * who does not recognise the glyph. On touch there is no hover, so it stays a
 * circle and relies on its accessible name. Implemented with a width
 * transition rather than a scale, so the label reflows instead of stretching.
 *
 * THE POSITIONING MATH. Three things stack on the bottom-left of a phone:
 *   - the safe-area inset, for a home indicator or a gesture bar
 *   - the mobile bottom nav, `--mobile-nav-height`, which only exists below md
 *   - the page's own bottom padding, so the button never sits on a fixed bar
 * so the control clears all three, and the `md:` step lifts it above the nav
 * height because the nav does not exist at that width. Nothing here is a
 * magic number that a viewport change can break.
 *
 * NO HORIZONTAL OVERFLOW. `left-*` anchors from the left edge only, and the
 * element is `w-` constrained, so it can never widen the document.
 */
export function WhatsAppFloatingButton({
  href,
  label = "WhatsApp",
}: {
  href: string | null;
  label?: string;
}) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      /* The accessible name is the full label at every width, so a screen
         reader is not told "WhatsApp button" with an empty visual. */
      aria-label={label}
      className={[
        "group fixed z-30 inline-flex items-center rounded-full",
        "bg-[#25D366] text-white shadow-lg shadow-black/25",
        "ring-1 ring-black/10",
        "transition-[width,box-shadow] duration-200 ease-out",
        "hover:shadow-xl hover:shadow-black/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-[#25D366] focus-visible:ring-offset-[var(--background)]",
        "h-12 w-12 overflow-hidden hover:w-56 focus-visible:w-56",
        // Clears the safe area, then the mobile bottom nav, then breathes.
        "left-[calc(0.75rem+var(--safe-left))]",
        "bottom-[calc(0.75rem+var(--safe-bottom)+var(--mobile-nav-height))]",
        "md:bottom-[calc(1rem+var(--safe-bottom))]",
        "print:hidden",
      ].join(" ")}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center">
        <WhatsAppIcon className="h-6 w-6" />
      </span>
      <span
        className="whitespace-nowrap pr-4 text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      >
        {label}
      </span>
    </a>
  );
}
