import { redirect } from "next/navigation";

export default function BimIndex() {
  redirect("/erp/hub?onglet=modeles");
}
