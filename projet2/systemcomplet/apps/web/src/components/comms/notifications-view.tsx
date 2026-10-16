"use client";

import clsx from "clsx";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NotificationPreferences } from "@/components/account/account-view";
import { resolveLink, type NotificationItem } from "@/components/shell/notification-bell";
import { Pagination } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/overlay";
import { Button, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useList } from "@/lib/hooks";
import { useRealtimeEvent } from "@/lib/realtime";

const CATEGORY_OPTIONS = [
  ["projects", "Projets"],
  ["decisions", "Décisions"],
  ["finance", "Finances"],
  ["documents", "Documents"],
  ["procurement", "Achats"],
  ["deliveries", "Livraisons"],
  ["subcontracting", "Sous-traitance"],
  ["disputes", "Litiges"],
  ["bim", "BIM"],
  ["qhse", "QHSE"],
  ["support", "SAV"],
  ["chat", "Messagerie"],
  ["calls", "Appels"],
  ["security", "Sécurité"],
  ["system", "Système"],
] as const;

export function NotificationsView({ base }: { base: string }) {
  const router = useRouter();
  const [tab, setTab] = useState("list");
  const list = useList<NotificationItem>("/notifications", { pageSize: 25 });
  useRealtimeEvent("notification", () => void list.reload());

  const open = async (n: NotificationItem) => {
    if (!n.read_at) await api("/notifications/read", { method: "POST", body: { ids: [n.id] } }).catch(() => undefined);
    const target = resolveLink(n.link, base);
    if (target) router.push(target);
    else void list.reload();
  };

  return (
    <div>
      <PageTitle
        title="Notifications"
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              await api("/notifications/read", { method: "POST", body: { ids: null } });
              void list.reload();
            }}
          >
            <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
          </Button>
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "list", label: "Mes notifications" },
          { key: "prefs", label: "Préférences" },
        ]}
      />
      {tab === "prefs" ? (
        <NotificationPreferences />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <Select
              className="w-auto"
              value={list.state.filters.unread ?? ""}
              onChange={(e) => list.setFilter("unread", e.target.value)}
              options={[{ value: "true", label: "Non lues" }]}
              placeholder="Toutes"
              aria-label="Statut de lecture"
            />
            <Select
              className="w-auto"
              value={list.state.filters.category ?? ""}
              onChange={(e) => list.setFilter("category", e.target.value)}
              options={CATEGORY_OPTIONS.map(([value, label]) => ({ value, label }))}
              placeholder="Toutes catégories"
              aria-label="Catégorie"
            />
          </div>
          {list.loading && !list.items.length ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : list.items.length ? (
            <ul className="divide-y divide-line">
              {list.items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => void open(n)} className={clsx("flex w-full gap-3 px-5 py-3.5 text-left hover:bg-slate-50", !n.read_at && "bg-brand-50/50")}>
                    <span className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", n.read_at ? "bg-slate-200" : n.priority === "critical" || n.priority === "high" ? "bg-red-500" : "bg-accent-500")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink">{n.title}</span>
                        <span className="text-xs text-muted">{dateTime(n.created_at)}</span>
                      </span>
                      {n.body ? <span className="mt-0.5 block text-sm text-muted">{n.body}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6">
              <EmptyState title="Aucune notification" />
            </div>
          )}
          {list.total > 0 ? <Pagination list={list} /> : null}
        </Card>
      )}
    </div>
  );
}
