"use client";

import { Bot, FileSearch, Mic, Radar, Sparkles, Square, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { LineChartCard } from "@/components/ui/charts";
import { Field, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS, type RefSource } from "@/lib/refs";

const DOCUMENTS: RefSource = { path: "/documents", label: (r) => `${r.code} — ${r.title}`, sublabel: (r) => (r.current_version ? `${r.current_version.label} · ${optionLabel(r.current_version.status)}` : undefined), paginated: true, searchable: true };
const ANOMALY_KINDS = [
  "invoice_above_po",
  "price_outlier",
  "quantity_outlier",
  "duplicate_invoice",
  "unusual_payment",
  "attendance_outlier",
  "stock_variance",
  // contrôle interne (A5)
  "split_orders",
  "invoice_near_duplicate",
  "invoice_before_order",
  "bank_details_changed",
  "duplicate_payment",
];

function AiDisclaimer() {
  return <p className="text-xs text-muted">Contenu généré par IA : à vérifier avant toute décision. Les propositions ne sont jamais appliquées sans validation humaine.</p>;
}

/* ----------------------------------------------------------------------------- assistant documentaire */

export function DocumentAssistant() {
  const toast = useToast();
  const [docId, setDocId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Row | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ q: string; answer: string; sources: Row[]; ai: boolean }[]>([]);
  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit space-y-3 p-4">
        <Field label="Document (version en vigueur)">
          <RefSelect
            source={DOCUMENTS}
            value={docId}
            onChange={(id, row) => {
              setDocId(id);
              setDoc(row ?? null);
              setHistory([]);
            }}
          />
        </Field>
        {doc?.current_version ? (
          <p className="text-xs text-muted">
            Version {doc.current_version.label} · {doc.current_version.page_count ?? "?"} page(s)
          </p>
        ) : null}
        <AiDisclaimer />
      </Card>
      <Card className="flex min-h-[28rem] flex-col">
        <CardHeader title="Questions au document" subtitle="Réponses sourcées : citations des passages utilisés." />
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {history.map((h, i) => (
            <div key={i} className="space-y-2">
              <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2 text-sm text-white">{h.q}</p>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-sm">
                <p className="whitespace-pre-line">{h.answer}</p>
                {h.sources.length ? (
                  <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                    {h.sources.map((s, k) => (
                      <li key={k}>
                        {s.page ? `p. ${s.page} · ` : ""}« {String(s.excerpt ?? s.text ?? "").slice(0, 220)} »
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!h.ai ? <Badge className="mt-2">Recherche plein texte (IA indisponible)</Badge> : null}
              </div>
            </div>
          ))}
          {!history.length ? <EmptyState title="Posez votre question" text="Ex. « Quelle est la classe de béton des fondations ? », « Quels sont les délais de réception ? »" icon={<FileSearch className="h-6 w-6" />} /> : null}
        </div>
        <form
          className="flex gap-2 border-t border-line p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!doc?.current_version || question.trim().length < 3) return;
            setBusy(true);
            try {
              const res = await api<Row>(`/ai/document-versions/${doc.current_version.id}/ask`, { method: "POST", body: { question: question.trim() } });
              setHistory((h) => [...h, { q: question.trim(), answer: res.answer, sources: res.sources ?? [], ai: !!res.ai }]);
              setQuestion("");
            } catch (err) {
              toast.error("Question impossible", errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={doc ? "Votre question…" : "Choisissez d'abord un document"} disabled={!doc} />
          <Button type="submit" loading={busy} disabled={!doc || question.trim().length < 3}>
            <Sparkles className="h-4 w-4" /> Demander
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------------- synthèse */

export function SiteSummary() {
  const toast = useToast();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [range, setRange] = useState({ start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) });
  const [audience, setAudience] = useState("direction");
  const [result, setResult] = useState<Row | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <Card className="grid gap-4 p-5 md:grid-cols-4">
        <Field label="Projet" className="md:col-span-2">
          <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} />
        </Field>
        <Field label="Du">
          <Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </Field>
        <Field label="Au">
          <Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </Field>
        <Field label="Destinataire">
          <Select value={audience} onChange={(e) => setAudience(e.target.value)} options={[{ value: "direction", label: "Direction (technique)" }, { value: "client", label: "Client (pédagogique, sans jargon)" }]} />
        </Field>
        <div className="flex items-end md:col-span-3">
          <Button
            loading={busy}
            disabled={!projectId}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api<Row>(`/ai/projects/${projectId}/summary`, { method: "POST", body: { start: range.start, end: range.end, audience } });
                setResult(res);
                setText(res.text);
              } catch (err) {
                toast.error("Synthèse impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Bot className="h-4 w-4" /> Générer la synthèse
          </Button>
        </div>
      </Card>
      {result ? (
        <Card className="space-y-3 p-5">
          <p className="text-xs text-muted">
            Période du {date(result.start)} au {date(result.end)} — brouillon à relire et compléter.
          </p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success("Synthèse copiée"))}>
              Copier
            </Button>
          </div>
          <AiDisclaimer />
        </Card>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- rapports vocaux */

function VoiceRecorder({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const toast = useToast();
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [transcript, setTranscript] = useState("");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        setBlob(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorder.current = rec;
      started.current = Date.now();
      setRecording(true);
      setBlob(null);
    } catch (err) {
      toast.error("Micro inaccessible", errorMessage(err));
    }
  };
  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
  };
  const audio = blob ? new File([blob], `rapport-${Date.now()}.webm`, { type: blob.type }) : files[0];
  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <Button variant="accent" onClick={stop}>
            <Square className="h-4 w-4" /> Arrêter
          </Button>
        ) : (
          <Button onClick={() => void start()}>
            <Mic className="h-4 w-4" /> Enregistrer
          </Button>
        )}
        {recording ? <span className="animate-pulse text-sm font-semibold text-red-600">● Enregistrement…</span> : null}
        {preview ? <audio controls src={preview} className="h-10" /> : null}
      </div>
      <p className="text-xs text-muted">ou déposez un fichier audio (dictaphone, WhatsApp) :</p>
      <FileDrop files={files} onChange={setFiles} accept="audio/*" maxSizeMb={100} />
      <Field label="Site concerné (facultatif)">
        <RefSelect source={REFS.sites} value={siteId} onChange={setSiteId} context={{ project_id: projectId }} />
      </Field>
      <Field label="Transcription (facultatif — sinon transcription serveur)">
        <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={3} />
      </Field>
      <Button
        loading={busy}
        disabled={!audio}
        onClick={async () => {
          if (!audio) return;
          setBusy(true);
          try {
            const fd = new FormData();
            fd.append("project_id", projectId);
            fd.append("file", audio);
            fd.append("client_mutation_id", crypto.randomUUID());
            if (siteId) fd.append("site_id", siteId);
            if (blob) fd.append("duration_seconds", String(Math.round((Date.now() - started.current) / 1000)));
            if (transcript.trim()) fd.append("transcript", transcript.trim());
            await api("/ai/voice-reports", { method: "POST", form: fd });
            setBlob(null);
            setFiles([]);
            setTranscript("");
            onDone();
            toast.success("Rapport envoyé", "Extraction des activités, besoins et retards en cours.");
          } catch (err) {
            toast.error("Envoi impossible", errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Upload className="h-4 w-4" /> Envoyer le rapport
      </Button>
    </div>
  );
}

function VoicePanel({ report, reload }: { report: Row; reload: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(report.reformulated ?? report.transcript ?? "");
  const [transcript, setTranscript] = useState("");
  const extracted = (report.extracted ?? {}) as Row;
  return (
    <div className="space-y-4">
      <audio controls src={apiUrl(`/ai/voice-reports/${report.id}/audio`)} className="w-full" />
      <DescriptionList
        items={[
          { label: "Statut", value: <StatusBadge status={report.status} /> },
          { label: "Enregistré le", value: dateTime(report.recorded_at) },
          { label: "Durée", value: report.duration_seconds ? `${report.duration_seconds} s` : "—" },
          { label: "Critique", value: report.is_critical ? <Badge tone="danger">Oui</Badge> : "Non" },
        ]}
      />
      {report.status === "uploaded" ? (
        <div className="space-y-2">
          <Field label="Transcription manuelle">
            <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4} />
          </Field>
          <Button
            size="sm"
            disabled={transcript.trim().length < 3}
            onClick={async () => {
              try {
                await api(`/ai/voice-reports/${report.id}/transcript`, { method: "POST", body: { transcript: transcript.trim() } });
                reload();
              } catch (err) {
                toast.error("Envoi impossible", errorMessage(err));
              }
            }}
          >
            Envoyer la transcription
          </Button>
        </div>
      ) : null}
      {Object.keys(extracted).length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(extracted).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-muted">{optionLabel(k)}</p>
              <p>{Array.isArray(v) ? v.join(" · ") || "—" : typeof v === "object" && v ? JSON.stringify(v) : String(v ?? "—")}</p>
            </div>
          ))}
        </div>
      ) : null}
      {report.status === "processed" ? (
        <div className="space-y-2">
          <Field label="Texte du journal de chantier (modifiable)">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await api(`/ai/voice-reports/${report.id}/validate`, { method: "POST", body: { edited_text: text !== (report.reformulated ?? report.transcript) ? text : null } });
                  toast.success("Validé", "Ajouté au journal de chantier.");
                  reload();
                } catch (err) {
                  toast.error("Validation impossible", errorMessage(err));
                }
              }}
            >
              Valider et journaliser
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api(`/ai/voice-reports/${report.id}/reject`, { method: "POST" });
                reload();
              }}
            >
              Rejeter
            </Button>
          </div>
          <AiDisclaimer />
        </div>
      ) : null}
      {report.error ? <Alert tone="danger">{report.error}</Alert> : null}
    </div>
  );
}

export function VoiceReports() {
  const { can } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-72">
          <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Tous les projets" />
        </div>
        {can("site:report") && projectId ? (
          <Button onClick={() => setRecording(true)}>
            <Mic className="h-4 w-4" /> Nouveau rapport vocal
          </Button>
        ) : null}
      </div>
      <ResourceView
        key={`${projectId ?? "all"}-${version}`}
        embedded
        config={{
          title: "Rapports vocaux de chantier",
          subtitle: "Dictés sur site, transcrits, structurés (activité, équipe, quantités, retards, besoins), validés puis journalisés.",
          path: "/ai/voice-reports",
          query: { project_id: projectId ?? undefined },
          columns: [
            { key: "recorded_at", label: "Enregistré", format: "datetime" },
            { key: "transcript", label: "Extrait", render: (r) => <span className="line-clamp-2 text-xs">{r.reformulated ?? r.transcript ?? "—"}</span> },
            { key: "is_critical", label: "Critique", render: (r) => (r.is_critical ? <Badge tone="danger">Critique</Badge> : "—") },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [{ key: "status", label: "Statut", options: ["uploaded", "transcribed", "processed", "validated", "rejected", "failed"].map((v) => ({ value: v, label: optionLabel(v) })) }],
          detail: (r, reload) => <VoicePanel report={r} reload={reload} />,
        }}
      />
      <Modal open={recording} onClose={() => setRecording(false)} title="Rapport vocal" size="lg">
        {projectId ? (
          <VoiceRecorder
            projectId={projectId}
            onDone={() => {
              setRecording(false);
              setVersion((v) => v + 1);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- OCR */

export function OcrTool() {
  const toast = useToast();
  const [kind, setKind] = useState("invoice");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Row | null>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <Field label="Type de pièce">
          <Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "invoice", label: "Facture fournisseur" }, { value: "delivery_note", label: "Bon de livraison" }, { value: "document", label: "Autre document" }]} />
        </Field>
        <Field label="Projet">
          <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Aucun" />
        </Field>
        <FileDrop files={files} onChange={setFiles} accept=".pdf,image/*" capture="environment" maxSizeMb={30} />
        <Button
          loading={busy}
          disabled={!files.length}
          onClick={async () => {
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append("kind", kind);
              if (projectId) fd.append("project_id", projectId);
              fd.append("file", files[0]);
              setJob(await api<Row>("/ai/ocr", { method: "POST", form: fd }));
              setFiles([]);
            } catch (err) {
              toast.error("Lecture impossible", errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <FileSearch className="h-4 w-4" /> Lire la pièce
        </Button>
      </Card>
      {job ? (
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Données extraites</p>
            <StatusBadge status={job.status} />
          </div>
          {job.confidence !== null && job.confidence !== undefined ? <p className="text-xs text-muted">Confiance {number(toNumber(job.confidence) * 100, 0)} %</p> : null}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries((job.extracted ?? {}) as Row).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface px-3 py-2">
                <dt className="text-xs text-muted">{optionLabel(k)}</dt>
                <dd>{typeof v === "object" && v ? JSON.stringify(v) : String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
          {job.raw_text ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Texte brut</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{job.raw_text}</pre>
            </details>
          ) : null}
          {job.status === "processed" ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => setJob(await api<Row>(`/ai/ocr/${job.id}/validate`, { method: "POST", body: { accepted: true } }))}>
                Valider l'extraction
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => setJob(await api<Row>(`/ai/ocr/${job.id}/validate`, { method: "POST", body: { accepted: false } }))}>
                Rejeter
              </Button>
            </div>
          ) : null}
          <AiDisclaimer />
        </Card>
      ) : (
        <Card className="p-5">
          <EmptyState title="Aucune pièce lue" text="Les champs reconnus (numéro, fournisseur, BC, montants) aident la saisie ; ils sont contrôlés par le rapprochement 3 pièces." />
        </Card>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------- prévisions */

export function PredictionsView() {
  const toast = useToast();
  const [projectId, setProjectId] = useState<string | null>(null);
  const rows = useApi<Row[]>(projectId ? "/ai/predictions" : null, { project_id: projectId ?? undefined });
  const last = rows.data?.[0];
  const series = (rows.data ?? [])
    .slice()
    .reverse()
    .map((p) => ({ as_of: date(p.as_of), cpi: toNumber(p.cpi), spi: toNumber(p.spi) }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-72">
          <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Choisir un projet…" />
        </div>
        {projectId ? (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api(`/ai/predictions/${projectId}/compute`, { method: "POST" });
                void rows.reload();
              } catch (err) {
                toast.error("Calcul impossible", errorMessage(err));
              }
            }}
          >
            <Radar className="h-4 w-4" /> Recalculer
          </Button>
        ) : null}
      </div>
      {!projectId ? (
        <EmptyState title="Choisissez un projet" text="Prévision coût / délai par la valeur acquise (EVM) : CPI, SPI, coût et date d'achèvement estimés." />
      ) : rows.loading && !rows.data ? (
        <Skeleton className="h-48" />
      ) : last ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="CPI (performance coût)" value={last.cpi !== null ? number(last.cpi, 2) : "—"} tone={toNumber(last.cpi) >= 1 ? "success" : "danger"} hint="≥ 1 : sous le budget" />
            <Stat label="SPI (performance délai)" value={last.spi !== null ? number(last.spi, 2) : "—"} tone={toNumber(last.spi) >= 1 ? "success" : "danger"} hint="≥ 1 : en avance" />
            <Stat label="Coût estimé à l'achèvement" value={money(last.estimate_at_completion)} hint={`Écart ${money(last.variance_at_completion)}`} tone={toNumber(last.variance_at_completion) < 0 ? "danger" : "neutral"} />
            <Stat label="Fin prévue" value={date(last.forecast_end_date)} hint={last.delay_days ? `${last.delay_days} j de retard` : "Dans les temps"} tone={last.delay_days > 0 ? "warning" : "success"} />
          </div>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">Tendance CPI / SPI</p>
              <StatusBadge status={last.risk_level} label={`Risque ${optionLabel(last.risk_level)}`} />
            </div>
            <LineChartCard data={series} x="as_of" series={[{ key: "cpi", label: "CPI" }, { key: "spi", label: "SPI", color: "#FB8C43" }]} height={220} />
            {last.explanation ? <p className="mt-3 whitespace-pre-line text-sm">{last.explanation}</p> : null}
          </Card>
        </>
      ) : (
        <EmptyState title="Aucune prévision" text="Lancez un calcul (budget approuvé et dates de projet requis)." />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------- anomalies */

export function AnomaliesList() {
  const { can, canAny } = useAuth();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  return (
    <ResourceView
      key={version}
      embedded
      config={{
        title: "Anomalies détectées",
        subtitle: "Factures au-dessus du BC, prix ou quantités atypiques, doublons, paiements inhabituels, écarts de stock et de pointage.",
        path: "/ai/anomalies",
        columns: [
          { key: "created_at", label: "Détectée", format: "date" },
          { key: "kind", label: "Type", format: "option" },
          { key: "description", label: "Description", render: (r) => <span className="text-sm">{r.description}</span> },
          { key: "amount_at_risk", label: "Montant à risque", format: "money", align: "right" },
          { key: "severity", label: "Gravité", format: "option" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: ["new", "confirmed", "dismissed", "resolved"].map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "kind", label: "Type", options: ANOMALY_KINDS.map((v) => ({ value: v, label: optionLabel(v) })) },
        ],
        toolbar: can("reports:export") ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                const res = await api<Row>("/ai/anomalies/scan", { method: "POST" });
                toast.success("Analyse terminée", Object.entries(res).map(([k, v]) => `${optionLabel(k)} : ${v}`).join(" · "));
                setVersion((x) => x + 1);
              } catch (err) {
                toast.error("Analyse impossible", errorMessage(err));
              }
            }}
          >
            <Radar className="h-4 w-4" /> Lancer une analyse
          </Button>
        ) : undefined,
        detail: (r) => (
          <div className="space-y-3">
            <p className="text-sm">{r.description}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(r.evidence ?? {}, null, 2)}</pre>
            {r.review_note ? <Alert tone="info" title={`Revue du ${dateTime(r.reviewed_at)}`}>{r.review_note}</Alert> : null}
          </div>
        ),
        actions: canAny("finance:approve", "procurement:approve", "reports:export")
          ? (["confirmed", "dismissed", "resolved"] as const).map((s) => ({
              key: s,
              label: s === "confirmed" ? "Confirmer" : s === "dismissed" ? "Écarter (faux positif)" : "Marquer résolue",
              path: (row: Row) => `/ai/anomalies/${row.id}/review`,
              when: (row: Row) => row.status !== s,
              reasonLabel: "Note de revue",
              body: (_row: Row, reason: string) => ({ status: s, note: reason }),
              tone: s === "dismissed" ? ("danger" as const) : undefined,
            }))
          : [],
      }}
    />
  );
}

export function AiUsage() {
  const usage = useApi<Row>("/ai/usage", { days: 30 });
  if (usage.loading && !usage.data) return <Skeleton className="h-40" />;
  if (!usage.data) return <Alert tone="danger">{usage.error}</Alert>;
  const u = usage.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Modèle de langage" value={u.status?.llm ? "Actif" : "Non configuré"} hint={u.status?.model ?? "Fonctions dégradées sans IA générative"} tone={u.status?.llm ? "success" : "warning"} />
        <Stat label="Reconnaissance vocale" value={u.status?.speech_to_text === "server" ? "Serveur" : "Sur l'appareil"} />
        <Stat label="Validations humaines" value={Object.entries((u.validation ?? {}) as Row).map(([k, v]) => `${optionLabel(k)} ${v}`).join(" · ") || "—"} />
      </div>
      <Card>
        <CardHeader title="Requêtes des 30 derniers jours" />
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Fonction</th>
              <th className="px-3 py-2">Fournisseur</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Requêtes</th>
              <th className="px-3 py-2 text-right">Jetons entrée / sortie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {((u.by_feature ?? []) as Row[]).map((f, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{optionLabel(f.feature)}</td>
                <td className="px-3 py-2">{f.provider}</td>
                <td className="px-3 py-2">{optionLabel(f.status)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{number(f.requests)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {number(f.input_tokens)} / {number(f.output_tokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function AiHub() {
  const { can, canAny } = useAuth();
  const status = useApi<Row>("/ai/status");
  const [tab, setTab] = useState("documents");
  return (
    <div className="space-y-5">
      <PageTitle
        title="Assistants IA"
        subtitle="Assistance documentaire, synthèses, rapports vocaux, lecture de pièces, prévisions — toujours sous validation humaine."
        actions={status.data ? <Badge tone={status.data.llm ? "success" : "warning"}>{status.data.llm ? `IA active · ${status.data.model}` : "IA générative non configurée (mode dégradé)"}</Badge> : null}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "documents", label: "Assistant documentaire" },
          { key: "synthese", label: "Synthèses de chantier" },
          { key: "vocal", label: "Rapports vocaux", hidden: !can("site:report") },
          { key: "ocr", label: "Lecture de pièces", hidden: !canAny("billing:write", "deliveries:receive", "documents:write") },
          { key: "previsions", label: "Prévisions", hidden: !can("reports:read") },
          { key: "usage", label: "Consommation", hidden: !can("settings:read") },
        ]}
      />
      {tab === "documents" ? <DocumentAssistant /> : null}
      {tab === "synthese" ? <SiteSummary /> : null}
      {tab === "vocal" ? <VoiceReports /> : null}
      {tab === "ocr" ? <OcrTool /> : null}
      {tab === "previsions" ? <PredictionsView /> : null}
      {tab === "usage" ? <AiUsage /> : null}
    </div>
  );
}
