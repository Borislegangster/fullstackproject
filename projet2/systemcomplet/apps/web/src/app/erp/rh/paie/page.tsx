import { redirect } from "next/navigation";

export default function PayrollIndex() {
  redirect("/erp/rh?onglet=paie");
}
