"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ContractsInbox, SubcontractorHome, SubcontractorInvoicesInbox, SubcontractorProfile } from "@/components/extranet/subcontractor";
import { PartnerPayments, SupplierHome, SupplierInvoices, SupplierProfile } from "@/components/extranet/supplier";
import { PageTitle } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

/** Espaces partenaires du compte connecté (un compte peut être fournisseur et sous-traitant). */
function usePartnerSpaces(): { supplier: boolean; subcontractor: boolean } {
  const { user } = useAuth();
  return { supplier: !!user?.spaces.includes("extranet_supplier"), subcontractor: !!user?.spaces.includes("extranet_subcontractor") };
}

export function ExtranetHome() {
  const { supplier, subcontractor } = usePartnerSpaces();
  return (
    <div className="space-y-10">
      {subcontractor ? <SubcontractorHome /> : null}
      {supplier ? <SupplierHome /> : null}
    </div>
  );
}

export function PartnerInvoicesPage() {
  const { supplier, subcontractor } = usePartnerSpaces();
  return (
    <div className="space-y-10">
      {subcontractor ? <SubcontractorInvoicesInbox /> : null}
      {supplier ? <SupplierInvoices /> : null}
    </div>
  );
}

export function PartnerPaymentsPage() {
  const { supplier, subcontractor } = usePartnerSpaces();
  return (
    <div className="space-y-10">
      {subcontractor ? <PartnerPayments path="/extranet/subcontractor/payments" title={supplier ? "Paiements — sous-traitance" : "Mes paiements"} /> : null}
      {supplier ? <PartnerPayments path="/extranet/supplier/payments" title={subcontractor ? "Paiements — fournitures" : "Mes paiements"} /> : null}
    </div>
  );
}

export function PartnerProfilePage() {
  const { supplier, subcontractor } = usePartnerSpaces();
  return (
    <div className="space-y-5">
      <PageTitle
        title="Profil entreprise"
        subtitle="Coordonnées, zones d'intervention, assurances : tenez-les à jour pour rester consulté."
        actions={
          <Link href="/extranet/compte" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
            <ShieldCheck className="h-4 w-4" /> Mon compte et sécurité
          </Link>
        }
      />
      {subcontractor ? <SubcontractorProfile /> : null}
      {supplier ? <SupplierProfile /> : null}
    </div>
  );
}

/** Marchés : page réservée aux sous-traitants (les fournisseurs travaillent par bons de commande). */
export function PartnerContracts() {
  const { subcontractor } = usePartnerSpaces();
  return subcontractor ? <ContractsInbox /> : <PageTitle title="Marchés" subtitle="Les marchés de sous-traitance concernent les comptes sous-traitants. Vos commandes sont dans « Commandes »." />;
}
