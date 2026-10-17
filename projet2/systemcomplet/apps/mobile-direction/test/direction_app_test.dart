import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_core/testing.dart';
import 'package:globus_direction/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _config = GlobusConfig(app: GlobusApp.direction, apiUrl: 'https://globus.test');

Map<String, dynamic> _director(List<String> permissions) => {
  ...meJson(spaces: const ['erp']),
  'email': 'direction@globus.test',
  'first_name': 'Diane',
  'last_name': 'Ngono',
  'full_name': 'Diane Ngono',
  'roles': ['DIRECTION'],
  'permissions': permissions,
  'mfa_enabled': true,
};

const _perms = ['dashboard:direction', 'projects:read', 'finance:read', 'finance:approve', 'procurement:approve', 'procurement:read', 'chat:use'];

FakeApi directionServer({List<String> permissions = _perms}) {
  final me = _director(permissions);
  final fake = FakeApi();
  fake
    ..on('POST', '/auth/login', (_) => (200, {'access_token': 'A', 'refresh_token': 'R', 'user': me}))
    ..on('GET', '/auth/me', (_) => (200, me))
    ..on('GET', '/notifications/unread-count', (_) => (200, {'unread': 0}))
    ..on(
      'GET',
      '/reports/dashboard',
      (_) => (
        200,
        {
          'generated_at': '2026-10-17T07:00:00Z',
          'projects': {
            'total': 12,
            'active': 9,
            'health': {'on_track': 6, 'at_risk': 2, 'critical': 1},
            'avg_progress': 47.5,
          },
          'planning': {'late_milestones': 3},
          'qhse': {'open_serious_incidents': 1},
          'approvals': {'purchase_requests': 2, 'payments': 1, 'situations': 0, 'client_decisions_pending': 4, 'draft_requests': 5},
          'support': {'open_tickets': 7, 'sla_breached': 2},
          'finance': {
            'portfolio_value': '1250000000',
            'invoiced': '640000000',
            'receivable': '85000000',
            'overdue': '12000000',
            'payable': '43000000',
            'collected_this_month': '38000000',
            'cashflow': {
              'series': [
                {'month': '2026-11', 'inflow': '90000000', 'outflow': '70000000', 'net': '20000000', 'cumulative': '120000000'},
                {'month': '2026-12', 'inflow': '60000000', 'outflow': '80000000', 'net': '-20000000', 'cumulative': '100000000'},
              ],
            },
            'margins': [
              {
                'project_id': 'p1',
                'code': 'GE-2026-001',
                'name': 'Villa Bonapriso',
                'revenue': '85000000',
                'committed': '40000000',
                'spent': '30000000',
                'forecast_cost': '79000000',
                'gross_margin': '6000000',
                'gross_margin_pct': 7.1,
              },
            ],
          },
        },
      ),
    )
    ..on('GET', '/procurement/approvals/pending', (_) => (200, <Object>[]))
    ..on(
      'GET',
      '/payments',
      (r) => (
        200,
        {
          'items': [
            if (r.query['status'] == 'awaiting_approval')
              {
                'id': 'pay1',
                'number': 'PAY-2026-00042',
                'direction': 'out',
                'counterparty_type': 'supplier',
                'counterparty_label': 'Cimencam',
                'amount': '4500000',
                'currency': 'XAF',
                'method': 'bank_transfer',
                'status': 'awaiting_approval',
                'created_at': '2026-10-16T09:00:00Z',
              },
          ],
          'total': 1,
        },
      ),
    )
    ..on(
      'GET',
      '/payments/pay1',
      (_) => (
        200,
        {
          'id': 'pay1',
          'number': 'PAY-2026-00042',
          'direction': 'out',
          'counterparty_type': 'supplier',
          'counterparty_label': 'Cimencam',
          'amount': '4500000',
          'currency': 'XAF',
          'method': 'bank_transfer',
          'status': 'awaiting_approval',
          'created_at': '2026-10-16T09:00:00Z',
          'allocations': <Object>[],
        },
      ),
    )
    ..on('GET', '/decisions', (_) => (200, {'items': <Object>[], 'total': 0}))
    ..on('GET', '/procurement/orders', (_) => (200, {'items': <Object>[], 'total': 0}));
  return fake;
}

Future<void> pumpDirection(WidgetTester tester, FakeApi fake) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    GlobusDirectionApp(
      config: _config,
      services: fakeServices(fake, app: GlobusApp.direction),
    ),
  );
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'direction@globus.test');
  await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
  await tester.pump();
  await tester.tap(find.text('Se connecter'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('direction : tableau de bord (portefeuille, approbations, trésorerie, marges)', (tester) async {
    final fake = directionServer();
    await pumpDirection(tester, fake);
    expect(fake.requests.firstWhere((r) => r.path == '/auth/login').headers['X-Client-App'], 'mobile-direction');
    expect(find.text('Bonjour Diane'), findsOneWidget);
    expect(find.text('9 / 12'), findsOneWidget);
    expect(find.text('Jalons en retard'), findsOneWidget);
    final page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
    for (final text in [
      'Paiements à approuver',
      money(1250000000),
      'Trésorerie prévisionnelle (6 mois)',
      'GE-2026-001 — Villa Bonapriso',
      'Santé des chantiers actifs',
    ]) {
      await tester.scrollUntilVisible(find.text(text), 250, scrollable: page);
      expect(find.text(text), findsOneWidget, reason: text);
    }
    expect(find.text(percent(7.1, 1)), findsOneWidget, reason: 'marge faible signalée');
  });

  testWidgets('validations : approbation d\'un paiement depuis le mobile (formulaire généré)', (tester) async {
    final fake = directionServer();
    Map<String, dynamic>? body;
    fake.on('POST', '/payments/pay1/approve', (r) {
      body = (r.body as Map?)?.cast<String, dynamic>() ?? {};
      return (200, {'id': 'pay1', 'status': 'pending', 'approved_at': '2026-10-17T08:00:00Z'});
    });
    await pumpDirection(tester, fake);
    await tester.tap(find.text('Validations').last);
    await tester.pumpAndSettle();
    expect(find.text('Achats'), findsOneWidget);
    expect(find.text('Situations'), findsNothing, reason: 'pas de droit subcontracting:validate');
    await tester.tap(find.text('Paiements'));
    await tester.pumpAndSettle();
    expect(find.text('PAY-2026-00042 · Cimencam'), findsOneWidget);
    await tester.tap(find.text('PAY-2026-00042 · Cimencam'));
    await tester.pumpAndSettle();
    expect(find.text(money('4500000', 'XAF')), findsWidgets);
    await tester.tap(find.text('Approuver').first);
    await tester.pumpAndSettle();
    expect(find.text('Motif de dérogation (si contrôle bloquant)'), findsOneWidget);
    await tester.tap(find.text('Approuver').last);
    await tester.pumpAndSettle();
    expect(body, isNotNull, reason: 'POST /payments/pay1/approve envoyé');
    expect(body!['override_reason'], isNull, reason: 'dérogation facultative non saisie');
    expect(find.text('Paiement approuvé'), findsOneWidget);
  });

  testWidgets('menu filtré par les permissions (rubriques sans droit absentes)', (tester) async {
    final fake = directionServer();
    await pumpDirection(tester, fake);
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    final seen = <String>{};
    final scrollable = find.descendant(of: find.byType(NavigationDrawer), matching: find.byType(Scrollable)).first;
    for (var i = 0; i < 14; i++) {
      for (final t in find.descendant(of: find.byType(NavigationDrawer), matching: find.byType(Text)).evaluate()) {
        final data = (t.widget as Text).data;
        if (data != null) seen.add(data);
      }
      await tester.drag(scrollable, const Offset(0, -300));
      await tester.pump(const Duration(milliseconds: 200));
    }
    for (final item in ['Tableau de bord', 'Validations', 'Rapport de direction', 'Chantiers', "Demandes d'achat", 'Paiements', 'Messagerie', 'Mon compte']) {
      expect(seen, contains(item), reason: item);
    }
    for (final hidden in ['Fournisseurs', 'Litiges', 'Leads', 'Personnel', 'Utilisateurs', "Journal d'audit", 'Sécurité']) {
      expect(seen, isNot(contains(hidden)), reason: '$hidden : permission absente');
    }
  });
}
