import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { PersonaHydrator } from "@/components/PersonaToggle";
import { SITE_TITLE } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: `%s · ${SITE_TITLE}` },
  description:
    "Compare lunar south-pole landing sites and dates: Sun and Earth above the horizon, power and direct-to-Earth communication windows. NASA Space Apps 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PersonaHydrator />
        <AppHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
