"use client";

import { Camera, CheckCircle2, Loader2, Mic, PencilRuler, Sparkles, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { money, number } from "@/lib/format";
import { readReferral } from "@/lib/referral";
import { track } from "@/lib/tracker";

interface EstimateResult {
  reference: string;
  estimate?: { min: string; max: string; currency: string; disclaimer?: string; adjustments?: string[] } | null;
  parameters: { project_type?: string | null; surface_m2?: number | null; levels?: number | null; rooms?: number | null; standing?: string | null };
  observations: string[];
  assumptions: string[];
  to_verify: string[];
  confidence?: string | null;
  ai_used: boolean;
  message: string;
}

type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null };

/** Devis budgétaire instantané (A2) : photos du terrain / croquis + note vocale → fourchette indicative immédiate. */
export function InstantEstimate() {
  const [renderedAt] = useState(() => Math.floor(Date.now() / 1000));
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const speech = useRef<SpeechRecognitionLike | null>(null);
  const [values, setValues] = useState({ universe: "HOME", surface_m2: "", levels: "", standing: "standard", location: "", description: "", first_name: "", last_name: "", email: "", phone: "", city: "", country: "" });
  const [consent, setConsent] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const set = (k: keyof typeof values, v: string) => setValues((cur) => ({ ...cur, [k]: v }));

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        setAudio(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorder.current = rec;
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const sr: SpeechRecognitionLike = new SR();
        sr.lang = "fr-FR";
        sr.continuous = true;
        sr.interimResults = false;
        sr.onresult = (e: any) => {
          const text = Array.from(e.results as ArrayLike<any>)
            .map((r: any) => r[0]?.transcript ?? "")
            .join(" ");
          setTranscript(text.trim());
        };
        sr.start();
        speech.current = sr;
      }
      setRecording(true);
    } catch {
      setError("Micro indisponible : autorisez l'accès au micro ou décrivez votre projet par écrit.");
    }
  };
  const stopRecording = () => {
    recorder.current?.stop();
    speech.current?.stop();
    setRecording(false);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("first_name", values.first_name.trim());
    if (values.last_name.trim()) form.set("last_name", values.last_name.trim());
    if (values.city.trim()) form.set("city", values.city.trim());
    if (values.country.trim()) form.set("country", values.country.trim());
    if (values.email) form.set("email", values.email);
    if (values.phone) form.set("phone", values.phone);
    if (whatsapp && values.phone) form.set("whatsapp", values.phone);
    form.set("consent_contact", consent ? "true" : "false");
    form.set("consent_whatsapp", whatsapp ? "true" : "false");
    form.set("universe", values.universe);
    if (values.surface_m2) form.set("surface_m2", values.surface_m2);
    if (values.levels) form.set("levels", values.levels);
    form.set("standing", values.standing);
    if (values.location) form.set("location", values.location);
    if (values.description) form.set("description", values.description);
    if (transcript) form.set("transcript", transcript);
    const code = readReferral();
    if (code) form.set("referral_code", code);
    form.set("rendered_at", String(renderedAt));
    if (honeypot) form.set("website", honeypot);
    images.forEach((f) => form.append("images", f));
    if (audio) form.set("audio", new File([audio], `note-vocale.${audio.type.includes("ogg") ? "ogg" : "webm"}`, { type: audio.type }));
    try {
      const res = await api<EstimateResult>("/public/instant-estimate", { method: "POST", form });
      setResult(res);
      track({ type: "instant_estimate_submit", target: values.universe });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6 rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" />
          <div>
            <p className="font-title text-2xl font-bold text-brand-900">Votre estimation indicative</p>
            <p className="text-sm text-muted">Référence {result.reference} · {result.message}</p>
          </div>
        </div>
        {result.estimate ? (
          <div className="relative overflow-hidden rounded-3xl bg-night p-7 text-white">
            <div className="aurora-blob -right-16 -top-16 h-48 w-48 bg-accent-500/40" />
            <p className="relative text-sm text-brand-100">Fourchette budgétaire</p>
            <p className="relative mt-1 font-title text-3xl font-extrabold sm:text-4xl">
              {money(result.estimate.min)} <span className="text-brand-200">–</span> {money(result.estimate.max)}
            </p>
            {result.estimate.adjustments?.length ? <p className="relative mt-2 text-xs text-brand-100">Inclut : {result.estimate.adjustments.join(" · ")}</p> : null}
            <p className="relative mt-3 text-xs text-brand-200">{result.estimate.disclaimer ?? "Estimation indicative, non contractuelle."}</p>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paramètres retenus</p>
            <ul className="mt-2 space-y-1 text-sm">
              {result.parameters.surface_m2 ? <li>Surface : {number(result.parameters.surface_m2)} m²</li> : null}
              {result.parameters.levels ? <li>Niveaux : {result.parameters.levels}</li> : null}
              {result.parameters.rooms ? <li>Pièces : {result.parameters.rooms}</li> : null}
              {result.parameters.standing ? <li>Standing : {result.parameters.standing}</li> : null}
              {result.parameters.project_type ? <li>Ouvrage : {result.parameters.project_type}</li> : null}
            </ul>
          </div>
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ce que nous avons vu</p>
            <ul className="mt-2 space-y-1 text-sm">{(result.observations.length ? result.observations : ["Analyse de vos éléments en cours par un ingénieur"]).map((o) => <li key={o}>• {o}</li>)}</ul>
          </div>
          <div className="rounded-2xl bg-accent-50 p-5 ring-1 ring-accent-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">À vérifier sur place</p>
            <ul className="mt-2 space-y-1 text-sm">{(result.to_verify.length ? result.to_verify : ["Nature du sol", "Accès et réseaux"]).map((o) => <li key={o}>• {o}</li>)}</ul>
          </div>
        </div>
        <p className="text-sm text-muted">Un ingénieur GLOBUS valide ou ajuste cette fourchette et vous recontacte (e-mail{whatsapp ? " ou WhatsApp" : ""}).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-5">
          <p className="flex items-center gap-2 font-semibold text-brand-800">
            <Camera className="h-5 w-5" /> Photos du terrain, croquis ou plan
          </p>
          <p className="mt-1 text-xs text-muted">Jusqu&apos;à 3 images (JPEG, PNG, WebP). Elles restent privées.</p>
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-4 text-sm font-medium text-brand-700 ring-1 ring-line hover:ring-brand-300">
            <PencilRuler className="h-4 w-4" /> Ajouter une image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setImages((cur) => [...cur, f].slice(0, 3));
                e.target.value = "";
              }}
            />
          </label>
          {previews.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label="Retirer" onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-dashed border-accent-200 bg-accent-50/40 p-5">
          <p className="flex items-center gap-2 font-semibold text-accent-800">
            <Mic className="h-5 w-5" /> Note vocale (facultatif)
          </p>
          <p className="mt-1 text-xs text-muted">Décrivez votre projet à voix haute : pièces, style, budget envisagé…</p>
          <div className="mt-3 flex items-center gap-2">
            {recording ? (
              <Button variant="danger" onClick={stopRecording}>
                <Square className="h-4 w-4" /> Arrêter
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => void startRecording()}>
                <Mic className="h-4 w-4" /> {audio ? "Réenregistrer" : "Enregistrer"}
              </Button>
            )}
            {recording ? <span className="flex items-center gap-1.5 text-sm text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Enregistrement…</span> : null}
            {audio && !recording ? (
              <>
                <audio controls src={URL.createObjectURL(audio)} className="h-9 max-w-[12rem]" />
                <button type="button" aria-label="Supprimer la note" onClick={() => { setAudio(null); setTranscript(""); }} className="rounded-lg p-1.5 text-muted hover:bg-white">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
          {transcript ? <p className="mt-2 rounded-xl bg-white p-2 text-xs italic text-ink">« {transcript} »</p> : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Univers">
          <Select value={values.universe} onChange={(e) => set("universe", e.target.value)} options={[{ value: "HOME", label: "Maison (Home)" }, { value: "BUSINESS", label: "Professionnel" }, { value: "PREMIUM", label: "Premium" }, { value: "DIASPORA", label: "Diaspora" }]} />
        </Field>
        <Field label="Surface habitable (m²)" help="Laisser vide si inconnue">
          <Input type="number" min={0} value={values.surface_m2} onChange={(e) => set("surface_m2", e.target.value)} />
        </Field>
        <Field label="Niveaux">
          <Input type="number" min={0} max={20} value={values.levels} onChange={(e) => set("levels", e.target.value)} />
        </Field>
        <Field label="Standing">
          <Select value={values.standing} onChange={(e) => set("standing", e.target.value)} options={[{ value: "standard", label: "Standard" }, { value: "confort", label: "Confort" }, { value: "premium", label: "Premium" }]} />
        </Field>
      </div>
      <Field label="Localisation du terrain">
        <Input value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Ex. Douala, Logbessou" />
      </Field>
      <Field label="Votre projet en quelques mots">
        <Textarea rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Villa de 4 chambres avec terrasse, terrain en pente…" />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Prénom" required>
          <Input value={values.first_name} autoComplete="given-name" onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Nom">
          <Input value={values.last_name} autoComplete="family-name" onChange={(e) => set("last_name", e.target.value)} />
        </Field>
        <Field label="Ville de résidence">
          <Input value={values.city} autoComplete="address-level2" onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Pays de résidence" help="Vous vivez hors du Cameroun ? Indiquez votre pays.">
          <Input value={values.country} autoComplete="country-name" onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={values.email} autoComplete="email" onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Téléphone / WhatsApp">
          <Input type="tel" value={values.phone} autoComplete="tel" onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      <div className="space-y-2">
        <Checkbox checked={consent} onChange={setConsent} label="J'accepte que GLOBUS ENGINEERING analyse mes éléments et me recontacte au sujet de mon projet." />
        <Checkbox checked={whatsapp} onChange={setWhatsapp} label="J'accepte d'être contacté(e) sur WhatsApp." />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button
        variant="accent"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={!consent || !values.first_name.trim() || (!values.email && !values.phone) || (!images.length && !audio && !values.description.trim() && !values.surface_m2)}
        onClick={() => void submit()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Obtenir mon estimation
      </Button>
      <p className="text-center text-xs text-muted">Fourchette calculée à partir des barèmes GLOBUS (jamais inventée par l&apos;IA), validée ensuite par un ingénieur.</p>
    </div>
  );
}
