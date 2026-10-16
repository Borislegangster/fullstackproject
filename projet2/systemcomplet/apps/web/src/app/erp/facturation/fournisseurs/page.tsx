import { redirect } from "next/navigation";

export default function SupplierInvoicesIndex() {
  redirect("/erp/facturation?onglet=fournisseurs");
}
