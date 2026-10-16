"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface LightboxItem {
  url: string;
  type?: string;
  caption?: string | null;
}

export function Lightbox({ items, index, onClose, onIndex }: { items: LightboxItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  useEffect(() => {
    if (index === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, items.length, onClose, onIndex]);
  if (index === null || !items[index] || typeof document === "undefined") return null;
  const item = items[index];
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="truncate text-sm">{item.caption}</p>
        <div className="flex items-center gap-2">
          <a href={item.url} download className="rounded p-2 hover:bg-white/10" aria-label="Télécharger">
            <Download className="h-5 w-5" />
          </a>
          <button type="button" onClick={onClose} className="rounded p-2 hover:bg-white/10" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {item.type === "video" ? <video src={item.url} controls autoPlay className="max-h-full max-w-full" /> : <img src={item.url} alt={item.caption ?? ""} className="max-h-full max-w-full object-contain" />}
        {items.length > 1 ? (
          <>
            <button type="button" onClick={() => onIndex((index - 1 + items.length) % items.length)} className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Précédent">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => onIndex((index + 1) % items.length)} className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Suivant">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
      <p className="pb-4 text-center text-xs text-white/60">
        {index + 1} / {items.length}
      </p>
    </div>,
    document.body,
  );
}
