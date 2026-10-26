import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'field_state.dart';
import 'screens/daily_log.dart';
import 'screens/equipment.dart';
import 'screens/home.dart';
import 'screens/hr.dart';
import 'screens/media.dart';
import 'screens/ocr.dart';
import 'screens/petty_cash.dart';
import 'screens/plans.dart';
import 'screens/qhse.dart';
import 'screens/receipt.dart';
import 'screens/sav.dart';
import 'screens/scanner.dart';
import 'screens/stock.dart';
import 'screens/sync.dart';
import 'screens/tasks.dart';
import 'screens/voice.dart';
import 'screens/zone.dart';

/// Même espace que l'ERP web : les liens des notifications (`/erp/...`) ouvrent l'écran mobile correspondant.
const base = '/erp';

/// Menu unique du personnel : chaque entrée n'apparaît que si le rôle / le métier en donne le droit
/// (permissions du serveur), comme le menu de l'ERP web.
const sections = <NavSection>[
  NavSection(title: 'Chantier', [
    NavItem('$base/terrain', 'Accueil chantier', Icons.home_work_outlined),
    NavItem('$base/terrain/taches', 'Mes tâches', Icons.task_alt, anyPerms: ['projects:read', 'planning:read', 'site:report']),
    NavItem('$base/planning', 'Planning', Icons.view_timeline_outlined, perms: ['planning:read']),
    NavItem('$base/terrain/journal', 'Journal de chantier', Icons.menu_book_outlined, anyPerms: ['site:report', 'projects:read']),
    NavItem('$base/terrain/photos', 'Photos et vidéos', Icons.photo_library_outlined, anyPerms: ['site:report', 'projects:read']),
    NavItem('$base/terrain/rapport-vocal', 'Rapports vocaux', Icons.mic_none, anyPerms: ['site:report']),
    NavItem('$base/terrain/plans', 'Plans et maquette', Icons.map_outlined, perms: ['documents:read']),
    NavItem('$base/hub/issues', 'Issues BIM', Icons.report_problem_outlined, perms: ['bim:read']),
    NavItem('$base/terrain/scanner', 'Scanner', Icons.qr_code_scanner),
    NavItem('$base/terrain/synchronisation', 'Synchronisation', Icons.sync),
  ]),
  NavSection(title: 'Logistique', [
    NavItem('$base/livraisons', 'Livraisons', Icons.local_shipping_outlined, perms: ['deliveries:read']),
    NavItem(
      '$base/livraisons/lecture',
      'Lecture de documents (IA)',
      Icons.document_scanner_outlined,
      anyPerms: ['deliveries:receive', 'billing:write', 'documents:write'],
    ),
    NavItem('$base/stocks', 'Stock chantier', Icons.inventory_2_outlined, perms: ['inventory:read']),
    NavItem('$base/materiel', 'Matériel et engins', Icons.construction_outlined, perms: ['equipment:read']),
    NavItem('$base/caisse', 'Ma petite caisse', Icons.account_balance_wallet_outlined, feature: 'petty_cash'),
  ]),
  NavSection(title: 'Sécurité et SAV', [
    NavItem('$base/qhse', 'QHSE', Icons.health_and_safety_outlined, anyPerms: ['qhse:read', 'qhse:write', 'site:report']),
    NavItem('$base/sav', 'SAV et entretien', Icons.support_agent, anyPerms: ['support:read', 'support:write']),
  ]),
  NavSection(title: 'Personnel', [
    NavItem('$base/terrain/pointage', 'Pointage', Icons.badge_outlined, anyPerms: ['attendance:self', 'hr:write', 'site:report']),
    NavItem('$base/rh/mon-espace', 'Mon espace RH', Icons.person_pin_outlined, perms: ['attendance:self']),
  ]),
  NavSection(title: 'Échanges', [
    NavItem('$base/messagerie', 'Messagerie', Icons.forum_outlined, perms: ['chat:use']),
    NavItem('$base/appels', 'Appels', Icons.call_outlined, perms: ['calls:use']),
    NavItem('$base/agenda', 'Agenda', Icons.event_outlined, perms: ['agenda:read']),
    NavItem('$base/notifications', 'Notifications', Icons.notifications_outlined),
    NavItem('$base/compte', 'Mon compte', Icons.person_outline),
  ]),
  NavSection(title: 'Aide', [NavItem('$base/documentation', 'Documentation', Icons.menu_book_outlined)]),
];

const tabs = <NavItem>[
  NavItem('$base/terrain', 'Chantier', Icons.home_work_outlined),
  NavItem('$base/terrain/taches', 'Tâches', Icons.task_alt, anyPerms: ['projects:read', 'planning:read', 'site:report']),
  NavItem('$base/terrain/scanner', 'Scanner', Icons.qr_code_scanner),
  NavItem('$base/messagerie', 'Messages', Icons.forum_outlined, perms: ['chat:use']),
  NavItem('$base/menu', 'Plus', Icons.apps),
];

String? _q(GoRouterState s, String key) => s.uri.queryParameters[key];

/// Code transmis par le scanner (`extra`) ou par un lien (`?code=`).
String? _code(GoRouterState s) => s.extra is String ? s.extra! as String : _q(s, 'code');

/// Pages (chemins identiques au web ; détails déclarés avant les motifs `:id`).
final pages = <AppPage>[
  AppPage('$base/terrain', 'Chantier', (_, _) => const FieldHomeScreen(), top: true),
  AppPage('$base/terrain/taches', 'Mes tâches', (_, s) => TasksScreen(zoneId: _q(s, 'zone')), top: true),
  AppPage('$base/terrain/taches/:id', 'Tâche', (_, s) => TaskDetailScreen(taskId: s.pathParameters['id']!)),
  AppPage('$base/planning', 'Planning', (_, _) => const FieldPlanningScreen()),
  AppPage('$base/terrain/journal', 'Journal de chantier', (_, _) => const DailyLogsScreen()),
  AppPage('$base/terrain/photos', 'Photos et vidéos', (_, _) => const PhotosScreen()),
  AppPage('$base/terrain/rapport-vocal', 'Rapports vocaux', (_, _) => const VoiceReportsScreen()),
  AppPage('$base/terrain/plans', 'Plans et maquette', (_, _) => const PlansScreen()),
  AppPage('$base/terrain/zones/scan', 'Zone', (_, s) => ZoneScreen(code: _code(s))),
  AppPage('$base/terrain/zones/:id', 'Zone', (_, s) => ZoneScreen(zoneId: s.pathParameters['id'])),
  AppPage('$base/terrain/scanner', 'Scanner', (_, _) => const ScannerScreen(), top: true),
  AppPage('$base/terrain/synchronisation', 'Synchronisation', (_, _) => const SyncScreen()),
  AppPage('$base/terrain/pointage', 'Pointage', (_, s) => AttendanceScreen(siteCode: _code(s))),
  AppPage('$base/hub/issues', 'Issues BIM', (_, _) => const IssuesScreen()),
  AppPage('$base/hub/issues/:id', 'Issue BIM', (_, s) => IssueScreen(issueId: s.pathParameters['id']!)),
  AppPage('$base/livraisons', 'Livraisons', (_, _) => const DeliveriesScreen()),
  AppPage('$base/livraisons/lecture', 'Lecture de documents', (_, _) => const OcrScreen()),
  AppPage('$base/livraisons/receptions', 'Réceptions', (_, _) => const DeliveriesScreen()),
  AppPage(
    '$base/livraisons/receptions/nouvelle',
    'Réception de livraison',
    (_, s) => _NeedsCode(
      code: _code(s),
      builder: (code) => ReceiptFormScreen(code: code),
    ),
  ),
  AppPage('$base/livraisons/receptions/:id', 'Bon de réception', (_, s) => ReceiptDetailScreen(id: s.pathParameters['id']!)),
  AppPage('$base/livraisons/:id', 'Livraison', (_, s) => DeliveryScreen(id: s.pathParameters['id']!)),
  AppPage('$base/stocks', 'Stock chantier', (_, _) => const StockScreen()),
  AppPage('$base/materiel', 'Matériel et engins', (_, _) => const EquipmentScreen()),
  AppPage('$base/caisse', 'Ma petite caisse', (_, _) => const PettyCashScreen()),
  AppPage(
    '$base/materiel/scan',
    'Matériel',
    (_, s) => _NeedsCode(
      code: _code(s),
      builder: (code) => EquipmentDetailScreen(code: code, routed: true),
    ),
  ),
  AppPage('$base/materiel/:id', 'Matériel', (_, s) => EquipmentDetailScreen(id: s.pathParameters['id'], routed: true)),
  AppPage('$base/qhse', 'QHSE', (_, _) => const QhseScreen()),
  AppPage('$base/qhse/incidents', 'QHSE', (_, _) => const QhseScreen()),
  AppPage('$base/qhse/incidents/nouveau', 'Signaler un incident', (_, s) => const IncidentFormScreen()),
  AppPage('$base/qhse/incidents/:id', 'Incident', (_, s) => IncidentScreen(id: s.pathParameters['id']!)),
  AppPage('$base/qhse/actions', 'QHSE', (_, _) => const QhseScreen()),
  AppPage('$base/qhse/actions/:id', 'Action corrective', (_, s) => ActionScreen(id: s.pathParameters['id']!, routed: true)),
  AppPage('$base/sav', 'SAV et entretien', (_, _) => const SavScreen()),
  AppPage('$base/sav/:id', 'Ticket SAV', (_, s) => TicketDetailScreen(ticketId: s.pathParameters['id']!, staff: true)),
  AppPage('$base/rh/mon-espace', 'Mon espace RH', (_, _) => const MySpaceScreen()),
  AppPage('$base/chantiers', 'Chantier', (_, _) => const FieldHomeScreen()),
  AppPage('$base/chantiers/:id', 'Chantier', (_, s) => _OpenSite(projectId: s.pathParameters['id']!)),
  AppPage('$base/chantiers/:id/:tab', 'Chantier', (_, s) => _OpenSite(projectId: s.pathParameters['id']!)),
  AppPage('$base/messagerie', 'Messagerie', (_, s) => _SiteMessaging(openConversationId: _q(s, 'c')), top: true),
  AppPage('$base/appels', 'Appels', (_, s) => CallsScreen(openCallId: _q(s, 'call'))),
  AppPage('$base/agenda', 'Agenda', (_, s) => _SiteAgenda(openEventId: _q(s, 'event'))),
  AppPage('$base/notifications', 'Notifications', (_, _) => const NotificationsScreen()),
  AppPage('$base/compte', 'Mon compte', (_, s) => AccountScreen(initialTab: _q(s, 'mfa') != null ? 1 : 0, mfaRequired: _q(s, 'mfa') == 'obligatoire')),
  AppPage('$base/documentation', 'Documentation', (_, s) => DocsScreen(space: 'erp', docId: _q(s, 'doc'), route: _q(s, 'route'))),
  AppPage('$base/menu', 'Plus', (_, _) => const MenuGrid(sections: sections), top: true),
];

GoRouter buildRouter(GlobusServices services) {
  return buildGlobusRouter(
    services: services,
    base: base,
    home: '$base/terrain',
    pages: [...pages, AppPage(base, 'Chantier', (_, _) => const FieldHomeScreen(), top: true)],
    shell: (context, state, child) => GlobusShell(
      state: state,
      pages: pages,
      sections: sections,
      tabs: tabs,
      base: base,
      topbar: const SiteSwitcher(),
      child: child,
    ),
  );
}

/// Écran ouvert sans code (lien incomplet) : saisie ou scan du code avant d'afficher la page.
class _NeedsCode extends StatefulWidget {
  const _NeedsCode({required this.code, required this.builder});
  final String? code;
  final Widget Function(String code) builder;
  @override
  State<_NeedsCode> createState() => _NeedsCodeState();
}

class _NeedsCodeState extends State<_NeedsCode> {
  late String? _code = widget.code;

  @override
  Widget build(BuildContext context) {
    final code = _code;
    if (code != null && code.isNotEmpty) return widget.builder(code);
    return EmptyView(
      icon: Icons.qr_code_scanner,
      title: 'Code requis',
      text: 'Scannez le QR ou saisissez le numéro imprimé.',
      action: FilledButton.icon(
        onPressed: () async {
          final value = await scanCode(context);
          if (value != null) setState(() => _code = value);
        },
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scanner'),
      ),
    );
  }
}

/// Lien `/erp/chantiers/{id}` : sélectionne ce chantier (s'il m'est affecté) puis affiche son accueil.
class _OpenSite extends StatefulWidget {
  const _OpenSite({required this.projectId});
  final String projectId;
  @override
  State<_OpenSite> createState() => _OpenSiteState();
}

class _OpenSiteState extends State<_OpenSite> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = context.read<FieldProjects>();
      if (state.projects?.any((p) => p.s('id') == widget.projectId) ?? false) state.select(widget.projectId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<FieldProjects>();
    if (state.projects != null && !state.projects!.any((p) => p.s('id') == widget.projectId)) {
      return const EmptyView(icon: Icons.lock_outline, title: 'Chantier non affecté', text: 'Ce chantier ne fait pas partie de vos affectations.');
    }
    return const FieldHomeScreen();
  }
}

class _SiteMessaging extends StatelessWidget {
  const _SiteMessaging({this.openConversationId});
  final String? openConversationId;

  @override
  Widget build(BuildContext context) {
    final project = context.watch<FieldProjects>().project;
    return ConversationsScreen(projectId: project?.s('id'), openConversationId: openConversationId);
  }
}

class _SiteAgenda extends StatelessWidget {
  const _SiteAgenda({this.openEventId});
  final String? openEventId;

  @override
  Widget build(BuildContext context) {
    final project = context.watch<FieldProjects>().project;
    return AgendaScreen(projectId: project?.s('id'), canCreate: context.can('agenda:write'), openEventId: openEventId);
  }
}
