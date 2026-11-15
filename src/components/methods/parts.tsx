import type { ReactNode } from "react";

/** Numbered section heading for the Data & methods page (D-139b): "01 — Kicker", big title, lead. */
export function SectionHead({ id, n, kicker, title, children }: { id: string; n: string; kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="reveal max-w-3xl">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-faint">
        <span className="num text-fg">{n}</span>
        <span className="h-px w-8 bg-line" aria-hidden />
        <span>{kicker}</span>
      </div>
      <h2 id={`${id}-h`} className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.15]">{title}</h2>
      {children && <div className="mt-4 text-base leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

/** A section of the page: anchor for the contents list, hairline above, generous spacing. */
export function Section({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-24 border-t border-line pt-14 pb-16 ${className}`}>
      {children}
    </section>
  );
}

/** Chapter divider ("Part 1 · How it works"): an anchor in the contents list that groups sections. */
export function Chapter({ id, part, title, children }: { id: string; part: string; title: string; children?: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 pt-6 pb-10">
      <div className="reveal">
        <div className="text-xs font-medium uppercase tracking-wider text-faint">{part}</div>
        <h2 className="mt-2 text-[2.75rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[3.5rem]">{title}</h2>
        {children && <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">{children}</p>}
      </div>
    </div>
  );
}

/** Small uppercase label used above figures and lists. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-wider text-faint">{children}</div>;
}

/** Inline code / file path. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-fg">{children}</code>;
}

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
