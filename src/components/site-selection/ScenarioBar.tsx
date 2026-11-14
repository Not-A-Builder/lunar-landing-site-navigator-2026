"use client";

import { PencilSimple, X } from "@phosphor-icons/react";
import { MAX_COMPARE } from "@/lib/config";
import { fmtUTC } from "@/lib/metrics/format";
import { resolveScenarioSite, SCENARIO_LETTERS, type Scenario } from "@/lib/scenarios";

/**
 * Sticky bar under the app header while a comparison is being built on the selection page (D-066).
 * One card per scenario slot: saved ones (pencil to edit, × to remove), the one the form below is
 * filling or editing (highlighted), and empty ones still available (long-dash outline).
 */
export function ScenarioBar({
  queue, activeIndex, editing, current, draftWhen, onEdit, onRemoveQueued, onRemoveCurrent,
}: {
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
    <div className="sticky top-[65px] z-20 shrink-0 border-b border-line bg-bg/90 backdrop-blur">
      <ol aria-label="Scenarios to compare" className="mx-auto grid max-w-[1600px] grid-cols-3 gap-3 px-4 py-3">
        {Array.from({ length: MAX_COMPARE }, (_, i) => {
          const L = SCENARIO_LETTERS[i];
          if (i !== activeIndex && i < queue.length) {
            const sc = queue[i];
            return (
              <Card key={i} label={`Scenario ${L}`} onEdit={() => onEdit(i)} onRemove={() => onRemoveQueued(i)} letter={L}>
                <Lines name={resolveScenarioSite(sc.siteId)?.name ?? "Unknown site"} when={sc.t ? Date.parse(sc.t) : null} />
              </Card>
            );
          }
          if (i === activeIndex) {
            return (
              <Card key={i} active label={`Scenario ${L} · ${editing ? "editing" : "selecting now"}`} onRemove={onRemoveCurrent} letter={L}>
                {current ? (
                  <Lines name={resolveScenarioSite(current.siteId)?.name ?? "Unknown site"} when={draftWhen} />
                ) : (
                  <>
                    <div className="truncate text-sm text-muted">Pick a date, time and site below</div>
                    <div className="num truncate text-xs text-faint">{fmtUTC(draftWhen)}</div>
                  </>
                )}
              </Card>
            );
          }
          return (
            <li key={i} className="relative flex min-h-[76px] flex-col justify-center rounded-sm px-3 py-2 text-faint">
              {/* Long dashes and gaps (CSS `dashed` can't set them) so a free slot reads differently from a card (D-071). */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                <rect x="0.5" y="0.5" rx="2" fill="none" stroke="var(--faint)" strokeOpacity={0.7} strokeDasharray="12 8" style={{ width: "calc(100% - 1px)", height: "calc(100% - 1px)" }} />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider">Scenario {L}</span>
              <span className="text-sm">Not added yet</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Card({
  label, letter, active = false, onEdit, onRemove, children,
}: { label: string; letter: string; active?: boolean; onEdit?: () => void; onRemove: () => void; children: React.ReactNode }) {
  const iconBtn = "shrink-0 cursor-pointer rounded-sm p-1 text-muted hover:bg-panel-2 hover:text-fg";
  return (
    <li
      aria-current={active ? "step" : undefined}
      className={`flex min-h-[76px] min-w-0 flex-col justify-center rounded-sm border bg-panel px-3 py-2 ${active ? "border-primary ring-1 ring-inset ring-primary" : "border-line"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-fg" : "text-faint"}`}>{label}</span>
        <div className="-m-1 flex items-center gap-0.5">
          {onEdit && (
            <button type="button" onClick={onEdit} aria-label={`Edit scenario ${letter}`} title="Edit date, time and site" className={iconBtn}>
              <PencilSimple size={16} />
            </button>
          )}
          <button type="button" onClick={onRemove} aria-label={`Remove scenario ${letter}`} title="Remove" className={iconBtn}>
            <X size={16} />
          </button>
        </div>
      </div>
      {children}
    </li>
  );
}

function Lines({ name, when }: { name: string; when: number | null }) {
  return (
    <>
      <div className="truncate font-medium leading-snug">{name}</div>
      <div className="num truncate text-xs text-muted">{fmtUTC(when)}</div>
    </>
  );
}
