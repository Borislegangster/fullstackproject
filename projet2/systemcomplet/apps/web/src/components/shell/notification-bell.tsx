"use client";

import clsx from "clsx";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { api, type Page } from "@/lib/api";
import { relative } from "@/lib/format";
import { useRealtimeEvent } from "@/lib/realtime";

export interface NotificationItem {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  priority?: string;
  category?: string;
  created_at: string;
  read_at?: string | null;
}

/** Traduit un lien de notification (générique ou spécifique à un espace) en route de l'espace courant. */
export function resolveLink(link: string | null | undefined, base: string): string | null {
  if (!link) return null;
  try {
    const url = new URL(link, "http://local");
    if (url.origin !== "http://local" && typeof window !== "undefined" && url.origin !== window.location.origin) return null;
    const path = url.pathname + url.search;
    // « Mon compte » de l'espace courant (alerte de nouvelle connexion, y compris les anciennes notifications).
    if (/^\/compte(\?|$)/.test(path)) return `${base}${path}`;
    if (path === "/erp/securite" && base !== "/erp") return `${base}/compte?onglet=sessions`;
    if (path === "/erp/appels" && base !== "/erp") return `${base}/appels`;
    if (/^\/(erp|espace-client|extranet)(\/|$)/.test(path)) return path;
    const m = path.match(/^\/(agenda|appels|messagerie)(?:\/([^/?]+))?(?:\?|$)/);
    if (m) {
      const param = { agenda: "event", appels: "call", messagerie: "c" }[m[1] as "agenda" | "appels" | "messagerie"];
      return m[2] ? `${base}/${m[1]}?${param}=${m[2]}` : `${base}/${m[1]}`;
    }
    if (path.startsWith("/notifications")) return `${base}/notifications`;
    return path;
  } catch {
    return null;
  }
}

export function NotificationBell({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();

  const refreshCount = useCallback(() => {
    api<{ unread: number }>("/notifications/unread-count")
      .then((r) => setUnread(r.unread))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 120_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api<Page<NotificationItem> & { unread_count: number }>("/notifications", { query: { page_size: 12 } })
      .then((p) => {
        setItems(p.items);
        setUnread(p.unread_count);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useRealtimeEvent("notification", (n: NotificationItem) => {
    setUnread((u) => u + 1);
    setItems((list) => [{ ...n, created_at: n.created_at ?? new Date().toISOString() }, ...list].slice(0, 12));
    if (n.priority === "critical" || n.priority === "high") toast.warning(n.title, n.body ?? undefined);
    else toast.info(n.title, n.body ?? undefined);
  });

  const markAll = async () => {
    await api("/notifications/read", { method: "POST", body: { ids: null } }).catch(() => undefined);
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const openItem = async (n: NotificationItem) => {
    if (!n.read_at) {
      void api("/notifications/read", { method: "POST", body: { ids: [n.id] } }).catch(() => undefined);
      setUnread((u) => Math.max(0, u - 1));
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    const target = resolveLink(n.link, base);
    setOpen(false);
    if (target) router.push(target);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2 text-ink hover:bg-brand-50" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
        <Bell className="h-5 w-5" />
        {unread ? <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        // Mobile : panneau calé sous l'en-tête (h-16) sur toute la largeur de l'écran — la cloche n'est pas au bord
        // droit, un menu accroché à elle déborderait à gauche. Dès sm : menu déroulant classique sous la cloche.
        <div className="fixed left-2 right-2 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold text-ink">Notifications</p>
            {unread ? (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
              </button>
            ) : null}
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {loading && !items.length ? <li className="px-4 py-6 text-center text-sm text-muted">Chargement…</li> : null}
            {!loading && !items.length ? <li className="px-4 py-6 text-center text-sm text-muted">Aucune notification</li> : null}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => void openItem(n)} className={clsx("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read_at && "bg-brand-50/60")}>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : n.priority === "critical" || n.priority === "high" ? "bg-red-500" : "bg-accent-500")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    {n.body ? <span className="line-clamp-2 block text-xs text-muted">{n.body}</span> : null}
                    <span className="mt-0.5 block text-[11px] text-muted">{relative(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link href={`${base}/notifications`} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50" onClick={() => setOpen(false)}>
            Voir toutes les notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
