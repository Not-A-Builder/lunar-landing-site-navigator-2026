"use client";

import { X } from "@phosphor-icons/react";
import { MAX_COMPARE } from "@/lib/config";
import { fmtUTC } from "@/lib/metrics/format";
import { isComplete, resolveScenarioSite, SCENARIO_LETTERS, type Scenario } from "@/lib/scenarios";

/** "Scenario A", "Scenario B · selecting now", …: one style in every state (saved, active, empty). */
const LABEL = "text-xs font-semibold uppercase tracking-wider text-faint";

/** Stagger index for the enter/exit animation (globals.css `.bar-card`). */
const stagger = (i: number) => ({ "--i": i, "--n": MAX_COMPARE }) as React.CSSProperties;

/**
 * Sticky bar under the app header while a comparison is being built on the selection page (D-066).
 * One card per scenario slot: saved ones (click the card to edit, × to remove), the one the form below is
 * filling or editing (highlighted), and empty ones still available (long-dash outline).
 *
 * `phase` "in": the bar slides down, then the cards fade in from the left one by one. "out": the
 * reverse, cards first (last one first), then the bar folds up; the bar is inert meanwhile (D-076).
 */
export function ScenarioBar({
  queue, activeIndex, editing, current, draftWhen, onEdit, onRemoveQueued, onRemoveCurrent, phase = null,
}: {
  phase?: "in" | "out" | null;
  queue: Scenario[];
  /** Slot the form is filling: an index into `queue` while editing, else `queue.length`. */
  activeIndex: number;
  /** True when the active slot is a saved scenario being edited (not a new one). */
  editing: boolean;
  onEdit: (i: number) => void;
  /** The scenario the form currently describes, or null until a site is picked. */
  current: Scenario | null;
  /** The form's landing time, shown on the active card before a site is picked. */
  draftWhen: number | null;
  onRemoveQueued: (i: number) => void;
  onRemoveCurrent: () => void;
}) {
  return (
    <div inert={phase === "out"} className={`sticky top-[65px] z-20 grid shrink-0 grid-rows-[1fr] ${phase === "in" ? "bar-in" : phase === "out" ? "bar-out" : ""}`}>
      <div className="min-h-0 overflow-hidden border-b border-line bg-bg/90 backdrop-blur">
      <ol aria-label="Scenarios to compare" className="mx-auto grid max-w-[1600px] grid-cols-3 gap-3 px-4 py-3">
        {Array.from({ length: MAX_COMPARE }, (_, i) => {
          const L = SCENARIO_LETTERS[i];
          if (i !== activeIndex && i < queue.length) {
            const sc = queue[i];
            return (
              <ScenarioCard key={i} i={i} label={`Scenario ${L}`} onEdit={() => onEdit(i)} onRemove={() => onRemoveQueued(i)} letter={L}>
                {isComplete(sc) ? (
                  <ScenarioLines name={resolveScenarioSite(sc.siteId)?.name ?? "Unknown site"} when={sc.t ? Date.parse(sc.t) : null} />
                ) : (
                  // Partial: a landing time, no site yet. Kept until removed with × (D-074).
                  <>
                    <div className="truncate text-sm text-muted">Site not picked yet</div>
                    <div className="num truncate text-xs text-muted">{fmtUTC(sc.t ? Date.parse(sc.t) : null)}</div>
                  </>
                )}
              </ScenarioCard>
            );
          }
          if (i === activeIndex) {
            return (
              <ScenarioCard key={i} i={i} active label={`Scenario ${L} · ${editing ? "editing" : "selecting now"}`} onRemove={onRemoveCurrent} letter={L}>
                {current ? (
                  <ScenarioLines name={resolveScenarioSite(current.siteId)?.name ?? "Unknown site"} when={draftWhen} />
                ) : (
                  <>
                    <div className="truncate text-sm text-muted">Pick a date, time and site below</div>
                    <div className="num truncate text-xs text-faint">{fmtUTC(draftWhen)}</div>
                  </>
                )}
              </ScenarioCard>
            );
          }
          return (
            <li key={i} style={stagger(i)} className="bar-card relative flex min-h-[76px] flex-col justify-center rounded-sm px-3 py-2 text-faint">
              {/* Long dashes and gaps (CSS `dashed` can't set them) so a free slot reads differently from a card (D-071). */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                <rect x="0.5" y="0.5" rx="2" fill="none" stroke="var(--faint)" strokeOpacity={0.4} strokeDasharray="12 8" style={{ width: "calc(100% - 1px)", height: "calc(100% - 1px)" }} />
              </svg>
              <span className={LABEL}>Scenario {L}</span>
              <span className="text-sm">Not added yet</span>
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}

/** One scenario card. Also used, as a `div`, for the comparison's cards (D-131b), so both look the same. */
export function ScenarioCard({
  i, label, letter, active = false, onEdit, onRemove, children, as: Tag = "li", className = "", editTitle = "Edit date, time and site", removeTitle = "Remove",
}: { i: number; label: string; letter: string; active?: boolean; onEdit?: () => void; onRemove?: () => void; children: React.ReactNode; as?: "li" | "div"; className?: string; editTitle?: string; removeTitle?: string }) {
  // A saved card is clickable as a whole to edit it (D-075); × stops the click from reaching the card.
  const editable = onEdit
    ? {
        role: "button",
        tabIndex: 0,
        "aria-label": `Edit scenario ${letter}`,
        title: editTitle,
        onClick: onEdit,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onEdit();
        },
      }
    : {};
  return (
    <Tag
      {...editable}
      aria-current={active ? "step" : undefined}
      style={stagger(i)}
      className={`bar-card ${className} flex min-h-[76px] min-w-0 flex-col justify-center rounded-sm border bg-panel px-3 py-2 outline-none ${
        active ? "border-primary ring-1 ring-inset ring-primary" : "border-line"
      } ${onEdit ? "cursor-pointer transition-colors hover:border-muted hover:bg-panel-2 focus-visible:border-fg" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        {onRemove && <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove scenario ${letter}`}
          title={removeTitle}
          className="-m-1 shrink-0 cursor-pointer rounded-sm p-1 text-muted hover:bg-line hover:text-fg"
        >
          <X size={16} />
        </button>}
      </div>
      {children}
    </Tag>
  );
}

export function ScenarioLines({ name, when }: { name: string; when: number | null }) {
  return (
    <>
      <div className="truncate font-medium leading-snug">{name}</div>
      <div className="num truncate text-xs text-muted">{fmtUTC(when)}</div>
    </>
  );
}
