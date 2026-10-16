import { redirect } from "next/navigation";

export default function CmsPagesIndex() {
  redirect("/erp/cms?onglet=pages");
}
