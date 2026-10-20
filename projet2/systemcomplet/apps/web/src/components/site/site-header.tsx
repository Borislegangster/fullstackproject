"use client";

import clsx from "clsx";
import { ArrowRight, ChevronDown, Menu, Phone, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import type { Media, NavItem } from "@/lib/cms-types";

import { DynIcon } from "./icon";

function NavLink({ item, onNavigate, className, children }: { item: NavItem; onNavigate?: () => void; className?: string; children?: React.ReactNode }) {
  const external = /^https?:/.test(item.href);
  if (external || item.open_new_tab)
    return (
      <a href={item.href} target={item.open_new_tab ? "_blank" : undefined} rel="noopener noreferrer" className={className} onClick={onNavigate}>
        {children ?? item.label}
      </a>
    );
  return (
    <Link href={item.href || "/"} className={className} onClick={onNavigate}>
      {children ?? item.label}
    </Link>
  );
}

/** En-tête de la vitrine : transparent au-dessus d'un héros sombre, verre dépoli au défilement, méga-menus
 * illustrés (icône + description issues du CMS), menu mobile plein écran. */
export function SiteHeader({
  items,
  mobileItems = [],
  actionItems = [],
  logo,
  companyName,
  phone,
}: {
  items: NavItem[];
  /** Menu « Menu mobile » du CMS (sinon : celui de l'en-tête). */
  mobileItems?: NavItem[];
  /** Menu « Boutons d'action de l'en-tête » du CMS (sinon : éléments « mis en avant » de l'en-tête). */
  actionItems?: NavItem[];
  logo?: Media | null;
  companyName: string;
  phone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const regular = items.filter((i) => !i.highlight);
  const highlighted = actionItems.length ? actionItems : items.filter((i) => i.highlight);
  const mobile = (mobileItems.length ? mobileItems : items).filter((i) => !i.highlight);
  const active = (href: string) => (href === "/" ? pathname === "/" : !!pathname?.startsWith(href));
  const tel = phone?.replace(/\s/g, "");

  return (
    <>
      <header className="site-header sticky top-0 z-50" data-scrolled={scrolled ? "true" : "false"}>
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <Link href="/" className="hdr-logo flex shrink-0 items-center rounded-xl transition" aria-label={`${companyName} — accueil`}>
            <img src={logo?.variants?.thumb?.url ?? logo?.url ?? "/brand/logo-globus.png"} alt={logo?.alt ?? companyName} className="h-9 w-auto lg:h-11" />
          </Link>
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
            {regular.map((item, ki) =>
              item.children.length ? (
                <div key={`${item.label}-${ki}`} className="group relative">
                  <button type="button" className={clsx("hdr-link flex items-center gap-1", item.children.some((c) => active(c.href)) && "is-active")}>
                    {item.label}
                    <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" />
                  </button>
                  <div className="invisible absolute left-1/2 top-full w-[36rem] -translate-x-1/2 translate-y-3 pt-3 opacity-0 transition duration-300 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="glass grid grid-cols-2 gap-1 rounded-3xl p-3">
                      {item.children.map((child, ki) => (
                        <NavLink key={`${child.label}-${ki}`} item={child} className="group/item flex items-start gap-3 rounded-2xl p-3 transition hover:bg-brand-50/80">
                          <span className="mt-0.5 inline-flex rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-2 text-white shadow-md transition group-hover/item:from-accent-400 group-hover/item:to-accent-600">
                            <DynIcon name={child.icon} className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-brand-800">{child.label}</span>
                            {child.description ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{child.description}</span> : null}
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <NavLink key={`${item.label}-${ki}`} item={item} className={clsx("hdr-link", active(item.href) && "is-active")} />
              ),
            )}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link href="/recherche" className="hdr-icon hidden sm:inline-flex" aria-label="Rechercher">
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/connexion" className="hdr-ghost hidden items-center gap-1.5 md:inline-flex">
              <UserRound className="h-4 w-4" /> Espace client
            </Link>
            {highlighted.map((item, ki) => (
              <NavLink key={`${item.label}-${ki}`} item={item} className="btn-glow hidden !rounded-xl !px-4 !py-2.5 text-sm sm:inline-flex">
                {item.label}
                <ArrowRight className="h-4 w-4" />
              </NavLink>
            ))}
            <button type="button" className="hdr-icon lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="menu-mobile" aria-label="Ouvrir le menu">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile plein écran */}
      <div
        id="menu-mobile"
        className={clsx("fixed inset-0 z-[70] overflow-y-auto bg-night text-white transition duration-500 lg:hidden", open ? "visible opacity-100" : "invisible opacity-0")}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="absolute inset-0 bg-blueprint opacity-40" />
        <div className="aurora-blob -right-24 top-10 h-72 w-72 bg-accent-500/30" />
        <div className="relative flex min-h-full flex-col">
          <div className="container-page flex h-16 items-center justify-between">
            <span className="rounded-xl bg-white/95 px-2 py-1">
              <img src={logo?.variants?.thumb?.url ?? logo?.url ?? "/brand/logo-globus.png"} alt={companyName} className="h-8 w-auto" />
            </span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 p-2.5" aria-label="Fermer le menu">
              <X className="h-6 w-6" />
            </button>
          </div>
          {open ? (
            <nav className="container-page flex flex-1 flex-col gap-1 py-6" aria-label="Navigation mobile">
              {mobile.map((item, i) => (
                  <div key={`${item.label}-${i}`} className="fade-up border-b border-white/10 py-2" style={{ "--delay": `${80 + i * 55}ms` } as CSSProperties}>
                    <NavLink item={item} onNavigate={() => setOpen(false)} className={clsx("block py-2 font-title text-2xl font-bold", active(item.href) ? "text-accent-400" : "text-white")} />
                    {item.children.length ? (
                      <div className="grid grid-cols-2 gap-1 pb-2">
                        {item.children.map((child, ki) => (
                          <NavLink key={`${child.label}-${ki}`} item={child} onNavigate={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-brand-100 hover:bg-white/10">
                            <DynIcon name={child.icon} className="h-4 w-4 text-accent-400" />
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              <div className="fade-up mt-auto grid gap-3 pt-8" style={{ "--delay": "450ms" } as CSSProperties}>
                {highlighted.map((item, ki) => (
                  <NavLink key={`${item.label}-${ki}`} item={item} onNavigate={() => setOpen(false)} className="btn-glow w-full">
                    {item.label} <ArrowRight className="h-4 w-4" />
                  </NavLink>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/connexion" onClick={() => setOpen(false)} className="btn-glass">
                    <UserRound className="h-4 w-4" /> Espace client
                  </Link>
                  {tel ? (
                    <a href={`tel:${tel}`} className="btn-glass">
                      <Phone className="h-4 w-4" /> Appeler
                    </a>
                  ) : (
                    <Link href="/recherche" onClick={() => setOpen(false)} className="btn-glass">
                      <Search className="h-4 w-4" /> Rechercher
                    </Link>
                  )}
                </div>
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}
