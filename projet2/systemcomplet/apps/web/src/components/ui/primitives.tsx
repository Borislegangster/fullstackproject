/** Composants de base du design system (sans état : utilisables côté serveur et client). */

import clsx from "clsx";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { initials, statusLabel, statusTone, type Tone } from "@/lib/format";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "whatsapp" | "light";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string): string {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap",
    {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    }[size],
    {
      primary: "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-10px_rgb(56_90_166_/_0.8)] hover:-translate-y-px hover:shadow-[0_12px_24px_-10px_rgb(56_90_166_/_0.9)]",
      accent: "bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_8px_20px_-10px_rgb(251_140_67_/_0.9)] hover:-translate-y-px hover:shadow-[0_12px_26px_-10px_rgb(251_140_67_/_0.95)]",
      secondary: "bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 hover:ring-brand-300",
      ghost: "text-brand-700 hover:bg-brand-50",
      danger: "bg-danger text-white hover:opacity-90",
      whatsapp: "bg-[#25D366] text-white hover:opacity-90",
      light: "bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25 backdrop-blur",
    }[variant],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  // type="button" par défaut : dans un formulaire, seul un bouton explicitement « submit » envoie le formulaire
  // (sinon tout bouton d'éditeur imbriqué — ajout de ligne, aperçu… — soumettrait le formulaire).
  return (
    <button type="button" className={buttonClass(variant, size, className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: ButtonVariant; size?: ButtonSize }) {
  const external = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
  if (external) {
    return (
      <a href={href} className={buttonClass(variant, size, className)} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  accent: "bg-accent-50 text-accent-700 ring-accent-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? statusLabel(status)}</Badge>;
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "neutral", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <Card className="group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(20_31_59_/_0.45)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-brand-200/50 to-accent-200/40 opacity-0 blur-2xl transition duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <span className={clsx("rounded-xl p-2.5 ring-1 ring-inset transition duration-300 group-hover:scale-110", TONES[tone])}>{icon}</span> : null}
      </div>
      <p className="relative mt-2 font-title text-[1.7rem] font-bold leading-tight text-ink">{value}</p>
      {hint ? <p className="relative mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function Progress({ value, tone = "brand", className, label }: { value: number; tone?: "brand" | "accent" | "success" | "danger"; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = {
    brand: "bg-gradient-to-r from-brand-400 to-brand-600",
    accent: "bg-gradient-to-r from-accent-300 to-accent-600",
    success: "bg-gradient-to-r from-emerald-400 to-emerald-600",
    danger: "bg-gradient-to-r from-red-400 to-red-600",
  }[tone];
  return (
    <div className={className}>
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span>{pct.toFixed(0)} %</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-brand-200 bg-white/70 px-6 py-14 text-center">
      <div className="pointer-events-none absolute inset-0 bg-blueprint-light mask-radial" />
      {icon ? <div className="relative mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-3.5 text-white shadow-lg shadow-brand-500/30 [&_svg]:h-7 [&_svg]:w-7">{icon}</div> : null}
      <p className="relative font-title text-lg font-semibold text-ink">{title}</p>
      {text ? <p className="relative mt-1 max-w-md text-sm text-muted">{text}</p> : null}
      {action ? <div className="relative mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton-shimmer rounded-xl", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div className={clsx("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", TONES[tone])} role={tone === "danger" ? "alert" : "status"}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name?: string | null; src?: string | null; size?: number }) {
  if (src) return <img src={src} alt={name ?? ""} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function PageTitle({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">{eyebrow}</p> : null}
        <h1 className="font-title text-2xl font-bold tracking-tight text-brand-900 sm:text-[2rem]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DescriptionList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={clsx("grid gap-x-6 gap-y-3", { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns])}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-ink">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
