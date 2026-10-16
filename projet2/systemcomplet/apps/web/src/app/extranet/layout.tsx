"use client";

import {
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileSignature,
  Gauge,
  Gavel,
  LayoutDashboard,
  MessageSquareWarning,
  MessagesSquare,
  Phone,
  Receipt,
  Scale,
  ShoppingCart,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { AppShell, type NavSection } from "@/components/shell/app-shell";
import { AuthProvider } from "@/lib/auth";

const SUB = ["extranet_subcontractor"];
const SUP = ["extranet_supplier"];

const SECTIONS: NavSection[] = [
  {
    items: [{ href: "/extranet", label: "Accueil", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Sous-traitance",
    items: [
      { href: "/extranet/consultations", label: "Consultations", icon: Gavel, spaces: SUB },
      { href: "/extranet/marches", label: "Mes marchés", icon: FileSignature, spaces: SUB },
      { href: "/extranet/situations", label: "Situations", icon: ClipboardCheck, spaces: SUB },
      { href: "/extranet/reclamations", label: "Réclamations", icon: MessageSquareWarning, spaces: SUB },
      { href: "/extranet/litiges", label: "Litiges", icon: Scale, spaces: SUB },
    ],
  },
  {
    title: "Fournitures",
    items: [
      { href: "/extranet/commandes", label: "Commandes", icon: ShoppingCart, spaces: SUP },
      { href: "/extranet/livraisons", label: "Livraisons", icon: Truck, spaces: SUP },
      { href: "/extranet/documents", label: "Documents", icon: FileCheck2, spaces: SUP },
      { href: "/extranet/performance", label: "Performance", icon: Gauge, spaces: SUP },
    ],
  },
  {
    title: "Facturation",
    items: [
      { href: "/extranet/factures", label: "Factures", icon: Receipt },
      { href: "/extranet/paiements", label: "Paiements", icon: Wallet },
    ],
  },
  {
    title: "Échanges",
    items: [
      { href: "/extranet/messagerie", label: "Messagerie", icon: MessagesSquare, perms: ["chat:use"] },
      { href: "/extranet/appels", label: "Appels", icon: Phone, perms: ["calls:use"] },
      { href: "/extranet/notifications", label: "Notifications", icon: Bell },
      { href: "/extranet/profil", label: "Profil entreprise", icon: Building2 },
      { href: "/extranet/compte", label: "Mon compte", icon: UserRound },
    ],
  },
  {
    title: "Aide",
    items: [{ href: "/extranet/documentation", label: "Documentation", icon: BookOpen }],
  },
];

export default function ExtranetLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell spaces={["extranet_supplier", "extranet_subcontractor"]} sections={SECTIONS} title="Extranet partenaires" base="/extranet" accountHref="/extranet/compte">
        {children}
      </AppShell>
    </AuthProvider>
  );
}
