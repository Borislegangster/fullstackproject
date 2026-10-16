import { redirect } from "next/navigation";

export default function TendersIndex() {
  redirect("/erp/sous-traitants?onglet=consultations");
}
