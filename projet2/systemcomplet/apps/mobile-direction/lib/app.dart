import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import 'screens/approvals.dart';
import 'screens/dashboard.dart';
import 'screens/modules.dart';
import 'screens/projects.dart';
import 'screens/reports.dart';

/// Même espace que l'ERP web : les liens des notifications (`/erp/...`) ouvrent l'écran mobile correspondant.
const base = '/erp';

/// Menu de la direction et des responsables (mêmes rubriques et mêmes droits que le menu de l'ERP web).
const sections = <NavSection>[
  NavSection(title: 'Pilotage', [
    NavItem('$base/tableau-de-bord', 'Tableau de bord', Icons.dashboard_outlined, anyPerms: ['dashboard:view', 'dashboard:direction']),
    NavItem('$base/validations', 'Validations', Icons.task_alt),
    NavItem('$base/direction/rapports', 'Rapport de direction', Icons.summarize_outlined, perms: ['dashboard:direction']),
    NavItem('$base/rapports/anomalies', 'Anomalies (IA)', Icons.policy_outlined, perms: ['ai:use']),
  ]),
  NavSection(title: 'Projets', [
    NavItem('$base/chantiers', 'Chantiers', Icons.engineering_outlined, perms: ['projects:read']),
    NavItem('$base/ged', 'GED', Icons.folder_open_outlined, perms: ['documents:read']),
    NavItem('$base/agenda', 'Agenda', Icons.event_outlined, perms: ['agenda:read']),
  ]),
  NavSection(title: 'Achats et logistique', [
    NavItem('$base/achats', "Demandes d'achat", Icons.shopping_cart_outlined, perms: ['procurement:read']),
    NavItem('$base/achats/commandes', 'Bons de commande', Icons.receipt_long_outlined, perms: ['procurement:read']),
    NavItem('$base/fournisseurs', 'Fournisseurs', Icons.storefront_outlined, perms: ['suppliers:read']),
    NavItem('$base/livraisons', 'Livraisons', Icons.local_shipping_outlined, perms: ['deliveries:read']),
    NavItem('$base/stocks', 'Stocks', Icons.inventory_2_outlined, perms: ['inventory:read']),
    NavItem('$base/materiel', 'Matériel', Icons.construction_outlined, perms: ['equipment:read']),
  ]),
  NavSection(title: 'Sous-traitance', [
    NavItem('$base/sous-traitants', 'Sous-traitants', Icons.handshake_outlined, perms: ['subcontracting:read']),
    NavItem('$base/sous-traitants/marches', 'Marchés', Icons.assignment_outlined, perms: ['subcontracting:read']),
    NavItem('$base/sous-traitants/consultations', 'Consultations', Icons.campaign_outlined, perms: ['subcontracting:read']),
    NavItem('$base/situations', 'Situations', Icons.fact_check_outlined, perms: ['subcontracting:read']),
    NavItem('$base/litiges', 'Litiges', Icons.gavel_outlined, perms: ['disputes:read']),
  ]),
  NavSection(title: 'Finance', [
    NavItem('$base/finances/paiements', 'Paiements', Icons.payments_outlined, perms: ['finance:read']),
    NavItem('$base/facturation', 'Factures clients', Icons.request_quote_outlined, perms: ['billing:read']),
    NavItem('$base/facturation/fournisseurs', 'Factures fournisseurs', Icons.receipt_outlined, perms: ['billing:read']),
    NavItem('$base/facturation/appels-de-fonds', 'Appels de fonds', Icons.call_made_outlined, perms: ['billing:read']),
    NavItem('$base/finances/echeanciers', 'Échéanciers clients', Icons.splitscreen_outlined, perms: ['billing:read']),
    NavItem('$base/finances/financements', 'Financement clients', Icons.savings_outlined, perms: ['finance:read']),
  ]),
  NavSection(title: 'Commercial', [
    NavItem('$base/crm', 'Leads', Icons.person_search_outlined, perms: ['crm:read']),
    NavItem('$base/crm/opportunites', 'Opportunités', Icons.trending_up, perms: ['crm:read']),
    NavItem('$base/crm/devis', 'Devis', Icons.description_outlined, perms: ['crm:read']),
    NavItem('$base/crm/contrats', 'Contrats', Icons.history_edu_outlined, perms: ['crm:read']),
    NavItem('$base/crm/contacts', 'Contacts', Icons.contacts_outlined, perms: ['crm:read']),
    NavItem('$base/sav', 'SAV', Icons.support_agent, anyPerms: ['support:read', 'support:write']),
  ]),
  NavSection(title: 'RH et QHSE', [
    NavItem('$base/rh', 'Personnel', Icons.badge_outlined, perms: ['hr:read']),
    NavItem('$base/rh/conges', 'Congés', Icons.beach_access_outlined, anyPerms: ['hr:read', 'hr:write']),
    NavItem('$base/rh/paie', 'Paie', Icons.account_balance_wallet_outlined, perms: ['hr:payroll']),
    NavItem('$base/qhse/incidents', 'Incidents QHSE', Icons.health_and_safety_outlined, perms: ['qhse:read']),
    NavItem('$base/qhse/actions', 'Actions correctives', Icons.assignment_turned_in_outlined, perms: ['qhse:read']),
  ]),
  NavSection(title: 'Communication', [
    NavItem('$base/messagerie', 'Messagerie', Icons.forum_outlined, perms: ['chat:use']),
    NavItem('$base/appels', 'Appels', Icons.call_outlined, perms: ['calls:use']),
    NavItem('$base/notifications', 'Notifications', Icons.notifications_outlined),
  ]),
  NavSection(title: 'Administration', [
    NavItem('$base/utilisateurs', 'Utilisateurs', Icons.manage_accounts_outlined, perms: ['users:read']),
    NavItem('$base/securite', 'Sécurité', Icons.shield_outlined, perms: ['security:read']),
    NavItem('$base/securite/sessions', 'Sessions actives', Icons.devices_outlined, perms: ['security:read']),
    NavItem('$base/audit', "Journal d'audit", Icons.manage_search, perms: ['audit:read']),
    NavItem('$base/compte', 'Mon compte', Icons.person_outline),
  ]),
  NavSection(title: 'Aide', [NavItem('$base/documentation', 'Documentation', Icons.menu_book_outlined)]),
];

const tabs = <NavItem>[
  NavItem('$base/tableau-de-bord', 'Pilotage', Icons.dashboard_outlined, anyPerms: ['dashboard:view', 'dashboard:direction']),
  NavItem('$base/validations', 'Validations', Icons.task_alt),
  NavItem('$base/chantiers', 'Chantiers', Icons.engineering_outlined, perms: ['projects:read']),
  NavItem('$base/messagerie', 'Messages', Icons.forum_outlined, perms: ['chat:use']),
  NavItem('$base/menu', 'Plus', Icons.apps),
];

String? _q(GoRouterState s, String key) => s.uri.queryParameters[key];

AppPage _resource(String path, ResourceConfig config, {bool top = false}) =>
    AppPage(path, config.title, (_, _) => ResourceListScreen(config: config), top: top);

/// Ouvre directement la fiche d'une ressource (lien de notification `/erp/.../{id}`).
AppPage _detail(String path, String title, ResourceConfig config) =>
    AppPage(path, title, (_, s) => ResourceDetailBody(config: config, row: J({'id': s.pathParameters['id']})));

/// Pages (chemins identiques au web ; détails déclarés avant les motifs `:id`).
final pages = <AppPage>[
  AppPage('$base/tableau-de-bord', 'Tableau de bord', (_, _) => const DashboardScreen(), top: true),
  AppPage('$base/validations', 'Validations', (_, _) => const ApprovalsScreen(), top: true),
  AppPage('$base/direction/rapports', 'Rapport de direction', (_, _) => const ExecutiveReportsScreen()),
  AppPage('$base/direction/rapports/:id', 'Rapport de direction', (_, s) => ExecutiveReportScreen(id: s.pathParameters['id']!)),
  _resource('$base/rapports/anomalies', anomalies),
  AppPage('$base/chantiers', 'Chantiers', (_, _) => const ProjectsScreen(), top: true),
  AppPage('$base/chantiers/:id', 'Chantier', (_, s) => ProjectScreen(id: s.pathParameters['id']!)),
  AppPage('$base/chantiers/:id/:tab', 'Chantier', (_, s) => ProjectScreen(id: s.pathParameters['id']!)),
  _resource('$base/ged', documents),
  _detail('$base/ged/documents/:id', 'Document', documents),
  AppPage('$base/agenda', 'Agenda', (context, s) => AgendaScreen(canCreate: context.can('agenda:write'), openEventId: _q(s, 'event'))),
  _resource('$base/achats', purchaseRequests),
  _resource('$base/achats/commandes', purchaseOrders),
  _detail('$base/achats/commandes/:id', 'Bon de commande', purchaseOrders),
  _detail('$base/achats/demandes/:id', "Demande d'achat", purchaseRequests),
  _resource('$base/fournisseurs', suppliers),
  _detail('$base/fournisseurs/:id', 'Fournisseur', suppliers),
  _resource('$base/livraisons', deliveries),
  _detail('$base/livraisons/:id', 'Livraison', deliveries),
  _resource('$base/stocks', stock),
  _resource('$base/materiel', equipment),
  _detail('$base/materiel/:id', 'Matériel', equipment),
  _resource('$base/sous-traitants', subcontractors),
  _resource('$base/sous-traitants/marches', subcontracts),
  _detail('$base/sous-traitants/marches/:id', 'Marché', subcontracts),
  _resource('$base/sous-traitants/consultations', tenders),
  _detail('$base/sous-traitants/consultations/:id', 'Consultation', tenders),
  _detail('$base/sous-traitants/:id', 'Sous-traitant', subcontractors),
  _resource('$base/situations', situations),
  _detail('$base/situations/:id', 'Situation', situations),
  _resource('$base/litiges', disputes),
  _detail('$base/litiges/:id', 'Litige', disputes),
  _resource('$base/finances/paiements', payments),
  _detail('$base/finances/paiements/:id', 'Paiement', payments),
  _resource('$base/finances', payments),
  _resource('$base/facturation', clientInvoices),
  _resource('$base/facturation/fournisseurs', supplierInvoices),
  _detail('$base/facturation/fournisseurs/:id', 'Facture fournisseur', supplierInvoices),
  _resource('$base/facturation/appels-de-fonds', fundsCalls),
  _resource('$base/finances/echeanciers', paymentPlans),
  _resource('$base/finances/financements', financingApplications),
  _resource('$base/crm', leads),
  _detail('$base/crm/leads/:id', 'Lead', leads),
  _resource('$base/crm/opportunites', opportunities),
  _resource('$base/crm/devis', quotes),
  _detail('$base/crm/devis/:id', 'Devis', quotes),
  _resource('$base/crm/contrats', contracts),
  _detail('$base/crm/contrats/:id', 'Contrat', contracts),
  _resource('$base/crm/contacts', contacts),
  _resource('$base/sav', tickets),
  AppPage('$base/sav/:id', 'Ticket SAV', (_, s) => TicketDetailScreen(ticketId: s.pathParameters['id']!, staff: true)),
  _resource('$base/rh', employees),
  _detail('$base/rh/employes/:id', 'Employé', employees),
  _resource('$base/rh/conges', leaves),
  _resource('$base/rh/paie', payrollRuns),
  _detail('$base/rh/paie/:id', 'Paie', payrollRuns),
  _resource('$base/qhse/incidents', incidents),
  _detail('$base/qhse/incidents/:id', 'Incident', incidents),
  _resource('$base/qhse/actions', qhseActions),
  _detail('$base/qhse/actions/:id', 'Action corrective', qhseActions),
  _resource('$base/qhse', incidents),
  AppPage('$base/messagerie', 'Messagerie', (_, s) => ConversationsScreen(openConversationId: _q(s, 'c')), top: true),
  AppPage('$base/appels', 'Appels', (_, s) => CallsScreen(openCallId: _q(s, 'call'))),
  AppPage('$base/notifications', 'Notifications', (_, _) => const NotificationsScreen()),
  _resource('$base/utilisateurs', users),
  AppPage('$base/securite', 'Sécurité', (_, _) => const SecurityScreen()),
  _resource('$base/securite/sessions', sessions),
  _resource('$base/audit', auditLog),
  AppPage('$base/compte', 'Mon compte', (_, s) => AccountScreen(initialTab: _q(s, 'mfa') != null ? 1 : 0, mfaRequired: _q(s, 'mfa') == 'obligatoire')),
  AppPage('$base/documentation', 'Documentation', (_, s) => DocsScreen(space: 'erp', docId: _q(s, 'doc'), route: _q(s, 'route'))),
  AppPage('$base/menu', 'Plus', (_, _) => const MenuGrid(sections: sections), top: true),
];

GoRouter buildRouter(GlobusServices services) {
  return buildGlobusRouter(
    services: services,
    base: base,
    home: '$base/tableau-de-bord',
    pages: [...pages, AppPage(base, 'Tableau de bord', (_, _) => const DashboardScreen(), top: true)],
    shell: (context, state, child) => GlobusShell(state: state, pages: pages, sections: sections, tabs: tabs, base: base, child: child),
  );
}
