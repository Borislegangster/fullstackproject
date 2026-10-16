"use client";

import { CalendarClock, CloudRain, Link2, Radar, Truck, UserX, Wand2, X } from "lucide-react";
import { useState } from "react";

import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Risk {
  id: string;
  task_id: string;
  task_title?: string | null;
  kind: "weather" | "season" | "supply" | "absence" | "dependency";
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  suggestion: { new_start?: string; new_end?: string; shift_days?: number; note?: string };
  status: string;
}

interface ApplyResult {
  moved: { task_id: string; title: string; start: string; end: string; before: { start: string; end: string } }[];
  milestones: { milestone: string; due_date: string; new_date: string }[];
  client_message: string;
}

const KIND: Record<Risk["kind"], { label: string; icon: React.ReactNode }> = {
  weather: { label: "Pluie annoncée", icon: <CloudRain className="h-4 w-4" /> },
  season: { label: "Saison des pluies", icon: <CloudRain className="h-4 w-4" /> },
  supply: { label: "Livraison", icon: <Truck className="h-4 w-4" /> },
  absence: { label: "Absence", icon: <UserX className="h-4 w-4" /> },
  dependency: { label: "Dépendance", icon: <Link2 className="h-4 w-4" /> },
};

/** Planning intelligent (A4) : risques de retard détectés, replanification en un clic, message client relu. */
export function ScheduleRisksPanel({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const risks = useApi<Risk[]>(`/projects/${projectId}/schedule-risks`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ risk: Risk; data: ApplyResult } | null>(null);
  const [message, setMessage] = useState("");
  const [dismissing, setDismissing] = useState<Risk | null>(null);
  const [note, setNote] = useState("");
  const scan = async () => {
    setBusy(true);
    try {
      const r = await api<{ created: number; resolved: number; open: number }>(`/projects/${projectId}/schedule-risks/scan`, { method: "POST" });
      toast.success(`Analyse terminée : ${r.open} risque(s) ouvert(s)`, r.resolved ? `${r.resolved} risque(s) résolu(s)` : undefined);
      void risks.reload();
    } catch (err) {
      toast.error("Analyse impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const apply = async (risk: Risk) => {
    try {
      const data = await api<ApplyResult>(`/schedule-risks/${risk.id}/apply`, { body: {} });
      setResult({ risk, data });
      setMessage(data.client_message);
      void risks.reload();
    } catch (err) {
      toast.error("Replanification impossible", errorMessage(err));
    }
  };
  const editable = can("planning:write");
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-brand-600" /> Planning intelligent
          </span>
        }
        subtitle="Pluie annoncée, livraisons tardives, absences et retards en cascade sur les 30 prochains jours — analyse automatique chaque matin."
        actions={
          editable ? (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void scan()}>
              <Radar className="h-4 w-4" /> Analyser maintenant
            </Button>
          ) : null
        }
      />
      {risks.loading && !risks.data ? (
        <Skeleton className="m-5 h-24" />
      ) : risks.data?.length ? (
        <ul className="divide-y divide-line">
          {risks.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  <span className={r.severity === "high" ? "text-red-600" : "text-amber-600"}>{KIND[r.kind]?.icon}</span>
                  {r.title}
                  <Badge tone={r.severity === "high" ? "danger" : "warning"}>{KIND[r.kind]?.label ?? r.kind}</Badge>
                </p>
                <p className="mt-1 text-muted">{r.detail}</p>
                {r.suggestion.new_start ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-700">
                    <CalendarClock className="h-3.5 w-3.5" /> Proposition : du {date(r.suggestion.new_start)} au {date(r.suggestion.new_end)}
                    {r.suggestion.shift_days ? ` (${r.suggestion.shift_days > 0 ? "+" : ""}${r.suggestion.shift_days} j)` : ""}
                  </p>
                ) : null}
                {r.suggestion.note ? <p className="mt-0.5 text-xs text-muted">{r.suggestion.note}</p> : null}
              </div>
              {editable ? (
                <div className="flex gap-2">
                  {r.suggestion.new_start ? (
                    <Button size="sm" onClick={() => void apply(r)}>
                      <Wand2 className="h-4 w-4" /> Replanifier
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setDismissing(r)}>
                    <X className="h-4 w-4" /> Écarter
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState title="Aucun risque détecté" text="Le planning des 30 prochains jours ne présente pas d'aléa identifié." />
        </div>
      )}
      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        size="lg"
        title="Planning ajusté"
        description={result?.risk.title}
        footer={
          can("projects:publish_client") ? (
            <>
              <Button variant="secondary" onClick={() => setResult(null)}>
                Ne pas prévenir
              </Button>
              <Button
                disabled={message.trim().length < 20}
                onClick={async () => {
                  try {
                    await api(`/schedule-risks/${result?.risk.id}/notify-client`, { body: { message } });
                    toast.success("Client prévenu", "Message envoyé dans son espace et par e-mail.");
                    setResult(null);
                  } catch (err) {
                    toast.error("Envoi impossible", errorMessage(err));
                  }
                }}
              >
                Prévenir le client
              </Button>
            </>
          ) : null
        }
      >
        {result ? (
          <div className="space-y-4">
            <ul className="space-y-1 text-sm">
              {result.data.moved.map((m) => (
                <li key={m.task_id} className="rounded-lg bg-surface px-3 py-2">
                  <span className="font-medium">{m.title}</span> : {date(m.before.start)} → <strong>{date(m.start)}</strong> (fin {date(m.end)})
                </li>
              ))}
            </ul>
            {result.data.milestones.length ? (
              <Alert tone="warning" title="Jalon(s) client impacté(s)">
                {result.data.milestones.map((m) => `${m.milestone} : ${date(m.due_date)} → ${date(m.new_date)}`).join(" · ")}
              </Alert>
            ) : (
              <Alert tone="success">Aucun jalon client impacté.</Alert>
            )}
            <Field label="Message au client (à relire)">
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={dismissing !== null}
        onClose={() => setDismissing(null)}
        title="Écarter le risque"
        footer={
          <Button
            disabled={!note.trim()}
            onClick={async () => {
              try {
                await api(`/schedule-risks/${dismissing?.id}/dismiss`, { body: { note } });
                setDismissing(null);
                setNote("");
                void risks.reload();
              } catch (err) {
                toast.error("Action impossible", errorMessage(err));
              }
            }}
          >
            Écarter
          </Button>
        }
      >
        <Field label="Motif" required help="Ex. « bâches installées », « équipier remplacé », « livraison avancée »">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  );
}
