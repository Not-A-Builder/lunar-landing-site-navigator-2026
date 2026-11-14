import Link from "next/link";
import { SITE_TITLE } from "@/lib/config";
import { PersonaToggle } from "./PersonaToggle";

const NAV = [
  { href: "/", label: "Select sites" },
  { href: "/compare", label: "Compare" },
  { href: "/sources", label: "Data & methods" },
] as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          {SITE_TITLE}
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <PersonaToggle />
      </div>
    </header>
  );
}
