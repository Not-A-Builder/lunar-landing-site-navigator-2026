"use client";

import { CalendarBlank, CaretLeft, CaretRight, Clock } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePopover } from "@/lib/use-popover";

/**
 * Landing date and time pickers, modelled on iOS Reminders: a compact field opens an inline month
 * calendar (tap the month title for month/year wheels) or hour/minute wheels. All values are UTC.
 * Both open upward: they sit at the foot of the site-selection column.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const YEARS = Array.from({ length: 2050 - 1960 + 1 }, (_, i) => 1960 + i);
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

const fieldCls = (open: boolean, disabled: boolean) =>
  `flex h-10 w-full items-center gap-2 rounded-sm border bg-panel px-3 text-left text-sm transition-colors ${
    disabled ? "border-line text-faint" : open ? "border-fg" : "border-line hover:border-muted"
  }`;

export function DateField({ value, onChange, id }: { value: number | null; onChange: (ms: number) => void; id?: string }) {
  const { ref, open, setOpen } = usePopover();
  const d = value === null ? null : new Date(value);
  const label = d ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "…";
  return (
    <div ref={ref} className="relative">
      <button id={id} type="button" disabled={!d} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} className={fieldCls(open, !d)}>
        <CalendarBlank size={18} className="shrink-0 text-muted" aria-hidden />
        <span className="num truncate">{label}</span>
      </button>
      {open && d && (
        <div role="dialog" aria-label="Choose landing date (UTC)" className="absolute bottom-full left-0 z-30 mb-1.5 w-[320px] rounded-sm border border-line bg-panel p-3 shadow-xl">
          <Calendar
            value={d}
            onPick={(y, m, day) => {
              onChange(Date.UTC(y, m, day, d.getUTCHours(), d.getUTCMinutes()));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Calendar({ value, onPick }: { value: Date; onPick: (y: number, m: number, d: number) => void }) {
  const [view, setView] = useState({ y: value.getUTCFullYear(), m: value.getUTCMonth() });
  const [wheels, setWheels] = useState(false);
  const today = useMemo(() => new Date(), []);
  const step = (n: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));

  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  const same = (a: Date, day: number) => a.getUTCFullYear() === view.y && a.getUTCMonth() === view.m && a.getUTCDate() === day;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setWheels(!wheels)} aria-expanded={wheels} className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-semibold hover:bg-panel-2">
          {MONTHS[view.m]} {view.y}
          <CaretRight size={14} weight="bold" className={`transition-transform ${wheels ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {!wheels && (
          <div className="flex">
            <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="rounded-sm p-1.5 hover:bg-panel-2"><CaretLeft size={18} weight="bold" /></button>
            <button type="button" onClick={() => step(1)} aria-label="Next month" className="rounded-sm p-1.5 hover:bg-panel-2"><CaretRight size={18} weight="bold" /></button>
          </div>
        )}
      </div>
      {wheels ? (
        <div className="flex justify-center gap-2 py-2">
          <Wheel ariaLabel="Month" width={150} items={MONTHS.map((l, i) => ({ value: i, label: l }))} value={view.m} onChange={(m) => setView((v) => ({ ...v, m }))} />
          <Wheel ariaLabel="Year" width={90} items={YEARS.map((y) => ({ value: y, label: String(y) }))} value={view.y} onChange={(y) => setView((v) => ({ ...v, y }))} />
        </div>
      ) : (
        <div role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`}>
          <div className="grid grid-cols-7 pb-1 text-center text-xs font-medium text-faint" role="row">
            {WEEKDAYS.map((w) => <span key={w} role="columnheader" aria-label={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5" role="row">
            {cells.map((day, i) =>
              day === null ? (
                <span key={`b${i}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={same(value, day)}
                  onClick={() => onPick(view.y, view.m, day)}
                  className="num group flex h-10 items-center justify-center"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                      same(value, day) ? "bg-primary font-semibold text-primary-ink" : same(today, day) ? "font-semibold text-accent group-hover:bg-panel-2" : "group-hover:bg-panel-2"
                    }`}
                  >
                    {day}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TimeField({ value, onChange, id }: { value: number | null; onChange: (ms: number) => void; id?: string }) {
  const { ref, open, setOpen } = usePopover();
  const d = value === null ? null : new Date(value);
  const set = (h: number, m: number) => d && onChange(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m));
  return (
    <div ref={ref} className="relative">
      <button id={id} type="button" disabled={!d} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} className={fieldCls(open, !d)}>
        <Clock size={18} className="shrink-0 text-muted" aria-hidden />
        <span className="num">{d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : "…"}</span>
        <span className="ml-auto text-xs text-faint">UTC</span>
      </button>
      {open && d && (
        <div role="dialog" aria-label="Choose landing time (UTC)" className="absolute bottom-full right-0 z-30 mb-1.5 rounded-sm border border-line bg-panel px-4 py-3 shadow-xl">
          <div className="flex items-center gap-1">
            <Wheel ariaLabel="Hour (UTC)" width={64} items={Array.from({ length: 24 }, (_, h) => ({ value: h, label: pad(h) }))} value={d.getUTCHours()} onChange={(h) => set(h, d.getUTCMinutes())} />
            <span className="num pb-0.5 text-lg font-medium">:</span>
            <Wheel ariaLabel="Minute" width={64} items={Array.from({ length: 60 }, (_, m) => ({ value: m, label: pad(m) }))} value={d.getUTCMinutes()} onChange={(m) => set(d.getUTCHours(), m)} />
            <span className="ml-2 text-sm text-faint">UTC</span>
          </div>
        </div>
      )}
    </div>
  );
}

const ITEM = 36;
const VISIBLE = 5;

/**
 * An iOS-style scroll wheel: snap scrolling, a highlighted centre band, items that tilt and fade away
 * from the centre. Scroll, click an item, or use the arrow keys.
 */
function Wheel<T extends number>({ items, value, onChange, ariaLabel, width }: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, items.findIndex((i) => i.value === value));
  const indexRef = useRef(index);

  const paint = () => {
    const el = ref.current;
    if (!el) return;
    const children = el.querySelectorAll<HTMLElement>("[data-wheel-item]");
    children.forEach((c, i) => {
      const off = (i * ITEM - el.scrollTop) / ITEM;
      const a = Math.min(Math.abs(off), 3);
      c.style.transform = `perspective(400px) rotateX(${-off * 20}deg)`;
      c.style.opacity = String(1 - a * 0.28);
    });
  };

  // Follow the value when it changes from outside (or on first open), without animating.
  useEffect(() => {
    indexRef.current = index;
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM;
    paint();
  }, [index]);

  const onScroll = () => {
    paint();
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
      if (i !== indexRef.current) {
        indexRef.current = i;
        onChange(items[i].value);
      }
    }, 90);
  };

  const go = (i: number) => ref.current?.scrollTo({ top: Math.min(items.length - 1, Math.max(0, i)) * ITEM, behavior: "smooth" });

  return (
    <div className="relative" style={{ width, height: ITEM * VISIBLE }}>
      <div className="pointer-events-none absolute inset-x-0 rounded-sm bg-panel-2" style={{ top: ITEM * 2, height: ITEM }} aria-hidden />
      <div
        ref={ref}
        role="spinbutton"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuenow={Number(value)}
        aria-valuetext={items[index]?.label}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            go(indexRef.current + (e.key === "ArrowDown" ? 1 : -1));
          }
        }}
        className="wheel relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-muted"
        style={{ paddingBlock: ITEM * 2 }}
      >
        {items.map((it, i) => (
          <div
            key={it.value}
            data-wheel-item
            onClick={() => go(i)}
            className={`num flex snap-center cursor-pointer items-center justify-center text-base ${i === index ? "font-medium text-fg" : "text-muted"}`}
            style={{ height: ITEM }}
          >
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}
