import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Noto_Sans_Devanagari, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { PasswordChangeGuard } from "@/components/password-change-guard";
import { PreferencesProvider } from "@/components/preferences-provider";
import { LOCALE_COOKIE, PREFERENCE_BOOTSTRAP, THEME_COOKIE } from "@/lib/i18n";
import "./globals.css";
// V3 storefront system. Imported after globals.css so the V2 stylesheet keeps
// serving any page that has not been migrated yet; V3 pages use the v3-*
// classes and never mix the two vocabularies in one component.
import "./v3.css";
// "Precision" design system (generation 4) — the TARGET visual language.
// Imported last so it wins any equal-specificity collision. Token and class
// names are namespaced `--sl-*` / `.sl-*`, so it cannot accidentally restyle a
// surface that has not been migrated yet. See the header of app/sparelink.css
// for the migration plan; do not add new surfaces to globals.css or v3.css.
import "./sparelink.css";

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

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
  openGraph: {
    title: "SpareLink India",
    description: siteDescription,
    siteName: "SpareLink India",
    locale: "en_IN",
    type: "website",
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
      className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased ${theme}`.trim()}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <PreferencesProvider initialLocale={locale} initialTheme={themeName}>
          <PasswordChangeGuard />
          {/*
            Customer Intelligence & Experience Analytics.

            Mounted above the page content so it observes route changes for the
            whole site. It renders nothing visible except the consent banner, which
            appears only until the customer has answered. No V3 storefront layout,
            class or token is changed by its presence.

            Default consent is DENIED: nothing is measured until someone opts in.
          */}
          <AnalyticsRoot />
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
