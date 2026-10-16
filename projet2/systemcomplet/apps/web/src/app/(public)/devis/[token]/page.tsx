import type { Metadata } from "next";

import { PublicQuote } from "./public-quote";

export const metadata: Metadata = { title: "Votre devis", robots: { index: false, follow: false } };

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="bg-surface py-10">
      <div className="container-page max-w-5xl">
        <PublicQuote token={token} />
      </div>
    </section>
  );
}
