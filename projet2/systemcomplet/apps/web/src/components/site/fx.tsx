"use client";

import clsx from "clsx";
import { Children, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

/** Observateur partagé : un seul IntersectionObserver pour toutes les apparitions de la page. */
const listeners = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;
function observe(el: Element, cb: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    cb();
    return () => undefined;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          listeners.get(e.target)?.();
          observer?.unobserve(e.target);
          listeners.delete(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  listeners.set(el, cb);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    listeners.delete(el);
  };
}

type RevealState = "idle" | "hidden" | "shown";

function offscreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= window.innerHeight || r.bottom <= 0;
}

function animationsAllowed(): boolean {
  return typeof IntersectionObserver !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Contenu visible par défaut (rendu serveur, robots, JS désactivé) : à l'hydratation, seuls les éléments hors
 * écran sont masqués, puis révélés à l'approche — aucun clignotement pour ce qui est déjà à l'écran. */
export function useReveal<T extends Element>(): [React.RefObject<T | null>, RevealState] {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<RevealState>("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !animationsAllowed() || !offscreen(el)) return;
    setState("hidden");
    return observe(el, () => setState("shown"));
  }, []);
  return [ref, state];
}

/** Apparition au défilement (fondu + translation / zoom / flou), retard optionnel pour les cascades. */
export function Reveal({
  children,
  as: Tag = "div",
  variant = "up",
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  variant?: "up" | "zoom" | "left" | "right" | "blur";
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [ref, state] = useReveal<HTMLElement>();
  return (
    <Tag ref={ref} className={clsx("reveal", className)} data-variant={variant} data-state={state} style={{ ...style, "--delay": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Cascade : chaque enfant apparaît avec un léger décalage. */
export function Stagger({ children, step = 90, variant = "up", className, itemClassName }: { children: ReactNode; step?: number; variant?: "up" | "zoom" | "left" | "right" | "blur"; className?: string; itemClassName?: string }) {
  return (
    <div className={className}>
      {Children.toArray(children).map((child, i) => (
        <Reveal key={i} variant={variant} delay={Math.min(i * step, 720)} className={itemClassName}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/** Compteur animé (format français) : valeur finale au rendu serveur ; compte depuis 0 quand il entre à l'écran. */
export function CountUp({ value, decimals = 0, duration = 1800, prefix = "", suffix = "" }: { value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const el = ref.current;
    setCurrent(value);
    if (!el || !animationsAllowed() || !offscreen(el)) return;
    setCurrent(0);
    let raf = 0;
    const stop = observe(el, () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setCurrent(value * (1 - Math.pow(1 - t, 4)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      stop();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  const text = current.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

/** Défilement infini horizontal (logos partenaires, garanties) ; pause au survol. */
export function Marquee({ children, duration = 40, reverse = false, className }: { children: ReactNode; duration?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={clsx("group relative overflow-hidden mask-fade-x", className)}>
      <div
        className="flex w-max animate-marquee gap-12 group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${duration}s`, animationDirection: reverse ? "reverse" : "normal" } as CSSProperties}
      >
        <div className="flex shrink-0 items-center gap-12">{children}</div>
        <div className="flex shrink-0 items-center gap-12" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Halo lumineux qui suit le pointeur (classe CSS .spotlight). */
export function Spotlight({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: ElementType }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <Tag
      ref={ref}
      className={clsx("spotlight", className)}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </Tag>
  );
}

/** Inclinaison 3D légère au survol (cartes premium). */
export function Tilt({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reset = () => {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  };
  return (
    <div
      ref={ref}
      className={clsx("transition-transform duration-300 ease-out will-change-transform", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      }}
      onPointerLeave={reset}
    >
      {children}
    </div>
  );
}

/** Barre de progression de lecture (haut de page). */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? h.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-brand-400 via-accent-400 to-accent-600" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />;
}
