"use client";

import { Eraser, Undo2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Button } from "./primitives";

type Point = { x: number; y: number; t: number };
type Stroke = Point[];

export interface SignaturePadHandle {
  /** PNG transparent recadré (data URL), ou null si rien n'est dessiné. */
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

const INK = "#10205f";

/** Zone de signature manuscrite : souris, doigt (écran tactile) ou stylet. Le tracé est lissé et son épaisseur suit
 * la vitesse du geste, comme un stylo. Exporte un PNG transparent recadré sur la signature. */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number; onChange?: (empty: boolean) => void; disabled?: boolean }>(
  function SignaturePad({ height = 200, onChange, disabled = false }, ref) {
    const wrap = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Stroke[]>([]);
    const current = useRef<Stroke | null>(null);
    const [empty, setEmpty] = useState(true);

    const widthAt = (a: Point, b: Point) => {
      const speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(b.t - a.t, 1);
      return Math.max(1.6, Math.min(3.6, 3.8 - speed * 1.4));
    };

    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1];
        const b = stroke[i];
        const prev = stroke[i - 2] ?? a;
        ctx.lineWidth = widthAt(a, b);
        ctx.beginPath();
        // courbe passant par les milieux : tracé lissé, sans angles
        ctx.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2);
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.stroke();
      }
    };

    const redraw = useCallback(() => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      for (const s of strokes.current) drawStroke(ctx, s);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = box.clientWidth;
        c.width = Math.round(w * dpr);
        c.height = Math.round(height * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${height}px`;
        redraw();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(box);
      return () => observer.disconnect();
    }, [height, redraw]);

    const changed = () => {
      const isEmpty = strokes.current.length === 0;
      setEmpty(isEmpty);
      onChange?.(isEmpty);
    };

    const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
    };

    const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current = [point(e)];
      strokes.current.push(current.current);
      redraw();
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!current.current) return;
      e.preventDefault();
      const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
      const rect = e.currentTarget.getBoundingClientRect();
      for (const ev of events) current.current.push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, t: performance.now() });
      redraw();
    };

    const up = () => {
      if (!current.current) return;
      current.current = null;
      changed();
    };

    const clear = () => {
      strokes.current = [];
      redraw();
      changed();
    };

    const undo = () => {
      strokes.current.pop();
      redraw();
      changed();
    };

    useImperativeHandle(ref, () => ({
      isEmpty: () => strokes.current.length === 0,
      clear,
      toDataURL: () => {
        const points = strokes.current.flat();
        if (!points.length) return null;
        const pad = 8;
        const minX = Math.max(0, Math.min(...points.map((p) => p.x)) - pad);
        const minY = Math.max(0, Math.min(...points.map((p) => p.y)) - pad);
        const maxX = Math.max(...points.map((p) => p.x)) + pad;
        const maxY = Math.max(...points.map((p) => p.y)) + pad;
        const scale = 2; // export net à l'impression
        const out = document.createElement("canvas");
        out.width = Math.max(1, Math.round((maxX - minX) * scale));
        out.height = Math.max(1, Math.round((maxY - minY) * scale));
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
        for (const s of strokes.current) drawStroke(ctx, s);
        return out.toDataURL("image/png");
      },
    }));

    return (
      <div className="space-y-2">
        <div ref={wrap} className="relative overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 bg-white">
          <canvas
            ref={canvas}
            aria-label="Zone de signature : dessinez votre signature avec la souris ou le doigt"
            role="img"
            className={`block touch-none select-none ${disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
          />
          <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-300" />
          {empty ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted">Signez ici avec la souris, le doigt ou un stylet</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={empty || disabled}>
            <Undo2 className="h-4 w-4" /> Annuler le trait
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={empty || disabled}>
            <Eraser className="h-4 w-4" /> Effacer
          </Button>
        </div>
      </div>
    );
  },
);
