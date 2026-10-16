import type { Metadata } from "next";

import { PayReturn } from "./pay-return";

export const metadata: Metadata = { title: "Confirmation de paiement", robots: { index: false, follow: false } };

export default async function PayReturnPage({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params;
  return (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page max-w-xl">
        <PayReturn tx={tx} />
      </div>
    </section>
  );
}
