"use client";

import { Copy, Link2, MessageCircle, Share2, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Share {
  id: string;
  title: string;
  token_hint: string;
  has_pin: boolean;
  expires_at: string;
  max_views?: number | null;
  views: number;
  last_viewed_at?: string | null;
  active: boolean;
  revoked_at?: string | null;
}

/** Partage d'une visite 360° / d'une maquette 3D avec la famille (R5) : lien sécurisé, expiration, PIN, révocation. */
export function ShareVisitButton({ projectId, contentId, modelId, title, onCreated }: { projectId: string; contentId?: string; modelId?: string; title: string; onCreated?: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [pin, setPin] = useState("");
  const [views, setViews] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ url: string }>(`/client/projects/${projectId}/visits`, {
        body: {
          content_id: contentId ?? null,
          model_id: modelId ?? null,
          days: Number(days),
          pin: pin || null,
          max_views: views ? Number(views) : null,
          message: message || null,
        },
      });
      setUrl(res.url);
      onCreated?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setOpen(false);
    setUrl(null);
    setPin("");
    setMessage("");
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" /> Partager
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Partager la visite avec vos proches"
        description={title}
        footer={
          url ? (
            <Button onClick={close}>Terminé</Button>
          ) : (
            <Button loading={busy} disabled={!!pin && !/^\d{4,8}$/.test(pin)} onClick={() => void create()}>
              <Link2 className="h-4 w-4" /> Créer le lien
            </Button>
          )
        }
      >
        {url ? (
          <div className="space-y-4">
            <Alert tone="success" title="Lien créé">
              Copiez-le maintenant : il n&apos;est affiché qu&apos;une seule fois.{pin ? " Communiquez le code PIN séparément." : ""}
            </Alert>
            <p className="break-all rounded-xl bg-surface p-3 font-mono text-xs">{url}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  toast.success("Lien copié");
                }}
              >
                <Copy className="h-4 w-4" /> Copier
              </Button>
              <a
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white"
                href={`https://wa.me/?text=${encodeURIComponent(`Visitez notre future maison en 360° : ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validité">
              <Select value={days} onChange={(e) => setDays(e.target.value)} options={[{ value: "1", label: "24 heures" }, { value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }]} />
            </Field>
            <Field label="Nombre de visites max." help="Vide = illimité pendant la validité">
              <Input type="number" min={1} value={views} onChange={(e) => setViews(e.target.value)} />
            </Field>
            <Field label="Code PIN (facultatif)" help="4 à 8 chiffres, à transmettre séparément">
              <Input inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Mot d'accueil" className="sm:col-span-2">
              <Textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Voici notre future maison, à bientôt pour la crémaillère !" />
            </Field>
            <p className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Vos invités voient uniquement ce contenu : aucune information financière ni document du projet.
            </p>
            {error ? <div className="sm:col-span-2"><Alert tone="danger">{error}</Alert></div> : null}
          </div>
        )}
      </Modal>
    </>
  );
}

export function MyVisitShares({ projectId, refreshKey = 0 }: { projectId: string; refreshKey?: number }) {
  const toast = useToast();
  const shares = useApi<Share[]>(`/client/projects/${projectId}/visits`, undefined, [refreshKey]);
  if (!shares.data?.length) return null;
  return (
    <Card>
      <CardHeader title="Mes liens de visite partagés" subtitle="Révoquez un lien à tout moment : il cesse immédiatement de fonctionner." />
      <ul className="divide-y divide-line">
        {shares.data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-medium">
                {s.title} <span className="font-mono text-xs text-muted">{s.token_hint}</span>{" "}
                {s.active ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">{s.revoked_at ? "Révoqué" : "Expiré"}</Badge>}
                {s.has_pin ? <Badge tone="info">PIN</Badge> : null}
              </p>
              <p className="text-xs text-muted">
                {s.views} visite(s){s.max_views ? ` / ${s.max_views}` : ""} · expire le {date(s.expires_at)}
                {s.last_viewed_at ? ` · dernière le ${date(s.last_viewed_at)}` : ""}
              </p>
            </div>
            {s.active ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await api(`/visits/${s.id}/revoke`, { method: "POST" });
                    toast.success("Lien révoqué");
                    void shares.reload();
                  } catch (err) {
                    toast.error("Révocation impossible", errorMessage(err));
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Révoquer
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
