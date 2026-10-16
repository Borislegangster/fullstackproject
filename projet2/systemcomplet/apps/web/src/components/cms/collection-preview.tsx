"use client";

import clsx from "clsx";
import { ExternalLink, LayoutGrid, Monitor, Smartphone, Tablet, X } from "lucide-react";
import { useState } from "react";

import { Blocks } from "@/components/site/blocks";
import { MediaImage } from "@/components/site/media";
import { Modal } from "@/components/ui/overlay";
import { Alert, StatusBadge } from "@/components/ui/primitives";
import type { Block, Media } from "@/lib/cms-types";

type Row = Record<string, any>;

export interface CollectionPreviewPayload {
  kind: string;
  title?: string | null;
  status?: string | null;
  path?: string | null;
  token?: string | null;
  card?: { kind: string; item: Row } | null;
  data?: Row;
}

const DEVICES = [
  { key: "desktop", label: "Ordinateur", icon: Monitor, width: "100%" },
  { key: "tablet", label: "Tablette", icon: Tablet, width: "820px" },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: "390px" },
] as const;

const CARD_TITLES: Record<string, string> = {
  universes: "Carte dans « Nos univers »",
  offers: "Carte dans la liste des offres",
  projects: "Carte dans « Nos réalisations »",
  blog: "Carte dans le blog",
  testimonials: "Témoignage tel qu'affiché",
  stats: "Chiffre clé tel qu'affiché",
  faq: "Question telle qu'affichée",
  banner: "Bannière telle qu'affichée",
};

function BannerPreview({ b }: { b: Row }) {
  const media = b.media as Media | null | undefined;
  if (b.kind === "popup")
    return (
      <div className="relative flex min-h-80 items-center justify-center rounded-2xl bg-slate-900/60 p-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          {media?.url ? <MediaImage media={media} className="h-40 w-full" sizes="28rem" /> : null}
          <div className="p-6">
            <p className="font-title text-xl font-bold text-brand-900">{b.title}</p>
            {b.content ? <p className="mt-2 text-sm text-muted">{b.content}</p> : null}
            {b.cta_label ? <span className="btn-glow mt-5 inline-flex">{b.cta_label}</span> : null}
          </div>
          {b.dismissible !== false ? <X className="absolute right-3 top-3 h-5 w-5 text-muted" /> : null}
        </div>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-brand-700 to-accent-500 px-5 py-3 text-sm text-white">
      <span className="font-semibold">{b.title}</span>
      {b.content ? <span className="text-white/85">{b.content}</span> : null}
      {b.cta_label ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-800">{b.cta_label}</span> : null}
    </div>
  );
}

function CardView({ card }: { card: { kind: string; item: Row } }) {
  if (card.kind === "banner") return <BannerPreview b={card.item} />;
  const block = { kind: card.kind, items: [card.item], layout: "grid", limit: 1 } as unknown as Block;
  return (
    <div className="mx-auto max-w-4xl">
      <Blocks blocks={[block]} />
    </div>
  );
}

/** Aperçu fidèle d'un élément de collection : page du site (même rendu que la vitrine) et carte des listes. */
export function CollectionPreview({ preview, onClose }: { preview: CollectionPreviewPayload; onClose: () => void }) {
  const hasPage = !!(preview.token && preview.path);
  const [tab, setTab] = useState<"page" | "card">(hasPage ? "page" : "card");
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const src = hasPage ? `/api/apercu?token=${encodeURIComponent(preview.token!)}&path=${encodeURIComponent(preview.path!)}` : "";
  const width = DEVICES.find((d) => d.key === device)?.width ?? "100%";
  return (
    <Modal open onClose={onClose} title={`Aperçu — ${preview.title ?? ""}`} size="full" description={preview.status ? <span className="inline-flex items-center gap-2">Statut : <StatusBadge status={preview.status} /> {preview.status !== "published" ? "· visible uniquement par vous dans cet aperçu" : ""}</span> : undefined}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {hasPage ? (
              <button type="button" onClick={() => setTab("page")} className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold", tab === "page" ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>
                <Monitor className="h-4 w-4" /> Page du site
              </button>
            ) : null}
            {preview.card ? (
              <button type="button" onClick={() => setTab("card")} className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold", tab === "card" ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>
                <LayoutGrid className="h-4 w-4" /> {CARD_TITLES[preview.card.kind] ?? "Carte dans les listes"}
              </button>
            ) : null}
          </div>
          {tab === "page" && hasPage ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Format d'écran">
                {DEVICES.map((d) => {
                  const Icon = d.icon;
                  return (
                    <button key={d.key} type="button" aria-pressed={device === d.key} title={d.label} onClick={() => setDevice(d.key)} className={clsx("rounded-lg px-2.5 py-1.5", device === d.key ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>
                      <Icon className="h-4 w-4" />
                      <span className="sr-only">{d.label}</span>
                    </button>
                  );
                })}
              </div>
              <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">
                <ExternalLink className="h-4 w-4" /> Ouvrir dans un onglet
              </a>
            </div>
          ) : null}
        </div>

        {tab === "page" && hasPage ? (
          <div className="flex justify-center rounded-2xl bg-slate-100 p-3">
            <iframe key={`${src}-${device}`} src={src} title={`Aperçu de ${preview.title ?? "la page"}`} className="h-[72vh] rounded-xl bg-white shadow-lg ring-1 ring-line transition-all" style={{ width, maxWidth: "100%" }} />
          </div>
        ) : null}
        {tab === "card" && preview.card ? (
          <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
            <CardView card={preview.card} />
          </div>
        ) : null}
        {!hasPage && !preview.card ? <Alert tone="info">Cet élément n&apos;a pas de rendu propre sur le site : il est utilisé par d&apos;autres pages.</Alert> : null}
      </div>
    </Modal>
  );
}
