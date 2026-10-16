import { redirect } from "next/navigation";

export default function ReceiptsIndex() {
  redirect("/erp/livraisons?onglet=receptions");
}
