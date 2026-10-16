import { redirect } from "next/navigation";

const ALIASES: Record<string, string> = { journal: "journal", decisions: "decisions", avenants: "avenants", planning: "planning", budget: "budget", equipe: "equipe" };

export default async function ProjectTabRedirect({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  redirect(`/erp/chantiers/${id}?onglet=${ALIASES[tab] ?? "synthese"}`);
}
