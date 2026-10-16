"use client";

import { ExternalLink, Lock, Rotate3D, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { ModelViewer } from "@/components/site/model-viewer";
import { api, errorMessage } from "@/lib/api";
import { dateLong } from "@/lib/format";

const ImmersiveViewer = dynamic(() => import("@/components/three/immersive-viewer").then((m) => m.ImmersiveViewer), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] items-center justify-center rounded-3xl bg-black/40 text-sm text-white/70">Chargement de la visite…</div>,
});

interface Preview {
  title: string;
  project?: string | null;
  city?: string | null;
  kind: string;
  message?: string | null;
  requires_pin: boolean;
  locked: boolean;
  expires_at: string;
}

interface Opened {
  title: string;
  kind: string;
  url: string;
  external: boolean;
  description?: string | null;
  captured_at?: string | null;
}

export function VisitPlayer({ token }: { token: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  const open = async (code?: string) => {
    setBusy(true);
    setError(null);
    try {
      setOpened(await api<Opened>(`/public/visits/${encodeURIComponent(token)}/open`, { body: { pin: code ?? null } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    api<Preview>(`/public/visits/${encodeURIComponent(token)}`)
      .then((p) => {
        setPreview(p);
        if (!p.requires_pin) void open();
      })
      .catch((err) => setFailure(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (failure) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
        <XCircle className="mx-auto h-12 w-12 text-red-300" />
        <h1 className="mt-4 font-title text-2xl font-bold text-white">Visite indisponible</h1>
        <p className="mt-2 text-brand-100">{failure}</p>
      </div>
    );
  }
  if (!preview) return <div className="mx-auto h-[60vh] max-w-5xl animate-pulse rounded-3xl bg-white/5" />;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-accent-200 ring-1 ring-white/20">
          <Rotate3D className="h-4 w-4" /> Visite immersive {preview.project ? `· ${preview.project}` : ""}
        </p>
        <h1 className="mt-4 font-title text-3xl font-bold text-white sm:text-5xl">{preview.title}</h1>
        {preview.message ? <p className="mx-auto mt-3 max-w-2xl text-lg text-brand-100">« {preview.message} »</p> : null}
      </div>
      {!opened ? (
        preview.requires_pin ? (
          <div className="mx-auto max-w-sm rounded-3xl bg-white/10 p-6 text-center backdrop-blur">
            <Lock className="mx-auto h-8 w-8 text-accent-300" />
            <p className="mt-3 font-semibold">Saisissez le code reçu</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="mt-4 w-full rounded-xl border-0 bg-white/90 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-ink"
              aria-label="Code PIN"
            />
            {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
            <button
              type="button"
              disabled={busy || pin.length < 4 || preview.locked}
              onClick={() => void open(pin)}
              className="mt-4 w-full rounded-full bg-accent-500 px-5 py-3 font-semibold text-white transition hover:bg-accent-600 disabled:opacity-50"
            >
              Ouvrir la visite
            </button>
            {preview.locked ? <p className="mt-3 text-xs text-red-200">Lien verrouillé après plusieurs codes erronés.</p> : null}
          </div>
        ) : error ? (
          <p className="text-center text-red-200">{error}</p>
        ) : (
          <div className="mx-auto h-[60vh] max-w-5xl animate-pulse rounded-3xl bg-white/5" />
        )
      ) : (
        <div className="mx-auto max-w-6xl space-y-4">
          {opened.kind === "photo_360" || opened.kind === "video_360" ? (
            <ImmersiveViewer url={opened.url} video={opened.kind === "video_360"} />
          ) : opened.kind === "model" ? (
            <div className="rounded-3xl bg-white p-3">
              <ModelViewer url={opened.url} className="h-[65vh]" />
            </div>
          ) : opened.external ? (
            <div className="rounded-3xl bg-white/10 p-8 text-center">
              <a href={opened.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 font-semibold text-white">
                <ExternalLink className="h-5 w-5" /> Lancer la visite virtuelle
              </a>
            </div>
          ) : (
            <video src={opened.url} controls playsInline className="w-full rounded-3xl bg-black" />
          )}
          <p className="text-center text-sm text-brand-200">
            {opened.description ? `${opened.description} · ` : ""}
            {opened.captured_at ? `Prise de vue du ${dateLong(opened.captured_at)} · ` : ""}
            Lien valable jusqu&apos;au {dateLong(preview.expires_at)} — GLOBUS ENGINEERING
          </p>
        </div>
      )}
    </div>
  );
}
