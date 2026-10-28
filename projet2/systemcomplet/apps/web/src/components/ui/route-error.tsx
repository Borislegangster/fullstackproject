"use client";

import { useEffect } from "react";

/** Erreur d'un écran : le menu de l'espace reste affiché ; message clair, détail technique pour le support,
 * boutons « Réessayer » et « Recharger la page » (utile juste après une mise en ligne). */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-brand-800">Une erreur est survenue</h1>
      <p className="mt-2 max-w-md text-muted">Cet écran n&apos;a pas pu s&apos;afficher. Réessayez ou rechargez la page.</p>
      <p className="mt-2 max-w-md break-words text-xs text-muted">
        Détail : {error.message || error.name}
        {error.digest ? ` · référence ${error.digest}` : ""}
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
          Réessayer
        </button>
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">
          Recharger la page
        </button>
      </div>
    </div>
  );
}
