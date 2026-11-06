import type { Metadata } from "next";

import { PublicSignature } from "./public-signature";

export const metadata: Metadata = { title: "Signer un document", robots: { index: false, follow: false } };

export default async function SignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="bg-surface py-10">
      <div className="container-page max-w-4xl">
        <PublicSignature token={token} />
      </div>
    </section>
  );
}
