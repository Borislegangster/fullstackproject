import type { Metadata } from "next";

import { SupplierPortal } from "./supplier-portal";

export const metadata: Metadata = { title: "Bon de commande fournisseur", robots: { index: false, follow: false } };

export default async function SupplierPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="bg-surface py-10">
      <div className="container-page max-w-5xl">
        <SupplierPortal token={token} />
      </div>
    </section>
  );
}
