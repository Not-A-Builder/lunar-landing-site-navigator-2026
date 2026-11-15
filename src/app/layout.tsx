import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { HistoryRecorder } from "@/components/history/HistoryRecorder";
import { PersonaHydrator } from "@/components/PersonaToggle";
import { Splash, SplashGate } from "@/components/Splash";
import { SITE_FULL_NAME, SITE_TITLE } from "@/lib/config";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: `${SITE_TITLE}: ${SITE_FULL_NAME}`, template: `%s · ${SITE_TITLE}` },
  description:
    "Compare lunar south-pole landing sites and dates: Sun and Earth above the horizon, power and direct-to-Earth communication windows. NASA Space Apps 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      {/* Every load starts in the dark theme, rendered on the server so there is no flash (D-072). */}
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before hydration (D-101). */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/* First-load splash, once per tab (D-144). The script hides it before paint if this tab has seen it. */}
        <SplashGate />
        <Splash />
        <PersonaHydrator />
        {/* Records opened site details and comparisons for History (D-131); reads the URL, so needs Suspense. */}
        <Suspense fallback={null}>
          <HistoryRecorder />
        </Suspense>
        <AppHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
