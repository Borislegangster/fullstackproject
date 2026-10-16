"use client";

import { SupplierOrderView, type SupplierOrder } from "@/components/procurement/supplier-order-view";
import { Alert, Skeleton } from "@/components/ui/primitives";
import { api, apiUrl } from "@/lib/api";
import { useApi } from "@/lib/hooks";

/** Portail fournisseur par lien sécurisé (envoyé par WhatsApp / e-mail) : aucun compte requis. */
export function SupplierPortal({ token }: { token: string }) {
  const base = `/public/supplier-portal/${encodeURIComponent(token)}`;
  const { data, error, loading, setData } = useApi<SupplierOrder>(base);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger" title="Lien invalide ou expiré">{error ?? "Contactez votre acheteur GLOBUS pour obtenir un nouveau lien."}</Alert>;
  return (
    <SupplierOrderView
      order={data}
      onUpdated={(o) => setData(o)}
      refresh={() => api<SupplierOrder>(base)}
      endpoints={{ respond: `${base}/respond`, shipment: `${base}/shipment`, invoice: `${base}/invoice`, pdf: apiUrl(`${base}/pdf`) }}
    />
  );
}
