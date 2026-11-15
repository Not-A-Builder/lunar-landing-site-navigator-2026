"use client";

import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { exitCompareFlow, validBack } from "@/lib/compare-flow";
import { SITE_TITLE } from "@/lib/config";
import { parseScenarios } from "@/lib/scenarios";
import { useExitCompare } from "./compare/ExitCompareDialog";
import { NavLinks } from "./NavLinks";
import { PersonaToggle } from "./PersonaToggle";
import { ThemeToggle } from "./ThemeToggle";

const divider = <span className="h-6 w-px shrink-0 bg-line" aria-hidden />;

/**
 * The regular header row: title, page links, persona and theme. Also the fallback while the URL is read.
 * The title always leads to site selection; while a comparison is open it first asks to exit it (D-130).
 */
export function DefaultHeaderBar({ comparing = false }: { comparing?: boolean }) {
  const askExit = useExitCompare((s) => s.setOpen);
  return (
    <>
      <Link
        href="/"
        onClick={(e) => {
          if (!comparing || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          askExit(true);
        }}
        className="shrink-0 font-semibold tracking-tight"
      >
        {SITE_TITLE}
      </Link>
      {divider}
      <NavLinks />
      <div className="ml-auto flex items-center gap-3">
        <PersonaToggle />
        <ThemeToggle />
      </div>
    </>
  );
}

/**
 * Header row. On the selection page opened as the "Select scenarios to compare" step (D-128, D-129), the
 * whole row is replaced by a close (×) at the top left, which returns to where it was opened, and the step's title.
 */
export function HeaderBar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const back = pathname === "/" ? validBack(params.get("back")) : null;
  if (!back) return <DefaultHeaderBar comparing={pathname === "/compare" && parseScenarios(params.get("s")).length >= 2} />;
  // Only the close (×) and the step's title, from the left edge: no app name, links, persona or theme (D-129).
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => exitCompareFlow(router, back)}
        aria-label="Close and go back"
        title="Close and go back"
        className="-ml-1.5 cursor-pointer rounded-sm p-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-fg"
      >
        <X size={22} />
      </button>
      <h1 className="text-base font-semibold">Select Scenarios to Compare</h1>
    </div>
  );
}
