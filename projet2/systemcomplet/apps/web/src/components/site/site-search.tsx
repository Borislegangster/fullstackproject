import { Search } from "lucide-react";
import type { ReactNode } from "react";

/** Formulaire de recherche du site : envoi GET classique vers /recherche (fonctionne même sans JavaScript). */
export function SiteSearchForm({ query, autoFocus = false }: { query: string; autoFocus?: boolean }) {
  return (
    <form action="/recherche" method="get" role="search" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Rechercher sur le site</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          key={query}
          type="search"
          name="q"
          defaultValue={query}
          required
          minLength={2}
          maxLength={100}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Une offre, un service, une question…"
          className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-ink shadow-lg ring-1 ring-white/20 placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-accent-400/60"
        />
      </label>
      <button type="submit" className="btn-glow h-14 shrink-0 !rounded-2xl !py-0">
        <Search className="h-5 w-5" /> Rechercher
      </button>
    </form>
  );
}

/** Extrait avec les termes trouvés surlignés (positions calculées par l'API, insensibles aux accents). */
export function Highlighted({ text, marks }: { text: string; marks?: number[][] }) {
  if (!marks?.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of marks) {
    if (start < pos || end > text.length) continue;
    if (start > pos) parts.push(text.slice(pos, start));
    parts.push(
      <mark key={start} className="rounded bg-accent-100 px-0.5 text-ink">
        {text.slice(start, end)}
      </mark>,
    );
    pos = end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}
