import { redirect } from "next/navigation";

export default function Index() {
  redirect("/erp/crm?onglet=contrats");
}
