"use client";

import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { useCalls } from "@/components/calls/call-provider";
import { Input } from "@/components/ui/form";
import { Alert, Avatar, Badge, Button, Card, CardHeader, PageTitle, Skeleton } from "@/components/ui/primitives";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { useRealtime } from "@/lib/realtime";

interface CallRow {
  id: string;
  kind: "audio" | "video";
  title?: string | null;
  status: string;
  initiator_id: string;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
  duration_seconds?: number | null;
  had_screen_share?: boolean;
  recording_file_id?: string | null;
  participants: { user_id: string; name: string; status: string }[];
}

interface Contact {
  id: string;
  name: string;
  job_title?: string | null;
  organization?: string | null;
  online?: boolean;
}

function duration(s?: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, "0")} s`;
}

/** Appels audio / vidéo : annuaire des personnes joignables, historique, enregistrements consentis. */
export function CallsView() {
  const { user } = useAuth();
  const calls = useCalls();
  const { online } = useRealtime();
  const history = useApi<CallRow[]>("/calls", { limit: 100 });
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<Contact[]>("/contacts", { query: { q: q || undefined } })
        .then(setContacts)
        .catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!calls.active) void history.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls.active]);

  return (
    <div>
      <PageTitle title="Appels" subtitle="Audio, vidéo et partage d'écran sécurisés (connexion HTTPS requise)." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Contacts joignables" />
          <div className="p-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" />
          </div>
          {error ? (
            <div className="px-3 pb-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
          <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="relative">
                  <Avatar name={c.name} size={36} />
                  {online.has(String(c.id)) || c.online ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{[c.job_title, c.organization].filter(Boolean).join(" · ")}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => void calls.start({ participantIds: [c.id], kind: "audio" })} aria-label={`Appeler ${c.name}`} disabled={!!calls.active}>
                  <Phone className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void calls.start({ participantIds: [c.id], kind: "video" })} aria-label={`Appel vidéo avec ${c.name}`} disabled={!!calls.active}>
                  <Video className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {!contacts.length ? <li className="px-4 py-6 text-center text-sm text-muted">Aucun contact</li> : null}
          </ul>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Historique" />
          {history.loading && !history.data ? (
            <div className="p-4">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {(history.data ?? []).map((c) => {
                const outgoing = c.initiator_id === user?.id;
                const others = c.participants.filter((p) => p.user_id !== user?.id).map((p) => p.name);
                const missed = ["missed", "rejected", "cancelled"].includes(c.status);
                const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="flex items-center gap-3">
                      <Icon className={missed ? "h-4 w-4 text-red-500" : "h-4 w-4 text-brand-600"} />
                      <span>
                        <span className="font-medium">{c.title || others.join(", ") || "Appel"}</span>
                        <span className="block text-xs text-muted">
                          {dateTime(c.started_at ?? c.created_at)} · {c.kind === "video" ? "vidéo" : "audio"} · {duration(c.duration_seconds)}
                          {c.had_screen_share ? " · écran partagé" : ""}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={missed ? "danger" : c.status === "ended" ? "neutral" : "info"}>{optionLabel(c.status)}</Badge>
                      {c.recording_file_id ? (
                        <a href={apiUrl(`/calls/${c.id}/recording`)} className="text-xs text-brand-600 underline" target="_blank" rel="noopener noreferrer">
                          Enregistrement
                        </a>
                      ) : null}
                      {["ringing", "active"].includes(c.status) && !calls.active ? (
                        <Button size="sm" onClick={() => void calls.join(c.id, c.kind === "video")}>
                          Rejoindre
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
              {!history.data?.length ? <li className="px-5 py-6 text-center text-sm text-muted">Aucun appel</li> : null}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
