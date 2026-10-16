"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { NewReceipt } from "@/components/erp/deliveries";

function Inner() {
  const params = useSearchParams();
  return <NewReceipt purchaseOrderId={params.get("commande")} deliveryId={params.get("livraison")} />;
}

export default function NewReceiptPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
