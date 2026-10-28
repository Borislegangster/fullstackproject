import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'project.dart';
import 'screens/building.dart';
import 'screens/dashboard.dart';
import 'screens/documents.dart';
import 'screens/finances.dart';
import 'screens/financing.dart';
import 'screens/immersion.dart';
import 'screens/passport.dart';
import 'screens/referral.dart';
import 'screens/site.dart';
import 'screens/support.dart';
import 'screens/validations.dart';

const base = '/espace-client';

/// Menu de l'espace client (mêmes entrées, mêmes droits et modules optionnels que le web).
const sections = <NavSection>[
  NavSection([
    NavItem('$base/dashboard', 'Tableau de bord', Icons.dashboard_outlined),
    NavItem('$base/passeport', 'Passeport projet', Icons.badge_outlined),
    NavItem('$base/chantier', 'Chantier', Icons.engineering_outlined),
    NavItem('$base/planning', 'Planning', Icons.calendar_month_outlined),
    NavItem('$base/agenda', 'Mes rendez-vous', Icons.event_outlined),
    NavItem('$base/finances', 'Finances', Icons.account_balance_wallet_outlined),
    NavItem('$base/financement', 'Financement', Icons.savings_outlined, feature: 'financing'),
    NavItem('$base/documents', 'Documents', Icons.description_outlined),
    NavItem('$base/preuves', 'Preuves certifiées', Icons.verified_user_outlined),
    NavItem('$base/validations', 'Validations', Icons.fact_check_outlined),
  ]),
  NavSection(title: 'Immersion', [
    NavItem('$base/immersion', 'Maquette 3D / BIM', Icons.view_in_ar_outlined),
    NavItem('$base/configurateur', 'Configurateur', Icons.palette_outlined),
    NavItem('$base/live', 'Live, 360° et drone', Icons.threesixty),
  ]),
  NavSection(title: 'Échanges', [
    NavItem('$base/messagerie', 'Messagerie', Icons.forum_outlined, perms: ['chat:use']),
    NavItem('$base/appels', 'Appels', Icons.call_outlined, perms: ['calls:use']),
    NavItem('$base/batiment', 'Mon bâtiment', Icons.home_outlined),
    NavItem('$base/energie', 'Énergie et confort', Icons.wb_sunny_outlined),
    NavItem('$base/sav', 'SAV et garanties', Icons.support_agent),
    NavItem('$base/tranquillite', 'Dossier Tranquillité', Icons.folder_special_outlined),
    NavItem('$base/avis', 'Mon avis', Icons.star_outline),
    NavItem('$base/parrainage', 'Parrainage', Icons.card_giftcard, feature: 'referrals'),
    NavItem('$base/notifications', 'Notifications', Icons.notifications_outlined),
    NavItem('$base/compte', 'Mon compte', Icons.person_outline),
  ]),
  NavSection(title: 'Aide', [NavItem('$base/documentation', 'Documentation', Icons.menu_book_outlined)]),
];

const tabs = <NavItem>[
  NavItem('$base/dashboard', 'Accueil', Icons.dashboard_outlined),
  NavItem('$base/chantier', 'Chantier', Icons.engineering_outlined),
  NavItem('$base/finances', 'Finances', Icons.account_balance_wallet_outlined),
  NavItem('$base/messagerie', 'Messages', Icons.forum_outlined, perms: ['chat:use']),
  NavItem('$base/menu', 'Plus', Icons.apps),
];

String? _q(GoRouterState s, String key) => s.uri.queryParameters[key];

/// Pages de l'application (chemins identiques au web : les liens des notifications ouvrent l'écran mobile).
final pages = <AppPage>[
  AppPage('$base/dashboard', 'Tableau de bord', (_, _) => const DashboardScreen(), top: true),
  AppPage('$base/passeport', 'Passeport projet', (_, _) => const PassportScreen()),
  AppPage('$base/chantier', 'Chantier', (_, _) => const SiteScreen(), top: true),
  AppPage('$base/planning', 'Planning', (_, _) => const PlanningScreen()),
  AppPage('$base/agenda', 'Mes rendez-vous', (context, s) => _ProjectAgenda(openEventId: _q(s, 'event'))),
  AppPage('$base/finances', 'Finances', (_, _) => const FinancesScreen(), top: true),
  AppPage('$base/finances/paiement/:id', 'Paiement', (_, s) => PaymentStatusScreen(transactionId: s.pathParameters['id']!)),
  AppPage('$base/financement', 'Financement', (_, _) => const FinancingScreen()),
  AppPage('$base/documents', 'Documents', (_, _) => const DocumentsScreen()),
  AppPage('$base/preuves', 'Preuves certifiées', (_, _) => const ProofsScreen()),
  AppPage('$base/validations', 'Validations', (_, _) => const ValidationsScreen()),
  AppPage('$base/immersion', 'Maquette 3D / BIM', (_, _) => const ImmersionScreen()),
  AppPage('$base/configurateur', 'Configurateur', (_, _) => const ConfiguratorListScreen()),
  AppPage('$base/configurateur/:id', 'Configurateur', (_, s) => ConfiguratorScreen(modelId: s.pathParameters['id']!)),
  AppPage('$base/live', 'Live, 360° et drone', (_, _) => const LiveScreen()),
  AppPage('$base/messagerie', 'Messagerie', (context, s) => _ProjectMessaging(openConversationId: _q(s, 'c')), top: true),
  AppPage('$base/appels', 'Appels', (_, s) => CallsScreen(openCallId: _q(s, 'call'))),
  AppPage('$base/batiment', 'Mon bâtiment', (_, _) => const BuildingScreen()),
  AppPage('$base/energie', 'Énergie et confort', (_, _) => const EnergyScreen()),
  AppPage('$base/sav', 'SAV et garanties', (_, _) => const SupportListScreen()),
  AppPage('$base/sav/:id', 'Demande SAV', (_, s) => TicketDetailScreen(ticketId: s.pathParameters['id']!)),
  AppPage('$base/tranquillite', 'Dossier Tranquillité', (_, _) => const TranquilliteScreen()),
  AppPage('$base/avis', 'Mon avis', (_, _) => const ReviewScreen()),
  AppPage('$base/avis/:projectId', 'Mon avis', (_, s) => ReviewScreen(projectId: s.pathParameters['projectId'])),
  AppPage('$base/parrainage', 'Parrainage', (_, _) => const ReferralScreen()),
  AppPage('$base/notifications', 'Notifications', (_, _) => const NotificationsScreen()),
  AppPage(
    '$base/compte',
    'Mon compte',
    (_, s) => AccountScreen(withPrivacy: true, initialTab: accountTabFor(s.uri.queryParameters), mfaRequired: _q(s, 'mfa') == 'obligatoire'),
  ),
  AppPage('$base/documentation', 'Documentation', (_, s) => DocsScreen(space: 'client', docId: _q(s, 'doc'), route: _q(s, 'route'))),
  AppPage('$base/menu', 'Plus', (_, _) => const MenuGrid(sections: sections), top: true),
];

GoRouter buildRouter(GlobusServices services) {
  return buildGlobusRouter(
    services: services,
    base: base,
    home: '$base/dashboard',
    pages: [
      ...pages,
      AppPage(base, 'Tableau de bord', (_, _) => const DashboardScreen(), top: true),
    ],
    shell: (context, state, child) => GlobusShell(
      state: state,
      pages: pages,
      sections: sections,
      tabs: tabs,
      base: base,
      topbar: const ProjectSwitcher(),
      child: child,
    ),
  );
}

class _ProjectMessaging extends StatelessWidget {
  const _ProjectMessaging({this.openConversationId});
  final String? openConversationId;

  @override
  Widget build(BuildContext context) {
    final project = context.watch<ClientProjects>().project;
    return ConversationsScreen(projectId: project?.s('id'), openConversationId: openConversationId);
  }
}

class _ProjectAgenda extends StatelessWidget {
  const _ProjectAgenda({this.openEventId});
  final String? openEventId;

  @override
  Widget build(BuildContext context) {
    final project = context.watch<ClientProjects>().project;
    return AgendaScreen(projectId: project?.s('id'), canCreate: false, canRequest: true, openEventId: openEventId);
  }
}
