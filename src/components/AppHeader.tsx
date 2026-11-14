import Link from "next/link";
import { SITE_TITLE } from "@/lib/config";
import { NavLinks } from "./NavLinks";
import { PersonaToggle } from "./PersonaToggle";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-5 px-4">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          {SITE_TITLE}
        </Link>
        <span className="h-6 w-px shrink-0 bg-line" aria-hidden />
        <NavLinks />
        <div className="ml-auto flex items-center gap-3">
          <PersonaToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
