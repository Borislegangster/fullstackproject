"use client";

import { FileCheck2, Loader2, X } from "lucide-react";
import { useState } from "react";

import { FileDrop } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";

/** Pièce jointe d'un formulaire (justificatif, scan) : le fichier est déposé tout de suite sur `endpoint`, qui renvoie
 * `{ file_id }` ; la valeur du champ reste l'identifiant du fichier stocké. `href` : lien de consultation du fichier
 * déjà enregistré (fiche existante). */
export function UploadedFileField({
  endpoint,
  value,
  onChange,
  href,
  accept = "image/*,application/pdf",
  maxSizeMb = 20,
  label = "Déposez le justificatif (photo ou PDF) ou cliquez pour parcourir",
}: {
  endpoint: string;
  value: unknown;
  onChange: (fileId: string | null) => void;
  href?: string | null;
  accept?: string;
  maxSizeMb?: number;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const upload = async (files: File[]) => {
    const file = files[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ file_id: string; filename?: string }>(endpoint, { method: "POST", form: fd });
      setName(res.filename ?? file.name);
      onChange(String(res.file_id));
    } catch (err) {
      toast.error("Dépôt impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (busy) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Envoi du fichier…
      </p>
    );
  }
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {href && !name ? (
            <a href={apiUrl(href)} target="_blank" rel="noreferrer" className="truncate text-brand-600 hover:underline">
              Fichier joint — ouvrir
            </a>
          ) : (
            <span className="truncate">{name ?? "Fichier joint"}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            setName(null);
            onChange(null);
          }}
          className="rounded-lg p-1 text-muted hover:bg-white hover:text-ink"
          aria-label="Retirer le fichier"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return <FileDrop files={[]} onChange={(files) => void upload(files)} accept={accept} maxSizeMb={maxSizeMb} label={label} />;
}
