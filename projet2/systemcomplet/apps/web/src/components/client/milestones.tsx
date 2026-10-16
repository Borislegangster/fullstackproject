import clsx from "clsx";
import { CheckCircle2, Circle, Clock } from "lucide-react";

import { date } from "@/lib/format";
import { optionLabel } from "@/lib/labels";

export interface MilestoneRow {
  id: string;
  name: string;
  description?: string | null;
  due_date: string;
  achieved_at?: string | null;
  status: string;
  payment_pct?: string | number | null;
}

/** Frise des jalons (atteints, à venir, en retard). */
export function MilestoneTimeline({ items }: { items: MilestoneRow[] }) {
  if (!items.length) return <p className="text-sm text-muted">Aucun jalon publié.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ol className="relative space-y-4 border-l-2 border-brand-100 pl-6">
      {items.map((m) => {
        const done = m.status === "achieved" || !!m.achieved_at;
        const late = !done && m.due_date < today;
        return (
          <li key={m.id} className="relative">
            <span className={clsx("absolute -left-[2.05rem] top-0.5 rounded-full bg-white", done ? "text-emerald-600" : late ? "text-red-500" : "text-brand-400")}>
              {done ? <CheckCircle2 className="h-5 w-5" /> : late ? <Clock className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
            </span>
            <p className="text-sm font-semibold text-ink">{m.name}</p>
            <p className="text-xs text-muted">
              {done ? `Atteint le ${date(m.achieved_at ?? m.due_date)}` : `Prévu le ${date(m.due_date)}`}
              {late ? " · en retard" : ""} · {optionLabel(m.status)}
            </p>
            {m.description ? <p className="mt-1 text-sm text-muted">{m.description}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
