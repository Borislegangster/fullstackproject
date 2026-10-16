"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useEffect, useState } from "react";

import { Lightbox } from "@/components/ui/lightbox";
import type { Media } from "@/lib/cms-types";

import { MediaImage } from "./media";

const full = (m: Media) => m.variants?.lg?.url ?? m.url ?? "";

/** Carrousel cinématographique : fondu enchaîné + Ken Burns, défilement automatique, pellicule de vignettes. */
export function GalleryCarousel({ medias }: { medias: Media[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const count = medias.length;
  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearTimeout(id);
  }, [index, paused, count]);
  if (!count) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const current = medias[index % count];
  return (
    <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="group relative aspect-[16/9] overflow-hidden rounded-[2rem] bg-night shadow-2xl ring-1 ring-black/5">
        {medias.map((m, i) => (
          <div key={m.id} className={clsx("absolute inset-0 transition-opacity duration-1000", i === index ? "opacity-100" : "opacity-0")} aria-hidden={i !== index}>
            <div key={i === index ? `on-${index}` : "off"} className={clsx("h-full w-full", i === index && "ken-burns")}>
              <MediaImage media={m} className="h-full w-full" sizes="(min-width: 1280px) 1200px, 100vw" />
            </div>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night-950/80 to-transparent" />
        {current.caption ? <p className="absolute bottom-5 left-6 right-24 text-sm font-medium text-white">{current.caption}</p> : null}
        <span className="glass-dark absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums text-white">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        <button type="button" onClick={() => setZoom(index)} className="glass-dark absolute bottom-5 right-5 rounded-full p-2.5 text-white transition hover:bg-white/20" aria-label="Agrandir l'image">
          <Expand className="h-4 w-4" />
        </button>
        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} className="glass-dark absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-3 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Image précédente">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="glass-dark absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-3 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Image suivante">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {medias.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setIndex(i)}
              className={clsx("relative h-16 w-24 shrink-0 overflow-hidden rounded-xl transition sm:h-20 sm:w-32", i === index ? "ring-2 ring-accent-500 ring-offset-2" : "opacity-60 hover:opacity-100")}
              aria-label={`Image ${i + 1}`}
              aria-current={i === index}
            >
              <MediaImage media={m} className="h-full w-full" sizes="128px" />
            </button>
          ))}
        </div>
      ) : null}
      <Lightbox items={medias.map((m) => ({ url: full(m), caption: m.caption ?? m.alt }))} index={zoom} onClose={() => setZoom(null)} onIndex={setZoom} />
    </div>
  );
}

/** Grille / mosaïque d'images avec agrandissement plein écran (visionneuse au clavier). */
export function GalleryGrid({ medias, masonry = false }: { medias: Media[]; masonry?: boolean }) {
  const [zoom, setZoom] = useState<number | null>(null);
  return (
    <>
      <div className={clsx(masonry ? "columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
        {medias.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setZoom(i)}
            className={clsx("img-zoom group relative block w-full overflow-hidden rounded-[1.5rem] bg-night text-left shadow-[var(--shadow-card)]", !masonry && "aspect-[4/3]")}
            aria-label={`Agrandir : ${m.alt || m.title || `image ${i + 1}`}`}
          >
            <MediaImage media={m} className={clsx("w-full", !masonry && "h-full")} sizes="(min-width: 1024px) 33vw, 100vw" />
            <span className="absolute inset-0 bg-gradient-to-t from-night-950/70 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
            <span className="glass-dark absolute right-4 top-4 rounded-full p-2 text-white opacity-0 transition duration-500 group-hover:opacity-100">
              <Expand className="h-4 w-4" />
            </span>
            {m.caption ? <span className="absolute bottom-4 left-4 right-4 translate-y-2 text-sm font-medium text-white opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">{m.caption}</span> : null}
          </button>
        ))}
      </div>
      <Lightbox items={medias.map((m) => ({ url: full(m), caption: m.caption ?? m.alt }))} index={zoom} onClose={() => setZoom(null)} onIndex={setZoom} />
    </>
  );
}
