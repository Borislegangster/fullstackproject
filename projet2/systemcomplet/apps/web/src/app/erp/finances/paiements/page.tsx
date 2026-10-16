import { redirect } from "next/navigation";

export default function PaymentsIndex() {
  redirect("/erp/finances?onglet=paiements");
}
