"use client";

import clsx from "clsx";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { useDebounce } from "@/lib/hooks";
import { fieldLabel } from "@/lib/labels";
import type { RefSource } from "@/lib/refs";
import { controlClass } from "@/components/ui/form";

function resolvePath(source: RefSource, context: Record<string, any>): { path: string | null; missing: string[] } {
  const missing: string[] = [];
  const path = source.path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = context[key];
    if (!v) missing.push(key);
    return v ? String(v) : "";
  });
  return { path: missing.length ? null : path, missing };
}

function useOptions(source: RefSource, context: Record<string, any>, search: string, enabled: boolean) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { path, missing } = resolvePath(source, context);
  const depValues = (source.dependsOn ?? []).filter((k) => !source.path.includes(`{${k}}`)).map((k) => [k, context[k]] as const);
  const key = JSON.stringify([path, depValues, search, source.query]);
  useEffect(() => {
    if (!enabled || !path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query: Record<string, any> = { ...(source.query ?? {}) };
    depValues.forEach(([k, v]) => {
      if (v) query[k] = v;
    });
    if (source.paginated) {
      query.page_size = 100;
      if (search && source.searchable) query.q = search;
    }
    api<any>(path, { query })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.items ?? []);
        setRows(list);
      })
      .catch(() => !cancelled && setError("Liste indisponible"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { rows, loading, error, missing };
}

export function RefSelect({
  source,
  value,
  onChange,
  context = {},
  placeholder = "Sélectionner…",
  disabled,
  invalid,
  allowClear = true,
  id,
}: {
  source: RefSource;
  value: string | null | undefined;
  onChange: (value: string | null, row?: any) => void;
  context?: Record<string, any>;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  allowClear?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const search = useDebounce(text, 250);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const { rows, loading, error, missing } = useOptions(source, context, search, open || (!!value && !selectedRow));
  const missingDeps = (source.dependsOn ?? []).filter((k) => !context[k] && source.path.includes(`{${k}}`));
  const blocked = missing.length > 0 || missingDeps.length > 0;

  useEffect(() => {
    if (!value) {
      setSelectedRow(null);
      return;
    }
    const found = rows.find((r) => String(r.id) === String(value));
    if (found) setSelectedRow(found);
  }, [value, rows]);

  // Libellé d'une valeur initiale absente de la première page de résultats.
  useEffect(() => {
    if (!value || selectedRow || source.path.includes("{") || !source.paginated) return;
    let cancelled = false;
    api<any>(`${source.path}/${value}`)
      .then((row) => !cancelled && row && setSelectedRow(row))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value, selectedRow, source]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!text || (source.paginated && source.searchable)) return rows;
    const t = text.toLowerCase();
    return rows.filter((r) => `${source.label(r)} ${source.sublabel?.(r) ?? ""}`.toLowerCase().includes(t));
  }, [rows, text, source]);

  const label = selectedRow ? source.label(selectedRow) : value ? "…" : "";

  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled || blocked}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(controlClass, "flex items-center justify-between gap-2 text-left", invalid && "border-red-400")}
      >
        <span className={clsx("truncate", !label && "text-slate-400")}>
          {blocked ? `Choisissez d'abord : ${[...missing, ...missingDeps].map(fieldLabel).join(", ")}` : label || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-muted">
          {value && allowClear && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              aria-label="Effacer"
              className="rounded p-0.5 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      {open ? (
        <div className="absolute z-[90] mt-1 w-full min-w-[16rem] rounded-xl border border-line bg-white shadow-xl">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-line px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </li>
            ) : error ? (
              <li className="px-3 py-2 text-sm text-red-600">{error}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">Aucun résultat</li>
            ) : (
              filtered.map((row) => {
                const selected = String(row.id) === String(value);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setSelectedRow(row);
                        onChange(String(row.id), row);
                        setOpen(false);
                        setText("");
                      }}
                      className={clsx("flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50", selected && "bg-brand-50")}
                    >
                      <Check className={clsx("mt-0.5 h-4 w-4 shrink-0 text-brand-500", !selected && "invisible")} />
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{source.label(row)}</span>
                        {source.sublabel?.(row) ? <span className="block truncate text-xs text-muted">{source.sublabel(row)}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function MultiRefSelect({
  source,
  value,
  onChange,
  context = {},
  placeholder = "Ajouter…",
  disabled,
}: {
  source: RefSource;
  value: string[];
  onChange: (value: string[]) => void;
  context?: Record<string, any>;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const { rows } = useOptions(source, context, "", value.length > 0);
  useEffect(() => {
    if (!rows.length) return;
    setLabels((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        next[String(r.id)] = source.label(r);
      });
      return next;
    });
  }, [rows, source]);
  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">
              {labels[v] ?? "…"}
              {!disabled ? (
                <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label="Retirer">
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      {!disabled ? (
        <RefSelect
          source={source}
          value={null}
          context={context}
          placeholder={placeholder}
          allowClear={false}
          onChange={(id, row) => {
            if (!id || value.includes(id)) return;
            if (row) setLabels((prev) => ({ ...prev, [id]: source.label(row) }));
            onChange([...value, id]);
          }}
        />
      ) : null}
    </div>
  );
}
