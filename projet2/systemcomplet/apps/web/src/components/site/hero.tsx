"use client";

import clsx from "clsx";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, MousePointer2, Pause, Play } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import type { Block, Media } from "@/lib/cms-types";

import { Tilt } from "./fx";
import { MediaImage, MediaVideo } from "./media";

const HeroScene = dynamic(() => import("./hero-scene").then((m) => m.HeroScene), { ssr: false });

type Cta = { label: string; href: string; style?: string; track_id?: string | null };
interface Slide {
  title: string;
  subtitle?: string | null;
  media?: Media | null;
  cta?: Cta | null;
}

const SLIDE_MS = 7000;

function HeroCta({ cta, index }: { cta: Cta; index: number }) {
  const external = /^(https?:|mailto:|tel:)/.test(cta.href);
  const primary = index === 0 && cta.style !== "whatsapp" && cta.style !== "secondary" && cta.style !== "ghost";
  const cls = cta.style === "whatsapp" ? "btn-glass !bg-[#25D366]/90 hover:!bg-[#25D366]" : primary ? "btn-glow" : "btn-glass";
  const content = (
    <>
      {cta.style === "whatsapp" ? <MessageCircle className="h-5 w-5" /> : null}
      {cta.label}
      {primary ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /> : null}
    </>
  );
  return external ? (
    <a href={cta.href} className={clsx("group", cls)} data-track={cta.track_id ?? undefined} target={cta.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <Link href={cta.href} className={clsx("group", cls)} data-track={cta.track_id ?? undefined}>
      {content}
    </Link>
  );
}

/** Titre animé mot à mot ; la seconde phrase (ou la fin du titre) passe en dégradé. */
function AnimatedTitle({ text, as: Tag, light = true, className }: { text: string; as: "h1" | "h2"; light?: boolean; className?: string }) {
  const parts = useMemo(() => {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) return sentences.map((s, i) => ({ text: s, highlight: i === sentences.length - 1 }));
    const words = text.split(" ");
    const cut = Math.max(1, words.length - 2);
    return [
      { text: words.slice(0, cut).join(" "), highlight: false },
      { text: words.slice(cut).join(" "), highlight: true },
    ].filter((p) => p.text);
  }, [text]);
  let index = 0;
  return (
    <Tag className={clsx("font-title font-bold leading-[1.05] tracking-tight [perspective:600px]", className)}>
      {parts.map((part, p) => (
        <span key={p} className="inline">
          {part.text.split(" ").map((word) => {
            const delay = 120 + index++ * 70;
            return (
              <span key={`${word}-${delay}`} className={clsx("word mr-[0.25em] pb-[0.08em]", part.highlight && (light ? "text-gradient-light" : "text-gradient"))} style={{ "--delay": `${delay}ms` } as CSSProperties}>
                {word}
              </span>
            );
          })}
          {p < parts.length - 1 ? <br className="hidden sm:block" /> : null}
        </span>
      ))}
    </Tag>
  );
}

/** Signature « Concevoir. Calculer. Construire. Contrôler. » (issue de l'accroche CMS) avec temps fort cyclique. */
function Signature({ text }: { text: string }) {
  const verbs = text.split(/\.\s*/).filter(Boolean);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (verbs.length < 3) return;
    const id = setInterval(() => setActive((a) => (a + 1) % verbs.length), 1800);
    return () => clearInterval(id);
  }, [verbs.length]);
  if (verbs.length < 3) return <p className="eyebrow mb-6 text-accent-300">{text}</p>;
  return (
    <ol className="mb-7 flex flex-wrap items-center gap-2" aria-label={text}>
      {verbs.map((v, i) => (
        <li
          key={v}
          className={clsx(
            "fade-up rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition duration-500",
            i === active ? "bg-accent-500 text-white shadow-[0_0_24px_rgb(251_140_67_/_0.6)]" : "glass-dark text-brand-100",
          )}
          style={{ "--delay": `${i * 90}ms` } as CSSProperties}
        >
          {v}
        </li>
      ))}
    </ol>
  );
}

function Backdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-night" />
      <div className="aurora-blob -left-40 top-[-10%] h-[38rem] w-[38rem] bg-brand-500/40" />
      <div className="aurora-blob right-[-12%] top-[20%] h-[30rem] w-[30rem] bg-accent-500/25 [animation-delay:-6s]" />
      <div className="aurora-blob bottom-[-20%] left-1/3 h-[26rem] w-[26rem] bg-[#3f6fe0]/30 [animation-delay:-11s]" />
      <div className="absolute inset-0 bg-blueprint mask-radial opacity-60" />
    </>
  );
}

/** Héros cinématographique : vidéo puis diaporama (Ken Burns, fondu enchaîné, barres de progression), ou scène 3D
 * signature quand aucun visuel n'est publié ; mise en page « split » et « minimal » conservées. */
export function CinematicHero({ block: b, first, pullUp = false }: { block: Block; first: boolean; pullUp?: boolean }) {
  const Tag = first ? "h1" : "h2";
  const slides: Slide[] = useMemo(() => (b.slides ?? []).filter((s: Slide) => s.media), [b.slides]);
  const video: Media | null = b.video_media ?? null;
  const media: Media | null = b.media ?? null;
  const ctas: Cta[] = b.ctas ?? [];
  const [phase, setPhase] = useState<"video" | "slides">(video && video.kind !== "external_video" && b.layout === "video_then_slides" ? "video" : "slides");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPaused(true);
      setPhase("slides");
    }
  }, []);
  useEffect(() => {
    if (phase !== "slides" || paused || slides.length < 2) return;
    const id = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setTick((t) => t + 1);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [phase, paused, slides.length, index, tick]);
  const go = useCallback(
    (next: number) => {
      setIndex(((next % slides.length) + slides.length) % slides.length);
      setTick((t) => t + 1);
    },
    [slides.length],
  );

  if (b.layout === "split") {
    return (
      <div className="relative overflow-hidden bg-gradient-to-b from-white to-surface">
        <div className="absolute inset-0 bg-blueprint-light mask-radial" />
        <div className="aurora-blob -right-32 -top-32 h-[28rem] w-[28rem] bg-accent-300/30" />
        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            {b.eyebrow ? <p className="eyebrow mb-5 text-accent-600">{b.eyebrow}</p> : null}
            <AnimatedTitle text={b.title} as={Tag} light={false} className="text-4xl text-brand-900 sm:text-6xl" />
            {b.subtitle ? <p className="fade-up mt-6 max-w-xl text-lg text-muted" style={{ "--delay": "500ms" } as CSSProperties}>{b.subtitle}</p> : null}
            {ctas.length ? (
              <div className="mt-9 flex flex-wrap gap-3">
                {ctas.map((c, i) => (i === 0 ? <HeroCta key={c.label} cta={c} index={0} /> : <Link key={c.label} href={c.href} className="btn-outline-brand">{c.label}</Link>))}
              </div>
            ) : null}
          </div>
          <Tilt className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-400/40 via-accent-400/30 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-white/60">
              {video ? <MediaVideo media={video} autoPlay /> : <MediaImage media={media} className="aspect-[4/3] w-full" priority={first} sizes="(min-width: 1024px) 50vw, 100vw" />}
            </div>
          </Tilt>
        </div>
      </div>
    );
  }

  const slide = phase === "slides" ? slides[index] : undefined;
  const title = slide?.title || b.title;
  const subtitle = slide?.subtitle || b.subtitle;
  const heroCtas = slide?.cta ? [...ctas.filter((c) => c.label !== slide.cta?.label).slice(0, 1), slide.cta] : ctas;
  const hasPhoto = !!(slides.length || media || (video && phase === "video"));

  return (
    <div data-hero={pullUp ? "dark" : undefined} className={clsx("noise relative isolate flex min-h-[100svh] items-center overflow-hidden text-white", pullUp && "-mt-16 lg:-mt-20")}>
      <Backdrop />
      {phase === "video" && video?.url ? (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted playsInline onEnded={() => setPhase("slides")} onError={() => setPhase("slides")} poster={video.poster_url}>
          <source src={video.url} type={video.mime ?? "video/mp4"} />
        </video>
      ) : slides.length ? (
        slides.map((s, i) => (
          <div key={s.title + i} className={clsx("absolute inset-0 transition-opacity duration-[1400ms] ease-out", i === index ? "opacity-100" : "opacity-0")} aria-hidden={i !== index}>
            <div key={i === index ? `active-${tick}` : "idle"} className={clsx("h-full w-full", i === index && !paused && "ken-burns")}>
              <MediaImage media={s.media} className="h-full w-full" priority={first && i === 0} sizes="100vw" />
            </div>
          </div>
        ))
      ) : media ? (
        <div className="absolute inset-0 ken-burns">
          <MediaImage media={media} className="h-full w-full" priority={first} sizes="100vw" />
        </div>
      ) : null}
      {hasPhoto ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-night-950/95 via-night-900/70 to-night-900/10" style={{ opacity: Math.min(1, (b.overlay_opacity ?? 0.45) + 0.45) }} />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-night-950/90 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-y-0 right-0 hidden w-[58%] lg:block">
          <HeroScene className="h-full w-full" />
        </div>
      )}

      <div className="container-page relative z-10 grid w-full items-center gap-10 pb-36 pt-32 lg:grid-cols-12">
        <div className="lg:col-span-7" key={phase === "slides" ? `copy-${index}` : "copy-video"}>
          {b.eyebrow ? <Signature text={b.eyebrow} /> : null}
          <AnimatedTitle text={title} as={Tag} className="text-[2.6rem] text-white drop-shadow-[0_4px_30px_rgb(0_0_0_/_0.35)] sm:text-6xl xl:text-7xl" />
          {subtitle ? (
            <p className="fade-up mt-7 max-w-2xl text-lg leading-relaxed text-brand-50/90 sm:text-xl" style={{ "--delay": "550ms" } as CSSProperties}>
              {subtitle}
            </p>
          ) : null}
          {heroCtas.length ? (
            <div className="fade-up mt-10 flex flex-wrap gap-3" style={{ "--delay": "750ms" } as CSSProperties}>
              {heroCtas.map((c, i) => (
                <HeroCta key={c.label} cta={c} index={i} />
              ))}
            </div>
          ) : null}
          {b.trust_points?.length ? (
            <ul className="fade-up mt-10 flex flex-wrap gap-2.5" style={{ "--delay": "950ms" } as CSSProperties}>
              {b.trust_points.map((t: string) => (
                <li key={t} className="glass-dark flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white">
                  <CheckCircle2 className="h-4 w-4 text-accent-400" /> {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {phase === "slides" && slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-8 z-10">
          <div className="container-page flex items-end justify-between gap-6 sm:pr-28">
            <ol className="hidden flex-1 gap-3 md:flex">
              {slides.map((s, i) => (
                <li key={s.title + i} className="max-w-[14rem] flex-1">
                  <button type="button" onClick={() => go(i)} className="group w-full text-left" aria-label={`Visuel ${i + 1} : ${s.title}`} aria-current={i === index}>
                    <span className="block h-[3px] overflow-hidden rounded-full bg-white/20">
                      <span
                        key={i === index ? `bar-${tick}-${paused}` : `bar-${i}`}
                        className={clsx("block h-full origin-left rounded-full bg-gradient-to-r from-accent-400 to-accent-600", i < index && "scale-x-100", i > index && "scale-x-0")}
                        style={i === index ? { animation: paused ? "none" : `progress-fill ${SLIDE_MS}ms linear forwards`, transform: paused ? "scaleX(0.5)" : undefined } : undefined}
                      />
                    </span>
                    <span className={clsx("mt-2 block truncate text-xs font-medium transition", i === index ? "text-white" : "text-white/50 group-hover:text-white/80")}>
                      {String(i + 1).padStart(2, "0")} · {s.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => go(index - 1)} className="glass-dark rounded-full p-3 text-white transition hover:bg-white/20" aria-label="Visuel précédent">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setPaused((p) => !p)} className="glass-dark rounded-full p-3 text-white transition hover:bg-white/20" aria-label={paused ? "Reprendre le diaporama" : "Mettre en pause"}>
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button type="button" onClick={() => go(index + 1)} className="glass-dark rounded-full p-3 text-white transition hover:bg-white/20" aria-label="Visuel suivant">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {phase === "video" ? (
        <button type="button" onClick={() => setPhase("slides")} className="glass-dark absolute bottom-8 right-6 z-10 rounded-full px-4 py-2 text-xs font-semibold text-white hover:bg-white/20">
          Passer la vidéo
        </button>
      ) : null}
      {slides.length < 2 && phase !== "video" ? (
        <a href="#apres-hero" className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-white/70 sm:flex" aria-label="Découvrir la suite">
          <MousePointer2 className="h-4 w-4 animate-float" />
          Découvrir
        </a>
      ) : null}
    </div>
  );
}
