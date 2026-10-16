"use client";

import clsx from "clsx";
import { ArrowRight, BookOpen, ChevronRight, ExternalLink, Info, Lightbulb, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useApi, useDebounce } from "@/lib/hooks";

type Span = { t: "text" | "b" | "code"; v: string } | { t: "route" | "ext"; v: string; href: string } | { t: "doc"; v: string; id: string };

type DocBlock =
  | { type: "h2" | "h3"; text: string; anchor: string }
  | { type: "p" | "note" | "warning" | "tip"; spans: Span[] }
  | { type: "ul" | "ol"; items: Span[][] }
  | { type: "table"; rows: Span[][][] };

interface DocItem {
  id: string;
  title: string;
  space: string;
  section: string;
  summary: string;
  route?: string | null;
}

interface DocPage extends DocItem {
  space_label: string;
  blocks: DocBlock[];
  toc: { text: string; anchor: string }[];
  related: { id: string; title: string }[];
}

interface SearchHit {
  id: string;
  title: string;
  space: string;
  section: string;
  heading?: string | null;
  anchor?: string | null;
  snippet: string;
}

const SPACE_OF_BASE: Record<string, string> = { "/erp": "erp", "/espace-client": "client", "/extranet": "extranet" };

function Inline({ spans, base, docHref }: { spans: Span[]; base: string; docHref: (id: string) => string }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.t === "b") return <strong key={i} className="font-semibold text-ink">{s.v}</strong>;
        if (s.t === "code") return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] text-brand-800">{s.v}</code>;
        if (s.t === "doc") return <Link key={i} href={docHref(s.id)} className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500">{s.v}</Link>;
        if (s.t === "route")
          return s.href.startsWith(`${base}/`) || s.href === base ? (
            <Link key={i} href={s.href} className="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
              {s.v}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <strong key={i} className="font-semibold text-ink">{s.v}</strong>
          );
        if (s.t === "ext")
          return (
            <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
              {s.v}
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        return <Fragment key={i}>{s.v}</Fragment>;
      })}
    </>
  );
}

const CALLOUT = {
  note: { icon: Info, cls: "border-brand-200 bg-brand-50/70 text-brand-900", label: "À savoir" },
  tip: { icon: Lightbulb, cls: "border-emerald-200 bg-emerald-50/70 text-emerald-900", label: "Astuce" },
  warning: { icon: TriangleAlert, cls: "border-amber-200 bg-amber-50/80 text-amber-900", label: "Attention" },
};

export function DocContent({ blocks, base, docHref }: { blocks: DocBlock[]; base: string; docHref: (id: string) => string }) {
  return (
    <div className="space-y-4 text-[0.95rem] leading-relaxed text-ink/90">
      {blocks.map((b, i) => {
        if (b.type === "h2")
          return (
            <h2 key={i} id={b.anchor} className="scroll-mt-24 pt-4 font-title text-xl font-bold text-brand-800">
              {b.text}
            </h2>
          );
        if (b.type === "h3")
          return (
            <h3 key={i} id={b.anchor} className="scroll-mt-24 pt-2 text-base font-semibold text-ink">
              {b.text}
            </h3>
          );
        if (b.type === "p")
          return (
            <p key={i}>
              <Inline spans={b.spans} base={base} docHref={docHref} />
            </p>
          );
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type === "ol" ? "ol" : "ul";
          return (
            <List key={i} className={clsx("space-y-1.5 pl-5", b.type === "ol" ? "list-decimal marker:font-semibold marker:text-brand-600" : "list-disc marker:text-accent-500")}>
              {b.items.map((item, j) => (
                <li key={j} className="pl-1">
                  <Inline spans={item} base={base} docHref={docHref} />
                </li>
              ))}
            </List>
          );
        }
        if (b.type === "table")
          return (
            <div key={i} className="overflow-x-auto rounded-xl ring-1 ring-line">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {(b.rows[0] ?? []).map((cell, j) => (
                      <th key={j} className="px-3 py-2">
                        <Inline spans={cell} base={base} docHref={docHref} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {b.rows.slice(1).map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 align-top">
                          <Inline spans={cell} base={base} docHref={docHref} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (b.type !== "note" && b.type !== "warning" && b.type !== "tip") return null;
        const callout = CALLOUT[b.type];
        const Icon = callout.icon;
        return (
          <div key={i} className={clsx("flex gap-3 rounded-xl border p-3.5 text-sm", callout.cls)} role="note">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">{callout.label} : </span>
              <Inline spans={b.spans} base={base} docHref={docHref} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Centre de documentation : sommaire, recherche et pages filtrés par l'API selon les droits de l'utilisateur. */
export function DocsCenter({ base }: { base: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const docId = params.get("doc");
  const route = params.get("route");
  const summary = useApi<{ spaces: { key: string; label: string }[]; items: DocItem[] }>("/documentation");
  const page = useApi<DocPage>(docId ? `/documentation/${encodeURIComponent(docId)}` : null, undefined, [docId]);
  const [q, setQ] = useState("");
  const query = useDebounce(q.trim(), 300);
  const hits = useApi<SearchHit[]>(query.length >= 2 ? "/documentation/search" : null, { q: query }, [query]);
  const [space, setSpace] = useState(SPACE_OF_BASE[base] ?? "erp");
  const docHref = (id: string) => `${pathname}?doc=${encodeURIComponent(id)}`;

  // Aide contextuelle : « ?route=/erp/finances » ouvre la page qui documente cet écran.
  useEffect(() => {
    if (!route) return;
    api<{ id: string }>("/documentation/route", { query: { path: route } })
      .then((r) => router.replace(docHref(r.id)))
      .catch(() => router.replace(pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    if (page.data?.space) setSpace(page.data.space);
  }, [page.data?.space]);

  const sections = useMemo(() => {
    const groups = new Map<string, DocItem[]>();
    (summary.data?.items ?? [])
      .filter((d) => d.space === space)
      .forEach((d) => groups.set(d.section, [...(groups.get(d.section) ?? []), d]));
    return [...groups.entries()];
  }, [summary.data, space]);
  const spaces = summary.data?.spaces ?? [];

  const nav = (
    <nav aria-label="Sommaire de la documentation" className="space-y-5">
      {spaces.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {spaces.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={space === s.key}
              onClick={() => setSpace(s.key)}
              className={clsx("rounded-full px-3 py-1 text-xs font-semibold ring-1 transition", space === s.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-muted ring-line hover:text-ink")}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      {sections.map(([section, items]) => (
        <div key={section}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{section}</p>
          <ul className="space-y-0.5">
            {items.map((d) => (
              <li key={d.id}>
                <Link
                  href={docHref(d.id)}
                  className={clsx("block rounded-lg px-2.5 py-1.5 text-sm transition", d.id === docId ? "bg-brand-50 font-semibold text-brand-700" : "text-ink/80 hover:bg-slate-100 hover:text-ink")}
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  let body: React.ReactNode;
  if (query.length >= 2) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          {hits.loading ? "Recherche…" : `${hits.data?.length ?? 0} résultat(s) pour « ${query} » dans les pages auxquelles vous avez accès`}
        </p>
        {(hits.data ?? []).map((h) => (
          <Link
            key={h.id}
            href={`${docHref(h.id)}${h.anchor ? `#${h.anchor}` : ""}`}
            onClick={() => setQ("")}
            className="block rounded-2xl bg-white p-4 ring-1 ring-line transition hover:ring-brand-300"
          >
            <p className="text-xs text-muted">
              {h.section}
              {h.heading ? ` › ${h.heading}` : ""}
            </p>
            <p className="font-semibold text-brand-800">{h.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{h.snippet}</p>
          </Link>
        ))}
      </div>
    );
  } else if (docId) {
    if (page.loading && !page.data) body = <Skeleton className="h-96 w-full" />;
    else if (!page.data)
      body = <EmptyState icon={<BookOpen className="h-8 w-8" />} title="Page indisponible" text="Cette page n'existe pas ou ne concerne pas votre profil." />;
    else {
      const d = page.data;
      body = (
        <article className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {d.space_label} <ChevronRight className="h-3 w-3" /> {d.section}
          </p>
          <h1 className="mt-1 font-title text-2xl font-bold text-ink sm:text-3xl">{d.title}</h1>
          <p className="mt-2 text-muted">{d.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {d.route && (d.route === base || d.route.startsWith(`${base}/`)) ? (
              <Link href={d.route} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Ouvrir l&apos;écran <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            {d.toc.map((t) => (
              <a key={t.anchor} href={`#${t.anchor}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink/80 hover:bg-brand-50 hover:text-brand-700">
                {t.text}
              </a>
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-2">
            <DocContent blocks={d.blocks} base={base} docHref={docHref} />
          </div>
          {d.related.length ? (
            <div className="mt-8 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <p className="text-sm font-semibold text-ink">Voir aussi</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {d.related.map((r) => (
                  <li key={r.id}>
                    <Link href={docHref(r.id)} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-brand-700 ring-1 ring-line hover:ring-brand-300">
                      {r.title} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      );
    }
  } else {
    body = summary.loading && !summary.data ? (
      <Skeleton className="h-96 w-full" />
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(([section, items]) => (
          <div key={section} className="rounded-2xl bg-white p-5 ring-1 ring-line">
            <p className="font-title text-lg font-bold text-brand-800">{section}</p>
            <ul className="mt-3 space-y-2">
              {items.map((d) => (
                <li key={d.id}>
                  <Link href={docHref(d.id)} className="group block">
                    <span className="flex items-center gap-1 text-sm font-semibold text-ink group-hover:text-brand-700">
                      {d.title} <ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                    </span>
                    <span className="line-clamp-2 text-xs text-muted">{d.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-brand-600" /> Documentation
          </span>
        }
        subtitle="Guides pas à pas adaptés à votre profil : seules les fonctions auxquelles vous avez accès y figurent."
      />
      <label className="relative block max-w-xl">
        <span className="sr-only">Rechercher dans la documentation</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une fonction, un écran, une action…"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <details className="rounded-2xl bg-white p-4 ring-1 ring-line lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Sommaire</summary>
            <div className="mt-3">{nav}</div>
          </details>
          <div className="hidden lg:block">{nav}</div>
        </aside>
        <div className="min-w-0">{body}</div>
      </div>
    </div>
  );
}
