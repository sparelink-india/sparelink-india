import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import { cookies } from "next/headers";
import { PasswordChangeGuard } from "@/components/password-change-guard";
import { PreferencesProvider } from "@/components/preferences-provider";
import { LOCALE_COOKIE, PREFERENCE_BOOTSTRAP, THEME_COOKIE } from "@/lib/i18n";
import { en, hi } from "@/lib/i18n/messages";
import "./globals.css";
// V3 storefront system. Imported after globals.css so the V2 stylesheet keeps
// serving any page that has not been migrated yet; V3 pages use the v3-*
// classes and never mix the two vocabularies in one component.
import "./v3.css";
/* Phase A extracted the banner carousel's rules into app/banner-carousel.css so
   the module could ship before V3 existed. v3.css is now deployed and is a
   strict superset of that extraction, so the file is redundant and is deleted in
   this commit. The carousel keeps rendering, styled by v3.css alone. */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-hi",
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
});

const siteDescription =
  "SpareLink India is the digital sales platform for Hind Motors, Ambaji Traders and India Sales.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "SpareLink India",
    template: "%s | SpareLink India",
  },
  description: siteDescription,
  applicationName: "SpareLink India",
  appleWebApp: {
    capable: true,
    title: "SpareLink",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  // Canonical is emitted per-route by the pages that own a specific URL, so the
  // site-wide default here is the bare origin. A single "/" canonical applied
  // globally would be wrong: it would tell crawlers that /products and /brands
  // are duplicates of the homepage.
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SpareLink India",
    description: siteDescription,
    siteName: "SpareLink India",
    locale: "en_IN",
    type: "website",
    url: "/",
    // An EXISTING committed asset: public/images/spareparts-bg.png is 1918x1012,
    // a 1.89:1 ratio, which is the Open Graph recommendation (1.91:1). No new
    // artwork was generated and the Hero was not touched.
    images: [
      {
        url: "/images/spareparts-bg.png",
        width: 1918,
        height: 1012,
        alt: "SpareLink India - automobile spare parts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SpareLink India",
    description: siteDescription,
    images: ["/images/spareparts-bg.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7a1233",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const jar = await cookies();
  const locale = jar.get(LOCALE_COOKIE)?.value === "hi" ? "hi" : "en";
  const themeName = jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  const theme = themeName === "dark" ? "dark" : "";

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} h-full antialiased ${theme}`.trim()}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {/* SKIP TO MAIN CONTENT.

            The first focusable thing on every page. Without it a keyboard user
            must Tab through the entire header - logo, nav row, search, utility
            bar, and on mobile the whole drawer trigger set - to reach content.

            Placed here rather than inside a shell because it must be the FIRST
            focusable node, and `app/layout.tsx` is the only frame above every
            route. It is rendered before <PreferencesProvider> on purpose: the
            label is read from the server-known locale (the cookie), so the link
            is correct on first paint and never flashes English at a Hindi user.

            It is `sr-only` until focused, so it costs no layout and is invisible
            to pointer users, then reveals itself as a fixed panel at the top
            left. Colours come from the same V3 tokens as the rest of the chrome
            so it is legible in both themes. `focus:` rather than `:focus-visible`
            because a skip link must appear for any keyboard focus, including
            programmatic focus from the fragment navigation itself.

            The target `id="main-content"` is on the <main> that each shell
            already renders, so this adds an attribute to an element that exists
            and changes no box, no spacing and no stacking. */}
        <a
          href="#main-content"
          data-skip-to-content
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-[var(--v3-r)] focus:border focus:border-[var(--v3-brand-line)] focus:bg-[var(--v3-panel)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[var(--v3-brand-ink)] focus:shadow-lg"
        >
          {(locale === "hi" ? hi : en)["a11y.skipToContent"]}
        </a>
        <PreferencesProvider initialLocale={locale} initialTheme={themeName}>
          <PasswordChangeGuard />
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
