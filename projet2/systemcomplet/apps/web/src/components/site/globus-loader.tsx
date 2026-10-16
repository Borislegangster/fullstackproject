"use client";

import { useEffect, useState, type CSSProperties } from "react";

const STAGES = ["Concevoir", "Calculer", "Construire", "Contrôler"];
const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

/** Zigzag de treillis (mât, flèche) entre deux membrures. */
function lattice(x1: number, y1: number, x2: number, y2: number, step: number, vertical: boolean): string {
  const pts: string[] = [];
  if (vertical) {
    for (let y = y1, i = 0; y >= y2; y -= step, i++) pts.push(`${i % 2 ? x2 : x1} ${y}`);
  } else {
    for (let x = x1, i = 0; x <= x2; x += step, i++) pts.push(`${x} ${i % 2 ? y2 : y1}`);
  }
  return `M${pts.join(" L")}`;
}

interface Building {
  x: number;
  w: number;
  floors: number;
  windows: number;
  delay: number;
}
const BUILDINGS: Building[] = [
  { x: 62, w: 50, floors: 3, windows: 2, delay: 1.05 },
  { x: 120, w: 86, floors: 7, windows: 4, delay: 0.95 },
  { x: 212, w: 56, floors: 4, windows: 2, delay: 1.0 },
];
const FLOOR_H = 19;
const GROUND = 200;

function Scene() {
  return (
    <svg className="gl-svg" viewBox="0 0 360 232" aria-hidden="true">
      <defs>
        <linearGradient id="gl-scan-glow" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fb8c43" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fb8c43" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Concevoir : sol, cotes et contours */}
      <path d={`M20 ${GROUND} H340`} className="gl-draw" stroke="#8fb0ff" strokeWidth="1.2" style={{ "--len": 320, "--d": "0.05s" } as CSSProperties} />
      <path d="M120 214 H206 M120 210 V218 M206 210 V218" className="gl-dim" style={d(0.3)} />
      <text x="163" y="226" textAnchor="middle" className="gl-dim-text" style={d(0.35)}>
        8,60 m
      </text>
      <path d="M106 200 V67 M102 200 H110 M102 67 H110" className="gl-dim" style={d(0.4)} />
      <text x="98" y="136" textAnchor="middle" className="gl-dim-text" transform="rotate(-90 98 136)" style={d(0.45)}>
        26,60 m
      </text>
      {BUILDINGS.map((b, i) => {
        const top = GROUND - b.floors * FLOOR_H;
        const len = 2 * (GROUND - top) + b.w;
        return <path key={b.x} d={`M${b.x} ${GROUND} V${top} H${b.x + b.w} V${GROUND}`} fill="none" stroke="#8fb0ff" strokeWidth="1" className="gl-draw" style={{ "--len": len, "--d": `${0.15 + i * 0.08}s` } as CSSProperties} />;
      })}

      {/* Calculer : ossature (poteaux + contreventement) */}
      {[120, 148.7, 177.3, 206].map((x, i) => (
        <path key={x} d={`M${x} ${GROUND} V67`} className="gl-draw gl-col" style={{ "--len": 133, "--d": `${0.62 + i * 0.07}s` } as CSSProperties} />
      ))}
      <path d="M120 200 L148.7 162 L177.3 200 M148.7 124 L177.3 86" className="gl-draw gl-col" strokeOpacity="0.6" style={{ "--len": 170, "--d": "0.85s" } as CSSProperties} />

      {/* Construire : niveaux qui montent, fenêtres qui s'allument */}
      {BUILDINGS.map((b) =>
        Array.from({ length: b.floors }).map((_, f) => {
          const y = GROUND - (f + 1) * FLOOR_H;
          const delay = b.delay + f * 0.13;
          const gap = (b.w - 6) / b.windows;
          return (
            <g key={`${b.x}-${f}`} className="gl-floor" style={d(delay)}>
              <rect className="gl-slab" x={b.x} y={y} width={b.w} height={FLOOR_H} />
              {Array.from({ length: b.windows }).map((__, w) => (
                <rect key={w} className="gl-win" x={b.x + 5 + w * gap} y={y + 5} width={gap - 6} height={9} rx="1" style={d(delay + 0.28 + w * 0.05)} />
              ))}
            </g>
          );
        }),
      )}
      <path d="M163 67 V50" stroke="#8fb0ff" strokeWidth="1.2" className="gl-appear" style={d(1.8)} />
      <circle cx="163" cy="49" r="2.2" fill="#fb8c43" className="gl-beacon" />

      {/* Grue : mât, flèche, tirants, chariot qui lève puis livre la poutre */}
      <path d="M300 200 V38 M308 200 V38" stroke="#fb8c43" strokeWidth="1.1" className="gl-draw" style={{ "--len": 330, "--d": "0.1s" } as CSSProperties} />
      <path d={lattice(300, 200, 308, 40, 12, true)} stroke="#fb8c43" strokeWidth="0.7" fill="none" className="gl-draw" style={{ "--len": 260, "--d": "0.25s" } as CSSProperties} />
      <path d="M150 34 H336 M150 40 H336" stroke="#fb8c43" strokeWidth="1.1" className="gl-draw" style={{ "--len": 380, "--d": "0.35s" } as CSSProperties} />
      <path d={lattice(150, 34, 336, 40, 9, false)} stroke="#fb8c43" strokeWidth="0.6" fill="none" className="gl-draw" style={{ "--len": 280, "--d": "0.45s" } as CSSProperties} />
      <path d="M304 34 V20 M304 20 L160 34 M304 20 L336 34" stroke="#fdb98a" strokeWidth="0.7" fill="none" className="gl-draw" style={{ "--len": 210, "--d": "0.55s" } as CSSProperties} />
      <rect x="322" y="40" width="14" height="9" fill="#385aa6" stroke="#8fb0ff" strokeWidth="0.6" className="gl-appear" style={d(0.6)} />
      <rect x="295" y="40" width="13" height="9" rx="1.5" fill="#fb8c43" className="gl-appear" style={d(0.6)} />
      <g className="gl-trolley">
        <rect x="288" y="40" width="9" height="4" fill="#fff" />
        <path d="M292.5 44 V150" stroke="#fdb98a" strokeWidth="0.8" className="gl-cable" />
        <g className="gl-load">
          <path d="M292.5 145 v4 m-3 0 h6" stroke="#fff" strokeWidth="0.9" fill="none" />
          <rect x="278" y="150" width="29" height="4" fill="#fb8c43" stroke="#fff" strokeWidth="0.5" />
        </g>
      </g>

      {/* Contrôler : scan puis validations */}
      <g className="gl-scan">
        <rect x="52" y="186" width="226" height="14" fill="url(#gl-scan-glow)" />
        <path d="M52 200 H278" stroke="#fb8c43" strokeWidth="1.6" />
      </g>
      {[
        [112, 143, 2.45],
        [206, 67, 2.35],
        [268, 124, 2.55],
      ].map(([x, y, delay]) => (
        <g key={x} className="gl-check" style={d(delay)}>
          <circle cx={x} cy={y} r="6.5" fill="#16a34a" stroke="#fff" strokeWidth="1" />
          <path d={`M${x - 3} ${y} l2.1 2.2 l3.9 -4.2`} stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}

/** Écran de chargement signature (chargement initial / rafraîchissement) : animation CSS pure dès le premier
 * rendu, sortie « obturateur » quand la page est prête (minimum 2,6 s à la première visite, 1,1 s ensuite). */
export function GlobusLoader({ companyName = "GLOBUS ENGINEERING" }: { companyName?: string }) {
  const [phase, setPhase] = useState<"run" | "exit" | "done">("run");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    let first = true;
    try {
      first = !sessionStorage.getItem("globus:loaded");
      sessionStorage.setItem("globus:loaded", "1");
    } catch {
      /* stockage indisponible : séquence complète */
    }
    const minMs = first ? 2650 : 1100;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const exit = () => {
      setPhase((p) => (p === "run" ? "exit" : p));
      timers.push(setTimeout(() => setPhase("done"), 1200));
    };
    const ready = () => timers.push(setTimeout(exit, Math.max(0, minMs - performance.now())));
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    timers.push(setTimeout(exit, 4800));
    return () => {
      window.removeEventListener("load", ready);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "done") return null;
  const [brand, ...rest] = companyName.split(" ");
  return (
    <div className="gl-root no-print" data-phase={phase} role="status" aria-live="polite" aria-label="Chargement de la page">
      <div className="gl-panel gl-panel-top" />
      <div className="gl-panel gl-panel-bottom" />
      <div className="gl-laser" />
      <div className="gl-stage-area">
        <div className="gl-glow" />
        <Scene />
        <div className="text-center">
          <p className="gl-brand" aria-label={brand}>
            {brand.split("").map((c, i) => (
              <span key={i} style={d(0.1 + i * 0.06)}>
                {c}
              </span>
            ))}
          </p>
          {rest.length ? <p className="gl-sub mt-2">{rest.join(" ")}</p> : null}
        </div>
        <ol className="gl-stages">
          {STAGES.map((s, i) => (
            <li key={s} className="gl-step" style={d(i * 0.65)}>
              {s}
            </li>
          ))}
        </ol>
        <div className="gl-meter">
          <div className="gl-bar">
            <span />
          </div>
          <span className="gl-percent" />
        </div>
      </div>
    </div>
  );
}

/** Chargeur compact (changement de page) : un bâtiment se construit en boucle + squelette du contenu. */
export function RouteLoader({ label = "Chargement", dark = false, skeleton = true }: { label?: string; dark?: boolean; skeleton?: boolean }) {
  return (
    <div className={dark ? "bg-night text-white" : ""} role="status" aria-live="polite" aria-label={label}>
      <div className="container-page flex flex-col items-center py-14">
        <svg viewBox="0 0 120 84" className="h-24 w-32" aria-hidden="true">
          <path d="M8 76 H112" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
          {[0, 1, 2, 3].map((f) => (
            <g key={f} className="rl-floor" style={d(f * 0.16)}>
              <rect x="38" y={76 - (f + 1) * 14} width="44" height="13" rx="1.5" fill="var(--color-brand-500)" fillOpacity={0.25 + f * 0.15} stroke="var(--color-brand-400)" />
              <rect x="44" y={76 - (f + 1) * 14 + 4} width="9" height="5" fill="var(--color-accent-400)" />
              <rect x="57" y={76 - (f + 1) * 14 + 4} width="9" height="5" fill="var(--color-accent-300)" />
              <rect x="70" y={76 - (f + 1) * 14 + 4} width="6" height="5" fill="var(--color-accent-400)" />
            </g>
          ))}
          <g className="rl-scan">
            <path d="M30 76 H90" stroke="var(--color-accent-500)" strokeWidth="1.5" />
          </g>
        </svg>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] opacity-70">{label}…</p>
      </div>
      {skeleton ? <SkeletonGrid /> : null}
    </div>
  );
}

/** Squelette de cartes (images + textes) avec reflet animé. */
export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="container-page grid gap-6 pb-16 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl bg-white/80 ring-1 ring-line">
          <div className="skeleton-shimmer aspect-[16/10]" />
          <div className="space-y-3 p-5">
            <div className="skeleton-shimmer h-4 w-2/3 rounded-full" />
            <div className="skeleton-shimmer h-3 w-full rounded-full" />
            <div className="skeleton-shimmer h-3 w-5/6 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
