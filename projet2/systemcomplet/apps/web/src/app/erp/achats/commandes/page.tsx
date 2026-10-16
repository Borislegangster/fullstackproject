import { redirect } from "next/navigation";

export default function OrdersIndex() {
  redirect("/erp/achats?onglet=commandes");
}
