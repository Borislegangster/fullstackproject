"use client";

import { Camera, Clapperboard, KeyRound, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export interface TimelapseRow {
  id: string;
  period_start: string;
  period_end: string;
  frames: number;
  duration_s: string;
  source: "camera" | "photos";
  status: string;
  error?: string | null;
  sent_at?: string | null;
  video_url?: string | null;
  poster_url?: string | null;
}

/** Time-lapses hebdomadaires (R2) — client : `/client/projects/{id}/timelapses` ; équipe : `/projects/{id}/timelapses`. */
export function TimelapseGallery({ path, emptyText }: { path: string; emptyText: string }) {
  const list = useApi<TimelapseRow[]>(path);
  const [current, setCurrent] = useState(0);
  if (list.loading && !list.data) return <Skeleton className="h-72 w-full" />;
  const items = (list.data ?? []).filter((t) => t.status === "ready" && t.video_url);
  if (!items.length) {
    return (
      <Card className="p-5">
        <EmptyState icon={<Clapperboard className="h-8 w-8" />} title="Pas encore de time-lapse" text={emptyText} />
      </Card>
    );
  }
  const t = items[Math.min(current, items.length - 1)];
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-accent-500" /> Votre chantier en vidéo
          </span>
        }
        subtitle={`Semaine du ${date(t.period_start)} au ${date(t.period_end)} · ${t.frames} images · ${number(t.duration_s, 0)} s`}
      />
      <video key={t.id} src={t.video_url ?? undefined} poster={t.poster_url ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
      {items.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3">
          {items.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setCurrent(i)}
              className={`shrink-0 overflow-hidden rounded-lg ring-2 ${i === current ? "ring-accent-500" : "ring-transparent"}`}
              aria-label={`Semaine du ${date(x.period_start)}`}
            >
              {x.poster_url ? <img src={x.poster_url} alt="" className="h-14 w-24 object-cover" /> : <span className="block h-14 w-24 bg-slate-200" />}
              <span className="block bg-white px-1 py-0.5 text-[10px] text-muted">{date(x.period_start)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

interface CameraRow {
  id: string;
  name: string;
  token_hint: string;
  active: boolean;
  last_seen_at?: string | null;
  snapshots: number;
}

/** Équipe projet : génération à la demande et caméras 4G du chantier. */
export function TimelapseAdmin({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const timelapses = useApi<TimelapseRow[]>(`/projects/${projectId}/timelapses`);
  const cameras = useApi<CameraRow[]>(`/projects/${projectId}/cameras`);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const generate = async (send: boolean) => {
    setBusy(true);
    try {
      await api(`/projects/${projectId}/timelapses`, { body: { send } });
      toast.success(send ? "Time-lapse généré et envoyé au client" : "Time-lapse généré");
      void timelapses.reload();
    } catch (err) {
      toast.error("Génération impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-accent-500" /> Time-lapse hebdomadaire
            </span>
          }
          subtitle="Généré chaque lundi à partir des caméras 4G ou, à défaut, des photos publiées (jamais des photos internes) ; envoyé au client."
          actions={
            can("projects:publish_client") ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" loading={busy} onClick={() => void generate(false)}>
                  <RefreshCw className="h-4 w-4" /> Générer la semaine écoulée
                </Button>
                <Button size="sm" variant="accent" disabled={busy} onClick={() => void generate(true)}>
                  <Send className="h-4 w-4" /> Générer et envoyer
                </Button>
              </div>
            ) : null
          }
        />
        {timelapses.data?.length ? (
          <ul className="divide-y divide-line">
            {timelapses.data.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  Semaine du {date(t.period_start)} au {date(t.period_end)} · {t.frames} images ({t.source === "camera" ? "caméras" : "photos publiées"})
                  {t.sent_at ? <span className="text-xs text-muted"> · envoyé le {dateTime(t.sent_at)}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={t.status === "ready" ? "success" : "danger"}>{t.status === "ready" ? "Prêt" : "Échec"}</Badge>
                  {t.video_url ? (
                    <a href={t.video_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-600 hover:underline">
                      Voir
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState title="Aucun time-lapse" text="Au moins 4 photos publiées (ou 8 clichés caméra) sur la semaine sont nécessaires." />
          </div>
        )}
      </Card>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-600" /> Caméras 4G du chantier
            </span>
          }
          subtitle="Chaque caméra dépose ses clichés avec son propre jeton (révocable), sur /api/v1/devices/cameras/snapshots."
          actions={
            can("projects:write") ? (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Ajouter une caméra
              </Button>
            ) : null
          }
        />
        {cameras.data?.length ? (
          <ul className="divide-y divide-line">
            {cameras.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{c.name}</span> <span className="font-mono text-xs text-muted">{c.token_hint}</span>{" "}
                  {c.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Désactivée</Badge>}
                  <span className="block text-xs text-muted">
                    {c.snapshots} cliché(s){c.last_seen_at ? ` · dernier ${dateTime(c.last_seen_at)}` : " · jamais connectée"}
                  </span>
                </span>
                {c.active && can("projects:write") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await api(`/cameras/${c.id}`, { method: "DELETE" });
                      toast.success("Caméra désactivée");
                      void cameras.reload();
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Désactiver
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState title="Aucune caméra" text="Une caméra fixe sur mât donne les time-lapses les plus spectaculaires." />
          </div>
        )}
      </Card>
      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setToken(null);
          setName("");
        }}
        title="Nouvelle caméra de chantier"
        footer={
          token ? null : (
            <Button
              disabled={name.trim().length < 2}
              onClick={async () => {
                try {
                  const res = await api<{ token: string }>(`/projects/${projectId}/cameras`, { body: { name } });
                  setToken(res.token);
                  void cameras.reload();
                } catch (err) {
                  toast.error("Création impossible", errorMessage(err));
                }
              }}
            >
              Créer
            </Button>
          )
        }
      >
        {token ? (
          <div className="space-y-3">
            <Alert tone="warning" title="Jeton affiché une seule fois">
              Saisissez-le dans la caméra / passerelle 4G (en-tête <code>X-Camera-Token</code>).
            </Alert>
            <p className="flex items-center gap-2 break-all rounded-xl bg-surface p-3 font-mono text-xs">
              <KeyRound className="h-4 w-4 shrink-0" /> {token}
            </p>
          </div>
        ) : (
          <Field label="Nom de la caméra" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mât nord — vue façade" />
          </Field>
        )}
      </Modal>
    </div>
  );
}
