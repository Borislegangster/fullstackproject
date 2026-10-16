import { ArrowRight, ArrowUpRight, Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Youtube } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { NavItem, SitePayload } from "@/lib/cms-types";

import { ConsentLink } from "./consent-link";
import { Reveal } from "./fx";
import { NewsletterForm } from "./newsletter-form";

const SOCIAL_ICONS: Record<string, ReactNode> = {
  facebook: <Facebook className="h-5 w-5" />,
  linkedin: <Linkedin className="h-5 w-5" />,
  instagram: <Instagram className="h-5 w-5" />,
  youtube: <Youtube className="h-5 w-5" />,
  whatsapp: <MessageCircle className="h-5 w-5" />,
};

function FooterLinks({ title, items }: { title: string; items: NavItem[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="eyebrow text-accent-400 [letter-spacing:0.16em]">{title}</p>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            {/^https?:/.test(item.href) ? (
              <a href={item.href} className="group inline-flex items-center gap-1 text-sm text-brand-100 transition hover:text-white" target="_blank" rel="noopener noreferrer">
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              </a>
            ) : (
              <Link href={item.href} className="group inline-flex items-center gap-1.5 text-sm text-brand-100 transition hover:translate-x-1 hover:text-white">
                <span className="h-px w-0 bg-accent-400 transition-all group-hover:w-3" />
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pied de page : appel à l'action final (promesse CMS), signature, liens, contacts, newsletter, mentions. */
export function SiteFooter({ site }: { site: SitePayload | null }) {
  const contacts = site?.contacts ?? {};
  const name = site?.company_name ?? "GLOBUS ENGINEERING";
  const whatsapp = contacts.whatsapp?.replace(/\D/g, "");
  const cta = (site?.menus?.header?.items ?? []).find((i) => i.highlight);
  const verbs = (site?.slogan ?? "").split(/\.\s*/).filter(Boolean);
  return (
    <footer className="relative isolate overflow-hidden bg-night text-brand-100">
      <div className="absolute inset-0 -z-10 bg-blueprint opacity-30 mask-fade-b" />
      <div className="aurora-blob -left-40 top-0 -z-10 h-[30rem] w-[30rem] bg-brand-500/25" />
      <div className="aurora-blob -right-32 top-40 -z-10 h-[24rem] w-[24rem] bg-accent-500/15 [animation-delay:-8s]" />

      {site?.promise ? (
        <div className="container-page pt-20">
          <Reveal variant="zoom" className="glass-dark relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-14 sm:py-16">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                {site.slogan ? <p className="eyebrow mb-4 text-accent-300">{site.slogan}</p> : null}
                <p className="font-title text-3xl font-bold leading-tight text-white sm:text-5xl">
                  <span className="text-gradient-light">{site.promise}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {cta ? (
                  <Link href={cta.href} className="btn-glow group">
                    {cta.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </Link>
                ) : null}
                {whatsapp ? (
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-glass" data-track="whatsapp-footer">
                    <MessageCircle className="h-5 w-5" /> WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          </Reveal>
        </div>
      ) : null}

      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-4">
          <span className="inline-flex rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
            <img src={site?.logo_dark?.variants?.thumb?.url ?? site?.logo?.variants?.thumb?.url ?? site?.logo?.url ?? "/brand/logo-globus.png"} alt={name} className="h-10 w-auto" />
          </span>
          {verbs.length > 1 ? (
            <ul className="flex flex-wrap gap-2">
              {verbs.map((v) => (
                <li key={v} className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white ring-1 ring-white/10">
                  {v}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="max-w-sm text-sm leading-relaxed text-brand-200">{site?.default_meta_description}</p>
          {site?.socials?.length ? (
            <div className="flex flex-wrap gap-2">
              {site.socials.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-social={s.network}
                  data-location="footer"
                  aria-label={s.label ?? s.network}
                  className="rounded-xl bg-white/5 p-2.5 text-white ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-accent-500 hover:ring-accent-400"
                >
                  {SOCIAL_ICONS[s.network] ?? <span className="text-xs font-semibold uppercase">{s.network.slice(0, 2)}</span>}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="lg:col-span-2">
          <FooterLinks title={site?.menus?.footer_main?.title ?? "Navigation"} items={site?.menus?.footer_main?.items ?? []} />
        </div>
        <div className="lg:col-span-3">
          <p className="eyebrow text-accent-400 [letter-spacing:0.16em]">Contact</p>
          <ul className="mt-5 space-y-4 text-sm">
            {contacts.address || contacts.city ? (
              <li className="flex gap-3">
                <span className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  <MapPin className="h-4 w-4 text-accent-400" />
                </span>
                <span className="pt-1">{[contacts.address, contacts.city, contacts.country].filter(Boolean).join(", ")}</span>
              </li>
            ) : null}
            {contacts.phone ? (
              <li className="flex gap-3">
                <span className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  <Phone className="h-4 w-4 text-accent-400" />
                </span>
                <a href={`tel:${contacts.phone.replace(/\s/g, "")}`} className="pt-1 hover:text-white">
                  {contacts.phone}
                </a>
              </li>
            ) : null}
            {whatsapp ? (
              <li className="flex gap-3">
                <span className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  <MessageCircle className="h-4 w-4 text-accent-400" />
                </span>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="pt-1 hover:text-white">
                  WhatsApp
                </a>
              </li>
            ) : null}
            {contacts.email ? (
              <li className="flex gap-3">
                <span className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  <Mail className="h-4 w-4 text-accent-400" />
                </span>
                <a href={`mailto:${contacts.email}`} className="break-all pt-1 hover:text-white">
                  {contacts.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="lg:col-span-3">
          <div className="glass-dark rounded-3xl p-6">
            <p className="eyebrow text-accent-400 [letter-spacing:0.16em]">Newsletter</p>
            <p className="mt-3 text-sm text-brand-200">Conseils, méthodes et coulisses de nos chantiers, une fois par mois.</p>
            <div className="mt-4">
              <NewsletterForm dark />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <p className="-mb-[0.18em] text-center font-title text-[18vw] font-bold leading-none tracking-tight text-transparent [-webkit-text-stroke:1px_rgb(255_255_255_/_0.09)]">{name.split(" ")[0]}</p>
      </div>

      <div className="border-t border-white/10 bg-night-950/60">
        {/* Marge basse sur mobile : les boutons flottants (haut de page, assistant) ne masquent pas les mentions. */}
        <div className="container-page flex flex-col gap-3 pb-28 pt-5 text-xs text-brand-200 md:flex-row md:items-center md:justify-between md:pb-5">
          <p>
            © {new Date().getFullYear()} {name}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {(site?.menus?.footer_legal?.items ?? []).map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <ConsentLink className="hover:text-white" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
