"use client";

import {
  Bell,
  BookOpen,
  BookUser,
  Box,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderLock,
  Gift,
  HandCoins,
  HardHat,
  Home,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  Palette,
  Phone,
  Rotate3D,
  ShieldCheck,
  Star,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { ClientProjectProvider, ProjectSwitcher } from "@/components/client/client-project";
import { AppShell, type NavSection } from "@/components/shell/app-shell";
import { AuthProvider } from "@/lib/auth";

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/espace-client/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/espace-client/passeport", label: "Passeport projet", icon: BookUser },
      { href: "/espace-client/chantier", label: "Chantier", icon: HardHat },
      { href: "/espace-client/planning", label: "Planning", icon: CalendarDays },
      { href: "/espace-client/agenda", label: "Mes rendez-vous", icon: CalendarClock },
      { href: "/espace-client/finances", label: "Finances", icon: Wallet },
      { href: "/espace-client/financement", label: "Financement", icon: HandCoins, feature: "financing" },
      { href: "/espace-client/documents", label: "Documents", icon: FileText },
      { href: "/espace-client/preuves", label: "Preuves certifiées", icon: ShieldCheck },
      { href: "/espace-client/validations", label: "Validations", icon: ClipboardCheck },
    ],
  },
  {
    title: "Immersion",
    items: [
      { href: "/espace-client/immersion", label: "Maquette 3D / BIM", icon: Box },
      { href: "/espace-client/configurateur", label: "Configurateur", icon: Palette },
      { href: "/espace-client/live", label: "Live, 360° et drone", icon: Rotate3D },
    ],
  },
  {
    title: "Échanges",
    items: [
      { href: "/espace-client/messagerie", label: "Messagerie", icon: MessagesSquare, perms: ["chat:use"] },
      { href: "/espace-client/appels", label: "Appels", icon: Phone, perms: ["calls:use"] },
      { href: "/espace-client/batiment", label: "Mon bâtiment", icon: Home },
      { href: "/espace-client/energie", label: "Énergie et confort", icon: Sun },
      { href: "/espace-client/sav", label: "SAV et garanties", icon: LifeBuoy },
      { href: "/espace-client/tranquillite", label: "Dossier Tranquillité", icon: FolderLock },
      { href: "/espace-client/avis", label: "Mon avis", icon: Star },
      { href: "/espace-client/parrainage", label: "Parrainage", icon: Gift, feature: "referrals" },
      { href: "/espace-client/notifications", label: "Notifications", icon: Bell },
      { href: "/espace-client/compte", label: "Mon compte", icon: UserRound },
    ],
  },
  {
    title: "Aide",
    items: [{ href: "/espace-client/documentation", label: "Documentation", icon: BookOpen }],
  },
];

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ClientProjectProvider>
        <AppShell spaces={["client"]} sections={SECTIONS} title="Espace client" base="/espace-client" accountHref="/espace-client/compte" topbar={<ProjectSwitcher />}>
          {children}
        </AppShell>
      </ClientProjectProvider>
    </AuthProvider>
  );
}
