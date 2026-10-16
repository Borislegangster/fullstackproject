"use client";

import { MoveHorizontal } from "lucide-react";
import { useState } from "react";

import type { Media } from "@/lib/cms-types";

import { MediaImage } from "./media";

export function BeforeAfterSlider({ before, after, caption }: { before: Media; after: Media; caption?: string | null }) {
  const [pos, setPos] = useState(50);
  return (
    <figure>
      <div className="relative aspect-[4/3] select-none overflow-hidden rounded-[1.75rem] bg-night shadow-2xl ring-1 ring-black/5">
        <MediaImage media={after} className="absolute inset-0 h-full w-full" sizes="(min-width: 768px) 50vw, 100vw" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <MediaImage media={before} className="h-full w-full grayscale-[35%]" sizes="(min-width: 768px) 50vw, 100vw" />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="h-full w-[3px] -translate-x-1/2 bg-gradient-to-b from-accent-400 via-white to-accent-400 shadow-[0_0_18px_rgb(251_140_67_/_0.8)]" />
          <span className="absolute left-0 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-700 shadow-xl ring-4 ring-white/40">
            <MoveHorizontal className="h-5 w-5" />
          </span>
        </div>
        <span className="glass-dark absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">Avant</span>
        <span className="absolute right-4 top-4 rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg">Après</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          aria-label="Comparer avant et après"
        />
      </div>
      {caption ? <figcaption className="mt-3 text-center text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
