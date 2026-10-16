import { redirect } from "next/navigation";

export default function IssuesIndex() {
  redirect("/erp/hub?onglet=issues");
}
