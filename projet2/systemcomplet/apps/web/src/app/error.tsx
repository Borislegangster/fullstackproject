"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-brand-800">Une erreur est survenue</h1>
      <p className="mt-2 max-w-md text-muted">Le service est momentanément indisponible. Réessayez dans quelques instants.</p>
      {error.digest ? <p className="mt-2 text-xs text-muted">Référence : {error.digest}</p> : null}
      <button type="button" onClick={reset} className="mt-6 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
        Réessayer
      </button>
    </div>
  );
}
