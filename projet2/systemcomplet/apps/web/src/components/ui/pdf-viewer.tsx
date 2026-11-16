"use client";

import { Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Visionneuse PDF intégrée (pdf.js) : les pages sont dessinées par le site lui-même, donc l'aperçu fonctionne aussi
 * sur téléphone — Chrome Android et les navigateurs intégrés aux applications n'affichent pas les PDF dans un cadre
 * (« Ce contenu est bloqué »). Pages rendues à la demande (défilement), ajustées à la largeur, zoom, sélection non
 * requise. Le fichier est lu par le lien d'accès contrôlé existant (cookies de session), jamais par un lien public.
 */

const ASSETS = "/pdfjs";
const MAX_PIXEL_RATIO = 2; // netteté sur écran dense sans saturer la mémoire d'un téléphone
const MAX_CANVAS_PIXELS = 12_000_000;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
};

let pdfjsPromise: Promise<any> | null = null;
function loadPdfjs(): Promise<any> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib: any) => {
    lib.GlobalWorkerOptions.workerSrc = `${ASSETS}/pdf.worker.min.mjs`;
    return lib;
  });
  return pdfjsPromise;
}

function PdfPageView({ doc, index, width, ratio, root }: { doc: PdfDocument; index: number; width: number; ratio: number; root: HTMLElement | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(index <= 2);
  const [pageRatio, setPageRatio] = useState(ratio);

  useEffect(() => {
    const node = holder.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((e) => setVisible(e.isIntersecting)), { root, rootMargin: "150% 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible || width <= 0) return;
    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(index);
        if (cancelled || !canvas.current) return;
        const base = page.getViewport({ scale: 1 });
        setPageRatio(base.height / base.width);
        let scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const pixels = base.width * scale * base.height * scale;
        if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const viewport = page.getViewport({ scale });
        const el = canvas.current;
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        const context = el.getContext("2d");
        if (!context) return;
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
      } catch {
        /* rendu annulé (défilement, zoom) ou page illisible : la page reste blanche */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index, width, visible]);

  return (
    <div ref={holder} className="mx-auto bg-white shadow-md ring-1 ring-black/5" style={{ width, height: Math.round(width * pageRatio) }} aria-label={`Page ${index}`}>
      {visible ? <canvas ref={canvas} className="block h-full w-full" /> : null}
    </div>
  );
}

export function PdfViewer({ url, name, downloadUrl, fallbackAction }: { url: string; name: string; downloadUrl?: string; fallbackAction?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocument | null = null;
    // Aperçu fermé pendant le chargement : le téléchargement est interrompu (données mobiles, mémoire).
    const controller = new AbortController();
    setDoc(null);
    setError(null);
    setZoom(1);
    setCurrent(1);
    (async () => {
      try {
        const [lib, response] = await Promise.all([loadPdfjs(), fetch(url, { credentials: "include", signal: controller.signal, headers: { "X-Client-App": "web" } })]);
        if (!response.ok) throw new Error(response.status === 403 ? "Accès refusé à ce document." : "Document indisponible.");
        const data = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;
        const pdf: PdfDocument = await lib.getDocument({ data, cMapUrl: `${ASSETS}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${ASSETS}/standard_fonts/` }).promise;
        loaded = pdf;
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(first.height / first.width);
        setDoc(pdf);
      } catch (err: any) {
        if (cancelled) return;
        const label = err?.name === "PasswordException" ? "Ce PDF est protégé par un mot de passe : téléchargez-le pour l'ouvrir." : err?.name === "InvalidPDFException" ? "Fichier PDF illisible ou endommagé." : err instanceof Error && /Accès|indisponible/.test(err.message) ? err.message : "Aperçu du PDF impossible sur cet appareil : téléchargez le fichier.";
        setError(label);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      void loaded?.destroy();
    };
  }, [url]);

  // Largeur disponible (rotation du téléphone, redimensionnement) : pages ajustées à la largeur.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => setAvailable(Math.max(0, node.clientWidth - 16));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 120);
    });
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const pageWidth = Math.round(Math.min(available, 1100) * zoom);
  const onScroll = () => {
    const node = scroller.current;
    if (!node || !doc || pageWidth <= 0) return;
    const pageHeight = pageWidth * ratio + 12;
    setCurrent(Math.min(doc.numPages, Math.max(1, Math.floor((node.scrollTop + node.clientHeight / 3) / pageHeight) + 1)));
  };
  const step = (dir: 1 | -1) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.findIndex((v) => v >= z) + dir))] ?? 1);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-slate-200">
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto overscroll-contain p-2">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-md text-sm text-muted">{error}</p>
            {fallbackAction !== undefined ? (
              fallbackAction
            ) : (
              <a href={downloadUrl ?? url} download={name} className="btn-brand !py-2.5 text-sm">
                <Download className="h-4 w-4" /> Télécharger
              </a>
            )}
          </div>
        ) : !doc || pageWidth <= 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
            <Loader2 className="h-7 w-7 animate-spin text-brand-500" /> Préparation de l&apos;aperçu…
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col gap-3">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPageView key={`${i}-${pageWidth}`} doc={doc} index={i + 1} width={pageWidth} ratio={ratio} root={scroller.current} />
            ))}
          </div>
        )}
      </div>
      {doc ? (
        <div className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 text-ink shadow-lg">
          <span className="whitespace-nowrap px-3 text-xs font-semibold tabular-nums" aria-live="polite">
            {current} / {doc.numPages}
          </span>
          <button type="button" onClick={() => step(-1)} disabled={zoom <= ZOOMS[0]} className="rounded-full p-2.5 hover:bg-white disabled:opacity-40" aria-label="Zoom arrière">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setZoom(1)} className="min-w-[3.5rem] rounded-full px-2 py-1.5 text-xs font-semibold tabular-nums hover:bg-white" aria-label="Ajuster à la largeur">
            {Math.round(zoom * 100)} %
          </button>
          <button type="button" onClick={() => step(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} className="rounded-full p-2.5 hover:bg-white disabled:opacity-40" aria-label="Zoom avant">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
