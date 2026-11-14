import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { PersonaHydrator } from "@/components/PersonaToggle";
import { SITE_TITLE } from "@/lib/config";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: `%s · ${SITE_TITLE}` },
  description:
    "Compare lunar south-pole landing sites and dates: Sun and Earth above the horizon, power and direct-to-Earth communication windows. NASA Space Apps 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      {/* Every load starts in the dark theme, rendered on the server so there is no flash (D-072). */}
      <body className="flex min-h-full flex-col">
        <PersonaHydrator />
        <AppHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
