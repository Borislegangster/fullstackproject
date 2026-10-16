import clsx from "clsx";
import { ChevronRight, Compass } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import type { Media, PagePayload } from "@/lib/cms-types";
import { dateLong } from "@/lib/format";
import { breadcrumbLd, JsonLd, webPageLd } from "@/lib/seo";

import { SectionView } from "./blocks";
import { MediaImage } from "./media";

export function Breadcrumbs({ items, dark = false }: { items: { name: string; path: string }[]; dark?: boolean }) {
  return (
    <nav aria-label="Fil d'Ariane" className={clsx("text-sm", dark ? "text-brand-200" : "text-muted")}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" /> : null}
            {i === items.length - 1 ? (
              <span aria-current="page" className={dark ? "text-white" : "text-ink"}>
                {it.name}
              </span>
            ) : (
              <Link href={it.path} className={dark ? "transition hover:text-white" : "hover:text-brand-600"}>
                {it.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={breadcrumbLd(items)} />
    </nav>
  );
}

/** En-tête immersif des pages intérieures : nuit + grille technique + halos, visuel de couverture en Ken Burns. */
export function PageHeader({
  title,
  summary,
  crumbs,
  children,
  eyebrow,
  media,
  aside,
}: {
  title: string;
  summary?: string | null;
  crumbs?: { name: string; path: string }[];
  children?: ReactNode;
  eyebrow?: string | null;
  media?: Media | null;
  aside?: ReactNode;
}) {
  return (
    <header data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night pb-16 pt-32 text-white lg:-mt-20 lg:pb-24 lg:pt-44">
      {media?.url ? (
        <>
          <div className="ken-burns absolute inset-0 -z-20">
            <MediaImage media={media} className="h-full w-full" priority sizes="100vw" />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night-950/95 via-night-900/80 to-night-900/35" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-night-950/80 to-transparent" />
        </>
      ) : (
        <>
          <div className="aurora-blob -left-32 -top-24 -z-10 h-[30rem] w-[30rem] bg-brand-500/40" />
          <div className="aurora-blob -right-24 top-10 -z-10 h-[24rem] w-[24rem] bg-accent-500/25 [animation-delay:-6s]" />
        </>
      )}
      <div className="absolute inset-0 -z-10 bg-blueprint opacity-40 mask-radial" />
      <div className={clsx("container-page relative", aside && "grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]")}>
        <div>
          {crumbs ? <Breadcrumbs items={crumbs} dark /> : null}
          {eyebrow ? <p className="eyebrow fade-up mt-8 text-accent-300">{eyebrow}</p> : null}
          <h1 className="fade-up mt-4 max-w-4xl font-title text-4xl font-bold leading-[1.08] text-white sm:text-6xl" style={{ "--delay": "80ms" } as CSSProperties}>
            {title}
          </h1>
          {summary ? (
            <p className="fade-up mt-6 max-w-3xl text-lg leading-relaxed text-brand-100" style={{ "--delay": "180ms" } as CSSProperties}>
              {summary}
            </p>
          ) : null}
          {children ? (
            <div className="fade-up" style={{ "--delay": "280ms" } as CSSProperties}>
              {children}
            </div>
          ) : null}
        </div>
        {aside ? (
          <div className="fade-up" style={{ "--delay": "320ms" } as CSSProperties}>
            {aside}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Rendu d'une page CMS publiée : sections/blocs, ou corps légal ; données structurées associées. */
export function CmsPageView({ page, crumbs, after }: { page: PagePayload; crumbs?: { name: string; path: string }[]; after?: ReactNode }) {
  const hasHero = page.sections[0]?.blocks[0]?.kind === "hero";
  const h1 = page.seo?.h1 || page.title;
  return (
    <>
      <JsonLd data={[webPageLd(page.title, page.path, page.seo?.description ?? page.summary), ...page.schema_markup.map((s) => ({ "@context": "https://schema.org", "@type": s.type, ...s.data }))]} />
      {!hasHero ? <PageHeader title={h1} summary={page.summary} crumbs={crumbs ?? (page.path !== "/" ? [{ name: "Accueil", path: "/" }, { name: page.title, path: page.path }] : undefined)} /> : null}
      {page.template === "legal" ? (
        <div className="container-page py-12">
          <article className="prose-globus relative z-10 mx-auto -mt-20 max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-line sm:p-12">
            {page.body ? <div dangerouslySetInnerHTML={{ __html: page.body }} /> : null}
            {page.updated_at ? <p className="mt-8 text-xs text-muted">Dernière mise à jour : {dateLong(page.updated_at)}</p> : null}
          </article>
        </div>
      ) : null}
      {page.sections.map((section, i) => (
        <SectionView key={section.key} section={section} index={hasHero ? i : i + 1} />
      ))}
      {page.template !== "legal" && page.body ? (
        <div className="container-page py-12">
          <div className="prose-globus mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: page.body }} />
        </div>
      ) : null}
      {after}
    </>
  );
}

export function EmptyPublicState({ title = "Contenu en cours de publication", text, standalone = false }: { title?: string; text?: ReactNode; standalone?: boolean }) {
  if (!standalone)
    return (
      <div className="container-page py-20">
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[2rem] bg-white px-6 py-14 text-center shadow-xl ring-1 ring-line">
          <div className="absolute inset-0 bg-blueprint-light mask-radial" />
          <span className="relative mx-auto inline-flex rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white shadow-lg shadow-brand-500/30">
            <Compass className="h-8 w-8" />
          </span>
          <h2 className="relative mt-6 font-title text-2xl font-bold text-brand-900">{title}</h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">{text ?? "Ces contenus seront publiés très prochainement. En attendant, parlons de votre projet."}</p>
          <Link href="/contact" className="btn-brand relative mt-8">
            Nous contacter
          </Link>
        </div>
      </div>
    );
  return (
    <div data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night px-4 pb-24 pt-40 text-center text-white lg:-mt-20 lg:pt-48">
      <div className="absolute inset-0 -z-10 bg-blueprint opacity-40 mask-radial" />
      <div className="aurora-blob left-1/4 top-10 -z-10 h-80 w-80 bg-brand-500/40" />
      <span className="mx-auto inline-flex rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
        <Compass className="h-10 w-10 animate-spin-slow text-accent-400" />
      </span>
      <p className="eyebrow mt-8 justify-center text-accent-300">GLOBUS ENGINEERING</p>
      <h1 className="mt-4 font-title text-3xl font-bold text-white sm:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-brand-100">{text ?? "Cette page n'a pas encore été publiée. Revenez bientôt ou contactez-nous."}</p>
      <div className="mt-10 flex justify-center gap-3">
        <Link href="/contact" className="btn-glow">
          Nous contacter
        </Link>
        <Link href="/" className="btn-glass">
          Accueil
        </Link>
      </div>
    </div>
  );
}
