/** Rendu des sections et blocs CMS (29 types) — contenus exclusivement issus de l'API (Zero Hardcode).
 * Direction artistique « futuriste » : apparitions au défilement, verre dépoli, dégradés, compteurs animés et un
 * visuel pour chaque élément (illustration générée — grille technique + pictogramme — si aucun média n'est publié). */

import clsx from "clsx";
import { ArrowRight, ArrowUpRight, Award, BadgeCheck, CheckCircle2, Clock, Linkedin, Mail, MapPin, MessageCircle, Navigation, Phone, Quote, Ruler, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Block, Media, ProjectCard, Section, SiteContacts, Testimonial, UniverseCard } from "@/lib/cms-types";
import { dateLong } from "@/lib/format";
import { optionLabel } from "@/lib/labels";

import { BeforeAfterSlider } from "./before-after";
import { CmsForm } from "./cms-form";
import { CountUp, Marquee, Reveal, Spotlight, Stagger, Tilt } from "./fx";
import { GalleryCarousel, GalleryGrid } from "./gallery-carousel";
import { CinematicHero } from "./hero";
import { DynIcon } from "./icon";
import { MediaImage, MediaVideo } from "./media";
import { ModelViewer } from "./model-viewer";

type Cta = { label: string; href: string; style?: string; track_id?: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* --------------------------------------------------------------------------------------------- primitives */

/** Illustration générée (grille technique + halos + pictogramme) quand aucun visuel n'est publié. */
export function Placeholder({ icon, className, label }: { icon?: string | null; className?: string; label?: string }) {
  return (
    <div className={clsx("relative isolate flex items-center justify-center overflow-hidden bg-night", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <div className="absolute inset-0 -z-10 bg-blueprint opacity-70" />
      <div className="absolute -right-10 -top-12 -z-10 h-44 w-44 rounded-full bg-accent-500/35 blur-3xl" />
      <div className="absolute -bottom-14 -left-10 -z-10 h-48 w-48 rounded-full bg-brand-400/45 blur-3xl" />
      <svg className="absolute inset-x-6 bottom-0 -z-10 h-1/2 w-[calc(100%-3rem)] text-brand-300/35" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 80 V52 H22 V30 H48 V60 H64 V18 H96 V44 H112 V8 H140 V40 H158 V26 H182 V58 H200 V80 Z" fill="currentColor" />
      </svg>
      <span className="rounded-2xl bg-white/10 p-4 text-white shadow-[0_0_40px_rgb(109_142_224_/_0.45)] ring-1 ring-white/20 backdrop-blur">
        <DynIcon name={icon} className="h-8 w-8" />
      </span>
    </div>
  );
}

function Visual({ media, icon, className, sizes, priority }: { media?: Media | null; icon?: string | null; className?: string; sizes?: string; priority?: boolean }) {
  if (media?.url) return <MediaImage media={media} className={className} sizes={sizes} priority={priority} />;
  return <Placeholder icon={icon} className={className} />;
}

/** Met en dégradé les derniers mots d'un titre (accroche visuelle sans balisage dans le CMS). */
function Highlight({ text, onDark }: { text: string; onDark?: boolean }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return <>{text}</>;
  const cut = words.length - 2;
  return (
    <>
      {words.slice(0, cut).join(" ")} <span className={onDark ? "text-gradient-light" : "text-gradient"}>{words.slice(cut).join(" ")}</span>
    </>
  );
}

function BlockTitle({ eyebrow, title, subtitle, center = true, onDark, className }: { eyebrow?: string | null; title?: string | null; subtitle?: string | null; center?: boolean; onDark?: boolean; className?: string }) {
  if (!title && !subtitle && !eyebrow) return null;
  return (
    <Reveal className={clsx("mb-12 max-w-3xl", center && "mx-auto text-center", className)}>
      {eyebrow ? <p className={clsx("eyebrow mb-4", onDark ? "text-accent-300" : "text-accent-600")}>{eyebrow}</p> : null}
      {title ? (
        <h2 className={clsx("font-title text-3xl font-bold leading-[1.12] sm:text-[2.6rem]", onDark ? "text-white" : "text-brand-900")}>
          <Highlight text={title} onDark={onDark} />
        </h2>
      ) : null}
      {subtitle ? <p className={clsx("mt-4 text-lg leading-relaxed", onDark ? "text-brand-100" : "text-muted")}>{subtitle}</p> : null}
    </Reveal>
  );
}

export function CtaButton({ cta, onDark }: { cta: Cta; onDark?: boolean }) {
  const style = cta.style ?? "primary";
  const cls = clsx(
    "group",
    {
      accent: "btn-glow",
      primary: onDark ? "btn-glow" : "btn-brand",
      secondary: onDark ? "btn-glass" : "btn-outline-brand",
      ghost: onDark ? "btn-glass" : "btn-outline-brand",
      whatsapp: "btn-whatsapp",
      light: "btn-glass",
    }[style] ?? "btn-brand",
  );
  const arrow = style === "accent" || style === "primary" ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /> : null;
  if (/^(https?:|mailto:|tel:)/.test(cta.href))
    return (
      <a href={cta.href} className={cls} data-track={cta.track_id ?? undefined} target={cta.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
        {style === "whatsapp" ? <MessageCircle className="h-5 w-5" /> : null}
        {cta.label}
        {arrow}
      </a>
    );
  return (
    <Link href={cta.href} className={cls} data-track={cta.track_id ?? undefined}>
      {cta.label}
      {arrow}
    </Link>
  );
}

/* --------------------------------------------------------------------------------------------- atouts */

interface FeatureItem {
  icon?: string | null;
  title: string;
  text?: string | null;
  href?: string | null;
  media?: Media | null;
}

function FeatureCard({ item, onDark }: { item: FeatureItem; onDark?: boolean }) {
  const card = (
    <Spotlight className={clsx("card-lift border-glow group flex h-full flex-col overflow-hidden rounded-[1.75rem]", onDark ? "glass-dark" : "bg-white shadow-[var(--shadow-card)] ring-1 ring-line")}>
      <div className="img-zoom relative aspect-[16/10] overflow-hidden">
        <Visual media={item.media} icon={item.icon} className="h-full w-full" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        {item.media ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-night-950/55 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 inline-flex rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 p-3 text-white shadow-lg shadow-accent-500/30">
              <DynIcon name={item.icon} className="h-5 w-5" />
            </span>
          </>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className={clsx("font-title text-xl font-bold", onDark ? "text-white" : "text-brand-900")}>{item.title}</h3>
        {item.text ? <p className={clsx("mt-2 flex-1 text-sm leading-relaxed", onDark ? "text-brand-100" : "text-muted")}>{item.text}</p> : null}
        {item.href ? (
          <span className={clsx("mt-5 inline-flex items-center gap-1.5 text-sm font-semibold", onDark ? "text-accent-300" : "text-accent-600")}>
            En savoir plus <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        ) : null}
      </div>
    </Spotlight>
  );
  return item.href ? (
    <Link href={item.href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}

function BentoTile({ item, large }: { item: FeatureItem; large?: boolean }) {
  const tile = (
    <div className="img-zoom group relative h-full overflow-hidden rounded-[1.75rem] bg-night text-white shadow-[var(--shadow-card)]">
      <Visual media={item.media} icon={item.icon} className="absolute inset-0 h-full w-full" sizes={large ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 100vw"} />
      <div className="absolute inset-0 bg-gradient-to-t from-night-950/90 via-night-950/30 to-transparent" />
      <span className="glass-dark absolute left-5 top-5 inline-flex rounded-2xl p-2.5">
        <DynIcon name={item.icon} className="h-5 w-5 text-accent-300" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className={clsx("font-title font-bold text-white", large ? "text-2xl sm:text-3xl" : "text-lg")}>{item.title}</h3>
        {item.text ? <p className={clsx("mt-2 text-sm text-brand-100", large ? "max-w-md" : "line-clamp-2")}>{item.text}</p> : null}
      </div>
      {item.href ? <ArrowUpRight className="absolute right-5 top-5 h-5 w-5 text-white/70 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" /> : null}
    </div>
  );
  return item.href ? (
    <Link href={item.href} className="block h-full">
      {tile}
    </Link>
  ) : (
    tile
  );
}

export function FeatureGrid({ items, columns = 3, onDark, style = "cards" }: { items: FeatureItem[]; columns?: number; onDark?: boolean; style?: string }) {
  if (style === "bento") {
    return (
      <div className="grid auto-rows-[14rem] gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <Reveal key={item.title} variant="zoom" delay={i * 80} className={clsx("h-full", i === 0 && "sm:col-span-2 sm:row-span-2", i === 3 && "lg:col-span-2")}>
            <BentoTile item={item} large={i === 0} />
          </Reveal>
        ))}
      </div>
    );
  }
  if (style === "minimal") {
    return (
      <Stagger className={clsx("grid gap-x-10 gap-y-12", { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns as 2 | 3 | 4] ?? "sm:grid-cols-3")}>
        {items.map((item) => (
          <div key={item.title} className="group flex gap-5">
            <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30 transition duration-500 group-hover:rotate-6 group-hover:from-accent-400 group-hover:to-accent-600">
              <DynIcon name={item.icon} className="h-6 w-6" />
            </span>
            <div>
              <h3 className={clsx("font-title text-lg font-bold", onDark ? "text-white" : "text-brand-900")}>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h3>
              {item.text ? <p className={clsx("mt-1.5 text-sm leading-relaxed", onDark ? "text-brand-100" : "text-muted")}>{item.text}</p> : null}
            </div>
          </div>
        ))}
      </Stagger>
    );
  }
  return (
    <Stagger className={clsx("grid gap-6", { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns as 2 | 3 | 4] ?? "sm:grid-cols-3")} itemClassName="h-full">
      {items.map((item) => (
        <FeatureCard key={item.title} item={item} onDark={onDark} />
      ))}
    </Stagger>
  );
}

/** Preuves de confiance : visuel + liste de garanties, ou grille de garanties lumineuses. */
function Trust({ b, onDark }: { b: Block; onDark?: boolean }) {
  const items: FeatureItem[] = b.items ?? [];
  const list = (
    <Stagger className={clsx("grid gap-4", b.media ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")} itemClassName="h-full">
      {items.map((item) => (
        <div key={item.title} className={clsx("card-lift group relative h-full overflow-hidden rounded-3xl p-6", onDark ? "glass-dark" : "bg-white shadow-[var(--shadow-card)] ring-1 ring-line")}>
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-400/15 blur-2xl transition duration-500 group-hover:bg-accent-400/35" />
          <span className="relative inline-flex rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 p-3 text-white shadow-lg shadow-accent-500/30">
            <DynIcon name={item.icon ?? "shield-check"} className="h-5 w-5" />
          </span>
          <h3 className={clsx("relative mt-4 font-title text-lg font-bold", onDark ? "text-white" : "text-brand-900")}>{item.title}</h3>
          {item.text ? <p className={clsx("relative mt-1.5 text-sm leading-relaxed", onDark ? "text-brand-100" : "text-muted")}>{item.text}</p> : null}
        </div>
      ))}
    </Stagger>
  );
  if (!b.media)
    return (
      <div>
        <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
        {list}
      </div>
    );
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
      <Reveal variant="left" className="relative">
        <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-400/35 via-accent-300/30 to-transparent blur-2xl" />
        <Tilt>
          <div className="relative overflow-hidden rounded-[2rem] shadow-2xl">
            <MediaImage media={b.media} className="aspect-[4/5] w-full" sizes="(min-width: 1024px) 45vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-night-950/60 to-transparent" />
            <span className="glass absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-900">
              <BadgeCheck className="h-5 w-5 shrink-0 text-success" /> {items[0]?.title}
            </span>
          </div>
        </Tilt>
      </Reveal>
      <div>
        <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} center={false} onDark={onDark} />
        {list}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- chiffres */

function statNumber(value: unknown): { n: number; decimals: number } {
  const n = Number(value);
  if (!Number.isFinite(n)) return { n: 0, decimals: 0 };
  if (Number.isInteger(n)) return { n, decimals: 0 };
  return { n, decimals: Math.min(2, (String(value).split(".")[1] ?? "").replace(/0+$/, "").length) };
}

function Stats({ b }: { b: Block }) {
  const items: any[] = b.items ?? [];
  if (!items.length) return null;
  return (
    <Reveal variant="zoom" className="relative isolate overflow-hidden rounded-[2rem] bg-night px-6 py-14 text-white shadow-2xl sm:px-12 sm:py-16">
      {b.media ? (
        <>
          <div className="ken-burns absolute inset-0 -z-20">
            <MediaImage media={b.media} className="h-full w-full" sizes="100vw" />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-night-950/90 via-night-900/80 to-brand-900/70" />
        </>
      ) : null}
      <div className="absolute inset-0 -z-10 bg-blueprint opacity-40 mask-radial" />
      <div className="aurora-blob -left-24 -top-24 -z-10 h-80 w-80 bg-brand-500/40" />
      <div className="aurora-blob -bottom-24 right-0 -z-10 h-72 w-72 bg-accent-500/25 [animation-delay:-6s]" />
      <BlockTitle eyebrow={b.eyebrow} title={b.title} onDark />
      <dl className={clsx("grid grid-cols-2 gap-4", items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {items.map((s, i) => {
          const { n, decimals } = statNumber(s.value);
          return (
            <Reveal key={s.label} delay={i * 110} className="glass-dark group flex flex-col rounded-3xl p-6 text-center transition hover:bg-white/10">
              <dt className="order-2 mt-3 text-sm font-medium text-brand-100">{s.label}</dt>
              <dd className="order-1 font-title text-4xl font-bold sm:text-5xl">
                <span className="text-gradient-light">
                  <CountUp value={n} decimals={decimals} prefix={s.prefix ?? ""} suffix={s.suffix ?? ""} />
                </span>
              </dd>
              <span className="order-3 mx-auto mt-4 h-0.5 w-10 rounded-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-500 group-hover:w-20" />
              {s.description ? <p className="order-4 mt-3 text-xs text-brand-200">{s.description}</p> : null}
            </Reveal>
          );
        })}
      </dl>
    </Reveal>
  );
}

/* --------------------------------------------------------------------------------------------- étapes */

function Steps({ b, onDark }: { b: Block; onDark?: boolean }) {
  const items: any[] = b.items ?? [];
  const head = <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} center={!(b.media && b.style !== "cards" && b.style !== "funnel")} />;
  if (b.style === "cards")
    return (
      <div>
        {head}
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" itemClassName="h-full">
          {items.map((s, i) => (
            <div key={s.title} className="card-lift group relative h-full overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-line">
              <div className="img-zoom relative aspect-[4/3] overflow-hidden">
                <Visual media={s.media} icon={s.icon} className="h-full w-full" sizes="(min-width: 1024px) 25vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-night-950/70 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-5 font-title text-5xl font-bold text-white/95 drop-shadow-lg">{pad(i + 1)}</span>
              </div>
              <div className="p-6">
                <h3 className="flex items-center gap-2 font-title text-lg font-bold text-brand-900">
                  <DynIcon name={s.icon} fallback={false} className="h-5 w-5 text-accent-500" />
                  {s.title}
                </h3>
                {s.text ? <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p> : null}
              </div>
            </div>
          ))}
        </Stagger>
      </div>
    );
  if (b.style === "funnel")
    return (
      <div>
        {head}
        <ol className="mx-auto flex max-w-4xl flex-col gap-3">
          {items.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              delay={i * 90}
              className="flex items-center gap-4 rounded-2xl p-4 text-white shadow-lg"
              style={{ marginInline: `${i * 3}%`, background: `linear-gradient(100deg, color-mix(in oklab, var(--color-brand-600) ${Math.max(20, 100 - i * 16)}%, var(--color-accent-500)), var(--color-brand-900))` }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 font-title font-bold ring-1 ring-white/25">{i + 1}</span>
              <div>
                <p className="font-semibold">{s.title}</p>
                {s.text ? <p className="text-sm text-white/80">{s.text}</p> : null}
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    );
  const timeline = (
    <ol className={clsx("relative", !b.media && "mx-auto max-w-3xl")}>
      <span className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-gradient-to-b from-accent-500 via-brand-400 to-transparent" aria-hidden="true" />
      {items.map((s, i) => (
        <Reveal as="li" key={s.title} delay={i * 90} variant="left" className="relative pb-8 pl-16 last:pb-0">
          <span className="absolute left-0 top-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 font-title text-sm font-bold text-white shadow-lg shadow-accent-500/30 ring-4 ring-white">{pad(i + 1)}</span>
          <div className={clsx("card-lift rounded-3xl p-6", onDark ? "glass-dark" : "bg-white shadow-[var(--shadow-card)] ring-1 ring-line")}>
            {s.media ? <MediaImage media={s.media} className="mb-4 aspect-[16/7] w-full rounded-2xl" sizes="(min-width: 1024px) 40vw, 100vw" /> : null}
            <h3 className={clsx("flex items-center gap-2 font-title text-lg font-bold", onDark ? "text-white" : "text-brand-900")}>
              <DynIcon name={s.icon} fallback={false} className="h-5 w-5 text-accent-500" />
              {s.title}
            </h3>
            {s.text ? <p className={clsx("mt-2 leading-relaxed", onDark ? "text-brand-100" : "text-muted")}>{s.text}</p> : null}
          </div>
        </Reveal>
      ))}
    </ol>
  );
  if (!b.media)
    return (
      <div>
        {head}
        {timeline}
      </div>
    );
  return (
    <div className="grid items-start gap-12 lg:grid-cols-2">
      <div className="lg:sticky lg:top-28">
        {head}
        <Reveal variant="zoom" className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-accent-300/40 via-brand-300/30 to-transparent blur-2xl" />
          <Tilt>
            <div className="overflow-hidden rounded-[2rem] shadow-2xl">
              <MediaImage media={b.media} className="aspect-[4/3] w-full" sizes="(min-width: 1024px) 45vw, 100vw" />
            </div>
          </Tilt>
        </Reveal>
      </div>
      {timeline}
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- appel à l'action */

function CtaBand({ b }: { b: Block }) {
  const theme = b.theme ?? "primary";
  const light = theme === "light";
  return (
    <Reveal variant="zoom" className={clsx("relative isolate overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-14 sm:py-20", light ? "bg-white shadow-xl ring-1 ring-line" : "bg-night text-white shadow-2xl")}>
      {b.media ? (
        <div className="ken-burns absolute inset-0 -z-30">
          <MediaImage media={b.media} className="h-full w-full" sizes="100vw" />
        </div>
      ) : null}
      {light ? (
        <>
          <div className={clsx("absolute inset-0 -z-20", b.media ? "bg-white/85" : "bg-gradient-to-br from-brand-50 via-white to-accent-50")} />
          <div className="absolute inset-0 -z-10 bg-blueprint-light mask-radial" />
        </>
      ) : (
        <>
          <div
            className={clsx(
              "absolute inset-0 -z-20",
              theme === "accent" ? "bg-gradient-to-br from-accent-500/95 via-accent-600/90 to-brand-900/85" : theme === "dark" ? "bg-gradient-to-br from-night-950/95 via-night-900/90 to-brand-900/80" : "bg-gradient-to-br from-brand-600/95 via-brand-800/90 to-night-950/90",
            )}
          />
          <div className="absolute inset-0 -z-10 bg-blueprint opacity-40 mask-radial" />
          <div className="aurora-blob -left-20 -top-24 -z-10 h-80 w-80 bg-brand-400/40" />
          <div className="aurora-blob -bottom-28 -right-10 -z-10 h-80 w-80 bg-accent-400/35 [animation-delay:-5s]" />
        </>
      )}
      <div className="relative mx-auto max-w-3xl">
        {b.eyebrow ? <p className={clsx("eyebrow mb-5", light ? "text-accent-600" : "text-accent-200")}>{b.eyebrow}</p> : null}
        <h2 className={clsx("font-title text-3xl font-bold leading-tight sm:text-5xl", light ? "text-brand-900" : "text-white")}>
          <Highlight text={b.title} onDark={!light} />
        </h2>
        {b.text ? <p className={clsx("mx-auto mt-5 max-w-2xl text-lg", light ? "text-muted" : "text-white/85")}>{b.text}</p> : null}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {(b.ctas ?? []).map((c: Cta) => (
            <CtaButton key={c.label} cta={theme === "accent" && c.style === "accent" ? { ...c, style: "light" } : c} onDark={!light} />
          ))}
        </div>
      </div>
    </Reveal>
  );
}

/* --------------------------------------------------------------------------------------------- collections */

export function ProjectCards({ items }: { items: ProjectCard[] }) {
  return (
    <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" itemClassName="h-full">
      {items.map((p) => (
        <Link key={p.id} href={p.path} className="group relative block h-full overflow-hidden rounded-[1.75rem] bg-night shadow-[var(--shadow-card)] ring-1 ring-black/5">
          <div className="img-zoom relative aspect-[4/5] overflow-hidden">
            <Visual media={p.cover} icon="building-2" className="h-full w-full" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/35 to-transparent transition duration-500 group-hover:via-night-950/55" />
          </div>
          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-5">
            {p.universe ? <span className="glass-dark rounded-full px-3 py-1 text-xs font-semibold text-white">{optionLabel(p.universe)}</span> : null}
            {p.category ? <span className="rounded-full bg-accent-500/90 px-3 py-1 text-xs font-semibold text-white">{p.category}</span> : null}
            {p.surface_m2 ? (
              <span className="glass-dark ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white">
                <Ruler className="h-3.5 w-3.5" /> {Number(p.surface_m2).toLocaleString("fr-FR")} m²
              </span>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-300">
              <MapPin className="h-3.5 w-3.5" />
              {[p.city, p.country].filter(Boolean).join(", ")}
              {p.year ? ` · ${p.year}` : ""}
            </p>
            <h3 className="mt-2 font-title text-2xl font-bold leading-tight text-white">{p.title}</h3>
            {p.summary ? <p className="mt-2 line-clamp-2 text-sm text-brand-100 transition-all duration-500 sm:max-h-0 sm:opacity-0 sm:group-hover:max-h-16 sm:group-hover:opacity-100">{p.summary}</p> : null}
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
              Voir le projet <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ))}
    </Stagger>
  );
}

function TestimonialCard({ t, onDark }: { t: Testimonial; onDark?: boolean }) {
  return (
    <figure className={clsx("relative flex h-full flex-col overflow-hidden rounded-[1.75rem] p-7", onDark ? "glass-dark text-white" : "bg-white shadow-[var(--shadow-card)] ring-1 ring-line")}>
      <Quote className="absolute right-6 top-6 h-14 w-14 text-accent-500/15" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        {t.rating ? (
          <div className="flex gap-0.5" aria-label={`Note ${t.rating} sur 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={clsx("h-4 w-4", i < (t.rating ?? 0) ? "fill-accent-400 text-accent-400" : "text-slate-300")} />
            ))}
          </div>
        ) : null}
        {t.verified ? (
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              onDark ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            )}
            title="Avis déposé par le client d'un chantier GLOBUS réel, via une invitation personnelle"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> Avis vérifié
          </span>
        ) : null}
      </div>
      <blockquote className={clsx("mt-4 flex-1 text-[1.05rem] leading-relaxed", onDark ? "text-brand-50" : "text-ink")}>« {t.quote} »</blockquote>
      {t.video ? <MediaVideo media={t.video} className="mt-5" /> : null}
      <figcaption className={clsx("mt-6 flex items-center gap-3 border-t pt-5", onDark ? "border-white/10" : "border-line")}>
        <span className="rounded-full bg-gradient-to-br from-accent-400 to-brand-500 p-[2px]">
          {t.photo ? (
            <MediaImage media={t.photo} className="h-12 w-12 rounded-full" sizes="48px" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-night font-title text-sm font-bold text-white">{initials(t.author_name)}</span>
          )}
        </span>
        <div>
          <p className={clsx("font-semibold", onDark ? "text-white" : "text-brand-900")}>{t.author_name}</p>
          <p className={clsx("text-xs", onDark ? "text-brand-200" : "text-muted")}>{[t.author_role, t.location].filter(Boolean).join(" · ")}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function TestimonialCards({ items, layout = "grid", onDark }: { items: Testimonial[]; layout?: string; onDark?: boolean }) {
  if (layout === "carousel" && items.length > 2)
    return (
      <Marquee duration={Math.max(35, items.length * 10)} className="py-2">
        {items.map((t) => (
          <div key={t.id} className="w-[22rem] shrink-0 self-stretch">
            <TestimonialCard t={t} onDark={onDark} />
          </div>
        ))}
      </Marquee>
    );
  return (
    <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" itemClassName="h-full">
      {items.map((t) => (
        <TestimonialCard key={t.id} t={t} onDark={onDark} />
      ))}
    </Stagger>
  );
}

export function UniverseCards({ items }: { items: UniverseCard[] }) {
  return (
    <Stagger className="flex flex-wrap justify-center gap-6" itemClassName="h-full w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
      {items.map((u) => (
        <Tilt key={u.id} className="h-full" max={5}>
          <Link href={u.path} className="group relative flex h-full min-h-[25rem] flex-col justify-end overflow-hidden rounded-[2rem] bg-night p-7 text-white shadow-xl ring-1 ring-white/10">
            <div className="img-zoom absolute inset-0">
              <Visual media={u.hero} icon={u.icon} className="h-full w-full" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/55 to-night-950/0" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full opacity-40 blur-3xl transition duration-700 group-hover:opacity-75" style={{ background: u.accent ?? "var(--color-accent-500)" }} />
            <div className="relative">
              <span className="mb-4 inline-flex rounded-2xl p-3 shadow-lg ring-1 ring-white/25" style={{ background: u.accent ?? "var(--color-accent-500)" }}>
                <DynIcon name={u.icon} className="h-6 w-6 text-white" />
              </span>
              <h3 className="font-title text-3xl font-bold text-white">{u.name}</h3>
              {u.tagline ? <p className="mt-2 text-sm font-medium text-brand-100">{u.tagline}</p> : null}
              {u.promise ? <p className="mt-3 line-clamp-3 text-sm text-white/80 transition-all duration-500 sm:max-h-0 sm:opacity-0 sm:group-hover:max-h-24 sm:group-hover:opacity-100">{u.promise}</p> : null}
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20 backdrop-blur transition group-hover:bg-accent-500 group-hover:ring-accent-400">
                Découvrir <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </Tilt>
      ))}
    </Stagger>
  );
}

export function OfferCards({ items }: { items: any[] }) {
  return (
    <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" itemClassName="h-full">
      {items.map((o) => (
        <article key={o.id} className="card-lift border-glow group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-line">
          <div className="img-zoom relative aspect-[16/10] overflow-hidden">
            <Visual media={o.media} icon={o.icon ?? "briefcase"} className="h-full w-full" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-night-950/65 via-transparent to-transparent" />
            {o.universe ? <span className="glass-dark absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white">{o.universe.name}</span> : null}
            {o.price_hint ? <span className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-3 py-1.5 text-sm font-bold text-brand-800 shadow-lg">{o.price_hint}</span> : null}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <h3 className="font-title text-xl font-bold text-brand-900">{o.name}</h3>
            {o.summary ? <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{o.summary}</p> : null}
            {o.duration_hint ? (
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                <Clock className="h-3.5 w-3.5 text-accent-500" /> {o.duration_hint}
              </p>
            ) : null}
            {o.path ? (
              <Link href={o.path} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 after:absolute after:inset-0 group-hover:text-accent-600">
                {o.cta_label ?? "Voir l'offre"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            ) : null}
          </div>
        </article>
      ))}
    </Stagger>
  );
}

export function BlogCards({ items }: { items: any[] }) {
  return (
    <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" itemClassName="h-full">
      {items.map((p) => (
        <Link key={p.id} href={p.path} className="card-lift group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-line">
          <div className="img-zoom relative aspect-[16/10] overflow-hidden">
            <Visual media={p.cover} icon="book-open" className="h-full w-full" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
            {p.category?.name ? <span className="absolute left-4 top-4 rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">{p.category.name}</span> : null}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <p className="text-xs font-medium text-muted">
              {p.published_at ? dateLong(p.published_at) : ""}
              {p.reading_minutes ? ` · ${p.reading_minutes} min de lecture` : ""}
            </p>
            <h3 className="mt-2 font-title text-lg font-bold leading-snug text-brand-900 transition group-hover:text-brand-600">{p.title}</h3>
            {p.excerpt ? <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{p.excerpt}</p> : null}
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-600">
              Lire l&apos;article <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      ))}
    </Stagger>
  );
}

export function FaqList({ items }: { items: { id?: string; question: string; answer: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <details key={f.id ?? f.question} className="group rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-line transition open:shadow-lg open:ring-brand-200 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-4 p-5 font-semibold text-brand-900">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-title text-sm text-brand-600 transition group-open:bg-accent-500 group-open:text-white">{pad(i + 1)}</span>
            <span className="flex-1">{f.question}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-lg text-accent-600 transition duration-300 group-open:rotate-45 group-open:bg-accent-50">+</span>
          </summary>
          <div className="prose-globus px-5 pb-5 text-sm sm:pl-[4.25rem]" dangerouslySetInnerHTML={{ __html: f.answer }} />
        </details>
      ))}
    </div>
  );
}

function Catalog({ b, onDark }: { b: Block; onDark?: boolean }) {
  const items: any[] = b.items ?? [];
  if (!items.length) return null;
  const title = <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />;
  switch (b.kind) {
    case "expertises":
    case "services":
      return (
        <div>
          {title}
          <FeatureGrid columns={3} onDark={onDark} items={items.map((x) => ({ icon: x.icon ?? (x.discipline ? "compass" : "check"), title: x.name, text: x.summary, href: x.path, media: x.media }))} />
        </div>
      );
    case "team":
      return (
        <div>
          {title}
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" itemClassName="h-full">
            {items.map((m) => (
              <div key={m.id} className="img-zoom group relative h-full overflow-hidden rounded-[1.75rem] bg-night shadow-[var(--shadow-card)]">
                <div className="aspect-[3/4]">
                  {m.photo_media ? (
                    <MediaImage media={m.photo_media} className="h-full w-full" sizes="(min-width: 1024px) 25vw, 50vw" />
                  ) : (
                    <div className="relative flex h-full items-center justify-center bg-night">
                      <div className="absolute inset-0 bg-blueprint opacity-60" />
                      <span className="relative font-title text-5xl font-bold text-white/90">{initials(m.name)}</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="font-title text-lg font-bold">{m.name}</p>
                  <p className="text-sm text-accent-300">{m.role}</p>
                  {m.linkedin_url ? (
                    <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} sur LinkedIn`} className="mt-3 inline-flex rounded-full bg-white/10 p-2 ring-1 ring-white/20 transition hover:bg-[#0a66c2]" data-social="linkedin" data-location="team">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </Stagger>
        </div>
      );
    case "partners":
      return (
        <div>
          {title}
          <Marquee duration={Math.max(25, items.length * 5)}>
            {items.map((p) => (
              <a
                key={p.id}
                href={p.url ?? undefined}
                target={p.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                title={p.name}
                className="flex h-24 w-48 shrink-0 items-center justify-center rounded-2xl bg-white px-6 shadow-[var(--shadow-card)] ring-1 ring-line grayscale transition duration-500 hover:-translate-y-1 hover:grayscale-0"
              >
                {p.logo_media ? <MediaImage media={p.logo_media} className="max-h-14 w-auto object-contain" sizes="160px" alt={p.name} /> : <span className="font-title text-sm font-bold text-brand-800">{p.name}</span>}
              </a>
            ))}
          </Marquee>
        </div>
      );
    case "certifications":
      return (
        <div className={clsx(b.media && "grid items-center gap-12 lg:grid-cols-[1fr_1.3fr]")}>
          {b.media ? (
            <Reveal variant="left" className="overflow-hidden rounded-[2rem] shadow-2xl">
              <MediaImage media={b.media} className="aspect-[4/5] w-full" sizes="(min-width: 1024px) 40vw, 100vw" />
            </Reveal>
          ) : null}
          <div>
            {b.media ? <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} center={false} onDark={onDark} /> : title}
            <Stagger className={clsx("grid gap-4", b.media ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")} itemClassName="h-full">
              {items.map((c) => (
                <div key={c.id} className="card-lift flex h-full items-start gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-line">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 ring-1 ring-line">
                    {c.logo_media ? <MediaImage media={c.logo_media} className="h-12 w-12 object-contain" sizes="48px" /> : <Award className="h-8 w-8 text-accent-500" />}
                  </span>
                  <div>
                    <p className="font-title font-bold text-brand-900">{c.name}</p>
                    <p className="text-sm text-muted">{[c.issuer, c.year].filter(Boolean).join(" · ")}</p>
                    {c.document_media?.url ? (
                      <a href={c.document_media.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-accent-600">
                        <BadgeCheck className="h-3.5 w-3.5" /> Voir le justificatif
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      );
    case "videos":
      return (
        <div>
          {title}
          <Stagger className="grid gap-6 md:grid-cols-2" itemClassName="h-full">
            {items.map((v) => (
              <figure key={v.id} className="h-full overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-line">
                <MediaVideo media={v.media} title={v.title} className="rounded-none" />
                <figcaption className="p-5">
                  <p className="font-title font-bold text-brand-900">{v.title}</p>
                  {v.description ? <p className="mt-1 text-sm text-muted">{v.description}</p> : null}
                </figcaption>
              </figure>
            ))}
          </Stagger>
        </div>
      );
    case "blog":
      return (
        <div>
          {title}
          <BlogCards items={items} />
        </div>
      );
    case "faq":
      if (b.media)
        return (
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div className="lg:sticky lg:top-28">
              <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} center={false} onDark={onDark} className="mb-8" />
              <Reveal variant="zoom" className="overflow-hidden rounded-[2rem] shadow-2xl">
                <MediaImage media={b.media} className="aspect-[4/3] w-full" sizes="(min-width: 1024px) 40vw, 100vw" />
              </Reveal>
            </div>
            <FaqList items={items} />
          </div>
        );
      return (
        <div className="mx-auto max-w-3xl">
          {title}
          <FaqList items={items} />
        </div>
      );
    default:
      return null;
  }
}

/* --------------------------------------------------------------------------------------------- contact & carte */

function ContactInfo({ b }: { b: Block }) {
  const site: SiteContacts | undefined = b.site;
  if (!site) return null;
  const wa = site.whatsapp?.replace(/\D/g, "");
  const hours = site.opening_hours;
  const rows: { icon: ReactNode; label: string; value: ReactNode }[] = [];
  if (site.address || site.city) rows.push({ icon: <MapPin className="h-5 w-5" />, label: "Adresse", value: [site.address, site.city, site.country].filter(Boolean).join(", ") });
  if (site.phone) rows.push({ icon: <Phone className="h-5 w-5" />, label: "Téléphone", value: <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a> });
  if (wa)
    rows.push({
      icon: <MessageCircle className="h-5 w-5" />,
      label: "WhatsApp",
      value: (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
          Écrire sur WhatsApp
        </a>
      ),
    });
  if (site.email) rows.push({ icon: <Mail className="h-5 w-5" />, label: "E-mail", value: <a href={`mailto:${site.email}`}>{site.email}</a> });
  const hourRows = hours ? (Array.isArray(hours) ? hours.map((h) => [h.day ?? "", h.hours ?? ""]) : Object.entries(hours)) : [];
  return (
    <div>
      <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} center={false} />
      <div className={clsx("grid gap-6", b.media && "lg:grid-cols-[1.15fr_1fr]")}>
        <div className="space-y-4">
          <Stagger className={clsx("grid gap-4 sm:grid-cols-2", !b.media && "lg:grid-cols-4")} itemClassName="h-full">
            {rows.map((r) => (
              <div key={r.label} className="card-lift h-full rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line">
                <span className="inline-flex rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-3 text-white shadow-lg shadow-brand-500/30">{r.icon}</span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{r.label}</p>
                <p className="mt-1 break-words font-semibold text-brand-900 [&_a]:transition [&_a:hover]:text-accent-600">{r.value}</p>
              </div>
            ))}
          </Stagger>
          {hourRows.length ? (
            <Reveal className="rounded-3xl bg-night p-6 text-white shadow-xl">
              <p className="flex items-center gap-2 font-title font-bold">
                <Clock className="h-5 w-5 text-accent-400" /> Horaires
              </p>
              <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {hourRows.map(([d, h]) => (
                  <li key={String(d)} className="flex justify-between gap-3 border-b border-white/10 pb-1.5">
                    <span className="text-brand-100">{String(d)}</span>
                    <span className="font-medium">{String(h)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}
        </div>
        {b.media ? (
          <Reveal variant="right" className="relative min-h-[22rem] overflow-hidden rounded-[2rem] shadow-2xl">
            <MediaImage media={b.media} className="absolute inset-0 h-full w-full" sizes="(min-width: 1024px) 45vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-night-950/70 to-transparent" />
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}

function MapBlock({ b }: { b: Block }) {
  const lat = b.latitude ?? b.site?.latitude;
  const lon = b.longitude ?? b.site?.longitude;
  if (lat === null || lat === undefined || lon === null || lon === undefined) return null;
  const d = 0.01 * Math.max(1, 15 - (b.zoom ?? 14));
  const bbox = [lon - d, lat - d / 2, lon + d, lat + d / 2].join(",");
  const address = b.address ?? b.site?.address;
  return (
    <div>
      <BlockTitle eyebrow={b.eyebrow} title={b.title} center={false} />
      <Reveal variant="zoom" className="relative overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-line">
        <iframe title={b.title ?? "Plan d'accès"} src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`} className="h-[460px] w-full saturate-[0.85]" loading="lazy" />
        <div className="glass absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 sm:right-auto sm:max-w-lg">
          {address ? (
            <p className="flex items-start gap-2 text-sm font-medium text-ink">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" /> {address}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`} target="_blank" rel="noopener noreferrer" className="btn-brand !rounded-xl !px-4 !py-2 text-sm">
              <Navigation className="h-4 w-4" /> Itinéraire
            </a>
            {b.site?.google_business_url ? (
              <a href={b.site.google_business_url} target="_blank" rel="noopener noreferrer" className="btn-outline-brand !rounded-xl !px-4 !py-2 text-sm">
                Fiche Google
              </a>
            ) : null}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- comparatif */

function CellValue({ value }: { value: string }) {
  const t = value.trim().toLowerCase();
  if (["oui", "yes", "✓", "✔", "inclus", "x"].includes(t)) return <CheckCircle2 className="h-5 w-5 text-success" aria-label={value} />;
  if (["non", "no", "✗", "—", "-", "n/a"].includes(t))
    return (
      <span className="text-slate-300" aria-label={value}>
        —
      </span>
    );
  return <>{value}</>;
}

function Comparison({ b }: { b: Block }) {
  const hl = typeof b.highlight_column === "number" ? b.highlight_column : -1;
  return (
    <div>
      <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} />
      <Reveal className="overflow-x-auto rounded-[1.75rem] bg-white shadow-xl ring-1 ring-line">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="bg-surface px-5 py-4" />
              {(b.columns ?? []).map((c: string, i: number) => (
                <th key={c} className={clsx("px-5 py-4 text-left font-title text-base font-bold", i === hl ? "bg-gradient-to-b from-brand-600 to-brand-800 text-white" : "bg-surface text-brand-900")}>
                  {i === hl ? (
                    <span className="inline-flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-accent-300" /> {c}
                    </span>
                  ) : (
                    c
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(b.rows ?? []).map((r: { label: string; values: string[] }) => (
              <tr key={r.label} className="transition hover:bg-brand-50/40">
                <th className="px-5 py-4 text-left font-semibold text-ink">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={i} className={clsx("px-5 py-4", i === hl ? "bg-brand-50/70 font-semibold text-brand-800" : "text-muted")}>
                    <CellValue value={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- textes, citation, formulaire */

function RichText({ b, onDark }: { b: Block; onDark?: boolean }) {
  const html = <div className={clsx("prose-globus", onDark && "prose-dark")} dangerouslySetInnerHTML={{ __html: b.html ?? "" }} />;
  if (!b.media)
    return (
      <div className="mx-auto max-w-3xl">
        <BlockTitle eyebrow={b.eyebrow} title={b.title} onDark={onDark} className="mb-6" />
        <Reveal>{html}</Reveal>
      </div>
    );
  const left = b.media_position === "left";
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <Reveal variant={left ? "left" : "right"} className={clsx("relative", left ? "lg:order-first" : "lg:order-last")}>
        <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-400/30 via-accent-300/30 to-transparent blur-2xl" />
        <Tilt>
          <div className="overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-black/5">
            <MediaImage media={b.media} className="aspect-[4/3] w-full" sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
        </Tilt>
      </Reveal>
      <div>
        <BlockTitle eyebrow={b.eyebrow} title={b.title} onDark={onDark} center={false} className="mb-6" />
        <Reveal>{html}</Reveal>
      </div>
    </div>
  );
}

function QuoteBlock({ b, onDark }: { b: Block; onDark?: boolean }) {
  const bg: Media | null = b.background_media ?? null;
  const dark = onDark || !!bg;
  return (
    <Reveal as="figure" variant="blur" className={clsx("relative isolate mx-auto overflow-hidden text-center", bg ? "rounded-[2rem] px-6 py-20 shadow-2xl sm:px-16" : "max-w-4xl")}>
      {bg ? (
        <>
          <div className="ken-burns absolute inset-0 -z-20">
            <MediaImage media={bg} className="h-full w-full" sizes="100vw" />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-night-950/90 via-night-900/80 to-brand-900/70" />
        </>
      ) : null}
      <Quote className="mx-auto h-12 w-12 text-accent-400" aria-hidden="true" />
      <blockquote className={clsx("mx-auto mt-6 max-w-3xl font-title text-2xl font-bold leading-snug sm:text-4xl", dark ? "text-white" : "text-brand-900")}>
        « <Highlight text={b.text} onDark={dark} /> »
      </blockquote>
      {b.author ? (
        <figcaption className="mt-8 flex items-center justify-center gap-3">
          {b.media ? (
            <span className="rounded-full bg-gradient-to-br from-accent-400 to-brand-500 p-[2px]">
              <MediaImage media={b.media} className="h-14 w-14 rounded-full" sizes="56px" />
            </span>
          ) : null}
          <span className="text-left">
            <span className={clsx("block font-semibold", dark ? "text-white" : "text-ink")}>{b.author}</span>
            {b.role ? <span className={clsx("text-sm", dark ? "text-brand-200" : "text-muted")}>{b.role}</span> : null}
          </span>
        </figcaption>
      ) : null}
    </Reveal>
  );
}

function FormBlock({ b }: { b: Block }) {
  if (!(b.form || b.form_key === "describe_project")) return null;
  const form = <CmsForm formKey={b.form_key} initial={b.form} title={b.title} text={b.text} />;
  if (!b.media)
    return (
      <Reveal className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-line sm:p-10">
        {b.eyebrow ? <p className="eyebrow mb-4 text-accent-600">{b.eyebrow}</p> : null}
        {form}
      </Reveal>
    );
  return (
    <Reveal variant="zoom" className="grid overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-line lg:grid-cols-[1fr_1.25fr]">
      <div className="relative min-h-[18rem]">
        <MediaImage media={b.media} className="absolute inset-0 h-full w-full" sizes="(min-width: 1024px) 40vw, 100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-night-900/30 to-transparent" />
        {b.eyebrow ? <p className="eyebrow absolute bottom-7 left-7 right-7 text-white">{b.eyebrow}</p> : null}
      </div>
      <div className="p-6 sm:p-10">
        {form}
      </div>
    </Reveal>
  );
}

/* --------------------------------------------------------------------------------------------- aiguillage */

export function BlockView({ block: b, first = false, onDark = false, pullUp = false }: { block: Block; first?: boolean; onDark?: boolean; pullUp?: boolean }) {
  switch (b.kind) {
    case "hero":
      return <CinematicHero block={b} first={first} pullUp={pullUp} />;
    case "rich_text":
      return <RichText b={b} onDark={onDark} />;
    case "features":
      return (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <FeatureGrid items={b.items ?? []} columns={b.columns ?? 3} onDark={onDark} style={b.style} />
        </div>
      );
    case "trust":
      return <Trust b={b} onDark={onDark} />;
    case "stats":
      return <Stats b={b} />;
    case "steps":
      return <Steps b={b} onDark={onDark} />;
    case "cta":
      return <CtaBand b={b} />;
    case "media":
      return (
        <Reveal as="figure" variant="zoom" className={clsx(b.layout === "full" ? "" : "mx-auto max-w-5xl")}>
          {b.media?.kind === "video" || b.media?.kind === "external_video" ? (
            <MediaVideo media={b.media} />
          ) : (
            <div className="overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-black/5">
              <MediaImage media={b.media} className="w-full" sizes="(min-width: 1024px) 1024px, 100vw" />
            </div>
          )}
          {b.caption ? <figcaption className={clsx("mt-3 text-center text-sm", onDark ? "text-brand-100" : "text-muted")}>{b.caption}</figcaption> : null}
        </Reveal>
      );
    case "gallery":
      return (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <Reveal variant="zoom">{b.layout === "carousel" ? <GalleryCarousel medias={b.medias ?? []} /> : <GalleryGrid medias={b.medias ?? []} masonry={b.layout === "masonry"} />}</Reveal>
        </div>
      );
    case "video":
      return (
        <div className="mx-auto max-w-5xl">
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <Reveal variant="zoom" className="rounded-[2rem] bg-gradient-to-br from-brand-400/70 via-accent-400/50 to-brand-700/70 p-[2px] shadow-2xl">
            <div className="overflow-hidden rounded-[calc(2rem-2px)] bg-night">
              <MediaVideo media={b.media} autoPlay={b.autoplay} className="rounded-none" />
            </div>
          </Reveal>
          {b.caption ? <p className={clsx("mt-3 text-center text-sm", onDark ? "text-brand-100" : "text-muted")}>{b.caption}</p> : null}
        </div>
      );
    case "testimonials":
      return b.items?.length ? (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <TestimonialCards items={b.items} layout={b.layout} onDark={onDark} />
        </div>
      ) : null;
    case "projects":
      return b.items?.length ? (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <ProjectCards items={b.items} />
          <Reveal className="mt-10 text-center">
            <Link href="/projets" className={onDark ? "btn-glass group" : "btn-outline-brand group"}>
              Toutes nos réalisations <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      ) : null;
    case "universes":
      return b.items?.length ? (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <UniverseCards items={b.items} />
        </div>
      ) : null;
    case "offers":
      return b.items?.length ? (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <OfferCards items={b.items} />
        </div>
      ) : null;
    case "expertises":
    case "services":
    case "team":
    case "partners":
    case "certifications":
    case "videos":
    case "blog":
    case "faq":
      return <Catalog b={b} onDark={onDark} />;
    case "comparison":
      return <Comparison b={b} />;
    case "map":
      return <MapBlock b={b} />;
    case "contact_info":
      return <ContactInfo b={b} />;
    case "form":
      return <FormBlock b={b} />;
    case "model3d":
      return (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} onDark={onDark} />
          <Reveal variant="zoom" className="relative overflow-hidden rounded-[2rem] bg-night shadow-2xl ring-1 ring-white/10">
            <div className="absolute inset-0 bg-blueprint opacity-40" />
            <span className="glass-dark absolute left-5 top-5 z-10 rounded-full px-3 py-1 text-xs font-semibold text-white">3D · faites pivoter, zoomez</span>
            {b.media?.url ? <ModelViewer url={b.media.url} className="relative h-[520px]" /> : null}
          </Reveal>
          {b.caption ? <p className={clsx("mt-3 text-center text-sm", onDark ? "text-brand-100" : "text-muted")}>{b.caption}</p> : null}
        </div>
      );
    case "quote":
      return <QuoteBlock b={b} onDark={onDark} />;
    case "before_after":
      return (
        <div>
          <BlockTitle eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} onDark={onDark} />
          <Stagger className="grid gap-6 md:grid-cols-2" variant="zoom">
            {(b.items ?? [])
              .filter((it: any) => it.before_media && it.after_media)
              .map((it: any, i: number) => (
                <BeforeAfterSlider key={i} before={it.before_media} after={it.after_media} caption={it.caption} />
              ))}
          </Stagger>
        </div>
      );
    default:
      return null;
  }
}

/* --------------------------------------------------------------------------------------------- sections */

const BACKGROUNDS: Record<string, string> = {
  white: "bg-white",
  surface: "bg-surface",
  brand: "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900",
  dark: "bg-night",
  night: "bg-night",
  gradient: "bg-gradient-to-br from-brand-50 via-white to-accent-50",
  aurora: "bg-white",
  accent: "bg-accent-50",
  light: "bg-brand-50",
};
const DARK_BACKGROUNDS = new Set(["brand", "dark", "night"]);

export function SectionView({ section, index, embedded = false }: { section: Section; index: number; embedded?: boolean }) {
  const s = section.settings ?? {};
  const bg = s.background ?? "";
  const media: Media | null = s.media ?? null;
  const onlyHero = section.blocks.length === 1 && section.blocks[0].kind === "hero";
  const onDark = DARK_BACKGROUNDS.has(bg) || (!!media && !bg);
  const padding = { none: "", sm: "py-10", md: "py-20", lg: "py-28" }[s.padding ?? "md"] ?? "py-20";
  const width = s.width === "narrow" ? "max-w-4xl mx-auto px-4" : s.width === "full" ? "" : "container-page";
  if (onlyHero) {
    return (
      <>
        <section id={s.anchor || section.key} aria-label={section.title ?? undefined}>
          <BlockView block={section.blocks[0]} first={index === 0} pullUp={index === 0 && !embedded} />
        </section>
        {index === 0 ? <div id="apres-hero" /> : null}
      </>
    );
  }
  return (
    <section id={s.anchor || section.key} className={clsx("relative isolate overflow-hidden", BACKGROUNDS[bg] ?? (index % 2 ? "bg-white" : "bg-surface"), padding)}>
      {media ? (
        <>
          <div className="absolute inset-0 -z-20">
            <MediaImage media={media} className="h-full w-full" sizes="100vw" />
          </div>
          <div className={clsx("absolute inset-0 -z-10", onDark ? "bg-gradient-to-b from-night-950/90 via-night-900/80 to-night-950/90" : "bg-white/88")} />
        </>
      ) : null}
      {onDark ? (
        <>
          <div className="absolute inset-0 -z-10 bg-blueprint opacity-30 mask-radial" />
          <div className="aurora-blob -left-40 top-0 -z-10 h-[28rem] w-[28rem] bg-brand-500/30" />
          <div className="aurora-blob -right-32 bottom-0 -z-10 h-[24rem] w-[24rem] bg-accent-500/20 [animation-delay:-7s]" />
        </>
      ) : null}
      {bg === "aurora" ? (
        <>
          <div className="absolute inset-0 -z-10 bg-blueprint-light mask-radial" />
          <div className="aurora-blob -left-32 -top-20 -z-10 h-[26rem] w-[26rem] bg-brand-200/60" />
          <div className="aurora-blob -right-24 bottom-0 -z-10 h-[22rem] w-[22rem] bg-accent-200/60 [animation-delay:-9s]" />
        </>
      ) : null}
      {bg === "gradient" ? <div className="absolute inset-0 -z-10 bg-blueprint-light mask-radial" /> : null}
      <div className={clsx(width, "space-y-20")}>
        {section.blocks.map((block, i) => (
          <BlockView key={i} block={block} first={index === 0 && i === 0} onDark={onDark} />
        ))}
      </div>
    </section>
  );
}

export function Blocks({ blocks, onDark }: { blocks: Block[]; onDark?: boolean }) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-16">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} onDark={onDark} />
      ))}
    </div>
  );
}
