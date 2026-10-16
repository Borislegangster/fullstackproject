"use client";

import { CheckCircle2, FileImage, Mic, Sparkles } from "lucide-react";
import { useState } from "react";

import { FileViewer } from "@/components/ui/file-preview";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Alert, Badge, Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Analysis {
  ai_used: boolean;
  ai?: { observations?: string[]; assumptions?: string[]; to_verify?: string[]; confidence?: string; slope?: string; access?: string } | null;
  transcript?: string | null;
  estimate?: { min: string; max: string; adjustments?: string[] } | null;
  validated: boolean;
  validated_by?: string;
  validated_at?: string;
  validated_range?: { min: string; max: string };
  engineer_note?: string | null;
}

/** Estimation instantanée d'un lead (A2) : pièces jointes, analyse IA, validation / ajustement par un ingénieur. */
export function InstantEstimatePanel({ leadId }: { leadId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const data = useApi<{ analysis: Analysis; estimate_min?: string | null; estimate_max?: string | null; files: { id: string; name: string; mime: string; url: string }[] }>(
    `/crm/leads/${leadId}/instant-estimate`,
  );
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  if (data.loading && !data.data) return <Skeleton className="h-64 w-full" />;
  if (!data.data) return null;
  const a = data.data.analysis;
  const validate = async () => {
    setBusy(true);
    try {
      await api(`/crm/leads/${leadId}/instant-estimate/validate`, { body: { min: min || data.data?.estimate_min, max: max || data.data?.estimate_max, note: note || null, notify } });
      toast.success("Estimation validée", notify ? "Le prospect est informé." : undefined);
      void data.reload();
    } catch (err) {
      toast.error("Validation impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-500" /> Estimation instantanée {a.validated ? <Badge tone="success">Validée</Badge> : <Badge tone="warning">À valider</Badge>}
          </span>
        }
        subtitle={a.ai_used ? `Analyse IA des images${a.ai?.confidence ? ` (confiance ${a.ai.confidence})` : ""} + barèmes internes` : "Barèmes internes (IA non disponible)"}
      />
      <div className="space-y-4 p-5">
        <div className="rounded-2xl bg-night p-5 text-white">
          <p className="text-xs text-brand-200">{a.validated ? `Validée par ${a.validated_by} le ${dateTime(a.validated_at)}` : "Fourchette proposée au prospect"}</p>
          <p className="font-title text-2xl font-bold">
            {data.data.estimate_min ? `${money(data.data.estimate_min)} – ${money(data.data.estimate_max)}` : "Barème non paramétré (Paramètres › Estimateur)"}
          </p>
          {a.estimate?.adjustments?.length ? <p className="mt-1 text-xs text-brand-100">{a.estimate.adjustments.join(" · ")}</p> : null}
        </div>
        {a.transcript ? (
          <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-sm italic">
            <Mic className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> « {a.transcript} »
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["Observations", a.ai?.observations],
              ["Hypothèses", a.ai?.assumptions],
              ["À vérifier", a.ai?.to_verify],
            ] as [string, string[] | undefined][]
          ).map(([label, items]) => (
            <div key={label} className="rounded-xl bg-surface p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-muted">{label}</p>
              <ul className="mt-1 space-y-0.5">{(items?.length ? items : ["—"]).map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          ))}
        </div>
        {data.data.files.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {data.data.files.map((f) =>
              f.mime.startsWith("image/") ? (
                <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="block aspect-video overflow-hidden rounded-xl ring-1 ring-line">
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                </a>
              ) : f.mime.startsWith("audio/") ? (
                <div key={f.id} className="rounded-xl bg-surface p-3">
                  <p className="mb-1 flex items-center gap-1 text-xs text-muted">
                    <Mic className="h-3.5 w-3.5" /> Note vocale
                  </p>
                  <audio controls src={f.url} className="w-full" />
                </div>
              ) : (
                <div key={f.id} className="h-40 overflow-hidden rounded-xl ring-1 ring-line">
                  <FileViewer source={{ url: f.url, name: f.name, mime: f.mime }} />
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <FileImage className="h-4 w-4" /> Aucune pièce jointe.
          </p>
        )}
        {can("crm:write") ? (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {a.validated ? "Ajuster la fourchette" : "Valider ou ajuster"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minimum (FCFA)">
                <Input type="number" min={1} value={min} placeholder={data.data.estimate_min ? String(number(data.data.estimate_min)) : ""} onChange={(e) => setMin(e.target.value)} />
              </Field>
              <Field label="Maximum (FCFA)">
                <Input type="number" min={1} value={max} placeholder={data.data.estimate_max ? String(number(data.data.estimate_max)) : ""} onChange={(e) => setMax(e.target.value)} />
              </Field>
              <Field label="Note au prospect" className="sm:col-span-2">
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. prévoir un mur de soutènement côté rue." />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Checkbox checked={notify} onChange={setNotify} label="Informer le prospect (e-mail / WhatsApp)" />
              <Button loading={busy} disabled={!(min || data.data.estimate_min) || !(max || data.data.estimate_max)} onClick={() => void validate()}>
                Valider l&apos;estimation
              </Button>
            </div>
          </div>
        ) : null}
        {!data.data.estimate_min ? <Alert tone="info">Paramétrez les ratios de l&apos;estimateur pour obtenir une fourchette automatique.</Alert> : null}
      </div>
    </Card>
  );
}
