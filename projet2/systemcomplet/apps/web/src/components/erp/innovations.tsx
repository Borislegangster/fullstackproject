"use client";

import { BadgeCheck, Ban, Download, ExternalLink, FileCheck2, Megaphone, Printer, QrCode, Send, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { TrustCard } from "@/components/innovations/trust";
import { Checkbox, Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage, type Page } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";

// ============================================================================ R3 / R4 — confiance et preuves
interface ProofRow {
  id: string;
  number: string;
  title: string;
  subject: string;
  subject_type: string;
  sha256: string;
  algorithm: string;
  issued_at: string;
  leaves: { label: string; sha256: string }[];
  anchor_status: string;
  anchored_at?: string | null;
  revoked: boolean;
  revoked_reason?: string | null;
  verification_url: string;
  public_code: string;
  client_visible: boolean;
}

const ANCHOR_LABELS: Record<string, string> = {
  none: "Registre GLOBUS",
  queued: "Horodatage public en file",
  pending: "Horodaté (OpenTimestamps)",
  failed: "Horodatage à relancer",
};

export function ProofList({ projectId }: { projectId: string }) {
  const { can, canAny } = useAuth();
  const toast = useToast();
  const proofs = useApi<Page<ProofRow>>("/proofs", { project_id: projectId, page_size: 100 });
  const [revoking, setRevoking] = useState<ProofRow | null>(null);
  const [reason, setReason] = useState("");
  const certifyToday = async () => {
    try {
      await api("/proofs/certify", { body: { subject_type: "photo_day", subject_id: `${projectId}:${new Date().toISOString().slice(0, 10)}` } });
      toast.success("Photos du jour certifiées");
      void proofs.reload();
    } catch (err) {
      toast.error("Certification impossible", errorMessage(err));
    }
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" /> Preuves opposables
          </span>
        }
        subtitle="Empreintes SHA-256 des documents publiés, décisions validées, réceptions et photos du jour — vérifiables par QR code."
        actions={
          canAny("documents:publish", "projects:publish_client") ? (
            <Button size="sm" variant="secondary" onClick={() => void certifyToday()}>
              <FileCheck2 className="h-4 w-4" /> Certifier les photos du jour
            </Button>
          ) : null
        }
      />
      {proofs.loading && !proofs.data ? (
        <Skeleton className="m-5 h-32" />
      ) : proofs.data?.items.length ? (
        <ul className="divide-y divide-line">
          {proofs.data.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {p.title} {p.revoked ? <Badge tone="danger">Révoquée</Badge> : null} {p.client_visible ? <Badge tone="info">Visible client</Badge> : null}
                </p>
                <p className="text-xs text-muted">
                  {p.number} · {p.subject} · {dateTime(p.issued_at)} · {ANCHOR_LABELS[p.anchor_status] ?? p.anchor_status}
                  {p.leaves.length ? ` · lot de ${p.leaves.length} pièce(s)` : ""}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500" title={p.sha256}>
                  {p.sha256}
                </p>
                {p.revoked_reason ? <p className="text-xs text-red-700">Motif : {p.revoked_reason}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={`/verification/${p.public_code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Vérifier
                </a>
                <Button size="sm" variant="ghost" onClick={() => void download(`/proofs/${p.id}/certificate.pdf`, `certificat-${p.number}.pdf`)}>
                  <Download className="h-4 w-4" /> Certificat
                </Button>
                {can("documents:publish") && !p.revoked ? (
                  <Button size="sm" variant="ghost" onClick={() => setRevoking(p)}>
                    <Ban className="h-4 w-4" /> Révoquer
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState title="Aucune preuve pour l'instant" text="Les documents publiés, décisions validées et réceptions sont certifiés automatiquement." />
        </div>
      )}
      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Révoquer la preuve"
        description="La preuve reste consultable, marquée révoquée avec votre motif (journal de sécurité)."
        footer={
          <Button
            variant="danger"
            disabled={reason.trim().length < 10}
            onClick={async () => {
              try {
                await api(`/proofs/${revoking?.id}/revoke`, { body: { reason } });
                toast.success("Preuve révoquée");
                setRevoking(null);
                setReason("");
                void proofs.reload();
              } catch (err) {
                toast.error("Révocation impossible", errorMessage(err));
              }
            }}
          >
            Révoquer
          </Button>
        }
      >
        <Field label="Motif (10 caractères minimum)" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  );
}

export function ProjectTrustTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <TrustCard path={`/projects/${projectId}/trust`} internal />
      <ProofList projectId={projectId} />
    </div>
  );
}

// ============================================================================ R6 — avis vérifiés
interface Invitation {
  id: string;
  recipient_name: string;
  channels: string[];
  status: string;
  created_at: string;
  expires_at: string;
  opened_at?: string | null;
  completed_at?: string | null;
  reminded_at?: string | null;
  rating?: number | null;
  consent_publish?: boolean | null;
}

export function ProjectReviewsTab({ projectId }: { projectId: string }) {
  const { canAny } = useAuth();
  const toast = useToast();
  const invitations = useApi<Invitation[]>("/review-invitations", { project_id: projectId });
  const [channels, setChannels] = useState<string[]>(["email", "whatsapp"]);
  const invite = async () => {
    try {
      await api(`/projects/${projectId}/review-invitations`, { body: { channels } });
      toast.success("Invitation envoyée au client", "Le lien personnel ne lui est transmis que par ses canaux.");
      void invitations.reload();
    } catch (err) {
      toast.error("Invitation impossible", errorMessage(err));
    }
  };
  const canInvite = canAny("crm:write", "projects:publish_client");
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Star className="h-5 w-5 text-accent-500" /> Avis client vérifié
          </span>
        }
        subtitle="Invitation nominative liée au chantier : seul le client peut déposer son avis ; publication uniquement avec son accord."
        actions={
          canInvite ? (
            <div className="flex flex-wrap items-center gap-3">
              {(["email", "whatsapp"] as const).map((c) => (
                <Checkbox key={c} checked={channels.includes(c)} onChange={(v) => setChannels((cur) => (v ? [...cur, c] : cur.filter((x) => x !== c)))} label={c === "email" ? "E-mail" : "WhatsApp"} />
              ))}
              <Button size="sm" disabled={!channels.length} onClick={() => void invite()}>
                <Send className="h-4 w-4" /> Inviter le client
              </Button>
            </div>
          ) : null
        }
      />
      {invitations.data?.length ? (
        <ul className="divide-y divide-line">
          {invitations.data.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {i.recipient_name} <StatusBadge status={i.status} />
                </p>
                <p className="text-xs text-muted">
                  Envoyée le {date(i.created_at)} ({i.channels.join(", ") || "espace client"}) · expire le {date(i.expires_at)}
                  {i.completed_at ? ` · avis déposé le ${date(i.completed_at)}` : i.opened_at ? ` · ouverte le ${date(i.opened_at)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {i.rating ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-accent-600">
                    {i.rating}/5 <Star className="h-4 w-4 fill-current" />
                  </span>
                ) : null}
                {canInvite && ["sent", "opened"].includes(i.status) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api(`/review-invitations/${i.id}/remind`, { method: "POST" });
                        toast.success("Relance envoyée");
                        void invitations.reload();
                      } catch (err) {
                        toast.error("Relance impossible", errorMessage(err));
                      }
                    }}
                  >
                    Relancer
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState title="Aucune invitation" text="L'invitation part automatiquement à la remise des clés (statut « réception »)." />
        </div>
      )}
    </Card>
  );
}

// ============================================================================ I4 — panneau de chantier connecté
interface PanelData {
  id: string;
  slug: string;
  url: string;
  qr_url: string;
  enabled: boolean;
  title: string;
  location_label?: string | null;
  owner_label?: string | null;
  contractor_label: string;
  permit_number?: string | null;
  permit_date?: string | null;
  permit_authority?: string | null;
  works_description?: string | null;
  working_hours?: string | null;
  contact_phone?: string | null;
  show_progress: boolean;
  show_milestones: boolean;
  show_photos: boolean;
  hiring_open: boolean;
  hiring_text?: string | null;
  photos: { site_media_id: string; media_id: string; url: string; caption?: string | null }[];
  views: number;
  scans: number;
  last_scan_at?: string | null;
  messages: { total: number; new: number };
}

interface PanelMessage {
  id: string;
  kind: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  message: string;
  status: string;
  created_at: string;
  lead_id?: string | null;
}

const KIND_LABELS: Record<string, string> = { info: "Information", devis: "Demande de devis", riverain: "Riverain", candidature: "Candidature" };

type PanelForm = Omit<PanelData, "id" | "url" | "qr_url" | "photos" | "views" | "scans" | "last_scan_at" | "messages">;

export function ProjectPanelTab({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi<{ configured: boolean; panel?: PanelData; suggestion?: Partial<PanelForm> }>(`/projects/${projectId}/panel`);
  const media = useApi<{ items: { id: string; media_type: string; caption?: string | null; url: string }[] }>(`/projects/${projectId}/media`, { page_size: 100 });
  const messages = useApi<PanelMessage[]>(state.data?.configured ? `/projects/${projectId}/panel/messages` : null);
  const [form, setForm] = useState<Partial<PanelForm>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    setForm(state.data.panel ?? state.data.suggestion ?? {});
    setSelected(state.data.panel?.photos.map((p) => p.site_media_id) ?? []);
  }, [state.data]);

  if (state.loading && !state.data) return <Skeleton className="h-96 w-full" />;
  if (!state.data) return <Alert tone="danger">{state.error}</Alert>;
  const panel = state.data.panel;
  const editable = can("projects:write");
  const set = (k: keyof PanelForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const save = async (extra: Partial<PanelForm> = {}) => {
    setSaving(true);
    try {
      const keys: (keyof PanelForm)[] = [
        "slug", "title", "location_label", "owner_label", "contractor_label", "permit_number", "permit_date", "permit_authority",
        "works_description", "working_hours", "contact_phone", "show_progress", "show_milestones", "show_photos", "hiring_open", "hiring_text",
      ];
      const body: Record<string, unknown> = {};
      for (const k of keys) if (form[k] !== undefined && form[k] !== "") body[k] = form[k];
      await api(`/projects/${projectId}/panel`, { method: "PUT", body: { ...body, ...extra } });
      toast.success(extra.enabled === true ? "Panneau publié" : extra.enabled === false ? "Panneau dépublié" : "Panneau enregistré");
      void state.reload();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const savePhotos = async () => {
    try {
      await api(`/projects/${projectId}/panel/photos`, { method: "PUT", body: { site_media_ids: selected } });
      toast.success("Photos publiées sur la page du chantier", "Copies publiques sans métadonnées GPS ni appareil.");
      void state.reload();
    } catch (err) {
      toast.error("Publication impossible", errorMessage(err));
    }
  };
  const text = (k: keyof PanelForm, label: string, props: { required?: boolean; help?: string; type?: string } = {}) => (
    <Field label={label} required={props.required} help={props.help}>
      <Input type={props.type ?? "text"} value={(form[k] as string | undefined) ?? ""} disabled={!editable} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  return (
    <div className="space-y-6">
      {panel ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Statut" value={panel.enabled ? "Publié" : "Brouillon"} tone={panel.enabled ? "success" : "warning"} icon={<Megaphone className="h-5 w-5" />} />
          <Stat label="Scans du QR code" value={panel.scans} hint={panel.last_scan_at ? `Dernier : ${dateTime(panel.last_scan_at)}` : undefined} icon={<QrCode className="h-5 w-5" />} />
          <Stat label="Visites de la page" value={panel.views} />
          <Stat label="Messages reçus" value={panel.messages.total} hint={panel.messages.new ? `${panel.messages.new} à traiter` : undefined} tone={panel.messages.new ? "accent" : "neutral"} />
        </div>
      ) : (
        <Alert tone="info" title="Panneau de chantier connecté">
          Le panneau réglementaire porte un QR code vers une page publique du chantier : avancement, photos choisies, horaires, recrutement local et
          contact des riverains. Rien n&apos;est public tant que vous ne l&apos;activez pas.
        </Alert>
      )}
      <Card>
        <CardHeader
          title="Contenu du panneau"
          subtitle={panel ? <a href={panel.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{panel.url}</a> : "Pré-rempli depuis la fiche projet"}
          actions={
            panel ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void download(`/projects/${projectId}/panel/print.pdf`, `panneau-${panel.slug}.pdf`)}>
                  <Printer className="h-4 w-4" /> Panneau A3 (PDF)
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void download(`/projects/${projectId}/panel/qr.png`, `qr-${panel.slug}.png`)}>
                  <QrCode className="h-4 w-4" /> QR code
                </Button>
                {can("projects:publish_client") ? (
                  <Button size="sm" variant={panel.enabled ? "ghost" : "accent"} disabled={saving} onClick={() => void save({ enabled: !panel.enabled })}>
                    {panel.enabled ? "Dépublier" : "Publier"}
                  </Button>
                ) : null}
              </div>
            ) : null
          }
        />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {text("title", "Titre affiché", { required: true })}
          {text("slug", "Adresse de la page", { help: "/chantiers/…  (lettres, chiffres, tirets)" })}
          {text("location_label", "Localisation affichée", { help: "Quartier / ville — jamais l'adresse exacte" })}
          {text("owner_label", "Maître d'ouvrage affiché", { help: "Avec l'accord du client (ex. « Famille M. »)" })}
          {text("contractor_label", "Entreprise")}
          {text("permit_number", "N° du permis de bâtir")}
          {text("permit_date", "Date du permis", { type: "date" })}
          {text("permit_authority", "Autorité de délivrance")}
          {text("working_hours", "Horaires du chantier")}
          {text("contact_phone", "Téléphone du chantier (riverains)")}
          <Field label="Nature des travaux" className="md:col-span-2">
            <Textarea rows={3} value={form.works_description ?? ""} disabled={!editable} onChange={(e) => set("works_description", e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-5 md:col-span-2">
            <Switch checked={form.show_progress ?? true} disabled={!editable} onChange={(v) => set("show_progress", v)} label="Avancement" />
            <Switch checked={form.show_milestones ?? true} disabled={!editable} onChange={(v) => set("show_milestones", v)} label="Étapes clés" />
            <Switch checked={form.show_photos ?? true} disabled={!editable} onChange={(v) => set("show_photos", v)} label="Photos" />
            <Switch checked={form.hiring_open ?? false} disabled={!editable} onChange={(v) => set("hiring_open", v)} label="Recrutement local" />
          </div>
          {form.hiring_open ? (
            <Field label="Profils recherchés" className="md:col-span-2">
              <Input value={form.hiring_text ?? ""} disabled={!editable} onChange={(e) => set("hiring_text", e.target.value)} placeholder="maçons, ferrailleurs, manœuvres du quartier" />
            </Field>
          ) : null}
        </div>
        {editable ? (
          <div className="flex justify-end border-t border-line px-5 py-3">
            <Button disabled={saving || !(form.title ?? "").trim()} onClick={() => void save()}>
              Enregistrer
            </Button>
          </div>
        ) : null}
      </Card>
      {panel ? (
        <Card>
          <CardHeader
            title="Photos publiées sur la page"
            subtitle="Sélectionnez jusqu'à 12 photos : elles sont recopiées sans métadonnées (GPS, appareil)."
            actions={can("projects:publish_client") ? <Button size="sm" onClick={() => void savePhotos()}>Publier la sélection ({selected.length})</Button> : null}
          />
          {media.data?.items.filter((m) => m.media_type === "photo").length ? (
            <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
              {media.data.items
                .filter((m) => m.media_type === "photo")
                .map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelected((cur) => (on ? cur.filter((x) => x !== m.id) : cur.length >= 12 ? cur : [...cur, m.id]))}
                      className={`relative aspect-square overflow-hidden rounded-xl ring-2 transition ${on ? "ring-accent-500" : "ring-transparent hover:ring-line"}`}
                      aria-pressed={on}
                    >
                      <img src={m.url} alt={m.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />
                      {on ? <BadgeCheck className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-white text-accent-500" /> : null}
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState title="Aucune photo de chantier" text="Ajoutez des photos dans l'onglet « Photos et vidéos »." />
            </div>
          )}
        </Card>
      ) : null}
      {panel ? (
        <Card>
          <CardHeader title="Messages reçus depuis la page" subtitle="Les demandes de devis deviennent des leads CRM ; les riverains sont signalés au QHSE." />
          {messages.data?.length ? (
            <ul className="divide-y divide-line">
              {messages.data.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.name} <Badge tone={m.kind === "riverain" ? "warning" : m.kind === "devis" ? "accent" : "info"}>{KIND_LABELS[m.kind] ?? m.kind}</Badge>{" "}
                      {m.status === "handled" ? <Badge tone="success">Traité</Badge> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {dateTime(m.created_at)} · {[m.phone, m.email].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{m.message}</p>
                    {m.lead_id ? (
                      <a href={`/erp/crm/leads/${m.lead_id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                        Voir le lead
                      </a>
                    ) : null}
                  </div>
                  {m.status !== "handled" && can("projects:write") ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await api(`/projects/${projectId}/panel/messages/${m.id}/handle`, { body: {} });
                        void messages.reload();
                        void state.reload();
                      }}
                    >
                      Marquer traité
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState title="Aucun message" />
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
