import clsx from "clsx";
import Link from "next/link";

export function Pager({ page, pages, basePath, params }: { page: number; pages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && k !== "page") qs.set(k, v);
    });
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2);
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-lg px-3 py-2 text-sm text-brand-700 hover:bg-brand-50" rel="prev">
          Précédent
        </Link>
      ) : null}
      {numbers.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - numbers[i - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={clsx("min-w-[2.5rem] rounded-lg px-3 py-2 text-center text-sm", p === page ? "bg-brand-500 font-semibold text-white" : "text-ink hover:bg-brand-50")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-lg px-3 py-2 text-sm text-brand-700 hover:bg-brand-50" rel="next">
          Suivant
        </Link>
      ) : null}
    </nav>
  );
}
