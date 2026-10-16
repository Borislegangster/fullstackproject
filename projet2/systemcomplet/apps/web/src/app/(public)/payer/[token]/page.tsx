import type { Metadata } from "next";

import { PayLink } from "./pay-link";

export const metadata: Metadata = { title: "Paiement sécurisé", robots: { index: false, follow: false } };

export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="relative overflow-hidden bg-surface py-12 lg:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-100/60 to-transparent" aria-hidden="true" />
      <div className="container-page relative max-w-5xl">
        <PayLink token={token} />
      </div>
    </section>
  );
}
