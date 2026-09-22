import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import { cookies } from "next/headers";
import { PasswordChangeGuard } from "@/components/password-change-guard";
import { PreferencesProvider } from "@/components/preferences-provider";
import { LOCALE_COOKIE, PREFERENCE_BOOTSTRAP, THEME_COOKIE } from "@/lib/i18n";
import "./globals.css";

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
      className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} h-full antialiased ${theme}`.trim()}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <PreferencesProvider initialLocale={locale} initialTheme={themeName}>
          <PasswordChangeGuard />
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
