"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export interface UrlFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Filtres de liste synchronisés avec l'URL (partageables et indexables). */
export function UrlFilters({ filters, search = true, placeholder = "Rechercher…" }: { filters: UrlFilter[]; search?: boolean; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        update("q", q.trim());
      }}
    >
      {search ? (
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      ) : null}
      {filters.map((f) =>
        f.options.length ? (
          <select
            key={f.key}
            value={params.get(f.key) ?? ""}
            onChange={(e) => update(f.key, e.target.value)}
            aria-label={f.label}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
          >
            <option value="">{f.label} : tous</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null,
      )}
    </form>
  );
}
