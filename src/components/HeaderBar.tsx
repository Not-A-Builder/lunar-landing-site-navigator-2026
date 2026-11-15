"use client";

import { X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { exitCompareFlow, validBack } from "@/lib/compare-flow";
import { LOGO_CAPS, LOGO_MARK, SITE_TITLE } from "@/lib/config";
import { parseScenarios } from "@/lib/scenarios";
import { BrandLogo } from "./BrandLogo";
import { useExitCompare } from "./compare/ExitCompareDialog";
import { NavLinks } from "./NavLinks";
import { PersonaToggle } from "./PersonaToggle";
import { ThemeToggle } from "./ThemeToggle";

const divider = <span className="h-6 w-px shrink-0 bg-line" aria-hidden />;

/** Header wordmark height and mark size (px). The mark is 20 × 20 (owner's pick). */
const WORDMARK_H = 22;
const MARK = 20;
/**
 * Shift that puts the mark's centre on the centre of the wordmark's capitals rather than its image box (the
 * artboard has space above the caps and the swoosh below them). Rounded to whole pixels so the mark stays crisp.
 */
const MARK_SHIFT = Math.round((WORDMARK_H * (LOGO_CAPS.top + LOGO_CAPS.bottom)) / (2 * LOGO_CAPS.artboard) - WORDMARK_H / 2);

/** Pages whose content is the same for every persona, so the header shows no persona selector (D-140b). */
const NO_PERSONA = new Set(["/sources"]);

/**
 * The regular header row: title, page links, persona and theme. Also the fallback while the URL is read.
 * Data & methods has no persona selector: it reads the same for everyone (D-140b).
 * The title always leads to site selection; while a comparison is open it first asks to exit it (D-130).
 */
export function DefaultHeaderBar({ comparing = false }: { comparing?: boolean }) {
  const askExit = useExitCompare((s) => s.setOpen);
  const pathname = usePathname();
  return (
    <>
      <Link
        href="/"
        onClick={(e) => {
          if (!comparing || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          askExit(true);
        }}
        aria-label={`${SITE_TITLE}, site selection`}
        className="flex shrink-0 items-center gap-2 rounded-sm transition-opacity hover:opacity-80"
      >
        {/* The square mark (favicon artwork, 2px corners), centred on the wordmark's capitals, then the wordmark in
            the current theme's colours (D-143). A faint inner stroke in the text colour (dark on light, light on dark)
            separates the mark from the header. */}
        <Image
          src={LOGO_MARK}
          width={MARK}
          height={MARK}
          alt=""
          unoptimized
          loading="eager"
          draggable={false}
          style={{ width: MARK, height: MARK, transform: MARK_SHIFT ? `translateY(${MARK_SHIFT}px)` : undefined }}
          className="block rounded-sm outline-1 -outline-offset-1 outline-fg/20"
        />
        <BrandLogo height={WORDMARK_H} className="block" />
      </Link>
      {divider}
      <NavLinks />
      <div className="ml-auto flex items-center gap-3">
        {!NO_PERSONA.has(pathname) && <PersonaToggle />}
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
