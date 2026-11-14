"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Select sites" },
  { href: "/compare", label: "Compare" },
  { href: "/sources", label: "Data & methods" },
] as const;

/** Page links; the current page gets full-strength text and a small dot underneath. */
export function NavLinks() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav className="flex gap-6 text-sm">
      {NAV.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`relative py-1 transition-colors ${active ? "font-medium text-fg" : "text-muted hover:text-fg"}`}
          >
            {n.label}
            <span className={`absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-fg transition-opacity ${active ? "opacity-100" : "opacity-0"}`} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
