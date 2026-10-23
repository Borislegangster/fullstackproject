"use client";

import clsx from "clsx";
import { Award, Download, FileText, Gavel, Lock, Plus, Send, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { MultiRefSelect, RefSelect } from "@/components/forms/ref-select";
import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { RowsEditor, ScoresEditor } from "@/components/forms/structured-fields";
import { Checkbox, controlClass, Field, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, percent, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { DECENNALE_TRADES, optionLabel, SUBCONTRACTING_TRADES, tradeOptions } from "@/lib/labels";
import { REFS, type RefSource } from "@/lib/refs";

const SUB_STATUSES = ["prospect", "qualified", "approved", "suspended", "blacklisted"];
/** Critères et pondérations de la qualification (identiques au calcul du serveur, note de 0 à 5). */
const QUALIFICATION_CRITERIA = [
  { key: "references", label: "Références", weight: 25 },
  { key: "capacite", label: "Capacité (moyens humains et matériels)", weight: 20 },
  { key: "securite", label: "Sécurité", weight: 20 },
  { key: "finances", label: "Solidité financière", weight: 15 },
  { key: "qualite", label: "Qualité", weight: 20 },
];
const TENDER_STATUSES = ["draft", "published", "closed", "awarded", "cancelled"];
const CONTRACT_STATUSES = ["draft", "sent", "signed", "mobilized", "in_progress", "completed", "closed", "terminated"];
const SITUATION_STATUSES = ["draft", "submitted", "field_checked", "validated", "rejected", "invoiced", "paid", "disputed"];

/* ----------------------------------------------------------------------------- sous-traitants */

const TRADE_CODES = new Set(SUBCONTRACTING_TRADES.flatMap((g) => g.codes));

/** Corps de métier d'un sous-traitant : cases à cocher du référentiel, par famille. Un code déjà enregistré hors
 * référentiel reste affiché (et conservé tant qu'il n'est pas décoché). */
function TradesPicker({ value, onChange }: { value: unknown; onChange: (codes: string[]) => void }) {
  const current = Array.isArray(value) ? value.map(String) : [];
  const legacy = current.filter((c) => !TRADE_CODES.has(c));
  const groups = legacy.length ? [...SUBCONTRACTING_TRADES, { family: "Autres corps de métier déjà enregistrés", codes: legacy }] : SUBCONTRACTING_TRADES;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-white px-3 py-2.5">
      {groups.map((g) => (
        <fieldset key={g.family} className="min-w-0">
          <legend className="mb-1 text-xs font-semibold text-muted">{g.family}</legend>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {g.codes.map((code) => (
              <Checkbox key={code} label={optionLabel(code)} checked={current.includes(code)} onChange={(on) => onChange(on ? [...current, code] : current.filter((c) => c !== code))} />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Un corps de métier (qualification) : liste déroulante du référentiel groupée par famille ; les codes historiques
 * du sous-traitant restent proposés. Signale l'assurance décennale exigée pour approuver. */
function TradeSelect({ value, onChange, invalid, known = [] }: { value: unknown; onChange: (code: string) => void; invalid?: boolean; known?: string[] }) {
  const selected = typeof value === "string" ? value : "";
  const legacy = [...new Set([...known, selected])].filter((c) => c && !TRADE_CODES.has(c));
  return (
    <>
      <select aria-label="Corps de métier" className={clsx(controlClass, "pr-8")} aria-invalid={invalid || undefined} value={selected} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir…</option>
        {SUBCONTRACTING_TRADES.map((g) => (
          <optgroup key={g.family} label={g.family}>
            {g.codes.map((code) => (
              <option key={code} value={code}>
                {optionLabel(code)}
                {known.includes(code) ? " (déclaré)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
        {legacy.length ? (
          <optgroup label="Autres corps de métier déjà enregistrés">
            {legacy.map((code) => (
              <option key={code} value={code}>
                {optionLabel(code)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      {DECENNALE_TRADES.includes(selected) ? <p className="mt-1 text-xs text-muted">Assurance décennale valide exigée pour approuver ce corps d&apos;état.</p> : null}
    </>
  );
}

const SUBCONTRACTOR_FIELDS: Record<string, FieldConfig> = {
  trades: { span: 2, help: "Cochez les corps de métier exercés ; une qualification approuvée ajoute aussi son corps de métier.", render: ({ value, onChange }) => <TradesPicker value={value} onChange={onChange} /> },
  organization_id: { ref: "subcontractorOrganizations", label: "Organisation (accès extranet)", help: "Organisation de type « sous-traitant » créée dans Administration › Utilisateurs et rôles › Organisations : ses comptes ouvriront l'extranet sous-traitant de cette fiche." },
};

export function SubcontractorsList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Sous-traitants",
        subtitle: "Qualification (critères, références, assurances), historique, notation et score.",
        path: "/subcontractors",
        href: (r) => `/erp/sous-traitants/${r.id}`,
        columns: [
          { key: "code", label: "Code", render: (r) => <CellLink href={`/erp/sous-traitants/${r.id}`}>{r.code ?? "—"}</CellLink> },
          { key: "legal_name", label: "Entreprise", sortable: true, render: (r) => r.trade_name || r.legal_name },
          { key: "trades", label: "Corps de métier", render: (r) => (r.trades ?? []).map((t: string) => optionLabel(t)).join(", ") || "—" },
          { key: "city", label: "Ville", hideOnMobile: true },
          { key: "score", label: "Score", sortable: true, render: (r) => <Progress value={toNumber(r.score)} className="w-24" label={number(r.score ?? 0, 1)} /> },
          { key: "insurance_ok", label: "Assurance RC", render: (r) => (r.insurance_ok ? <Badge tone="success">Valide</Badge> : <Badge tone="danger">À jour ?</Badge>), hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: SUB_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "trade", label: "Corps de métier", options: tradeOptions() },
        ],
        create: { endpoint: "POST /subcontractors", label: "Nouveau sous-traitant", perms: ["subcontracting:write"], fields: SUBCONTRACTOR_FIELDS },
      }}
    />
  );
}

export function SubcontractorDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const sub = useApi<Row>(`/subcontractors/${id}`);
  const ratings = useApi<Row[]>(`/subcontractors/${id}/ratings`);
  const [tab, setTab] = useState("profil");
  const [dialog, setDialog] = useState<null | "edit" | "status" | "qualif" | "rating">(null);
  if (sub.loading && !sub.data) return <Skeleton className="h-96 w-full" />;
  if (!sub.data) return <Alert tone="danger">{sub.error}</Alert>;
  const s = sub.data;
  const h = s.history ?? {};
  const write = can("subcontracting:write");
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/sous-traitants" className="hover:underline">Sous-traitants</Link>}
        title={s.trade_name || s.legal_name}
        subtitle={[s.code, (s.trades ?? []).map((t: string) => optionLabel(t)).join(", "), s.city].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {write ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                  Modifier
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("status")}>
                  Statut
                </Button>
                <Button size="sm" onClick={() => setDialog("qualif")}>
                  Qualifier
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Score global" value={number(h.score ?? s.score ?? 0, 1)} tone="info" />
        <Stat label="Marchés terminés" value={h.completed_contracts ?? 0} />
        <Stat label="Ponctualité" value={percent(h.on_time_rate ?? s.on_time_rate ?? 0, 1)} />
        <Stat label="Taux de litige" value={percent(h.dispute_rate ?? s.dispute_rate ?? 0, 1)} tone={toNumber(h.dispute_rate) > 10 ? "danger" : "neutral"} />
        <Stat label="Note moyenne" value={h.rating_average ? `${number(h.rating_average, 2)} / 5` : "—"} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "profil", label: "Profil" },
          { key: "qualifications", label: "Qualifications", count: (s.qualifications ?? []).length },
          { key: "marches", label: "Marchés", count: (s.contracts ?? []).length },
          { key: "notes", label: "Notations", count: ratings.data?.length ?? null },
        ]}
      />
      {tab === "profil" ? (
        <Card className="p-5">
          <DescriptionList
            columns={3}
            items={[
              { label: "Raison sociale", value: s.legal_name },
              { label: "NIU / RCCM", value: [s.tax_id, s.trade_register].filter(Boolean).join(" · ") },
              { label: "Effectif", value: s.workforce_size },
              { label: "Zones", value: (s.zones ?? []).join(", ") },
              { label: "E-mail", value: s.email },
              { label: "Téléphone / WhatsApp", value: [s.phone, s.whatsapp].filter(Boolean).join(" · ") },
              { label: "Adresse", value: [s.address, s.city].filter(Boolean).join(", ") },
              { label: "Assurance RC jusqu'au", value: date(s.insurance_rc_until) },
              { label: "Décennale jusqu'au", value: date(s.insurance_decennale_until) },
              { label: "Compte bancaire", value: s.bank_account_masked },
              { label: "Mobile Money", value: s.mobile_money_masked },
            ]}
          />
          {s.notes ? <p className="mt-4 whitespace-pre-line text-sm text-muted">{s.notes}</p> : null}
        </Card>
      ) : null}
      {tab === "qualifications" ? (
        <Card>
          <CardHeader title="Dossiers de qualification" />
          <ul className="divide-y divide-line text-sm">
            {((s.qualifications ?? []) as Row[]).map((q) => (
              <li key={q.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {optionLabel(q.trade)} — score {number(q.score ?? 0, 1)}
                  </span>
                  <StatusBadge status={q.decision} />
                </div>
                <p className="text-xs text-muted">
                  Décidé le {dateTime(q.decided_at)} {q.valid_until ? `· valable jusqu'au ${date(q.valid_until)}` : ""} {q.comment ? `· ${q.comment}` : ""}
                </p>
                {((q.documents ?? []) as Row[]).length ? (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {((q.documents ?? []) as Row[]).map((d) => (
                      <a key={d.id} href={apiUrl(`/subcontractors/${id}/qualifications/${q.id}/documents/${d.id}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {d.name}
                      </a>
                    ))}
                  </div>
                ) : null}
                {q.criteria && typeof q.criteria === "object" ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(q.criteria as Record<string, unknown>).map(([k, v]) => (
                      <Badge key={k}>
                        {QUALIFICATION_CRITERIA.find((c) => c.key === k)?.label ?? optionLabel(k)} : {String(v)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
            {!(s.qualifications ?? []).length ? <li className="px-5 py-4 text-muted">Aucune qualification.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "marches" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {((s.contracts ?? []) as Row[]).map((c) => (
              <li key={c.id} className="flex justify-between gap-2 px-5 py-3">
                <span>
                  <CellLink href={`/erp/sous-traitants/marches/${c.id}`}>{c.number}</CellLink> {c.title}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{money(c.amount)}</span>
                  <StatusBadge status={c.status} />
                </span>
              </li>
            ))}
            {!(s.contracts ?? []).length ? <li className="px-5 py-4 text-muted">Aucun marché.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "notes" ? (
        <Card>
          <CardHeader title="Notations" actions={<Button size="sm" onClick={() => setDialog("rating")}>Noter</Button>} />
          <ul className="divide-y divide-line text-sm">
            {(ratings.data ?? []).map((r) => (
              <li key={r.id} className="px-5 py-3">
                <p className="text-xs text-muted">{dateTime(r.created_at)}</p>
                <p>
                  Qualité {r.quality} · Délais {r.delay} · Sécurité {r.safety} · Propreté {r.cleanliness} · Conformité {r.compliance} · Coopération {r.cooperation}
                </p>
                {r.comment ? <p className="text-muted">« {r.comment} »</p> : null}
              </li>
            ))}
            {!ratings.data?.length ? <li className="px-5 py-4 text-muted">Aucune notation.</li> : null}
          </ul>
        </Card>
      ) : null}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier le sous-traitant" size="xl">
        <SchemaForm endpoint="PATCH /subcontractors/{subcontractor_id}" params={{ subcontractor_id: id }} initial={s} partial fields={SUBCONTRACTOR_FIELDS} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void sub.reload(); }} />
      </Modal>
      <Modal open={dialog === "status"} onClose={() => setDialog(null)} title="Statut du sous-traitant">
        <SchemaForm endpoint="POST /subcontractors/{subcontractor_id}/status" params={{ subcontractor_id: id }} initial={{ status: s.status }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void sub.reload(); }} columns={1} />
      </Modal>
      <Modal open={dialog === "qualif"} onClose={() => setDialog(null)} title="Qualification" size="lg">
        <SchemaForm
          endpoint="POST /subcontractors/{subcontractor_id}/qualifications"
          params={{ subcontractor_id: id }}
          initial={{ trade: (s.trades ?? []).length === 1 ? s.trades[0] : "", criteria: Object.fromEntries(QUALIFICATION_CRITERIA.map((c) => [c.key, 0])), references: [] }}
          fields={{
            trade: { render: ({ value, onChange, invalid }) => <TradeSelect value={value} onChange={onChange} invalid={invalid} known={s.trades ?? []} /> },
            criteria: { span: 2, label: "Critères notés (0 à 5)", render: ({ value, onChange }) => <QualificationCriteriaEditor value={value} onChange={onChange} /> },
            references: { span: 2, label: "Références chantier", render: ({ value, onChange }) => <ReferencesEditor value={value} onChange={onChange} /> },
            document_file_ids: { span: 2, label: "Pièces justificatives", help: "Assurances, attestations, références… Chaque fichier est envoyé dès son dépôt.", render: ({ value, onChange }) => <QualificationDocumentsField subcontractorId={id} value={value} onChange={onChange} /> },
          }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            toast.success("Qualification enregistrée");
            void sub.reload();
          }}
        />
      </Modal>
      <Modal open={dialog === "rating"} onClose={() => setDialog(null)} title="Noter le sous-traitant" size="lg">
        <SchemaForm endpoint="POST /subcontractors/{subcontractor_id}/ratings" params={{ subcontractor_id: id }} fields={{ subcontract_id: { ref: { path: "/subcontracts", query: { subcontractor_id: id }, label: (r: Row) => `${r.number} — ${r.title}`, paginated: true } } }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void ratings.reload(); void sub.reload(); }} />
      </Modal>
    </div>
  );
}

/** Pièces justificatives d'une qualification : chaque fichier est déposé dès sa sélection (POST /subcontractors/{id}/documents),
 * la valeur envoyée reste la liste des identifiants de fichiers ; seuls les noms sont affichés, chaque pièce peut être retirée. */
function QualificationDocumentsField({ subcontractorId, value, onChange }: { subcontractorId: string; value: unknown; onChange: (ids: string[]) => void }) {
  const toast = useToast();
  const ids: string[] = Array.isArray(value) ? value.map(String) : [];
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    if (busy || !files.length) return;
    if (ids.length + files.length > 50) {
      toast.error("Trop de pièces", "50 pièces au maximum par qualification.");
      return;
    }
    setBusy(true);
    const added: string[] = [];
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await api<{ file_id: string; filename?: string }>(`/subcontractors/${subcontractorId}/documents`, { method: "POST", form: fd });
        added.push(String(res.file_id));
        setNames((prev) => ({ ...prev, [String(res.file_id)]: res.filename || f.name }));
      }
    } catch (err) {
      toast.error("Dépôt impossible", errorMessage(err));
    } finally {
      if (added.length) onChange([...ids, ...added]);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <FileDrop files={[]} onChange={(files) => void upload(files)} multiple accept=".pdf,image/*" maxSizeMb={25} label={busy ? "Envoi en cours…" : "Déposez les pièces ou cliquez pour parcourir"} />
      {ids.length ? (
        <ul className="space-y-1">
          {ids.map((fid, i) => (
            <li key={fid} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                <span className="truncate">{names[fid] ?? `Pièce ${i + 1}`}</span>
              </span>
              <button type="button" onClick={() => onChange(ids.filter((x) => x !== fid))} aria-label={`Retirer ${names[fid] ?? `la pièce ${i + 1}`}`} className="rounded p-0.5 text-muted hover:bg-slate-200 hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Aucune pièce jointe.</p>
      )}
    </div>
  );
}

/** Grille de qualification : une note de 0 à 5 par critère, score pondéré sur 100 affiché en direct. */
function QualificationCriteriaEditor({ value, onChange }: { value: unknown; onChange: (v: Row) => void }) {
  const scores: Row = value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
  const total = QUALIFICATION_CRITERIA.reduce((sum, c) => sum + (toNumber(scores[c.key]) / 5) * c.weight, 0);
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      {QUALIFICATION_CRITERIA.map((c) => (
        <div key={c.key} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink">
            {c.label} <span className="text-xs text-muted">· poids {c.weight}</span>
          </span>
          <div className="flex gap-1" role="radiogroup" aria-label={c.label}>
            {[0, 1, 2, 3, 4, 5].map((n) => {
              const on = toNumber(scores[c.key]) === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ ...scores, [c.key]: n })}
                  className={clsx("h-8 w-8 rounded-lg text-sm font-semibold ring-1 transition", on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:bg-brand-50")}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="border-t border-line pt-2 text-sm">
        Score : <strong>{number(total, 1)} / 100</strong>
        {total < 50 ? <span className="text-amber-700"> · 50 minimum pour approuver</span> : null}
      </p>
    </div>
  );
}

/** Références chantier du sous-traitant : `[{ projet, client, annee, montant }]`. */
function ReferencesEditor({ value, onChange }: { value: unknown; onChange: (v: Row[]) => void }) {
  return (
    <RowsEditor
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      itemLabel="Référence"
      title={(r, i) => r.projet || `Référence ${i + 1}`}
      fields={[
        { key: "projet", label: "Projet", placeholder: "Ex. Immeuble R+4" },
        { key: "client", label: "Client" },
        { key: "annee", label: "Année", type: "number", min: 1950, max: 2100, step: 1 },
        { key: "montant", label: "Montant (FCFA)", type: "number", min: 0 },
      ]}
      newRow={() => ({ projet: "", client: "", annee: new Date().getFullYear(), montant: null })}
      addLabel="Référence"
      empty="Aucune référence."
      max={50}
    />
  );
}

/* ----------------------------------------------------------------------------- consultations */

interface ItemDraft {
  code: string;
  designation: string;
  unit: string;
  quantity: string;
}

interface LotDraft {
  lot_id: string | null;
  code: string;
  name: string;
  description: string;
  estimated_amount: string;
  items: ItemDraft[];
}

const emptyItem = (): ItemDraft => ({ code: "", designation: "", unit: "u", quantity: "" });
const emptyLot = (n: number): LotDraft => ({ lot_id: null, code: `L${n}`, name: "", description: "", estimated_amount: "", items: [emptyItem()] });

const TENDER_CRITERIA = [
  { key: "prix", label: "Prix", weight: 50 },
  { key: "delai", label: "Délai", weight: 20 },
  { key: "technique", label: "Valeur technique", weight: 20 },
  { key: "historique", label: "Historique avec GLOBUS", weight: 10 },
];

/** Pièces du dossier de consultation (DCE) : plans et documents GED du projet, dans leur version en vigueur. Les
 * sous-traitants consultés les téléchargent depuis leur extranet. */
function TenderDocsPicker({ projectId, value, onChange }: { projectId: string; value: string[]; onChange: (ids: string[]) => void }) {
  const docs = useApi<{ items: Row[] }>("/documents", { project_id: projectId, page_size: 100 });
  const rows = (docs.data?.items ?? []).filter((d) => d.current_version?.id);
  if (docs.loading && !docs.data) return <Skeleton className="h-16" />;
  if (!rows.length) return <p className="text-sm text-muted">Aucun document dans la GED de ce projet : déposez d&apos;abord les plans et le CCTP (GED › Déposer un document).</p>;
  return (
    <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
      {rows.map((d) => {
        const id = String(d.current_version.id);
        return (
          <li key={id}>
            <Checkbox
              label={[d.code ? `${d.code} — ${d.title}` : d.title, d.current_version.label].filter(Boolean).join(" · ")}
              checked={value.includes(id)}
              onChange={(checked) => onChange(checked ? [...value, id] : value.filter((x) => x !== id))}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Création d'une consultation multi-lots avec bordereaux de prix (DPGF). */
export function TenderForm({ onCreated, onCancel }: { onCreated: (t: Row) => void; onCancel: () => void }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>(Object.fromEntries(TENDER_CRITERIA.map((c) => [c.key, String(c.weight)])));
  const weightTotal = TENDER_CRITERIA.reduce((sum, c) => sum + toNumber(weights[c.key]), 0);
  const [form, setForm] = useState({ title: "", description: "", technical_spec: "", deadline: "", start_date_target: "", duration_days_target: "", variants_allowed: false, exclusions: "" });
  const [lots, setLots] = useState<LotDraft[]>([emptyLot(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setLot = (i: number, patch: Partial<LotDraft>) => setLots((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setItem = (i: number, k: number, patch: Partial<ItemDraft>) => setLots((all) => all.map((l, j) => (j === i ? { ...l, items: l.items.map((it, m) => (m === k ? { ...it, ...patch } : it)) } : l)));
  const submit = async () => {
    // Poste commencé sans désignation (ou sans quantité) : signalé, jamais retiré en silence.
    for (const [i, l] of lots.entries()) {
      const k = l.items.findIndex((it) => (it.designation.trim() || toNumber(it.quantity) > 0) && (!it.designation.trim() || toNumber(it.quantity) <= 0));
      if (k >= 0) {
        setError(`Lot ${i + 1}, poste ${k + 1} incomplet : désignation et quantité (supérieure à 0) obligatoires.`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const tender = await api<Row>("/tenders", {
        method: "POST",
        body: {
          project_id: projectId,
          title: form.title,
          description: form.description || null,
          technical_spec: form.technical_spec || null,
          document_version_ids: docIds,
          quality_criteria: TENDER_CRITERIA.map((c) => ({ key: c.key, weight: Math.round(toNumber(weights[c.key])) })),
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
          start_date_target: form.start_date_target || null,
          duration_days_target: form.duration_days_target ? Number(form.duration_days_target) : null,
          variants_allowed: form.variants_allowed,
          exclusions: form.exclusions || null,
          lots: lots.map((l) => ({
            lot_id: l.lot_id,
            code: l.code,
            name: l.name,
            description: l.description || null,
            estimated_amount: Number(l.estimated_amount || 0),
            items: l.items.filter((it) => it.designation.trim()).map((it) => ({ code: it.code || null, designation: it.designation, unit: it.unit || "u", quantity: Number(it.quantity || 0) })),
          })),
        },
      });
      onCreated(tender);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Projet" required>
          <RefSelect
            source={REFS.projects}
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              setDocIds([]);
            }}
          />
        </Field>
        <Field label="Date limite de remise des offres" required>
          <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </Field>
        <Field label="Intitulé" required className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Démarrage souhaité">
          <Input type="date" value={form.start_date_target} onChange={(e) => setForm({ ...form, start_date_target: e.target.value })} />
        </Field>
        <Field label="Durée cible (jours)">
          <Input type="number" min={1} value={form.duration_days_target} onChange={(e) => setForm({ ...form, duration_days_target: e.target.value })} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </Field>
        <Field label="Cahier des charges technique" className="sm:col-span-2">
          <Textarea value={form.technical_spec} onChange={(e) => setForm({ ...form, technical_spec: e.target.value })} rows={4} />
        </Field>
        <Field label="Exclusions" className="sm:col-span-2">
          <Textarea value={form.exclusions} onChange={(e) => setForm({ ...form, exclusions: e.target.value })} rows={2} />
        </Field>
        <Checkbox label="Variantes autorisées" checked={form.variants_allowed} onChange={(v) => setForm({ ...form, variants_allowed: v })} />
      </div>
      <Field label="Pièces du dossier de consultation (DCE)" help="Plans, CCTP, notes techniques : version en vigueur, téléchargeable par les sous-traitants consultés.">
        {projectId ? <TenderDocsPicker projectId={projectId} value={docIds} onChange={setDocIds} /> : <p className="text-sm text-muted">Choisissez d&apos;abord le projet.</p>}
      </Field>
      <Field label="Critères de notation des offres (pondération en %)" help="Le comparatif des offres applique ces poids ; le total doit faire 100 %.">
        <div className="grid gap-3 sm:grid-cols-4">
          {TENDER_CRITERIA.map((c) => (
            <label key={c.key} className="block text-sm">
              <span className="text-xs text-muted">{c.label}</span>
              <Input type="number" min={0} max={100} value={weights[c.key]} onChange={(e) => setWeights({ ...weights, [c.key]: e.target.value })} />
            </label>
          ))}
        </div>
        {weightTotal !== 100 ? <p className="mt-1 text-xs text-red-600">Total actuel : {weightTotal} % (100 % attendu).</p> : null}
      </Field>
      {lots.map((lot, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-brand-800">Lot {i + 1}</p>
            {lots.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => setLots((all) => all.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" /> Retirer le lot
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Code" required>
              <Input value={lot.code} onChange={(e) => setLot(i, { code: e.target.value })} />
            </Field>
            <Field label="Intitulé du lot" required className="sm:col-span-2">
              <Input value={lot.name} onChange={(e) => setLot(i, { name: e.target.value })} />
            </Field>
            <Field label="Estimation">
              <Input type="number" min={0} value={lot.estimated_amount} onChange={(e) => setLot(i, { estimated_amount: e.target.value })} />
            </Field>
            {projectId ? (
              <Field label="Lot du projet" className="sm:col-span-2">
                <RefSelect source={REFS.lots} value={lot.lot_id} onChange={(v) => setLot(i, { lot_id: v })} context={{ project_id: projectId }} />
              </Field>
            ) : null}
          </div>
          <table className="min-w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 text-left">Code</th>
                <th className="py-1 text-left">
                  Désignation
                  <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
                </th>
                <th className="py-1 text-left">Unité</th>
                <th className="py-1 text-left">
                  Quantité
                  <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lot.items.map((it, k) => (
                <tr key={k}>
                  <td className="py-1 pr-2">
                    <Input className="w-20" value={it.code} onChange={(e) => setItem(i, k, { code: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input value={it.designation} onChange={(e) => setItem(i, k, { designation: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input className="w-20" value={it.unit} onChange={(e) => setItem(i, k, { unit: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input type="number" min={0} className="w-28" value={it.quantity} onChange={(e) => setItem(i, k, { quantity: e.target.value })} />
                  </td>
                  <td>
                    <button type="button" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => setLot(i, { items: lot.items.filter((_, m) => m !== k) })} aria-label="Retirer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button size="sm" variant="secondary" onClick={() => setLot(i, { items: [...lot.items, emptyItem()] })}>
            <Plus className="h-4 w-4" /> Poste
          </Button>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setLots((all) => [...all, emptyLot(all.length + 1)])}>
        <Plus className="h-4 w-4" /> Ajouter un lot
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={submit} loading={busy} disabled={!projectId || !form.title || !form.deadline || weightTotal !== 100 || lots.some((l) => !l.name || !l.items.some((it) => it.designation && it.quantity))}>
          Créer la consultation
        </Button>
      </div>
    </div>
  );
}

export function TendersList() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { can } = useAuth();
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Consultations",
          subtitle: "Appels d'offres multi-lots, invitations, offres sous pli scellé jusqu'à la date limite, comparatif, négociation, attribution.",
          path: "/tenders",
          href: (r) => `/erp/sous-traitants/consultations/${r.id}`,
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/sous-traitants/consultations/${r.id}`}>{r.number}</CellLink> },
            { key: "title", label: "Consultation" },
            { key: "lots", label: "Lots", render: (r) => (r.lots ?? []).length },
            { key: "deadline", label: "Date limite", format: "datetime", sortable: true },
            { key: "bids_count", label: "Offres", render: (r) => `${r.bids_count}${r.sealed ? " 🔒" : ""}` },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [{ key: "status", label: "Statut", options: TENDER_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
          toolbar: can("subcontracting:write") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouvelle consultation
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle consultation" size="xl">
        <TenderForm onCancel={() => setCreating(false)} onCreated={(t) => router.push(`/erp/sous-traitants/consultations/${t.id}`)} />
      </Modal>
    </>
  );
}

/** Modification des pièces du DCE et des critères d'une consultation encore en brouillon (PUT complet). */
function TenderDceDialog({ tender, open, onClose, onSaved }: { tender: Row; open: boolean; onClose: () => void; onSaved: (t: Row) => void }) {
  const toast = useToast();
  const [docIds, setDocIds] = useState<string[]>(((tender.documents ?? []) as Row[]).map((d) => String(d.version_id)));
  const current = Object.fromEntries(((tender.quality_criteria ?? []) as Row[]).map((c) => [c.key, String(c.weight)]));
  const [weights, setWeights] = useState<Record<string, string>>(Object.fromEntries(TENDER_CRITERIA.map((c) => [c.key, current[c.key] ?? String(c.weight)])));
  const total = TENDER_CRITERIA.reduce((sum, c) => sum + toNumber(weights[c.key]), 0);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const t = tender;
      const saved = await api<Row>(`/tenders/${t.id}`, {
        method: "PUT",
        body: {
          project_id: t.project_id,
          title: t.title,
          description: t.description ?? null,
          technical_spec: t.technical_spec ?? null,
          document_version_ids: docIds,
          deadline: t.deadline,
          start_date_target: t.start_date_target ?? null,
          duration_days_target: t.duration_days_target ?? null,
          quality_criteria: TENDER_CRITERIA.map((c) => ({ key: c.key, weight: Math.round(toNumber(weights[c.key])) })),
          variants_allowed: !!t.variants_allowed,
          exclusions: t.exclusions ?? null,
          lots: ((t.lots ?? []) as Row[]).map((l) => ({
            lot_id: l.lot_id ?? null,
            code: l.code,
            name: l.name,
            description: l.description ?? null,
            estimated_amount: toNumber(l.estimated_amount),
            items: ((l.items ?? []) as Row[]).map((it) => ({ code: it.code ?? null, designation: it.designation, unit: it.unit || "u", quantity: toNumber(it.quantity) })),
          })),
        },
      });
      toast.success("Dossier de consultation mis à jour");
      onSaved(saved);
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pièces du DCE et critères"
      size="lg"
      footer={
        <Button loading={busy} disabled={total !== 100} onClick={save}>
          Enregistrer
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Pièces du dossier de consultation (DCE)">
          <TenderDocsPicker projectId={String(tender.project_id)} value={docIds} onChange={setDocIds} />
        </Field>
        <Field label="Critères de notation (pondération en %)">
          <div className="grid gap-3 sm:grid-cols-4">
            {TENDER_CRITERIA.map((c) => (
              <label key={c.key} className="block text-sm">
                <span className="text-xs text-muted">{c.label}</span>
                <Input type="number" min={0} max={100} value={weights[c.key]} onChange={(e) => setWeights({ ...weights, [c.key]: e.target.value })} />
              </label>
            ))}
          </div>
          {total !== 100 ? <p className="mt-1 text-xs text-red-600">Total actuel : {total} % (100 % attendu).</p> : null}
        </Field>
      </div>
    </Modal>
  );
}

interface Comparison {
  lot: { id: string; code: string; name: string; estimated_amount: string };
  criteria: { key: string; label?: string; weight: number }[] | Record<string, number>;
  bids: { bid_id: string; subcontractor_id: string; subcontractor: string; amount: string; final_amount?: string | null; duration_days?: number | null; is_variant: boolean; exclusions?: string | null; status: string; technical_score?: string | null; total_score?: string | null; delta_vs_estimate_pct?: number | null; breakdown: Record<string, number>; history?: Row }[];
  items: { item_id: string; designation: string; unit: string; quantity: string; min?: string | null; max?: string | null; avg?: string | null; prices: { subcontractor_id: string; unit_price: string }[] }[];
}

export function TenderDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const tender = useApi<Row>(`/tenders/${id}`);
  const bids = useApi<{ sealed: boolean; count: number; bids: Row[] }>(`/tenders/${id}/bids`);
  const [lotId, setLotId] = useState<string | null>(null);
  const activeLot: string | null = lotId ?? tender.data?.lots?.[0]?.id ?? null;
  const comparison = useApi<Comparison>(activeLot && bids.data && !bids.data.sealed ? `/tenders/${id}/lots/${activeLot}/comparison` : null);
  const [dialog, setDialog] = useState<null | "invite" | "evaluate" | "negotiate" | "award" | "cancel" | "close" | "dce">(null);
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [inviteTrade, setInviteTrade] = useState("");
  const [target, setTarget] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (tender.loading && !tender.data) return <Skeleton className="h-96 w-full" />;
  if (!tender.data) return <Alert tone="danger">{tender.error}</Alert>;
  const t = tender.data;
  const write = can("subcontracting:write");
  const lots = (t.lots ?? []) as Row[];
  const bidRows = (bids.data?.bids ?? []) as Row[];
  /** Dernière proposition de négociation en attente émise par le sous-traitant (acceptable par GLOBUS). */
  const pendingCounter = (bidId: string): Row | null => {
    const negs = (bidRows.find((b) => b.id === bidId)?.negotiations ?? []) as Row[];
    const last = negs[negs.length - 1];
    return last && last.status === "proposed" && last.proposed_by !== "globus" ? last : null;
  };
  const acceptCounter = async (bidId: string) => {
    try {
      await api(`/bids/${bidId}/negotiations/accept`, { method: "POST" });
      toast.success("Contre-proposition acceptée", "Le montant final de l'offre est mis à jour.");
      reload();
    } catch (err) {
      toast.error("Acceptation impossible", errorMessage(err));
    }
  };
  const reload = () => {
    void tender.reload();
    void bids.reload();
    void comparison.reload();
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/sous-traitants?onglet=consultations" className="hover:underline">Consultations</Link>}
        title={`${t.number} — ${t.title}`}
        subtitle={`Date limite : ${dateTime(t.deadline)}${t.sealed ? " · offres sous pli scellé" : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            {write && t.status === "draft" ? (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    tender.setData(await api(`/tenders/${id}/publish`, { method: "POST" }));
                    toast.success("Consultation publiée", "Les entreprises invitées sont notifiées.");
                  } catch (err) {
                    toast.error("Publication impossible", errorMessage(err));
                  }
                }}
              >
                <Send className="h-4 w-4" /> Publier
              </Button>
            ) : null}
            {write && ["draft", "published"].includes(t.status) ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("invite")}>
                <Users className="h-4 w-4" /> Inviter
              </Button>
            ) : null}
            {write && t.status === "published" ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("close")}>
                Clôturer
              </Button>
            ) : null}
            {can("subcontracting:award") && ["draft", "published", "closed"].includes(t.status) ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("cancel")}>
                Annuler
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <DescriptionList
            columns={2}
            items={[
              { label: "Démarrage souhaité", value: date(t.start_date_target) },
              { label: "Durée cible", value: t.duration_days_target ? `${t.duration_days_target} j` : "—" },
              { label: "Variantes", value: t.variants_allowed ? "Autorisées" : "Non" },
              { label: "Publiée le", value: dateTime(t.published_at) },
            ]}
          />
          {t.description ? <p className="mt-3 whitespace-pre-line text-sm">{t.description}</p> : null}
          {t.technical_spec ? (
            <details className="mt-3 rounded-xl bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium">Cahier des charges technique</summary>
              <p className="mt-2 whitespace-pre-line">{t.technical_spec}</p>
            </details>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted">
                Pièces du DCE
                {write && t.status === "draft" ? (
                  <button type="button" className="font-medium normal-case text-brand-600 hover:underline" onClick={() => setDialog("dce")}>
                    Modifier
                  </button>
                ) : null}
              </p>
              {((t.documents ?? []) as Row[]).length ? (
                <ul className="space-y-0.5 text-sm">
                  {((t.documents ?? []) as Row[]).map((d) => (
                    <li key={d.version_id}>
                      <Link href={`/erp/ged/documents/${d.document_id}`} className="text-brand-600 hover:underline">
                        {d.code} — {d.title}
                      </Link>{" "}
                      <span className="text-xs text-muted">v{d.version}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Aucune pièce jointe.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted">Critères de notation</p>
              <p className="text-sm">{((t.quality_criteria ?? []) as Row[]).map((c) => `${optionLabel(c.key)} ${c.weight} %`).join(" · ") || "Prix 50 % · Délai 20 % · Technique 20 % · Historique 10 %"}</p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Invitations" subtitle={`${(t.invitations ?? []).length} entreprise(s)`} />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
            {((t.invitations ?? []) as Row[]).map((inv) => (
              <li key={inv.id} className="flex justify-between gap-2 px-5 py-2">
                <span>{inv.subcontractor}</span>
                <StatusBadge status={inv.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Offres" subtitle={bids.data?.sealed ? `${bids.data.count} offre(s) reçue(s) — ouverture à la date limite` : `${bids.data?.count ?? 0} offre(s)`} />
        {bids.data?.sealed ? (
          <div className="flex items-center gap-2 p-5 text-sm text-muted">
            <Lock className="h-4 w-4" /> Pli scellé : le contenu des offres reste inaccessible jusqu'au {dateTime(t.deadline)} (ou clôture anticipée).
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line px-4 py-2">
              {lots.map((l) => (
                <button key={l.id} type="button" onClick={() => setLotId(l.id)} className={`rounded-full px-3 py-1 text-xs font-medium ${activeLot === l.id ? "bg-brand-500 text-white" : "bg-slate-100"}`}>
                  {l.code} — {l.name}
                </button>
              ))}
            </div>
            {comparison.loading ? (
              <Skeleton className="m-4 h-40" />
            ) : comparison.data ? (
              comparison.data.bids.length ? (
                <div className="space-y-4 p-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Entreprise</th>
                          <th className="px-3 py-2 text-right">Montant</th>
                          <th className="px-3 py-2">Écart / estimation</th>
                          <th className="px-3 py-2">Délai</th>
                          <th className="px-3 py-2">Technique</th>
                          <th className="px-3 py-2">Score total</th>
                          <th className="px-3 py-2">Statut</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {comparison.data.bids.map((b, i) => (
                          <tr key={b.bid_id} className={i === 0 ? "bg-emerald-50/60" : ""}>
                            <td className="px-3 py-2">
                              <span className="font-medium">{b.subcontractor}</span> {b.is_variant ? <Badge tone="accent">Variante</Badge> : null}
                              <span className="block text-xs text-muted">
                                {Object.entries(b.breakdown)
                                  .map(([k, v]) => `${optionLabel(k)} ${number(v, 1)}`)
                                  .join(" · ")}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {money(b.final_amount ?? b.amount)}
                              {b.final_amount && b.final_amount !== b.amount ? <span className="block text-xs text-muted line-through">{money(b.amount)}</span> : null}
                            </td>
                            <td className={`px-3 py-2 ${toNumber(b.delta_vs_estimate_pct) > 0 ? "text-amber-700" : "text-emerald-700"}`}>{b.delta_vs_estimate_pct !== null && b.delta_vs_estimate_pct !== undefined ? `${b.delta_vs_estimate_pct > 0 ? "+" : ""}${number(b.delta_vs_estimate_pct, 1)} %` : "—"}</td>
                            <td className="px-3 py-2">{b.duration_days ? `${b.duration_days} j` : "—"}</td>
                            <td className="px-3 py-2">{b.technical_score !== null && b.technical_score !== undefined ? number(b.technical_score, 1) : "—"}</td>
                            <td className="px-3 py-2">
                              <Progress value={toNumber(b.total_score)} className="w-24" label={number(b.total_score ?? 0, 1)} />
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={b.status} />
                            </td>
                            <td className="px-3 py-2">
                              {write && !["awarded", "cancelled"].includes(t.status) ? (
                                <span className="flex flex-wrap gap-1">
                                  <Button size="sm" variant="secondary" onClick={() => { setTarget(b); setDialog("evaluate"); }}>
                                    Évaluer
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => { setTarget(b); setDialog("negotiate"); }}>
                                    Négocier
                                  </Button>
                                  {pendingCounter(b.bid_id) ? (
                                    <Button size="sm" variant="accent" onClick={() => void acceptCounter(b.bid_id)}>
                                      Accepter {money(pendingCounter(b.bid_id)?.amount)}
                                    </Button>
                                  ) : null}
                                  {can("subcontracting:award") ? (
                                    <Button size="sm" onClick={() => { setTarget(b); setDialog("award"); }}>
                                      <Award className="h-4 w-4" /> Attribuer
                                    </Button>
                                  ) : null}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <details className="rounded-xl border border-line">
                    <summary className="cursor-pointer px-4 py-2 text-sm font-medium">Bordereau comparé (prix unitaires par poste)</summary>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-left text-muted">
                          <tr>
                            <th className="px-3 py-2">Poste</th>
                            <th className="px-3 py-2">Qté</th>
                            {comparison.data.bids.map((b) => (
                              <th key={b.bid_id} className="px-3 py-2 text-right">
                                {b.subcontractor}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-right">Min / moy. / max</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {comparison.data.items.map((it) => (
                            <tr key={it.item_id}>
                              <td className="px-3 py-1.5">{it.designation}</td>
                              <td className="px-3 py-1.5">
                                {number(it.quantity, 2)} {it.unit}
                              </td>
                              {comparison.data!.bids.map((b) => {
                                const p = it.prices.find((x) => x.subcontractor_id === b.subcontractor_id);
                                const isMin = p && it.min !== null && it.min !== undefined && toNumber(p.unit_price) === toNumber(it.min);
                                return (
                                  <td key={b.bid_id} className={`px-3 py-1.5 text-right tabular-nums ${isMin ? "font-semibold text-emerald-700" : ""}`}>
                                    {p ? money(p.unit_price) : "—"}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                                {money(it.min)} / {money(it.avg)} / {money(it.max)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  {((bids.data?.bids ?? []) as Row[]).some((b) => (b.negotiations ?? []).length) ? (
                    <div className="rounded-xl border border-line p-4 text-sm">
                      <p className="mb-2 font-medium">Historique des négociations</p>
                      {((bids.data?.bids ?? []) as Row[]).map((b) =>
                        ((b.negotiations ?? []) as Row[]).map((n) => (
                          <p key={n.id} className="text-xs">
                            {b.subcontractor} · tour {n.round} · {optionLabel(n.proposed_by)} : {money(n.amount)} {n.duration_days ? `· ${n.duration_days} j` : ""} · {optionLabel(n.status)} {n.comment ? `— ${n.comment}` : ""}
                          </p>
                        )),
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState title="Aucune offre pour ce lot" />
                </div>
              )
            ) : comparison.error ? (
              <div className="p-4">
                <Alert tone="warning">{comparison.error}</Alert>
              </div>
            ) : null}
          </>
        )}
      </Card>
      <Card>
        <CardHeader title="Lots et bordereaux" />
        <div className="space-y-4 p-5">
          {lots.map((l) => (
            <div key={l.id}>
              <p className="font-semibold">
                {l.code} — {l.name} <span className="text-sm font-normal text-muted">· estimation {money(l.estimated_amount)}</span>
              </p>
              <ul className="mt-1 text-sm text-muted">
                {((l.items ?? []) as Row[]).map((it) => (
                  <li key={it.id}>
                    {it.code ? `${it.code} · ` : ""}
                    {it.designation} — {number(it.quantity, 2)} {it.unit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={dialog === "invite"}
        onClose={() => setDialog(null)}
        title="Inviter des entreprises"
        footer={
          <Button
            loading={busy}
            disabled={!inviteIds.length}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/tenders/${id}/invitations`, { method: "POST", body: { subcontractor_ids: inviteIds } });
                setInviteIds([]);
                setDialog(null);
                toast.success("Invitations envoyées");
                reload();
              } catch (err) {
                toast.error("Invitation impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Inviter
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Corps de métier" help="Restreint les entreprises proposées ; celles déjà ajoutées restent sélectionnées.">
            <Select value={inviteTrade} onChange={(e) => setInviteTrade(e.target.value)} options={tradeOptions()} placeholder="Tous les corps de métier" />
          </Field>
          <MultiRefSelect source={{ ...REFS.subcontractors, query: { status: "qualified,approved", ...(inviteTrade ? { trade: inviteTrade } : {}) } }} value={inviteIds} onChange={setInviteIds} placeholder="Ajouter une entreprise qualifiée…" />
        </div>
      </Modal>
      <Modal open={dialog === "evaluate" && !!target} onClose={() => setDialog(null)} title={`Évaluation technique — ${target?.subcontractor ?? ""}`}>
        <SchemaForm endpoint="POST /bids/{bid_id}/evaluation" params={{ bid_id: target?.bid_id ?? "" }} initial={{ technical_score: target?.technical_score ?? "" }} fields={{ evaluation: { label: "Détail par critère (facultatif)", render: ({ value, onChange }) => <ScoresEditor value={value} onChange={onChange} placeholder="Ex. Méthodologie" /> } }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); reload(); }} columns={1} />
      </Modal>
      <Modal open={dialog === "negotiate" && !!target} onClose={() => setDialog(null)} title={`Négociation — ${target?.subcontractor ?? ""}`}>
        <SchemaForm endpoint="POST /bids/{bid_id}/negotiations" params={{ bid_id: target?.bid_id ?? "" }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); toast.success("Proposition transmise"); reload(); }} columns={1} />
      </Modal>
      <Modal open={dialog === "award" && !!target} onClose={() => setDialog(null)} title={`Attribuer à ${target?.subcontractor ?? ""}`} size="lg">
        <SchemaForm
          endpoint="POST /tenders/{tender_id}/award"
          params={{ tender_id: id }}
          fixed={{ bid_id: target?.bid_id ?? "" }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            setDialog(null);
            toast.success("Marché créé");
            if (res?.id) router.push(`/erp/sous-traitants/marches/${res.id}`);
            else reload();
          }}
        />
      </Modal>
      <ConfirmDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        title="Clôturer la consultation"
        text="Les offres seront ouvertes et plus aucune remise ne sera acceptée."
        onConfirm={async () => {
          tender.setData(await api(`/tenders/${id}/close`, { method: "POST" }));
          void bids.reload();
        }}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Annuler la consultation"
        reasonLabel="Motif (communiqué aux entreprises)"
        reasonMin={5}
        tone="danger"
        onConfirm={async (reason) => {
          tender.setData(await api(`/tenders/${id}/cancel`, { method: "POST", body: { reason } }));
        }}
      />
      {dialog === "dce" ? (
        <TenderDceDialog
          tender={t}
          open
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            tender.setData(saved);
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- marchés */

export function ContractsList({ projectId }: { projectId?: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Marchés de sous-traitance",
        subtitle: "Contrat, signature OTP, mobilisation, avance, situations, retenue de garantie, clôture.",
        path: "/subcontracts",
        query: { project_id: projectId },
        href: (r) => `/erp/sous-traitants/marches/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/sous-traitants/marches/${r.id}`}>{r.number}</CellLink> },
          { key: "title", label: "Objet" },
          { key: "subcontractor", label: "Sous-traitant" },
          { key: "project", label: "Projet", render: (r) => r.project?.code ?? "—", hideOnMobile: true },
          { key: "amount", label: "Montant HT", format: "money", align: "right" },
          { key: "summary", label: "Avancement", render: (r) => <Progress value={toNumber(r.summary?.progress_pct)} className="w-24" label={`${number(r.summary?.progress_pct ?? 0)} %`} /> },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: CONTRACT_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: {
          endpoint: "POST /subcontracts",
          label: "Marché de gré à gré",
          perms: ["subcontracting:award"],
          fixed: projectId ? { project_id: projectId } : undefined,
          fields: { justification: { help: "Attribution sans consultation : justification obligatoire (tracée)." }, items: { columns: ["code", "designation", "unit", "quantity", "unit_price"] } },
        },
      }}
    />
  );
}

function SituationCreate({ contract, onDone, onCancel }: { contract: Row; onDone: (s: Row) => void; onCancel: () => void }) {
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = (contract.items ?? []) as Row[];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début de période" required>
          <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
        </Field>
        <Field label="Fin de période" required>
          <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
        </Field>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Poste</th>
            <th className="px-3 py-2 text-right">Marché</th>
            <th className="px-3 py-2">Quantité de la période</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((it) => (
            <tr key={it.id}>
              <td className="px-3 py-2">{it.designation}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {number(it.quantity, 2)} {it.unit} × {money(it.unit_price)}
              </td>
              <td className="px-3 py-2">
                <Input type="number" min={0} className="w-32" value={qty[it.id] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!period.start || !period.end || !Object.values(qty).some((v) => toNumber(v) > 0)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const s = await api<Row>(`/subcontracts/${contract.id}/situations`, {
                method: "POST",
                body: { period_start: period.start, period_end: period.end, lines: Object.entries(qty).filter(([, v]) => v !== "").map(([item_id, v]) => ({ item_id, period_quantity: Number(v) })) },
              });
              onDone(s);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer la situation
        </Button>
      </div>
    </div>
  );
}

export function ContractDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const contract = useApi<Row>(`/subcontracts/${id}`);
  const [dialog, setDialog] = useState<null | "edit" | "mobilize" | "situation" | "retention" | "close" | "terminate" | "advance">(null);
  if (contract.loading && !contract.data) return <Skeleton className="h-96 w-full" />;
  if (!contract.data) return <Alert tone="danger">{contract.error}</Alert>;
  const c = contract.data;
  const s = c.summary ?? {};
  const write = can("subcontracting:write");
  const cur = c.currency === "XAF" ? "FCFA" : c.currency;
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/sous-traitants?onglet=marches" className="hover:underline">Marchés</Link>}
        title={`${c.number} — ${c.title}`}
        subtitle={`${c.subcontractor} · ${c.project?.code ?? ""} ${c.project?.name ?? ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <a href={apiUrl(`/subcontracts/${id}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <Download className="h-3.5 w-3.5" /> Contrat PDF
            </a>
            {write && c.status === "draft" ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                Modifier
              </Button>
            ) : null}
            {can("subcontracting:award") && c.status === "draft" ? (
              <>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      contract.setData(await api(`/subcontracts/${id}/send`, { method: "POST" }));
                      toast.success("Contrat envoyé pour signature", "Le sous-traitant signe par code OTP sur son extranet.");
                    } catch (err) {
                      toast.error("Envoi impossible", errorMessage(err));
                    }
                  }}
                >
                  <Send className="h-4 w-4" /> Envoyer pour signature
                </Button>
              </>
            ) : null}
            {write && ["signed", "mobilized", "in_progress"].includes(c.status) ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("mobilize")}>
                  Mobilisation
                </Button>
                <Button size="sm" onClick={() => setDialog("situation")}>
                  Nouvelle situation
                </Button>
              </>
            ) : null}
            {can("billing:write") && toNumber(c.advance_amount) > 0 && ["signed", "mobilized", "in_progress"].includes(c.status) ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("advance")}>
                Facture d'avance
              </Button>
            ) : null}
            {can("finance:approve") && ["in_progress", "completed", "closed"].includes(c.status) && toNumber(s.retention_held) > 0 && s.retention_status !== "released" ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("retention")}>
                Libérer la retenue
              </Button>
            ) : null}
            {can("subcontracting:award") && ["signed", "mobilized", "in_progress", "completed"].includes(c.status) ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("close")}>
                Clôturer
              </Button>
            ) : null}
            {can("subcontracting:award") && !["closed", "terminated"].includes(c.status) ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("terminate")}>
                Résilier
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Montant du marché HT" value={money(c.amount, cur)} hint={`TVA ${number(c.tax_rate ?? 0, 2)} %`} tone="info" />
        <Stat label="Cumul validé" value={money(s.cumulative_validated, cur)} hint={`${number(s.progress_pct ?? 0, 1)} % · reste ${money(s.remaining_amount, cur)}`} />
        <Stat label="Retenue de garantie" value={money(s.retention_held, cur)} hint={`${number(c.retention_pct ?? 0, 1)} % · ${optionLabel(s.retention_status)}`} />
        <Stat label="Facturé / payé" value={`${money(s.invoiced, cur)}`} hint={`Payé ${money(s.paid, cur)} · pénalités ${money(s.penalties, cur)}`} />
      </div>
      <Card className="p-5">
        <Progress value={toNumber(s.progress_pct)} label="Avancement financier" tone="accent" />
        <div className="mt-4">
          <DescriptionList
            columns={3}
            items={[
              { label: "Période", value: `${date(c.start_date)} → ${date(c.end_date)}` },
              { label: "Avance", value: `${money(c.advance_amount, cur)} (récupération ${number(c.advance_recovery_pct ?? 0, 1)} %)` },
              { label: "Avance récupérée", value: money(s.advance_recovered, cur) },
              { label: "Pénalité / jour", value: `${money(c.penalty_per_day, cur)} (plafond ${number(c.penalty_cap_pct ?? 0, 1)} %)` },
              { label: "Signé le", value: `${dateTime(c.signed_at)} ${c.signed_by_name ? `par ${c.signed_by_name}` : ""}` },
              { label: "Situations", value: s.situations ?? (c.situations ?? []).length },
            ]}
          />
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bordereau du marché" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Poste</th>
                  <th className="px-3 py-2 text-right">Qté</th>
                  <th className="px-3 py-2 text-right">PU</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {((c.items ?? []) as Row[]).map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-1.5">{it.designation}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {number(it.quantity, 2)} {it.unit}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(it.unit_price, cur)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(it.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Situations de travaux" />
            <ul className="divide-y divide-line text-sm">
              {((c.situations ?? []) as Row[]).map((x) => (
                <li key={x.id} className="flex justify-between gap-2 px-5 py-2.5">
                  <span>
                    <CellLink href={`/erp/situations/${x.id}`}>{x.number}</CellLink> · {date(x.period_start)} → {date(x.period_end)}
                    <span className="block text-xs text-muted">
                      Net {money(x.net_amount, cur)} {x.exceeds_contract ? "· dépassement" : ""}
                    </span>
                  </span>
                  <StatusBadge status={x.status} />
                </li>
              ))}
              {!(c.situations ?? []).length ? <li className="px-5 py-3 text-muted">Aucune situation.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Mobilisations" />
            <ul className="divide-y divide-line text-sm">
              {((c.mobilizations ?? []) as Row[]).map((m) => (
                <li key={m.id} className="px-5 py-2.5">
                  {date(m.mobilization_date)} · {m.team_size} personne(s) {m.supervisor_name ? `· encadrant ${m.supervisor_name}` : ""}
                  <span className="block text-xs text-muted">
                    Accès chantier {m.site_access_granted ? "accordé" : "non accordé"} · accueil sécurité {m.safety_induction_done ? "fait" : "à faire"}
                  </span>
                </li>
              ))}
              {!(c.mobilizations ?? []).length ? <li className="px-5 py-3 text-muted">Aucune mobilisation.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Factures du sous-traitant" />
            <ul className="divide-y divide-line text-sm">
              {((c.invoices ?? []) as Row[]).map((i) => (
                <li key={i.id} className="flex justify-between gap-2 px-5 py-2.5">
                  <span>
                    {i.number} · {i.reference} · {money(i.amount, cur)}
                  </span>
                  <StatusBadge status={i.status} />
                </li>
              ))}
              {!(c.invoices ?? []).length ? <li className="px-5 py-3 text-muted">Aucune facture.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
      {c.terms ? (
        <Card className="p-5">
          <p className="mb-2 font-semibold">Conditions particulières</p>
          <p className="whitespace-pre-line text-sm text-muted">{c.terms}</p>
        </Card>
      ) : null}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier le marché" size="xl">
        <SchemaForm endpoint="PATCH /subcontracts/{contract_id}" params={{ contract_id: id }} initial={c} partial onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void contract.reload(); }} />
      </Modal>
      <Modal open={dialog === "mobilize"} onClose={() => setDialog(null)} title="Mobilisation du sous-traitant">
        <SchemaForm endpoint="POST /subcontracts/{contract_id}/mobilizations" params={{ contract_id: id }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void contract.reload(); toast.success("Mobilisation enregistrée"); }} />
      </Modal>
      <Modal open={dialog === "situation"} onClose={() => setDialog(null)} title="Nouvelle situation de travaux" size="lg">
        <SituationCreate contract={c} onCancel={() => setDialog(null)} onDone={(sit) => router.push(`/erp/situations/${sit.id}`)} />
      </Modal>
      <Modal open={dialog === "retention"} onClose={() => setDialog(null)} title="Libération de la retenue de garantie">
        <SchemaForm endpoint="POST /subcontracts/{contract_id}/retention/release" params={{ contract_id: id }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void contract.reload(); toast.success("Retenue libérée"); }} columns={1} />
      </Modal>
      <ConfirmDialog
        open={dialog === "advance"}
        onClose={() => setDialog(null)}
        title="Facture d'avance forfaitaire"
        text={`Générer la facture d'avance de ${money(c.advance_amount, cur)} ?`}
        onConfirm={async () => {
          await api(`/subcontracts/${id}/advance-invoice`, { method: "POST" });
          toast.success("Facture d'avance créée");
          void contract.reload();
        }}
      />
      <ConfirmDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        title="Clôturer le marché"
        text="Le décompte définitif est arrêté ; la retenue reste due jusqu'à sa libération."
        onConfirm={async () => {
          contract.setData(await api(`/subcontracts/${id}/close`, { method: "POST" }));
        }}
      />
      <ConfirmDialog
        open={dialog === "terminate"}
        onClose={() => setDialog(null)}
        title="Résilier le marché"
        reasonLabel="Motif de résiliation"
        reasonMin={5}
        tone="danger"
        confirmLabel="Résilier"
        onConfirm={async (reason) => {
          contract.setData(await api(`/subcontracts/${id}/terminate`, { method: "POST", body: { reason } }));
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- situations */

export function SituationsList({ status }: { status?: string }) {
  return (
    <ResourceView
      config={{
        title: "Situations de travaux",
        subtitle: "Soumission avec photos → constat terrain → validation (blocage au-delà du marché sans dérogation) → facture → paiement.",
        path: "/situations",
        query: { status },
        href: (r) => `/erp/situations/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/situations/${r.id}`}>{r.number}</CellLink> },
          { key: "subcontract", label: "Marché", render: (r) => r.subcontract?.number ?? "—" },
          { key: "period_start", label: "Période", render: (r) => `${date(r.period_start)} → ${date(r.period_end)}` },
          { key: "gross_amount", label: "Brut", format: "money", align: "right" },
          { key: "net_amount", label: "Net à payer", format: "money", align: "right" },
          { key: "exceeds_contract", label: "Dépassement", render: (r) => (r.exceeds_contract ? <Badge tone={r.derogation_granted ? "warning" : "danger"}>{r.derogation_granted ? "Dérogation" : "Bloquant"}</Badge> : "—") },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: SITUATION_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
      }}
    />
  );
}

export function SituationDetail({ id }: { id: string }) {
  const { can, canAny } = useAuth();
  const toast = useToast();
  const sit = useApi<Row>(`/situations/${id}`);
  const [dialog, setDialog] = useState<null | "check" | "derogation" | "validate" | "reject" | "invoice">(null);
  const [checked, setChecked] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  if (sit.loading && !sit.data) return <Skeleton className="h-96 w-full" />;
  if (!sit.data) return <Alert tone="danger">{sit.error}</Alert>;
  const s = sit.data;
  const lines = (s.lines ?? []) as Row[];
  const act = async (fn: () => Promise<Row>, message: string) => {
    setBusy(true);
    try {
      sit.setData(await fn());
      toast.success(message);
      setDialog(null);
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/situations" className="hover:underline">Situations</Link>}
        title={`Situation ${s.number}`}
        subtitle={`${s.subcontract?.number ?? ""} — ${s.subcontract?.title ?? ""} · période du ${date(s.period_start)} au ${date(s.period_end)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {s.status === "draft" && can("subcontracting:write") ? (
              <Button size="sm" loading={busy} onClick={() => act(() => api(`/situations/${id}/submit`, { method: "POST" }), "Situation soumise")}>
                Soumettre
              </Button>
            ) : null}
            {s.status === "submitted" && canAny("subcontracting:validate", "site:report") ? (
              <Button
                size="sm"
                onClick={() => {
                  setChecked(Object.fromEntries(lines.map((l) => [l.id, String(toNumber(l.period_quantity))])));
                  setDialog("check");
                }}
              >
                Constat terrain
              </Button>
            ) : null}
            {s.status === "field_checked" && s.exceeds_contract && !s.derogation_granted && can("subcontracting:derogate") ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("derogation")}>
                Accorder une dérogation
              </Button>
            ) : null}
            {s.status === "field_checked" && can("subcontracting:validate") ? (
              <>
                <Button size="sm" onClick={() => setDialog("validate")} disabled={s.exceeds_contract && !s.derogation_granted}>
                  Valider
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("reject")}>
                  Rejeter
                </Button>
              </>
            ) : null}
            {s.status === "validated" && can("billing:write") ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("invoice")}>
                Enregistrer la facture
              </Button>
            ) : null}
          </div>
        }
      />
      {s.exceeds_contract ? (
        <Alert tone={s.derogation_granted ? "warning" : "danger"} title={s.derogation_granted ? "Dépassement couvert par une dérogation" : "Dépassement du montant du marché"}>
          {s.derogation_granted ? s.derogation_reason : "La validation est bloquée tant qu'une dérogation n'a pas été accordée (ou qu'un avenant n'a pas été signé)."}
        </Alert>
      ) : null}
      {s.rejection_reason ? <Alert tone="danger" title="Motif du rejet">{s.rejection_reason}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Montant brut de la période" value={money(s.gross_amount)} tone="info" />
        <Stat label="Cumul" value={money(s.cumulative_amount)} hint={`Précédent ${money(s.previous_cumulative_amount)}`} />
        <Stat label="Retenues" value={money(toNumber(s.retention_amount) + toNumber(s.advance_recovered) + toNumber(s.penalties))} hint={`Garantie ${money(s.retention_amount)} · avance ${money(s.advance_recovered)} · pénalités ${money(s.penalties)}`} />
        <Stat label="Net à payer" value={money(s.net_amount)} tone="success" />
      </div>
      <Card>
        <CardHeader title="Avancement par poste" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Poste</th>
                <th className="px-3 py-2 text-right">Marché</th>
                <th className="px-3 py-2 text-right">Précédent</th>
                <th className="px-3 py-2 text-right">Période</th>
                <th className="px-3 py-2 text-right">Constaté</th>
                <th className="px-3 py-2 text-right">Cumul</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-1.5">{l.designation}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {number(l.contract_quantity, 2)} {l.unit}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(l.previous_quantity, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(l.period_quantity, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.checked_quantity !== null && l.checked_quantity !== undefined ? number(l.checked_quantity, 2) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(l.cumulative_quantity, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(l.progress_pct, 1)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.field_check_notes ? <p className="border-t border-line px-5 py-3 text-sm text-muted">Constat terrain : {s.field_check_notes}</p> : null}
      </Card>
      <Card>
        <CardHeader title="Photos d'avancement" subtitle="Obligatoires pour la soumission (preuves datées et géolocalisées)." />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {((s.photo_file_ids ?? []) as string[]).map((fid) => (
            <a key={fid} href={apiUrl(`/situations/${id}/photos/${fid}`)} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-slate-100">
              <img src={apiUrl(`/situations/${id}/photos/${fid}`)} alt="Photo d'avancement" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ))}
          {!(s.photo_file_ids ?? []).length ? <p className="col-span-full text-sm text-muted">Aucune photo.</p> : null}
        </div>
        {s.status === "draft" ? (
          <div className="space-y-2 border-t border-line p-4">
            <FileDrop files={photos} onChange={setPhotos} multiple accept="image/*" capture="environment" maxSizeMb={20} />
            <Button
              size="sm"
              disabled={!photos.length}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  for (const f of photos) {
                    const fd = new FormData();
                    fd.append("file", f);
                    await api(`/situations/${id}/photos`, { method: "POST", form: fd });
                  }
                  setPhotos([]);
                  void sit.reload();
                } catch (err) {
                  toast.error("Envoi impossible", errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Envoyer les photos
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal
        open={dialog === "check"}
        onClose={() => setDialog(null)}
        title="Constat terrain"
        size="lg"
        footer={
          <Button loading={busy} onClick={() => act(() => api(`/situations/${id}/field-check`, { method: "POST", body: { checked: Object.fromEntries(Object.entries(checked).map(([k, v]) => [k, Number(v || 0)])), notes: notes || null } }), "Constat enregistré")}>
            Enregistrer le constat
          </Button>
        }
      >
        <table className="min-w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 text-left">Poste</th>
              <th className="py-1 text-right">Déclaré</th>
              <th className="py-1 text-left">Constaté</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5">{l.designation}</td>
                <td className="py-1.5 text-right tabular-nums">{number(l.period_quantity, 2)}</td>
                <td className="py-1.5">
                  <Input type="number" min={0} className="w-28" value={checked[l.id] ?? ""} onChange={(e) => setChecked((c) => ({ ...c, [l.id]: e.target.value }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Field label="Observations" className="mt-4">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
      </Modal>
      <ConfirmDialog
        open={dialog === "derogation"}
        onClose={() => setDialog(null)}
        title="Dérogation au montant du marché"
        reasonLabel="Justification (tracée et auditée)"
        reasonMin={15}
        tone="accent"
        onConfirm={async (reason) => {
          sit.setData(await api(`/situations/${id}/derogation`, { method: "POST", body: { reason } }));
        }}
      />
      <Modal open={dialog === "validate"} onClose={() => setDialog(null)} title="Valider la situation">
        <SchemaForm endpoint="POST /situations/{situation_id}/validate" params={{ situation_id: id }} onCancel={() => setDialog(null)} onSuccess={(res: Row) => { sit.setData(res); setDialog(null); toast.success("Situation validée", "La dépense est imputée au chantier."); }} columns={1} />
      </Modal>
      <ConfirmDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Rejeter la situation"
        reasonLabel="Motif (communiqué au sous-traitant)"
        reasonMin={5}
        tone="danger"
        onConfirm={async (reason) => {
          sit.setData(await api(`/situations/${id}/reject`, { method: "POST", body: { reason } }));
        }}
      />
      <Modal open={dialog === "invoice"} onClose={() => setDialog(null)} title="Facture du sous-traitant">
        <SchemaForm endpoint="POST /situations/{situation_id}/invoice" params={{ situation_id: id }} initial={{ amount: s.invoice_amount_expected ?? s.net_amount }} fields={{ amount: { help: `Montant attendu : ${money(s.invoice_amount_expected ?? s.net_amount)} (net à payer de la situation, plus la TVA du marché le cas échéant).` } }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void sit.reload(); toast.success("Facture enregistrée"); }} columns={1} />
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- factures, réclamations */

export function SubcontractorInvoices() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Factures des sous-traitants",
        path: "/subcontractor-invoices",
        columns: [
          { key: "number", label: "N°" },
          { key: "reference", label: "Réf. sous-traitant" },
          { key: "kind", label: "Type", format: "option" },
          { key: "invoice_date", label: "Date", format: "date" },
          { key: "amount", label: "Montant TTC", format: "money", align: "right" },
          { key: "amount_paid", label: "Payé", format: "money", align: "right" },
          { key: "amount_frozen", label: "Gelé (litige)", format: "money", align: "right", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: ["received", "approved_for_payment", "partially_paid", "paid", "disputed", "rejected"].map((v) => ({ value: v, label: optionLabel(v) })) }],
        detailPath: (r) => `/subcontractor-invoices/${r.id}`,
        detail: (r) => (
          <div className="space-y-3">
            <DescriptionList
              items={[
                { label: "Référence", value: r.reference },
                { label: "Date / échéance", value: `${date(r.invoice_date)} · ${date(r.due_date)}` },
                { label: "HT / TVA / TTC", value: `${money(r.amount_ht)} / ${money(r.tax_amount)} / ${money(r.amount)}` },
                { label: "Payé", value: money(r.amount_paid) },
                { label: "Avoirs", value: money(r.amount_credited) },
                { label: "Gelé (litige)", value: money(r.amount_frozen) },
                { label: "Statut", value: <StatusBadge status={r.status} /> },
              ]}
            />
            {r.file_id ? (
              <a href={apiUrl(`/subcontractor-invoices/${r.id}/file`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                <Download className="h-4 w-4" /> Facture (PDF)
              </a>
            ) : null}
            {r.rejection_reason ? <Alert tone="danger">{r.rejection_reason}</Alert> : null}
          </div>
        ),
        actions: [
          { key: "validate", label: "Valider (bon à payer)", path: (r) => `/subcontractor-invoices/${r.id}/validate`, when: (r) => r.status === "received", perms: ["billing:validate"], confirm: "Valider cette facture pour paiement ?" },
          { key: "reject", label: "Rejeter", path: (r) => `/subcontractor-invoices/${r.id}/reject`, when: (r) => r.status === "received", perms: ["billing:validate"], reasonLabel: "Motif du rejet", tone: "danger" },
        ],
      }}
    />
  );
}

export function ClaimsList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Réclamations",
        subtitle: "Demandes de rémunération complémentaire ou contestations des partenaires.",
        path: "/claims",
        columns: [
          { key: "title", label: "Réclamation" },
          { key: "amount", label: "Montant", format: "money", align: "right" },
          { key: "created_at", label: "Date", format: "date" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: ["submitted", "accepted", "rejected", "escalated"].map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: { endpoint: "POST /claims", label: "Nouvelle réclamation", perms: ["disputes:write"], fields: { subcontract_id: { ref: "subcontracts" } } },
        actions: [{ key: "answer", label: "Répondre", endpoint: "POST /claims/{claim_id}/answer", when: (r) => r.status === "submitted", perms: ["disputes:write"], success: "Réponse enregistrée (une escalade ouvre un litige)." }],
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- litiges */

const DISPUTE_FLOW = ["OUVERT", "EN_ANALYSE", "EN_NEGOCIATION", "ESCALADE", "DECISION", "RESOLU"];

const PARTY_SOURCES: Record<string, { label: string; source: RefSource }> = {
  subcontractor: { label: "Sous-traitant", source: REFS.subcontractors },
  supplier: { label: "Fournisseur", source: REFS.suppliers },
  client: { label: "Client", source: REFS.clientOrganizations },
};

const RELATED_SOURCES: Record<string, { label: string; party: string; source: (partyId: string | null) => RefSource }> = {
  subcontract: { label: "Marché de sous-traitance", party: "subcontractor", source: (pid) => ({ ...REFS.subcontracts, query: pid ? { subcontractor_id: pid } : undefined }) },
  situation: {
    label: "Situation de travaux",
    party: "subcontractor",
    source: (pid) => ({ path: "/situations", query: pid ? { subcontractor_id: pid } : undefined, label: (r) => `${r.number} — ${r.subcontract?.number ?? ""}`, sublabel: (r) => `${date(r.period_start)} → ${date(r.period_end)}`, paginated: true, searchable: true }),
  },
  subcontractor_invoice: {
    label: "Facture sous-traitant",
    party: "subcontractor",
    source: (pid) => ({ path: "/subcontractor-invoices", query: pid ? { subcontractor_id: pid } : undefined, label: (r) => `${r.number} — ${r.reference ?? ""}`, sublabel: (r) => money(r.amount), paginated: true, searchable: true }),
  },
  purchase_order: { label: "Bon de commande", party: "supplier", source: (pid) => ({ ...REFS.purchaseOrders, query: pid ? { supplier_id: pid } : undefined }) },
  goods_receipt: {
    label: "Réception",
    party: "supplier",
    source: (pid) => ({ path: "/goods-receipts", query: pid ? { supplier_id: pid } : undefined, label: (r) => `${r.number} — ${date(r.received_at ?? r.created_at)}`, paginated: true, searchable: true }),
  },
  supplier_invoice: { label: "Facture fournisseur", party: "supplier", source: (pid) => ({ ...REFS.supplierInvoices, query: pid ? { supplier_id: pid } : undefined }) },
};

interface DisputeDraft {
  party_type: string;
  party_id: string | null;
  related_type: string;
  related_id: string | null;
  project_id: string | null;
  owner_id: string | null;
  title: string;
  description: string;
  amount_disputed: string;
  freeze: boolean;
}

/** Ouverture guidée d'un litige : partie → pièce contestée → montant gelé. */
export function DisputeCreate({ onCreated, onCancel, initial }: { onCreated: (d: Row) => void; onCancel: () => void; initial?: Partial<DisputeDraft> }) {
  const [v, setV] = useState<DisputeDraft>({
    party_type: "subcontractor",
    party_id: null,
    related_type: "",
    related_id: null,
    project_id: null,
    owner_id: null,
    title: "",
    description: "",
    amount_disputed: "",
    freeze: true,
    ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const relatedOptions = Object.entries(RELATED_SOURCES).filter(([, r]) => r.party === v.party_type);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await api<Row>("/disputes", {
        method: "POST",
        body: {
          party_type: v.party_type,
          party_id: v.party_id,
          related_type: v.related_type || null,
          related_id: v.related_type ? v.related_id : null,
          project_id: v.project_id,
          owner_id: v.owner_id,
          title: v.title.trim(),
          description: v.description || null,
          amount_disputed: Number(v.amount_disputed || 0),
          freeze: v.freeze,
        },
      });
      onCreated(d);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Partie concernée" required>
          <Select
            value={v.party_type}
            onChange={(e) => setV({ ...v, party_type: e.target.value, party_id: null, related_type: "", related_id: null })}
            options={Object.entries(PARTY_SOURCES).map(([value, p]) => ({ value, label: p.label }))}
          />
        </Field>
        <Field label={PARTY_SOURCES[v.party_type].label} required>
          <RefSelect key={v.party_type} source={PARTY_SOURCES[v.party_type].source} value={v.party_id} onChange={(id) => setV({ ...v, party_id: id, related_id: null })} />
        </Field>
        {relatedOptions.length ? (
          <Field label="Pièce contestée">
            <Select
              value={v.related_type}
              onChange={(e) => setV({ ...v, related_type: e.target.value, related_id: null })}
              options={[{ value: "", label: "Aucune" }, ...relatedOptions.map(([value, r]) => ({ value, label: r.label }))]}
            />
          </Field>
        ) : null}
        {v.related_type ? (
          <Field label={RELATED_SOURCES[v.related_type].label} required>
            <RefSelect
              key={`${v.related_type}-${v.party_id ?? ""}`}
              source={RELATED_SOURCES[v.related_type].source(v.party_id)}
              value={v.related_id}
              onChange={(id, row) => setV({ ...v, related_id: id, project_id: v.project_id ?? row?.project_id ?? row?.project?.id ?? null })}
            />
          </Field>
        ) : null}
        <Field label="Projet">
          <RefSelect source={REFS.projects} value={v.project_id} onChange={(id) => setV({ ...v, project_id: id })} />
        </Field>
        <Field label="Responsable du dossier">
          <RefSelect source={REFS.users} value={v.owner_id} onChange={(id) => setV({ ...v, owner_id: id })} />
        </Field>
        <Field label="Objet" required className="sm:col-span-2">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={250} />
        </Field>
        <Field label="Exposé des faits" className="sm:col-span-2">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={4} />
        </Field>
        <Field label="Montant contesté">
          <Input type="number" min={0} value={v.amount_disputed} onChange={(e) => setV({ ...v, amount_disputed: e.target.value })} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox label="Geler les paiements sur la pièce contestée" checked={v.freeze} onChange={(freeze) => setV({ ...v, freeze })} />
        </div>
      </div>
      <p className="text-xs text-muted">Les preuves (photos, courriers, PV) s'ajoutent ensuite à la chronologie du litige.</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button loading={busy} disabled={!v.party_id || v.title.trim().length < 3 || (!!v.related_type && !v.related_id)} onClick={submit}>
          Ouvrir le litige
        </Button>
      </div>
    </div>
  );
}

export function DisputesList() {
  const { can } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <ResourceView
        config={{
          title: "Litiges",
          subtitle: "Statuts, montants gelés, preuves, chronologie horodatée, décision et résolution (avoir).",
          path: "/disputes",
          href: (r) => `/erp/litiges/${r.id}`,
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/litiges/${r.id}`}>{r.number}</CellLink> },
            { key: "title", label: "Objet" },
            { key: "party_label", label: "Partie" },
            { key: "party_type", label: "Type", format: "option", hideOnMobile: true },
            { key: "amount_disputed", label: "Contesté", format: "money", align: "right" },
            { key: "amount_frozen", label: "Gelé", format: "money", align: "right", hideOnMobile: true },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [
            { key: "status", label: "Statut", options: DISPUTE_FLOW.map((v) => ({ value: v, label: optionLabel(v) })) },
            { key: "party_type", label: "Partie", options: Object.entries(PARTY_SOURCES).map(([value, p]) => ({ value, label: p.label })) },
          ],
          toolbar: can("disputes:write") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Ouvrir un litige
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Ouvrir un litige" size="lg">
        <DisputeCreate onCancel={() => setCreating(false)} onCreated={(d) => router.push(`/erp/litiges/${d.id}`)} />
      </Modal>
    </>
  );
}

export function DisputeDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const dispute = useApi<Row>(`/disputes/${id}`);
  const [dialog, setDialog] = useState<null | "transition" | "event" | "decision" | "resolve">(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("EN_ANALYSE");
  const [content, setContent] = useState("");
  if (dispute.loading && !dispute.data) return <Skeleton className="h-96 w-full" />;
  if (!dispute.data) return <Alert tone="danger">{dispute.error}</Alert>;
  const d = dispute.data;
  const events = (d.events ?? []) as Row[];
  const flow: Record<string, string[]> = { OUVERT: ["EN_ANALYSE", "ESCALADE"], EN_ANALYSE: ["EN_NEGOCIATION", "ESCALADE"], EN_NEGOCIATION: ["ESCALADE"], ESCALADE: ["EN_NEGOCIATION"], DECISION: ["ESCALADE"] };
  // L'escalade engage la direction : réservée aux décideurs.
  const allowed: Record<string, string[]> = Object.fromEntries(Object.entries(flow).map(([k, v]) => [k, v.filter((x) => x !== "ESCALADE" || can("disputes:decide"))]));
  const write = can("disputes:write");
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/litiges" className="hover:underline">Litiges</Link>}
        title={`${d.number} — ${d.title}`}
        subtitle={`${optionLabel(d.party_type)} : ${d.party_label ?? ""} ${d.related_type ? `· ${optionLabel(d.related_type)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={d.status} />
            {write && allowed[d.status]?.length ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTarget(allowed[d.status][0]);
                  setDialog("transition");
                }}
              >
                Faire évoluer
              </Button>
            ) : null}
            {write && d.status !== "RESOLU" ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("event")}>
                Ajouter à la chronologie
              </Button>
            ) : null}
            {can("disputes:decide") && ["EN_ANALYSE", "EN_NEGOCIATION", "ESCALADE"].includes(d.status) ? (
              <Button size="sm" onClick={() => setDialog("decision")}>
                <Gavel className="h-4 w-4" /> Décision
              </Button>
            ) : null}
            {can("disputes:decide") && d.status === "DECISION" ? (
              <Button size="sm" variant="accent" onClick={() => setDialog("resolve")}>
                Clore (résolu)
              </Button>
            ) : null}
          </div>
        }
      />
      <ol className="flex flex-wrap gap-2">
        {DISPUTE_FLOW.map((s) => (
          <li key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${s === d.status ? "bg-brand-500 text-white" : DISPUTE_FLOW.indexOf(s) < DISPUTE_FLOW.indexOf(d.status) ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-muted"}`}>
            {optionLabel(s)}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Montant contesté" value={money(d.amount_disputed)} tone="warning" />
        <Stat label="Montant gelé" value={money(d.amount_frozen)} hint="Paiements suspendus sur la pièce contestée" />
        <Stat label="Accepté / refusé" value={`${money(d.amount_accepted)} / ${money(d.amount_refused)}`} />
        <Stat label="Niveau d'escalade" value={d.escalation_level ?? 0} hint={d.escalated_to ? optionLabel(d.escalated_to) : undefined} />
      </div>
      {d.description ? <Card className="whitespace-pre-line p-5 text-sm">{d.description}</Card> : null}
      {d.decision_summary ? <Alert tone="info" title={`Décision du ${dateTime(d.decided_at)}`}>{d.decision_summary}</Alert> : null}
      <Card>
        <CardHeader title="Chronologie" subtitle="Journal horodaté et non modifiable des échanges, preuves, propositions et décisions." />
        <ol className="relative space-y-4 border-l-2 border-brand-100 py-5 pl-6 pr-5 ml-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-accent-500 ring-4 ring-white" />
              <p className="text-xs text-muted">
                {dateTime(e.created_at)} · {optionLabel(e.kind)} · {e.author_side === "party" ? "Partenaire" : "GLOBUS"}
                {e.from_status ? ` · ${optionLabel(e.from_status)} → ${optionLabel(e.to_status)}` : ""}
              </p>
              {e.amount !== null && e.amount !== undefined ? <p className="text-sm font-semibold">{money(e.amount)}</p> : null}
              {e.content ? <p className="whitespace-pre-line text-sm">{e.content}</p> : null}
              {((e.file_ids ?? []) as string[]).length ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {(e.file_ids as string[]).map((fid, i) => (
                    <a key={fid} href={apiUrl(`/disputes/${id}/files/${fid}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                      <Download className="h-3 w-3" /> Pièce {i + 1}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
          {!events.length ? <li className="text-sm text-muted">Aucun événement.</li> : null}
        </ol>
      </Card>

      <Modal
        open={dialog === "transition"}
        onClose={() => setDialog(null)}
        title="Faire évoluer le litige"
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                dispute.setData(await api(`/disputes/${id}/transition`, { method: "POST", body: { to_status: target, content: content || null } }));
                setContent("");
                setDialog(null);
              } catch (err) {
                toast.error("Transition impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer
          </Button>
        }
      >
        <div className="space-y-3">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} options={(allowed[d.status] ?? []).map((s) => ({ value: s, label: optionLabel(s) }))} aria-label="Nouveau statut" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Commentaire" />
        </div>
      </Modal>
      <Modal open={dialog === "event"} onClose={() => setDialog(null)} title="Ajouter à la chronologie" size="lg">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Pièces jointes (facultatif)</p>
            <FileDrop files={files} onChange={setFiles} multiple maxSizeMb={25} />
          </div>
          <SchemaForm
            endpoint="POST /disputes/{dispute_id}/events"
            params={{ dispute_id: id }}
            fields={{ file_ids: { hidden: true } }}
            onSubmit={async (payload) => {
              const ids: string[] = [];
              for (const f of files) {
                const fd = new FormData();
                fd.append("file", f);
                const res = await api<{ file_id: string }>(`/disputes/${id}/files`, { method: "POST", form: fd });
                ids.push(res.file_id);
              }
              return api(`/disputes/${id}/events`, { method: "POST", body: { ...(payload as Row), file_ids: ids } });
            }}
            onCancel={() => setDialog(null)}
            onSuccess={() => {
              setFiles([]);
              setDialog(null);
              void dispute.reload();
            }}
            columns={1}
          />
        </div>
      </Modal>
      <Modal open={dialog === "decision"} onClose={() => setDialog(null)} title="Décision">
        <SchemaForm endpoint="POST /disputes/{dispute_id}/decision" params={{ dispute_id: id }} initial={{ amount_accepted: 0, amount_refused: d.amount_disputed }} fields={{ file_ids: { hidden: true }, amount_refused: { help: `Accepté + refusé = montant contesté (${money(d.amount_disputed)}).` }, summary: { help: "Motivation détaillée de la décision : 20 caractères minimum." } }} onCancel={() => setDialog(null)} onSuccess={(res: Row) => { dispute.setData(res); setDialog(null); }} columns={1} />
      </Modal>
      <ConfirmDialog
        open={dialog === "resolve"}
        onClose={() => setDialog(null)}
        title="Clore le litige"
        text="Les montants gelés sont libérés ; un avoir est émis pour la part refusée le cas échéant."
        reasonLabel="Commentaire de clôture"
        reasonMin={3}
        onConfirm={async (reason) => {
          dispute.setData(await api(`/disputes/${id}/resolve`, { method: "POST", body: { comment: reason } }));
        }}
      />
    </div>
  );
}

export function SubcontractingHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title="Sous-traitance" subtitle="Qualification → consultation → comparatif → contrat → mobilisation → situations → contrôle → facture → paiement → litige → clôture." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "sous-traitants", label: "Sous-traitants" },
          { key: "consultations", label: "Consultations" },
          { key: "marches", label: "Marchés" },
          { key: "factures", label: "Factures" },
          { key: "reclamations", label: "Réclamations" },
        ]}
      />
      {tab === "sous-traitants" ? <SubcontractorsList /> : null}
      {tab === "consultations" ? <TendersList /> : null}
      {tab === "marches" ? <ContractsList /> : null}
      {tab === "factures" ? <SubcontractorInvoices /> : null}
      {tab === "reclamations" ? <ClaimsList /> : null}
    </div>
  );
}
