"use client";

import clsx from "clsx";
import { Bot, Paperclip, Play, RotateCcw, Send, Star, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { SchemaForm } from "@/components/forms/schema-form";
import { RowsEditor } from "@/components/forms/structured-fields";
import { Checkbox, FileDrop, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

export interface TicketData {
  id: string;
  number: string;
  project_id?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  category: string;
  priority: string;
  subject: string;
  description?: string | null;
  location?: string | null;
  status: string;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  response_breached?: boolean;
  resolution_breached?: boolean;
  within_warranty?: boolean | null;
  assigned_to_id?: string | null;
  diagnosis?: string | null;
  resolution?: string | null;
  total_cost?: string | null;
  satisfaction_rating?: number | null;
  satisfaction_comment?: string | null;
  ai_draft_reply?: string | null;
  created_at: string;
  messages: { id: string; author_id?: string | null; body: string; internal: boolean; created_at: string }[];
  attachments: { id: string; file_id: string; kind: string; uploaded_by_id?: string | null; created_at: string }[];
  interventions: { id: string; number: string; technician_id?: string | null; scheduled_at: string; started_at?: string | null; finished_at?: string | null; report?: string | null; time_spent_hours?: string | null; labor_cost?: string | null; material_cost?: string | null; status: string; client_validated?: boolean }[];
  warranty_claim?: { decision: string; reason: string; responsible_party?: string | null } | null;
}

type Material = Record<string, any>;

/** Fournitures d'une intervention : `[{ label, quantity, unit, cost }]` (coût total de la ligne). */
function MaterialsEditor({ value, onChange }: { value: unknown; onChange: (v: Material[]) => void }) {
  const rows: Material[] = Array.isArray(value) ? value : [];
  const total = rows.reduce((sum, r) => sum + toNumber(r.cost), 0);
  return (
    <RowsEditor
      value={rows}
      onChange={onChange}
      itemLabel="Fourniture"
      title={(r, i) => r.label || `Fourniture ${i + 1}`}
      fields={[
        { key: "label", label: "Libellé", placeholder: "Ex. Disjoncteur 20 A" },
        { key: "quantity", label: "Quantité", type: "number", min: 0 },
        { key: "unit", label: "Unité", placeholder: "u, m, kg…" },
        { key: "cost", label: "Coût (FCFA)", type: "number", min: 0 },
      ]}
      newRow={() => ({ label: "", quantity: 1, unit: "u", cost: 0 })}
      addLabel="Fourniture"
      empty="Aucune fourniture utilisée."
      max={100}
      footer={rows.length ? <p className="text-right text-sm text-muted">Total : <strong className="text-ink">{money(total)}</strong> (à reporter dans le coût matériel)</p> : null}
    />
  );
}

/** Preuves d'intervention : photos du ticket (avant / après) cochées ; les photos « après » sont proposées d'office. */
function ProofPicker({ attachments, value, onChange }: { attachments: TicketData["attachments"]; value: unknown; onChange: (v: string[]) => void }) {
  const photos = attachments.filter((a) => a.kind !== "document");
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
  useEffect(() => {
    if (!Array.isArray(value)) onChange(photos.filter((a) => a.kind === "after").map((a) => a.file_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!photos.length) return <Alert tone="warning">Ajoutez d&apos;abord les photos avant / après dans « Photos et documents » : elles servent de preuve.</Alert>;
  return (
    <div className="space-y-1.5">
      {photos.map((a) => (
        <Checkbox
          key={a.id}
          checked={selected.includes(a.file_id)}
          onChange={(on) => onChange(on ? [...selected, a.file_id] : selected.filter((x) => x !== a.file_id))}
          label={`${optionLabel(a.kind)} · ${dateTime(a.created_at)}`}
        />
      ))}
    </div>
  );
}

/** Fiche SAV (§18.1) : échanges, pièces, diagnostic, garantie, interventions, validation et satisfaction. */
export function TicketDetail({ ticketId, staff = false, onChanged }: { ticketId: string; staff?: boolean; onChanged?: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const ticket = useApi<TicketData>(`/support/tickets/${ticketId}`);
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState("photo");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "assign" | "diagnosis" | "warranty" | "intervention" | "finish" | "validate" | "reopen">(null);
  const [finishId, setFinishId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  if (ticket.loading && !ticket.data) return <Skeleton className="h-96 w-full" />;
  if (!ticket.data) return <Alert tone="danger">{ticket.error}</Alert>;
  const t = ticket.data;
  const refresh = (data?: TicketData) => {
    if (data) ticket.setData(data);
    else void ticket.reload();
    onChanged?.();
  };

  const post = async (key: string, fn: () => Promise<TicketData | unknown>) => {
    setBusy(key);
    try {
      const res = await fn();
      refresh(res && typeof res === "object" && "number" in (res as object) ? (res as TicketData) : undefined);
      return true;
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const awaitingClient = t.status === "resolved" || t.interventions.some((i) => i.status === "done" && !i.client_validated);
  const closed = ["closed", "cancelled"].includes(t.status);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">
              {t.number} · ouvert le {dateTime(t.created_at)}
            </p>
            <h2 className="mt-1 text-xl font-bold text-brand-800">{t.subject}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={t.priority === "urgent" || t.priority === "high" ? "danger" : "neutral"}>{optionLabel(t.priority)}</Badge>
            <StatusBadge status={t.status} />
            {t.response_breached || t.resolution_breached ? <Badge tone="danger">SLA dépassé</Badge> : null}
          </div>
        </div>
        {t.description ? <p className="mt-3 whitespace-pre-line text-sm text-ink">{t.description}</p> : null}
        <div className="mt-4">
          <DescriptionList
            columns={3}
            items={[
              { label: "Catégorie", value: optionLabel(t.category) },
              { label: "Localisation", value: t.location },
              { label: "Sous garantie", value: t.within_warranty === null || t.within_warranty === undefined ? "À déterminer" : t.within_warranty ? "Oui" : "Non" },
              { label: "Réponse attendue", value: dateTime(t.response_due_at) },
              { label: "Résolution attendue", value: dateTime(t.resolution_due_at) },
              ...(staff ? [{ label: "Coût total", value: money(t.total_cost ?? 0) }] : []),
            ]}
          />
        </div>
        {t.diagnosis ? (
          <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
            <p className="font-semibold text-brand-800">Diagnostic</p>
            <p className="whitespace-pre-line">{t.diagnosis}</p>
          </div>
        ) : null}
        {t.warranty_claim ? (
          <Alert tone={t.warranty_claim.decision === "covered" ? "success" : t.warranty_claim.decision === "partial" ? "warning" : "danger"} title={`Garantie : ${optionLabel(t.warranty_claim.decision)}`}>
            {t.warranty_claim.reason}
          </Alert>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {staff && !closed ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDialog("assign")}>
                Affecter
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog("diagnosis")}>
                Diagnostic
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog("warranty")}>
                Décision garantie
              </Button>
              <Button size="sm" onClick={() => setDialog("intervention")}>
                <Wrench className="h-4 w-4" /> Planifier une intervention
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={busy === "ai"}
                onClick={() =>
                  post("ai", async () => {
                    const res = await api<{ draft?: string | null }>(`/support/tickets/${t.id}/ai-draft`, { method: "POST" });
                    if (res.draft) setMessage(res.draft);
                    return null;
                  })
                }
              >
                <Bot className="h-4 w-4" /> Proposer une réponse (IA)
              </Button>
            </>
          ) : null}
          {!staff && awaitingClient && !closed ? (
            <Button size="sm" variant="accent" onClick={() => setDialog("validate")}>
              <Star className="h-4 w-4" /> Valider l'intervention
            </Button>
          ) : null}
          {t.status === "resolved" || t.status === "closed" ? (
            <Button size="sm" variant="ghost" onClick={() => setDialog("reopen")}>
              <RotateCcw className="h-4 w-4" /> Rouvrir
            </Button>
          ) : null}
        </div>
      </Card>

      {t.interventions.length ? (
        <Card>
          <CardHeader title="Interventions" />
          <ul className="divide-y divide-line">
            {t.interventions.map((i) => (
              <li key={i.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {i.number} · {dateTime(i.scheduled_at)}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={i.status} />
                    {i.client_validated ? <Badge tone="success">Validée par le client</Badge> : null}
                    {staff && i.status === "scheduled" ? (
                      <Button size="sm" variant="secondary" loading={busy === `start-${i.id}`} onClick={() => post(`start-${i.id}`, () => api(`/support/interventions/${i.id}/start`, { method: "POST" }))}>
                        <Play className="h-3.5 w-3.5" /> Démarrer
                      </Button>
                    ) : null}
                    {staff && i.status === "in_progress" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setFinishId(i.id);
                          setDialog("finish");
                        }}
                      >
                        Terminer
                      </Button>
                    ) : null}
                  </span>
                </div>
                {i.report ? <p className="mt-1 whitespace-pre-line text-muted">{i.report}</p> : null}
                {staff && (i.labor_cost || i.material_cost) ? (
                  <p className="text-xs text-muted">
                    Main-d'œuvre {money(i.labor_cost ?? 0)} · matériel {money(i.material_cost ?? 0)} · {i.time_spent_hours ?? 0} h
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Échanges" />
        <ul className="space-y-3 p-5">
          {t.messages.map((m) => {
            const mine = m.author_id === user?.id;
            return (
              <li key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                <div className={clsx("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.internal ? "bg-amber-50 ring-1 ring-amber-200" : mine ? "bg-brand-500 text-white" : "bg-slate-100 text-ink")}>
                  {m.internal ? <p className="mb-1 text-[11px] font-semibold uppercase text-amber-700">Note interne</p> : null}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={clsx("mt-1 text-[11px]", mine && !m.internal ? "text-brand-100" : "text-muted")}>{dateTime(m.created_at)}</p>
                </div>
              </li>
            );
          })}
          {!t.messages.length ? <li className="text-sm text-muted">Aucun échange pour le moment.</li> : null}
        </ul>
        {!closed ? (
          <div className="space-y-2 border-t border-line p-4">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Votre message…" maxLength={8000} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {staff ? <Checkbox label="Note interne (invisible du client)" checked={internal} onChange={setInternal} /> : <span />}
              <Button
                loading={busy === "msg"}
                disabled={!message.trim()}
                onClick={async () => {
                  const ok = await post("msg", () => api(`/support/tickets/${t.id}/messages`, { method: "POST", body: { body: message.trim(), internal: staff && internal } }));
                  if (ok) setMessage("");
                }}
              >
                <Send className="h-4 w-4" /> Envoyer
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Photos et documents" />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {t.attachments.map((a) => (
            <a key={a.id} href={apiUrl(`/support/attachments/${a.id}`)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs hover:bg-brand-50">
              <Paperclip className="h-4 w-4 text-brand-500" /> {optionLabel(a.kind)} · {dateTime(a.created_at)}
            </a>
          ))}
          {!t.attachments.length ? <p className="col-span-full text-sm text-muted">Aucune pièce jointe.</p> : null}
        </div>
        {!closed ? (
          <div className="space-y-2 border-t border-line p-4">
            <div className="flex flex-wrap items-end gap-2">
              <Select className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)} options={["photo", "document", "before", "after"].map((v) => ({ value: v, label: optionLabel(v) }))} aria-label="Type de pièce" />
            </div>
            <FileDrop files={files} onChange={setFiles} multiple accept="image/*,.pdf" maxSizeMb={25} capture="environment" />
            <Button
              size="sm"
              disabled={!files.length}
              loading={busy === "upload"}
              onClick={async () => {
                setBusy("upload");
                try {
                  for (const f of files) {
                    const form = new FormData();
                    form.append("kind", kind);
                    form.append("file", f);
                    await api(`/support/tickets/${t.id}/attachments`, { method: "POST", form });
                  }
                  setFiles([]);
                  refresh();
                } catch (err) {
                  toast.error("Envoi impossible", errorMessage(err));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Envoyer les fichiers
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal open={dialog === "assign"} onClose={() => setDialog(null)} title="Affecter le ticket">
        <SchemaForm endpoint="POST /support/tickets/{ticket_id}/assign" params={{ ticket_id: t.id }} fields={{ assignee_id: { label: "Technicien / responsable", ref: "users" } }} onSuccess={(res) => { refresh(res); setDialog(null); }} onCancel={() => setDialog(null)} columns={1} />
      </Modal>
      <Modal open={dialog === "diagnosis"} onClose={() => setDialog(null)} title="Diagnostic">
        <SchemaForm endpoint="POST /support/tickets/{ticket_id}/diagnosis" params={{ ticket_id: t.id }} initial={{ diagnosis: t.diagnosis ?? "" }} onSuccess={(res) => { refresh(res); setDialog(null); }} onCancel={() => setDialog(null)} columns={1} />
      </Modal>
      <Modal open={dialog === "warranty"} onClose={() => setDialog(null)} title="Décision de garantie">
        <SchemaForm endpoint="POST /support/tickets/{ticket_id}/warranty" params={{ ticket_id: t.id }} fields={{ responsible_party_id: { hidden: true } }} onSuccess={(res) => { refresh(res); setDialog(null); }} onCancel={() => setDialog(null)} columns={1} />
      </Modal>
      <Modal open={dialog === "intervention"} onClose={() => setDialog(null)} title="Planifier une intervention">
        <SchemaForm endpoint="POST /support/tickets/{ticket_id}/interventions" params={{ ticket_id: t.id }} fields={{ technician_id: { ref: "users", label: "Technicien" } }} onSuccess={() => { refresh(); setDialog(null); }} onCancel={() => setDialog(null)} columns={1} />
      </Modal>
      <Modal open={dialog === "finish" && !!finishId} onClose={() => setDialog(null)} title="Rapport d'intervention" size="lg">
        <SchemaForm
          endpoint="POST /support/interventions/{intervention_id}/finish"
          params={{ intervention_id: finishId ?? "" }}
          fields={{
            proof_file_ids: {
              span: 2,
              label: "Preuves de l'intervention (photos avant / après)",
              render: ({ value, onChange }) => <ProofPicker attachments={t.attachments} value={value} onChange={onChange} />,
            },
            materials: { span: 2, label: "Fournitures utilisées", render: ({ value, onChange }) => <MaterialsEditor value={value} onChange={onChange} /> } }}
          onSuccess={() => {
            refresh();
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      </Modal>
      <Modal
        open={dialog === "validate"}
        onClose={() => setDialog(null)}
        title="Valider l'intervention"
        footer={
          <Button
            loading={busy === "validate"}
            onClick={async () => {
              const ok = await post("validate", () => api(`/support/tickets/${t.id}/validate`, { method: "POST", body: { rating, comment: comment || null } }));
              if (ok) setDialog(null);
            }}
          >
            Valider
          </Button>
        }
      >
        <p className="text-sm text-muted">Votre satisfaction</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} étoile(s)`}>
              <Star className={clsx("h-8 w-8", n <= rating ? "fill-accent-400 text-accent-400" : "text-slate-300")} />
            </button>
          ))}
        </div>
        <Textarea className="mt-4" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Commentaire (facultatif)" />
      </Modal>
      <ConfirmDialog
        open={dialog === "reopen"}
        onClose={() => setDialog(null)}
        title="Rouvrir le ticket"
        reasonLabel="Pourquoi le problème persiste-t-il ?"
        reasonMin={5}
        onConfirm={async (reason) => {
          const res = await api<TicketData>(`/support/tickets/${t.id}/reopen`, { method: "POST", body: { reason } });
          refresh(res);
        }}
      />
    </div>
  );
}
