"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import { date } from "@/lib/format";

export interface GanttTask {
  id: string;
  name: string;
  start?: string | null;
  end?: string | null;
  progress_pct?: number | string | null;
  status?: string | null;
  is_milestone?: boolean;
  critical?: boolean;
  baseline_start?: string | null;
  baseline_end?: string | null;
  level?: number;
  group?: string | null;
}

export interface GanttLink {
  from: string;
  to: string;
  type?: string;
}

const DAY = 86_400_000;
const ZOOMS = { semaine: 28, mois: 9, trimestre: 3.2 } as const;

function parse(d?: string | null): number | null {
  if (!d) return null;
  const t = Date.parse(d.length === 10 ? `${d}T00:00:00Z` : d);
  return Number.isNaN(t) ? null : t;
}

/** Diagramme de Gantt (lecture) : barres, avancement, jalons, référence (baseline), chemin critique, liens. */
export function Gantt({ tasks, links = [], onSelect, height }: { tasks: GanttTask[]; links?: GanttLink[]; onSelect?: (t: GanttTask) => void; height?: number }) {
  const [zoom, setZoom] = useState<keyof typeof ZOOMS>("mois");
  const dayWidth = ZOOMS[zoom];
  const rowH = 34;
  const labelW = 260;

  const { min, max, rows } = useMemo(() => {
    const valid = tasks.filter((t) => parse(t.start) !== null);
    const starts = valid.map((t) => parse(t.start)!);
    const ends = valid.map((t) => parse(t.end) ?? parse(t.start)!);
    const today = Date.now();
    const lo = Math.min(...starts, today) - 7 * DAY;
    const hi = Math.max(...ends, today) + 14 * DAY;
    return { min: lo, max: hi, rows: tasks };
  }, [tasks]);

  if (!tasks.length) return <p className="p-5 text-sm text-muted">Aucune tâche planifiée.</p>;
  const totalDays = Math.max(1, Math.ceil((max - min) / DAY));
  const width = totalDays * dayWidth;
  const x = (t: number) => ((t - min) / DAY) * dayWidth;
  const months: { label: string; left: number; width: number }[] = [];
  const cursor = new Date(min);
  cursor.setUTCDate(1);
  while (cursor.getTime() < max) {
    const start = Math.max(cursor.getTime(), min);
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)).getTime();
    months.push({ label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }), left: x(start), width: x(Math.min(next, max)) - x(start) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const index = new Map(rows.map((t, i) => [t.id, i]));
  const todayX = x(Date.now());

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center justify-end gap-1 border-b border-line px-3 py-2 text-xs">
        <span className="mr-2 text-muted">Échelle</span>
        {(Object.keys(ZOOMS) as (keyof typeof ZOOMS)[]).map((z) => (
          <button key={z} type="button" onClick={() => setZoom(z)} className={clsx("rounded-lg px-2.5 py-1 capitalize", zoom === z ? "bg-brand-500 text-white" : "hover:bg-slate-100")}>
            {z}
          </button>
        ))}
      </div>
      <div className="flex overflow-auto" style={{ maxHeight: height ?? 560 }}>
        <div className="sticky left-0 z-10 shrink-0 border-r border-line bg-white" style={{ width: labelW }}>
          <div className="h-9 border-b border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-muted">Tâche</div>
          {rows.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect?.(t)}
              className="flex w-full items-center truncate border-b border-line/60 px-3 text-left text-xs hover:bg-brand-50"
              style={{ height: rowH, paddingLeft: 12 + (t.level ?? 0) * 14 }}
              title={`${t.name} — ${date(t.start)} → ${date(t.end)}`}
            >
              <span className={clsx("truncate", t.critical && "font-semibold text-red-700", t.is_milestone && "font-semibold")}>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="relative shrink-0" style={{ width }}>
          <div className="sticky top-0 z-[5] h-9 border-b border-line bg-slate-50">
            {months.map((m) => (
              <div key={`${m.label}-${m.left}`} className="absolute top-0 h-full border-l border-line px-1.5 py-2 text-[11px] font-medium uppercase text-muted" style={{ left: m.left, width: m.width }}>
                {m.label}
              </div>
            ))}
          </div>
          <div className="relative" style={{ height: rows.length * rowH }}>
            {months.map((m) => (
              <div key={`grid-${m.left}`} className="absolute inset-y-0 border-l border-line/60" style={{ left: m.left }} />
            ))}
            {rows.map((_, i) => (
              <div key={i} className="absolute inset-x-0 border-b border-line/60" style={{ top: (i + 1) * rowH - 1 }} />
            ))}
            <div className="absolute inset-y-0 w-0.5 bg-accent-500/70" style={{ left: todayX }} title="Aujourd'hui" />
            <svg className="pointer-events-none absolute inset-0" width={width} height={rows.length * rowH}>
              {links.map((l, k) => {
                const a = index.get(l.from);
                const b = index.get(l.to);
                if (a === undefined || b === undefined) return null;
                const ta = rows[a];
                const tb = rows[b];
                const ax = x(parse(ta.end) ?? parse(ta.start) ?? min);
                const bx = x(parse(tb.start) ?? min);
                const ay = a * rowH + rowH / 2;
                const by = b * rowH + rowH / 2;
                return <path key={k} d={`M${ax},${ay} H${ax + 8} V${by} H${bx}`} fill="none" stroke="#94a3b8" strokeWidth={1.2} markerEnd="url(#arrow)" />;
              })}
              <defs>
                <marker id="arrow" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>
            {rows.map((t, i) => {
              const s = parse(t.start);
              if (s === null) return null;
              const e = Math.max(parse(t.end) ?? s, s);
              const top = i * rowH + 7;
              const pct = Math.max(0, Math.min(100, Number(t.progress_pct ?? 0)));
              if (t.is_milestone)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect?.(t)}
                    className={clsx("absolute h-4 w-4 rotate-45 rounded-sm", pct >= 100 || t.status === "achieved" ? "bg-emerald-500" : "bg-accent-500")}
                    style={{ left: x(s) - 8, top: top + 3 }}
                    title={`${t.name} — ${date(t.start)}`}
                  />
                );
              const bs = parse(t.baseline_start);
              const be = parse(t.baseline_end);
              return (
                <div key={t.id}>
                  {bs !== null && be !== null ? <div className="absolute h-1.5 rounded bg-slate-300" style={{ left: x(bs), width: Math.max(4, x(be + DAY) - x(bs)), top: top + 20 }} title="Référence" /> : null}
                  <button
                    type="button"
                    onClick={() => onSelect?.(t)}
                    className={clsx("absolute overflow-hidden rounded-md text-left text-[10px] text-white", t.critical ? "bg-red-400" : t.status === "done" ? "bg-emerald-400" : t.status === "blocked" ? "bg-slate-400" : "bg-brand-400")}
                    style={{ left: x(s), width: Math.max(6, x(e + DAY) - x(s)), top, height: 18 }}
                    title={`${t.name} — ${date(t.start)} → ${date(t.end)} · ${pct.toFixed(0)} %`}
                  >
                    <span className={clsx("absolute inset-y-0 left-0", t.critical ? "bg-red-600" : t.status === "done" ? "bg-emerald-600" : "bg-brand-600")} style={{ width: `${pct}%` }} />
                    <span className="relative px-1.5 leading-[18px]">{pct ? `${pct.toFixed(0)} %` : ""}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
