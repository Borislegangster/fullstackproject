import Link from "next/link";

import { NotFoundTracker } from "@/components/site/not-found-tracker";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <img src="/brand/logo-globus.png" alt="GLOBUS ENGINEERING" className="h-12 w-auto" />
      <p className="mt-10 font-accent text-6xl font-bold text-brand-500">404</p>
      <h1 className="mt-4 text-2xl font-bold text-brand-800">Page introuvable</h1>
      <p className="mt-2 max-w-md text-muted">Cette page n'existe pas, a été déplacée ou n'est plus publiée.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
          Retour à l'accueil
        </Link>
        <Link href="/recherche" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
          Rechercher
        </Link>
      </div>
      <NotFoundTracker />
    </div>
  );
}
