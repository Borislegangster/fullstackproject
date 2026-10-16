import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
        <Link href="/" className="relative">
          <img src="/brand/logo-globus.png" alt="GLOBUS ENGINEERING" className="h-12 w-auto rounded-lg bg-white/95 p-1.5" />
        </Link>
        <div className="relative">
          <p className="font-accent text-3xl font-bold leading-snug text-white">Concevoir. Calculer. Construire. Contrôler.</p>
          <p className="mt-4 max-w-md text-brand-100">Espace client, ERP et extranet partenaires : une seule plateforme sécurisée pour suivre, décider et collaborer.</p>
        </div>
        <p className="relative text-xs text-brand-200">Connexion sécurisée · chiffrement TLS · authentification à deux facteurs</p>
      </aside>
      <main id="contenu" className="flex items-center justify-center bg-surface px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 block lg:hidden">
            <img src="/brand/logo-globus.png" alt="GLOBUS ENGINEERING" className="mx-auto h-11 w-auto" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
