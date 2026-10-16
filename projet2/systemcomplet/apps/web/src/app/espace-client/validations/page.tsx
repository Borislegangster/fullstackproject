"use client";

import { CheckCircle2, Clock, FileSignature, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { ConfirmDialog, Tabs } from "@/components/ui/overlay";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { Alert, Badge, Button, Card, EmptyState, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface DecisionRow {
  id: string;
  number: string;
  kind: string;
  title: string;
  description?: string | null;
  options?: Record<string, any>[] | null;
  selected_option?: string | null;
  price_impact?: string | null;
  delay_impact_days?: number | null;
  currency?: string;
  version_label?: string | null;
  status: string;
  due_date?: string | null;
  validated_at?: string | null;
  validation_method?: string | null;
  content_hash?: string | null;
  rejection_reason?: string | null;
}

interface ChangeOrderRow {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  reason?: string | null;
  cost_impact: string;
  delay_impact_days: number;
  lines?: { designation?: string; label?: string; amount?: string | number; quantity?: number; unit_price?: number }[] | null;
  status: string;
  submitted_at?: string | null;
  client_approved_at?: string | null;
}

const CHANNELS = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
];

function optionValue(o: Record<string, any>): string {
  return String(o.key ?? o.value ?? o.code ?? o.label ?? o.name ?? JSON.stringify(o));
}

function optionText(o: Record<string, any>): string {
  return String(o.label ?? o.name ?? o.title ?? o.key ?? o.value ?? "Option");
}

function ValidationsContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState("decisions");
  const decisions = useApi<DecisionRow[]>("/client/decisions", { project_id: projectId });
  const changes = useApi<ChangeOrderRow[]>("/client/change-orders", { project_id: projectId });
  const [validate, setValidate] = useState<DecisionRow | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [reject, setReject] = useState<DecisionRow | null>(null);
  const [approveCo, setApproveCo] = useState<ChangeOrderRow | null>(null);
  const [rejectCo, setRejectCo] = useState<ChangeOrderRow | null>(null);
  const canDecide = can("client:decide");

  const pendingDecisions = (decisions.data ?? []).filter((d) => d.status === "pending_client");
  const pendingChanges = (changes.data ?? []).filter((c) => c.status === "submitted");

  return (
    <div className="space-y-6">
      <PageTitle title="Validations" subtitle="Décisions et avenants soumis à votre accord : chaque validation est sécurisée par code et figée." />
      {!canDecide ? <Alert tone="info">Votre profil permet la consultation ; seul le titulaire du contrat peut valider.</Alert> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "decisions", label: "Décisions", count: pendingDecisions.length },
          { key: "avenants", label: "Avenants", count: pendingChanges.length },
          { key: "historique", label: "Historique" },
        ]}
      />
      {tab === "decisions" ? (
        decisions.loading ? (
          <Skeleton className="h-48 w-full" />
        ) : pendingDecisions.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingDecisions.map((d) => (
              <Card key={d.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">
                      {d.number} · {optionLabel(d.kind)} {d.version_label ? `· version ${d.version_label}` : ""}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-brand-800">{d.title}</h3>
                  </div>
                  <Badge tone="warning">
                    <Clock className="h-3 w-3" /> {d.due_date ? `avant le ${date(d.due_date)}` : "en attente"}
                  </Badge>
                </div>
                {d.description ? <p className="mt-2 whitespace-pre-line text-sm text-muted">{d.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone={toNumber(d.price_impact) > 0 ? "warning" : toNumber(d.price_impact) < 0 ? "success" : "neutral"}>Impact prix : {money(d.price_impact ?? 0)}</Badge>
                  <Badge tone={(d.delay_impact_days ?? 0) > 0 ? "warning" : "neutral"}>Impact délai : {d.delay_impact_days ?? 0} jour(s)</Badge>
                </div>
                {d.options?.length ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {d.options.map((o) => (
                      <li key={optionValue(o)} className="rounded-lg bg-surface px-3 py-2">
                        <span className="font-medium">{optionText(o)}</span>
                        {o.price_impact !== undefined ? <span className="text-muted"> · {money(o.price_impact)}</span> : null}
                        {o.description ? <span className="block text-xs text-muted">{o.description}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {canDecide ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        setSelected(d.options?.length ? optionValue(d.options[0]) : "");
                        setValidate(d);
                      }}
                    >
                      <ShieldCheck className="h-4 w-4" /> Valider
                    </Button>
                    <Button variant="secondary" onClick={() => setReject(d)}>
                      Refuser
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Aucune décision en attente" />
        )
      ) : null}
      {tab === "avenants" ? (
        changes.loading ? (
          <Skeleton className="h-48 w-full" />
        ) : pendingChanges.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingChanges.map((c) => (
              <Card key={c.id} className="p-5">
                <p className="text-xs text-muted">
                  Avenant {c.number} · soumis le {date(c.submitted_at)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-brand-800">{c.title}</h3>
                {c.description ? <p className="mt-2 whitespace-pre-line text-sm text-muted">{c.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="warning">Montant : {money(c.cost_impact)}</Badge>
                  <Badge>Délai : {c.delay_impact_days} jour(s)</Badge>
                  {c.reason ? <Badge tone="info">Motif : {optionLabel(c.reason)}</Badge> : null}
                </div>
                {c.lines?.length ? (
                  <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
                    {c.lines.map((l, i) => (
                      <li key={i} className="flex justify-between px-3 py-1.5">
                        <span>{l.designation ?? l.label}</span>
                        <span className="tabular-nums">{l.amount !== undefined ? money(l.amount) : l.quantity && l.unit_price ? money(l.quantity * l.unit_price) : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {canDecide ? (
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => setApproveCo(c)}>
                      <FileSignature className="h-4 w-4" /> Approuver
                    </Button>
                    <Button variant="secondary" onClick={() => setRejectCo(c)}>
                      Refuser
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Aucun avenant en attente" />
        )
      ) : null}
      {tab === "historique" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {[...(decisions.data ?? []).filter((d) => d.status !== "pending_client").map((d) => ({ key: d.id, title: `${d.number} — ${d.title}`, status: d.status, when: d.validated_at, detail: d.selected_option ? `Option : ${d.selected_option}` : d.rejection_reason ?? "", hash: d.content_hash })), ...(changes.data ?? []).filter((c) => c.status !== "submitted").map((c) => ({ key: c.id, title: `Avenant ${c.number} — ${c.title}`, status: c.status, when: c.client_approved_at, detail: money(c.cost_impact), hash: null }))].map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>
                  <span className="font-medium">{row.title}</span>
                  <span className="block text-xs text-muted">
                    {row.when ? dateTime(row.when) : ""} {row.detail ? `· ${row.detail}` : ""} {row.hash ? `· empreinte ${row.hash.slice(0, 16)}…` : ""}
                  </span>
                </span>
                {row.status === "rejected" ? <Badge tone="danger"><XCircle className="h-3 w-3" /> Refusé</Badge> : <StatusBadge status={row.status} />}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <OtpDialog
        open={!!validate}
        onClose={() => setValidate(null)}
        title="Valider la décision"
        description={validate?.title}
        channels={CHANNELS}
        canConfirm={!validate?.options?.length || !!selected}
        request={(channel) => api(`/client/decisions/${validate!.id}/otp`, { method: "POST", query: { channel } })}
        confirm={async (challenge, code) => {
          await api(`/client/decisions/${validate!.id}/validate`, { method: "POST", body: { otp_token: challenge.otp_token, code, selected_option: selected || null } });
          toast.success("Décision validée", "Votre validation est horodatée et figée.");
          void decisions.reload();
        }}
      >
        {validate?.options?.length ? (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Option retenue</legend>
            {validate.options.map((o) => (
              <label key={optionValue(o)} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${selected === optionValue(o) ? "border-brand-400 bg-brand-50" : "border-line"}`}>
                <input type="radio" name="option" checked={selected === optionValue(o)} onChange={() => setSelected(optionValue(o))} />
                {optionText(o)}
              </label>
            ))}
          </fieldset>
        ) : null}
        {validate ? (
          <Alert tone="info">
            Impact : {money(validate.price_impact ?? 0)} · {validate.delay_impact_days ?? 0} jour(s). Un avenant est créé automatiquement si nécessaire.
          </Alert>
        ) : null}
      </OtpDialog>

      <ConfirmDialog
        open={!!reject}
        onClose={() => setReject(null)}
        title="Refuser la décision"
        text={reject?.title}
        reasonLabel="Motif du refus"
        reasonMin={5}
        tone="danger"
        confirmLabel="Refuser"
        onConfirm={async (reason) => {
          await api(`/client/decisions/${reject!.id}/reject`, { method: "POST", body: { reason } });
          toast.success("Refus transmis à votre chef de projet");
          void decisions.reload();
        }}
      />

      <OtpDialog
        open={!!approveCo}
        onClose={() => setApproveCo(null)}
        title="Approuver l'avenant"
        description={approveCo ? `${approveCo.number} — ${money(approveCo.cost_impact)} · ${approveCo.delay_impact_days} j` : undefined}
        request={() => api(`/client/change-orders/${approveCo!.id}/otp`, { method: "POST" })}
        confirm={async (challenge, code) => {
          await api(`/client/change-orders/${approveCo!.id}/decision`, { method: "POST", body: { approve: true, otp_token: challenge.otp_token, code } });
          toast.success("Avenant approuvé");
          void changes.reload();
        }}
        confirmLabel="Approuver"
      />

      <ConfirmDialog
        open={!!rejectCo}
        onClose={() => setRejectCo(null)}
        title="Refuser l'avenant"
        text={rejectCo?.title}
        reasonLabel="Motif du refus"
        reasonMin={5}
        tone="danger"
        confirmLabel="Refuser"
        onConfirm={async (reason) => {
          await api(`/client/change-orders/${rejectCo!.id}/decision`, { method: "POST", body: { approve: false, reason } });
          toast.success("Refus transmis");
          void changes.reload();
        }}
      />
    </div>
  );
}

export default function ValidationsPage() {
  return <WithProject>{(p) => <ValidationsContent projectId={p.id} />}</WithProject>;
}
