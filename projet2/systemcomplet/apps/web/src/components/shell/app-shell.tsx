"use client";

import clsx from "clsx";
import { ChevronDown, CircleHelp, LogOut, Menu, ShieldAlert, UserRound, WifiOff, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CallProvider } from "@/components/calls/call-provider";
import { RouteLoader } from "@/components/site/globus-loader";
import { FilePreviewHost } from "@/components/ui/file-preview";
import { MfaStepUpHost } from "@/components/ui/mfa-step-up";
import { Avatar } from "@/components/ui/primitives";
import { accountPathFor, useAuth, useSpaceGuard } from "@/lib/auth";
import { useOnline } from "@/lib/hooks";
import { RealtimeProvider, useRealtime } from "@/lib/realtime";

import { NotificationBell } from "./notification-bell";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Permissions dont au moins une est requise pour afficher l'entrée. */
  perms?: string[];
  /** Espaces requis (ex. extranet_supplier). */
  spaces?: string[];
  /** Module optionnel requis (désactivé par défaut, ouvert par l'administration). */
  feature?: string;
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Aide contextuelle : ouvre la page de documentation de l'écran courant (onglet compris). */
function HelpButton({ base }: { base: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`${base}/documentation?route=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
      className="rounded-xl p-2 text-ink hover:bg-brand-50"
      aria-label="Aide sur cet écran"
      title="Aide sur cet écran"
    >
      <CircleHelp className="h-5 w-5" />
    </button>
  );
}

function ConnectionDot() {
  const { status } = useRealtime();
  return (
    <span
      className={clsx("h-2 w-2 rounded-full", status === "open" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : "bg-red-500")}
      title={status === "open" ? "Temps réel connecté" : status === "connecting" ? "Connexion temps réel…" : "Temps réel déconnecté"}
    />
  );
}

function UserMenu({ accountHref }: { accountHref: string }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-brand-50" aria-expanded={open} aria-haspopup="menu" aria-label={`Menu du compte : ${user.full_name}`}>
        <Avatar name={user.full_name} src={user.avatar_url} size={32} />
        <span className="hidden text-left md:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-ink">{user.full_name}</span>
          <span className="block max-w-[10rem] truncate text-xs text-muted">{user.job_title ?? user.organization?.name ?? user.email}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-white p-1.5 shadow-2xl">
            <div className="border-b border-line px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">{user.full_name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <Link href={accountHref} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-slate-50">
              <UserRound className="h-4 w-4" /> Mon compte et sécurité
            </Link>
            <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SidebarNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const { user, canAny } = useAuth();
  // entrée active = correspondance la plus précise (ex. « Échéanciers » plutôt que « Finances » sur /erp/finances/echeanciers)
  const activeHref = sections
    .flatMap((s) => s.items)
    .filter((it) => (it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Navigation de l'espace">
      {sections.map((section, i) => {
        const items = section.items.filter((it) => (!it.perms || canAny(...it.perms)) && (!it.spaces || it.spaces.some((s) => user?.spaces.includes(s))) && (!it.feature || !!user?.features?.includes(it.feature)));
        if (!items.length) return null;
        return (
          <div key={section.title ?? i}>
            {section.title ? <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300/80">{section.title}</p> : null}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition duration-300",
                        active
                          ? "bg-gradient-to-r from-white/[0.16] to-white/[0.04] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08)]"
                          : "text-brand-100/90 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white",
                      )}
                    >
                      {active ? <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-accent-300 to-accent-600 shadow-[0_0_12px_rgb(251_140_67_/_0.8)]" /> : null}
                      <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition", active ? "bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-lg shadow-accent-500/30" : "bg-white/5 text-brand-200 group-hover:bg-white/10 group-hover:text-white")}>
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function ShellFrame({ sections, title, base, accountHref, children, topbar }: { sections: NavSection[]; title: string; base: string; accountHref?: string; children: ReactNode; topbar?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const online = useOnline();
  const { user } = useAuth();
  useEffect(() => setMobileOpen(false), [pathname]);
  const account = accountHref ?? (user ? accountPathFor(user) : "/");
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col overflow-hidden bg-night lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-25 mask-fade-b" />
        <div className="aurora-blob -left-24 -top-24 h-72 w-72 bg-brand-500/35" />
        <div className="aurora-blob -bottom-28 -right-24 h-64 w-64 bg-accent-500/20 [animation-delay:-7s]" />
        <Link href={base} className="relative flex items-center gap-3 px-5 py-5">
          <span className="rounded-xl bg-white/95 p-1.5 shadow-lg">
            <img src="/brand/logo-globus.png" alt="GLOBUS ENGINEERING" className="h-8 w-auto" />
          </span>
          <span className="font-title text-sm font-semibold leading-tight text-white">{title}</span>
        </Link>
        <div className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgb(255_255_255_/_0.15)_transparent] [scrollbar-width:thin]">
          <SidebarNav sections={sections} />
        </div>
        <p className="relative border-t border-white/10 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-brand-300/70">Concevoir · Calculer · Construire · Contrôler</p>
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button type="button" className="absolute inset-0 bg-brand-900/50" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col overflow-hidden bg-night">
            <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-25" />
            <div className="relative flex items-center justify-between px-5 py-4">
              <span className="font-title text-sm font-semibold text-white">{title}</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded p-1 text-white hover:bg-white/10" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto">
              <SidebarNav sections={sections} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/60 bg-white/75 px-4 shadow-[0_8px_30px_-20px_rgb(20_31_59_/_0.35)] backdrop-blur-xl backdrop-saturate-150 sm:px-6">
          <button type="button" className="rounded-lg p-2 hover:bg-brand-50 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">{topbar}</div>
          <ConnectionDot />
          <HelpButton base={base} />
          <NotificationBell base={base} />
          <UserMenu accountHref={account} />
        </header>
        {!online ? (
          <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900" role="status">
            <WifiOff className="h-4 w-4" /> Hors connexion : les données affichées peuvent ne plus être à jour.
          </div>
        ) : null}
        {user && user.mfa_required && !user.mfa_enabled ? (
          <div className="flex flex-wrap items-center gap-2 bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
            <ShieldAlert className="h-4 w-4" /> La double authentification est obligatoire pour votre profil.
            <Link href={`${account}?mfa=obligatoire`} className="font-semibold underline">
              Activer maintenant
            </Link>
          </div>
        ) : null}
        <main id="contenu" className="relative min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64 bg-gradient-to-b from-brand-100/60 via-brand-50/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64 bg-blueprint-light mask-fade-b" />
          <div className="relative">{children}</div>
        </main>
        <FilePreviewHost />
        <MfaStepUpHost accountHref={account} />
      </div>
    </div>
  );
}

/** Coque des espaces authentifiés (ERP, espace client, extranet) : garde d'accès, temps réel, appels. */
export function AppShell(props: { spaces: string[]; sections: NavSection[]; title: string; base: string; accountHref?: string; children: ReactNode; topbar?: ReactNode }) {
  const { ready } = useSpaceGuard(props.spaces);
  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center bg-night text-white">
        <div className="absolute inset-0 bg-blueprint opacity-30 mask-radial" />
        <div className="relative">
          <RouteLoader label="Ouverture de votre espace sécurisé" dark skeleton={false} />
        </div>
      </div>
    );
  return (
    <RealtimeProvider>
      <CallProvider>
        <ShellFrame {...props} />
      </CallProvider>
    </RealtimeProvider>
  );
}
