"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { number } from "@/lib/format";

export const PALETTE = ["#385AA6", "#FB8C43", "#16a34a", "#8aa1d6", "#fda96f", "#d97706", "#2f4c8d", "#dc2626", "#5f7ec2", "#b8591a"];

export interface Serie {
  key: string;
  label: string;
  color?: string;
}

const compact = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} Md`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)} k`;
  return number(n, 1);
};

function NoData({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-slate-50 text-sm text-muted" style={{ height }}>
      Pas encore de données sur la période
    </div>
  );
}

export function LineChartCard({ data, x, series, height = 260, area = false }: { data: Record<string, any>[]; x: string; series: Serie[]; height?: number; area?: boolean }) {
  if (!data.length) return <NoData height={height} />;
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ec" />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} stroke="#5d6578" />
        <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} stroke="#5d6578" width={52} />
        <Tooltip formatter={(v) => number(v as number, 2)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) =>
          area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i % PALETTE.length]} fill={s.color ?? PALETTE[i % PALETTE.length]} fillOpacity={0.15} strokeWidth={2} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

export function BarChartCard({ data, x, series, height = 260, horizontal = false, stacked = false }: { data: Record<string, any>[]; x: string; series: Serie[]; height?: number; horizontal?: boolean; stacked?: boolean }) {
  if (!data.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 24 : 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ec" />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11 }} stroke="#5d6578" />
            <YAxis type="category" dataKey={x} tick={{ fontSize: 11 }} stroke="#5d6578" width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={{ fontSize: 11 }} stroke="#5d6578" />
            <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} stroke="#5d6578" width={52} />
          </>
        )}
        <Tooltip formatter={(v) => number(v as number, 2)} />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} stackId={stacked ? "a" : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240 }: { data: { name: string; value: number }[]; height?: number }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
          {filtered.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => number(v as number, 2)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
