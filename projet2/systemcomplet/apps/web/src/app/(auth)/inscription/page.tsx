import { redirect } from "next/navigation";

/** Ancienne adresse : l'inscription libre n'existe pas (comptes créés par GLOBUS, accès sur invitation). */
export default async function LegacySignupPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation } = await searchParams;
  redirect(invitation ? `/activation?invitation=${encodeURIComponent(invitation)}` : "/connexion");
}
