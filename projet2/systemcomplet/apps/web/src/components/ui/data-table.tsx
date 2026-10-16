"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { date, dateTime, money, number, percent } from "@/lib/format";
import type { UseList } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

import { Alert, Button, EmptyState, Skeleton, StatusBadge } from "./primitives";
import { SearchInput, Select, type Option } from "./form";

export type CellFormat = "money" | "date" | "datetime" | "status" | "number" | "percent" | "bool" | "option" | "text";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  format?: CellFormat;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  hideOnMobile?: boolean;
}

export function formatCell(value: unknown, format: CellFormat = "text", row?: any): ReactNode {
  switch (format) {
    case "money":
      return money(value, row?.currency === "XAF" || !row?.currency ? "FCFA" : row.currency);
    case "date":
      return date(value);
    case "datetime":
      return dateTime(value);
    case "status":
      return <StatusBadge status={value as string} />;
    case "number":
      return number(value, 2);
    case "percent":
      return percent(value, 0);
    case "bool":
      return value ? "Oui" : "Non";
    case "option":
      return optionLabel(value);
    default:
      if (value === null || value === undefined || value === "") return "—";
      if (Array.isArray(value)) return value.map((v) => optionLabel(v)).join(", ");
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
  }
}

export interface FilterDef {
  key: string;
  label: string;
  options: Option[];
}

export function DataTable<T extends Record<string, any>>({
  columns,
  list,
  rows,
  loading,
  error,
  onRowClick,
  rowActions,
  filters,
  toolbar,
  searchable = true,
  empty,
  rowKey = (row: T) => String(row.id ?? JSON.stringify(row)),
  compact,
}: {
  columns: Column<T>[];
  list?: UseList<T>;
  rows?: T[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  filters?: FilterDef[];
  toolbar?: ReactNode;
  searchable?: boolean;
  empty?: { title: string; text?: ReactNode; action?: ReactNode };
  rowKey?: (row: T) => string;
  compact?: boolean;
}) {
  const data = list ? list.items : rows ?? [];
  const isLoading = list ? list.loading : !!loading;
  const err = list ? list.error : error;
  const sort = list?.state.sort;

  const toggleSort = (key: string) => {
    if (!list) return;
    if (sort === key) list.setSort(`-${key}`);
    else if (sort === `-${key}`) list.setSort(undefined);
    else list.setSort(key);
  };

  return (
    <div className="card overflow-hidden">
      {list && (searchable || filters?.length || toolbar) ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {searchable ? <SearchInput value={list.state.q} onChange={list.setQ} className="w-full sm:w-64" /> : null}
          {filters?.map((f) => (
            <Select
              key={f.key}
              aria-label={f.label}
              className="w-auto min-w-[10rem]"
              value={list.state.filters[f.key] ?? ""}
              onChange={(e) => list.setFilter(f.key, e.target.value)}
              options={f.options}
              placeholder={`${f.label} : tous`}
            />
          ))}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            <Button variant="ghost" size="sm" onClick={() => void list.reload()} aria-label="Actualiser" title="Actualiser">
              <RefreshCw className={clsx("h-4 w-4", list.loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      ) : null}
      {err ? (
        <div className="p-4">
          <Alert tone="danger" title="Chargement impossible">
            {err}
          </Alert>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={clsx(
                    "whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    c.hideOnMobile && "hidden md:table-cell",
                  )}
                >
                  {c.sortable && list ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort === c.key ? <ArrowUp className="h-3 w-3" /> : sort === `-${c.key}` ? <ArrowDown className="h-3 w-3" /> : null}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              {rowActions ? <th className="px-4 py-2.5" aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {isLoading && !data.length
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={clsx("px-4 py-3", c.hideOnMobile && "hidden md:table-cell")}>
                        <Skeleton className="h-4 w-full max-w-[10rem]" />
                      </td>
                    ))}
                    {rowActions ? <td /> : null}
                  </tr>
                ))
              : data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={clsx(onRowClick && "cursor-pointer hover:bg-brand-50/50", isLoading && "opacity-60")}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={clsx(
                          compact ? "px-4 py-2" : "px-4 py-3",
                          "align-middle text-ink",
                          c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
                          c.hideOnMobile && "hidden md:table-cell",
                          c.className,
                        )}
                      >
                        {c.render ? c.render(row) : formatCell(row[c.key], c.format, row)}
                      </td>
                    ))}
                    {rowActions ? (
                      <td className="whitespace-nowrap px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {rowActions(row)}
                      </td>
                    ) : null}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!isLoading && !err && !data.length ? (
        <div className="p-4">
          <EmptyState icon={<Inbox className="h-8 w-8" />} title={empty?.title ?? "Aucun élément"} text={empty?.text} action={empty?.action} />
        </div>
      ) : null}
      {list && list.total > 0 ? <Pagination list={list} /> : null}
    </div>
  );
}

export function Pagination<T>({ list }: { list: UseList<T> }) {
  const { page, pageSize } = list.state;
  const pages = Math.max(1, Math.ceil(list.total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(list.total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
      <span>
        {from}–{to} sur {list.total}
      </span>
      <div className="flex items-center gap-2">
        <select
          className="rounded-lg border border-line bg-white px-2 py-1 text-sm"
          value={pageSize}
          onChange={(e) => list.setPageSize(Number(e.target.value))}
          aria-label="Éléments par page"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => list.setPage(page - 1)} aria-label="Page précédente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => list.setPage(page + 1)} aria-label="Page suivante">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
