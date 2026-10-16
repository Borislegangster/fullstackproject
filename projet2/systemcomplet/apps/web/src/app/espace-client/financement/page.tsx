"use client";

import { FilePlus2, HandCoins, Landmark, Send, Undo2 } from "lucide-react";
import { useState } from "react";

import { useClientProject } from "@/components/client/client-project";
import { FinancingSimulator, type FinancingInputs, type PartnerOffer } from "@/components/innovations/financing-simulator";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Application {
  id: string;
  number: string;
  project_id?: string | null;
  amount: string;
  down_payment: string;
  duration_months: number;
  status: string;
  submitted_at?: string | null;
  documents: { kind: string; label: string; name: string }[];
  partners: { share_id: string; partner: string; status: string; viewed_at?: string | null; offer?: Record<string, string> | null; revoked: boolean }[];
  accepted_offer?: Record<string, string> | null;
}

const KINDS = [
  { value: "identite", label: "Pièce d'identité" },
  { value: "revenus", label: "Justificatifs de revenus" },
  { value: "releves", label: "Relevés bancaires (3 mois)" },
  { value: "titre_foncier", label: "Titre foncier / attestation" },
  { value: "devis", label: "Devis ou contrat GLOBUS" },
  { value: "autre", label: "Autre pièce" },
];
const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "accent" | "success" | "danger" }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  submitted: { label: "Transmis", tone: "info" },
  offer: { label: "Offre reçue", tone: "accent" },
  accepted: { label: "Offre acceptée", tone: "success" },
  withdrawn: { label: "Retiré", tone: "neutral" },
};

function Dossier({ app, offers, onChange }: { app: Application; offers: PartnerOffer[]; onChange: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState("identite");
  const [partners, setPartners] = useState<string[]>(offers.filter((o) => o.eligible).map((o) => o.partner_id));
  const [consent, setConsent] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    try {
      await api(`/client/financing/applications/${app.id}/documents`, { method: "POST", form });
      toast.success("Pièce ajoutée");
      onChange();
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
    }
  };
  const s = STATUS[app.status] ?? { label: app.status, tone: "neutral" as const };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Dossier {app.number} <Badge tone={s.tone}>{s.label}</Badge>
          </span>
        }
        subtitle={`${money(app.amount)} · apport ${money(app.down_payment)} · ${number(app.duration_months / 12, 0)} ans${app.submitted_at ? ` · transmis le ${date(app.submitted_at)}` : ""}`}
        actions={
          ["submitted", "offer"].includes(app.status) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api(`/client/financing/applications/${app.id}/withdraw`, { method: "POST" });
                toast.success("Accord retiré", "Les établissements n'ont plus accès au dossier.");
                onChange();
              }}
            >
              <Undo2 className="h-4 w-4" /> Retirer mon accord
            </Button>
          ) : null
        }
      />
      <div className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold">Pièces du dossier</p>
          <ul className="mt-2 space-y-1 text-sm">
            {app.documents.map((d, i) => (
              <li key={`${d.name}-${i}`} className="text-muted">
                • {d.label ?? d.kind} — {d.name}
              </li>
            ))}
            {!app.documents.length ? <li className="text-muted">Aucune pièce pour l&apos;instant.</li> : null}
          </ul>
          {["draft", "submitted"].includes(app.status) ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Type de pièce">
                <Select value={kind} onChange={(e) => setKind(e.target.value)} options={KINDS} />
              </Field>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-line hover:ring-brand-300">
                <FilePlus2 className="h-4 w-4" /> Ajouter (PDF, image)
                <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
              </label>
            </div>
          ) : null}
        </div>
        {app.status === "draft" ? (
          <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <p className="text-sm font-semibold">Établissements destinataires</p>
            <div className="mt-2 space-y-2">
              {offers.map((o) => (
                <Checkbox
                  key={o.partner_id}
                  checked={partners.includes(o.partner_id)}
                  onChange={(v) => setPartners((cur) => (v ? [...cur, o.partner_id] : cur.filter((x) => x !== o.partner_id)))}
                  label={`${o.name}${o.eligible ? "" : " (hors critères simulés)"}`}
                />
              ))}
            </div>
            <div className="mt-3">
              <Checkbox
                checked={consent}
                onChange={setConsent}
                label="J'autorise GLOBUS ENGINEERING à transmettre mon dossier et mes pièces aux établissements cochés pour l'étude de mon financement."
                description="Accès par lien personnel, valable 30 jours, révocable à tout moment ; pièces filigranées au nom de chaque établissement."
              />
            </div>
            <Button
              className="mt-3"
              disabled={!consent || !partners.length}
              onClick={async () => {
                try {
                  await api(`/client/financing/applications/${app.id}/submit`, { body: { partner_ids: partners, consent } });
                  toast.success("Dossier transmis");
                  onChange();
                } catch (err) {
                  toast.error("Transmission impossible", errorMessage(err));
                }
              }}
            >
              <Send className="h-4 w-4" /> Transmettre le dossier
            </Button>
          </div>
        ) : null}
        {app.partners.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {app.partners.map((p) => (
              <div key={p.share_id} className={`rounded-2xl p-4 ring-1 ${p.offer ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-line"}`}>
                <p className="flex items-center justify-between gap-2 font-semibold">
                  <span className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-brand-600" /> {p.partner}
                  </span>
                  <Badge tone={p.revoked ? "neutral" : p.status === "offer" ? "success" : p.status === "declined" ? "danger" : "info"}>
                    {p.revoked ? "Accès retiré" : { sent: "Envoyé", viewed: "Consulté", in_review: "À l'étude", offer: "Offre", declined: "Refus" }[p.status] ?? p.status}
                  </Badge>
                </p>
                {p.offer ? (
                  <div className="mt-2 text-sm">
                    <p>
                      {money(p.offer.amount)} sur {number(Number(p.offer.duration_months) / 12, 0)} ans à <strong>{p.offer.rate} %</strong>
                      {p.offer.monthly_payment ? ` · ${money(p.offer.monthly_payment)} / mois` : ""}
                    </p>
                    {p.offer.conditions ? <p className="text-xs text-muted">{p.offer.conditions}</p> : null}
                    {app.status === "offer" ? (
                      <Button size="sm" className="mt-2" onClick={() => setAccepting(p.share_id)}>
                        <HandCoins className="h-4 w-4" /> Accepter cette offre
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <OtpDialog
        open={accepting !== null}
        onClose={() => setAccepting(null)}
        title="Accepter l'offre de financement"
        description="Votre acceptation est horodatée et transmise à l'établissement, qui finalise le contrat de prêt avec vous."
        request={(channel) => api(`/client/financing/applications/${app.id}/offers/${accepting}/otp`, { method: "POST", query: { channel } })}
        confirm={async (challenge, code) => {
          await api(`/client/financing/applications/${app.id}/offers/${accepting}/accept`, { body: { otp_token: challenge.otp_token, code } });
          toast.success("Offre acceptée");
          onChange();
        }}
        confirmLabel="J'accepte l'offre"
      />
    </Card>
  );
}

export default function ClientFinancingPage() {
  const toast = useToast();
  const { project } = useClientProject();
  const { user } = useAuth();
  const apps = useApi<Application[]>("/client/financing");
  const [sim, setSim] = useState<{ inputs: FinancingInputs; offers: PartnerOffer[] } | null>(null);
  const open = !!user?.features?.includes("financing");
  const create = async () => {
    if (!sim) return;
    try {
      await api("/client/financing/applications", { body: { ...sim.inputs, project_id: project?.id ?? null } });
      toast.success("Dossier créé", "Ajoutez vos pièces puis transmettez-le.");
      void apps.reload();
    } catch (err) {
      toast.error("Création impossible", errorMessage(err));
    }
  };
  if (apps.loading && !apps.data) return <Skeleton className="h-96 w-full" />;
  if (!open && !(apps.data ?? []).length)
    return (
      <EmptyState
        icon={<Landmark className="h-8 w-8" />}
        title="Financement en ligne non disponible"
        text="Ce service n'est pas ouvert pour le moment. Votre chargé d'affaires reste à votre disposition pour étudier votre financement."
      />
    );
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Landmark className="h-7 w-7 text-brand-600" /> Financement
          </span>
        }
        subtitle="Simulez, constituez votre dossier une seule fois et transmettez-le en un clic à nos établissements partenaires."
      />
      {!open ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Le financement en ligne est fermé : vos dossiers existants restent consultables, aucun nouveau dossier ne peut être créé.</p> : null}
      <Card className={open ? "p-5" : "hidden"}>
        <FinancingSimulator onChange={(inputs, offers) => setSim({ inputs, offers })} />
        <div className="mt-4 flex justify-end">
          <Button variant="accent" disabled={!sim} onClick={() => void create()}>
            <FilePlus2 className="h-4 w-4" /> Créer mon dossier de financement
          </Button>
        </div>
      </Card>
      {apps.loading && !apps.data ? <Skeleton className="h-40 w-full" /> : null}
      {(apps.data ?? []).map((a) => (
        <Dossier key={a.id} app={a} offers={sim?.offers ?? []} onChange={() => void apps.reload()} />
      ))}
    </div>
  );
}
