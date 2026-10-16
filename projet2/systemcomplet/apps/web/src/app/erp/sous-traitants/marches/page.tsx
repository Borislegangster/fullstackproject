import { redirect } from "next/navigation";

export default function ContractsIndex() {
  redirect("/erp/sous-traitants?onglet=marches");
}
