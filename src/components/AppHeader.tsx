import Link from "next/link";
import { SITE_TITLE } from "@/lib/config";
import { PersonaToggle } from "./PersonaToggle";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Select sites" },
  { href: "/compare", label: "Compare" },
  { href: "/sources", label: "Data & methods" },
] as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          {SITE_TITLE}
        </Link>
        <nav className="flex gap-5 text-sm text-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <PersonaToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
