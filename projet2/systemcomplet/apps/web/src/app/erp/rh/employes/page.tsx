import { redirect } from "next/navigation";

export default function EmployeesIndex() {
  redirect("/erp/rh?onglet=personnel");
}
