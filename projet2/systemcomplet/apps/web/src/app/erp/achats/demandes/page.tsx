import { redirect } from "next/navigation";

export default function RequestsIndex() {
  redirect("/erp/achats?onglet=demandes");
}
