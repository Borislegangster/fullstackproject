"use client";

import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Construction,
  FileBarChart2,
  FileSearch,
  FolderKanban,
  GanttChart,
  Gavel,
  Gift,
  Globe,
  HandCoins,
  HardHat,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Lock,
  Mail,
  MessageCircle,
  MessagesSquare,
  Network,
  Palette,
  Phone,
  Receipt,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Split,
  Truck,
  UserCog,
  Users,
  Wrench,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { AppShell, type NavSection } from "@/components/shell/app-shell";
import { AuthProvider } from "@/lib/auth";

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/erp", label: "Tableau de bord", icon: LayoutDashboard, exact: true, perms: ["dashboard:view"] },
      { href: "/erp/rapports", label: "Rapports", icon: BarChart3, perms: ["reports:read"] },
      { href: "/erp/direction/rapports", label: "Rapport de direction", icon: FileBarChart2, perms: ["dashboard:direction"] },
      { href: "/erp/ia", label: "Assistants IA", icon: Bot, perms: ["ai:use"] },
    ],
  },
  {
    title: "Projets",
    items: [
      { href: "/erp/chantiers", label: "Chantiers", icon: HardHat, perms: ["projects:read"] },
      { href: "/erp/planning", label: "Planning", icon: GanttChart, perms: ["planning:read"] },
      { href: "/erp/hub", label: "Hub BIM", icon: Network, perms: ["bim:read"] },
      { href: "/erp/ged", label: "GED", icon: FolderKanban, perms: ["documents:read"] },
      { href: "/erp/configurateur", label: "Configurateur 3D", icon: Palette, perms: ["configurator:manage", "projects:read"] },
      { href: "/erp/agenda", label: "Agenda", icon: CalendarDays, perms: ["agenda:read"] },
    ],
  },
  {
    title: "Achats et logistique",
    items: [
      { href: "/erp/achats", label: "Achats", icon: ShoppingCart, perms: ["procurement:read"] },
      { href: "/erp/achats/prix", label: "Prix des matériaux", icon: LineChart, perms: ["procurement:read"] },
      { href: "/erp/fournisseurs", label: "Fournisseurs", icon: Building2, perms: ["suppliers:read"] },
      { href: "/erp/livraisons", label: "Livraisons", icon: Truck, perms: ["deliveries:read"] },
      { href: "/erp/stocks", label: "Stocks", icon: Boxes, perms: ["inventory:read"] },
      { href: "/erp/materiel", label: "Matériel", icon: Wrench, perms: ["equipment:read"] },
    ],
  },
  {
    title: "Sous-traitance",
    items: [
      { href: "/erp/sous-traitants", label: "Sous-traitants", icon: Construction, perms: ["subcontracting:read"] },
      { href: "/erp/situations", label: "Situations", icon: ClipboardList, perms: ["subcontracting:read"] },
      { href: "/erp/litiges", label: "Litiges", icon: Gavel, perms: ["disputes:read"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/erp/finances", label: "Finances", icon: Landmark, perms: ["finance:read"] },
      { href: "/erp/facturation", label: "Facturation", icon: Receipt, perms: ["billing:read"] },
      { href: "/erp/finances/echeanciers", label: "Échéanciers clients", icon: Split, perms: ["billing:read"] },
      { href: "/erp/finances/sequestre", label: "Séquestre par jalon", icon: Lock, perms: ["finance:read"] },
      { href: "/erp/finances/financements", label: "Financement clients", icon: HandCoins, perms: ["finance:read"] },
      { href: "/erp/caisse", label: "Ma petite caisse", icon: Wallet, feature: "petty_cash" },
    ],
  },
  {
    title: "Commercial",
    items: [
      { href: "/erp/crm", label: "CRM", icon: Briefcase, perms: ["crm:read"] },
      { href: "/erp/crm/ambassadeurs", label: "Ambassadeurs", icon: Gift, perms: ["crm:read"] },
      { href: "/erp/assistant", label: "Assistant et WhatsApp", icon: MessageCircle, perms: ["crm:read"] },
      { href: "/erp/sav", label: "SAV", icon: LifeBuoy, perms: ["support:read", "support:write"] },
      { href: "/erp/newsletter", label: "Newsletter", icon: Mail, perms: ["newsletter:read"] },
    ],
  },
  {
    title: "RH et QHSE",
    items: [
      { href: "/erp/rh", label: "Ressources humaines", icon: Users, perms: ["hr:read"] },
      { href: "/erp/qhse", label: "QHSE", icon: ShieldAlert, perms: ["qhse:read"] },
    ],
  },
  {
    title: "Site web",
    items: [
      { href: "/erp/cms", label: "Contenus (CMS)", icon: Globe, perms: ["cms:read"] },
      { href: "/erp/media", label: "Médiathèque", icon: ImageIcon, perms: ["cms:read", "media:write"] },
      { href: "/erp/seo", label: "SEO", icon: Search, perms: ["seo:write", "cms:read"] },
      { href: "/erp/analytics", label: "Analytics", icon: Activity, perms: ["analytics:read"] },
    ],
  },
  {
    title: "Communication",
    items: [
      { href: "/erp/messagerie", label: "Messagerie", icon: MessagesSquare, perms: ["chat:use"] },
      { href: "/erp/appels", label: "Appels", icon: Phone, perms: ["calls:use"] },
      { href: "/erp/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/erp/utilisateurs", label: "Utilisateurs et rôles", icon: UserCog, perms: ["users:read", "roles:manage"] },
      { href: "/erp/parametres", label: "Paramètres", icon: Settings, perms: ["settings:read", "notifications:manage", "integrations:manage"] },
      { href: "/erp/securite", label: "Sécurité", icon: ShieldCheck, perms: ["security:read"] },
      { href: "/erp/audit", label: "Journal d'audit", icon: FileSearch, perms: ["audit:read"] },
      { href: "/erp/compte", label: "Mon compte", icon: KeyRound },
    ],
  },
  {
    title: "Aide",
    items: [{ href: "/erp/documentation", label: "Documentation", icon: BookOpen }],
  },
];

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell spaces={["erp"]} sections={SECTIONS} title="ERP GLOBUS" base="/erp" accountHref="/erp/compte">
        {children}
      </AppShell>
    </AuthProvider>
  );
}
