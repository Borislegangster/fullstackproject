"use client";

import { Camera, CheckCircle2, Star, Video } from "lucide-react";
import { useState } from "react";

import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/api";

const HINTS = ["", "Très décevant", "Décevant", "Correct", "Très bien", "Exceptionnel"];

/** Dépôt d'un avis vérifié (lien nominatif ou espace client) : note, témoignage, photo / vidéo, consentement. */
export function ReviewForm({ firstName, projectName, submit }: { firstName?: string; projectName?: string; submit: (form: FormData) => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [display, setDisplay] = useState("initials");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean | null>(null);

  if (done !== null) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-bold text-brand-800">Merci {firstName ?? ""} !</h2>
        <p className="mt-2 text-muted">
          {done
            ? "Votre avis sera publié après une relecture de forme (aucune modification de votre note ni de vos propos)."
            : "Votre avis reste interne : il nous aide à progresser, sans être publié."}
        </p>
      </div>
    );
  }
  const send = async () => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("rating", String(rating));
    form.set("comment", comment);
    form.set("display", display);
    if (role) form.set("author_role", role);
    if (location) form.set("location", location);
    form.set("consent_publish", consent ? "true" : "false");
    if (photo) form.set("photo", photo);
    if (video) form.set("video", video);
    try {
      await submit(form);
      setDone(consent);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const shown = hover || rating;
  return (
    <div className="space-y-6 rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <div>
        <p className="text-sm font-medium text-ink">Votre note globale{projectName ? ` pour « ${projectName} »` : ""}</p>
        <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Note de 1 à 5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} sur 5`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded-lg p-1 transition hover:scale-110 focus-visible:outline-2"
            >
              <Star className={`h-9 w-9 ${n <= shown ? "fill-accent-400 text-accent-500" : "text-slate-300"}`} />
            </button>
          ))}
          <span className="ml-3 text-sm font-semibold text-accent-600">{HINTS[shown]}</span>
        </div>
      </div>
      <Field label="Votre témoignage" required help={`${comment.trim().length}/20 caractères minimum`}>
        <Textarea rows={5} value={comment} maxLength={1500} onChange={(e) => setComment(e.target.value)} placeholder="Accueil, respect des délais, qualité des finitions, suivi du chantier…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Affichage du nom">
          <Select value={display} onChange={(e) => setDisplay(e.target.value)} options={[{ value: "initials", label: "Prénom + initiale" }, { value: "full", label: "Nom complet" }]} />
        </Field>
        <Field label="Vous êtes (facultatif)">
          <Input value={role} maxLength={150} onChange={(e) => setRole(e.target.value)} placeholder="Particulier, gérant de PME…" />
        </Field>
        <Field label="Ville (facultatif)">
          <Input value={location} maxLength={150} onChange={(e) => setLocation(e.target.value)} placeholder="Douala" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm hover:border-brand-300">
          <Camera className="h-5 w-5 text-brand-500" />
          <span className="min-w-0 flex-1 truncate">{photo ? photo.name : "Ajouter une photo de votre réalisation"}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm hover:border-brand-300">
          <Video className="h-5 w-5 text-brand-500" />
          <span className="min-w-0 flex-1 truncate">{video ? video.name : "Ajouter une courte vidéo (facultatif)"}</span>
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <Checkbox
        checked={consent}
        onChange={setConsent}
        label="J'autorise GLOBUS ENGINEERING à publier mon avis (note, texte, photo / vidéo) sur son site, avec le nom choisi ci-dessus."
        description="Sans cette case, votre avis reste interne. Vous pouvez retirer votre accord à tout moment."
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end">
        <Button variant="accent" size="lg" loading={busy} disabled={!rating || comment.trim().length < 20} onClick={() => void send()}>
          Envoyer mon avis
        </Button>
      </div>
    </div>
  );
}
