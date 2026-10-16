"use client";

import { CheckCircle2, FileSearch, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Vérification locale d'un fichier : l'empreinte SHA-256 est calculée dans le navigateur (WebCrypto) et comparée à
 * l'empreinte certifiée ou à celle d'une pièce du lot. Le fichier n'est jamais envoyé au serveur.
 */
export function ProofFileCheck({ sha256, leaves }: { sha256: string; leaves: { label: string; sha256: string }[] }) {
  const [state, setState] = useState<{ status: "idle" | "busy" | "match" | "nomatch"; name?: string; hash?: string; label?: string }>({ status: "idle" });
  const check = async (file: File | undefined) => {
    if (!file) return;
    setState({ status: "busy", name: file.name });
    const hash = await sha256Hex(file);
    const leaf = leaves.find((l) => l.sha256 === hash);
    if (hash === sha256 || leaf) setState({ status: "match", name: file.name, hash, label: leaf?.label });
    else setState({ status: "nomatch", name: file.name, hash });
  };
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-5 text-left">
      <p className="flex items-center gap-2 font-semibold text-brand-800">
        <FileSearch className="h-5 w-5" /> Vérifier un fichier en votre possession
      </p>
      <p className="mt-1 text-xs text-muted">Le calcul se fait sur votre appareil : votre fichier ne quitte jamais votre navigateur.</p>
      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-6 text-sm font-medium text-brand-700 ring-1 ring-line transition hover:ring-brand-300">
        <input type="file" className="sr-only" onChange={(e) => void check(e.target.files?.[0])} />
        Choisir le fichier à comparer
      </label>
      {state.status === "busy" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Calcul de l&apos;empreinte de {state.name}…
        </p>
      ) : null}
      {state.status === "match" ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>Fichier identique</strong> à {state.label ? `la pièce « ${state.label} » du lot certifié` : "l'original certifié"} : il n&apos;a pas été
            modifié depuis sa certification.
          </span>
        </p>
      ) : null}
      {state.status === "nomatch" ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>Empreinte différente</strong> : ce fichier n&apos;est pas celui qui a été certifié (ou il a été modifié).
            <code className="mt-1 block break-all text-[11px]">{state.hash}</code>
          </span>
        </p>
      ) : null}
    </div>
  );
}
