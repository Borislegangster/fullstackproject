import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_core/testing.dart';
import 'package:globus_field/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _fieldConfig = GlobusConfig(app: GlobusApp.field, apiUrl: 'https://globus.test');

Map<String, dynamic> _worker(List<String> permissions, {List<String> spaces = const ['erp']}) => {
  ...meJson(spaces: spaces),
  'email': 'chef@globus.test',
  'first_name': 'Paul',
  'last_name': 'Essomba',
  'full_name': 'Paul Essomba',
  'roles': ['CHEF_CHANTIER'],
  'permissions': permissions,
};

/// Serveur simulé : chef de chantier affecté au chantier « Villa Bonapriso ».
FakeApi fieldServer(List<String> permissions, {List<String> spaces = const ['erp']}) {
  final me = _worker(permissions, spaces: spaces);
  final fake = FakeApi();
  fake
    ..on('POST', '/auth/login', (_) => (200, {'access_token': 'A', 'refresh_token': 'R', 'user': me}))
    ..on('GET', '/auth/me', (_) => (200, me))
    ..on('POST', '/auth/logout', (_) => (200, {'status': 'ok'}))
    ..on('GET', '/notifications/unread-count', (_) => (200, {'unread': 0}))
    ..on(
      'GET',
      '/projects',
      (_) => (
        200,
        {
          'items': [
            {
              'id': 'p1',
              'code': 'GE-2026-001',
              'name': 'Villa Bonapriso',
              'status': 'execution',
              'progress_pct': '42.5',
              'city': 'Douala',
              'end_planned': '2027-03-30',
            },
            {'id': 'p9', 'code': 'GE-2025-009', 'name': 'Ancien chantier', 'status': 'clos'},
          ],
          'total': 2,
        },
      ),
    )
    ..on(
      'GET',
      '/projects/p1/tasks',
      (_) => (
        200,
        {
          'items': [
            {'id': 't1', 'title': 'Coffrage poteaux R+1', 'status': 'in_progress', 'progress_pct': '60', 'end_planned': '2026-10-20', 'version': 3},
          ],
          'total': 1,
        },
      ),
    )
    ..on(
      'GET',
      '/projects/p1/kpis',
      (_) => (200, {'tasks_late': 1, 'tasks_total': 48, 'incidents_open': 0, 'health': 'on_track', 'next_milestones': <Object>[]}),
    )
    ..on('GET', '/projects/p1/bim/zones', (_) => (200, <Object>[]))
    ..on('GET', '/auth/mfa/factors', (_) => (200, <Object>[]));
  return fake;
}

Future<Directory> _tempDir() async {
  final dir = await Directory.systemTemp.createTemp('globus_field_test_');
  addTearDown(() async {
    try {
      await dir.delete(recursive: true);
    } catch (_) {}
  });
  return dir;
}

/// Laisse s'exécuter les entrées-sorties réelles (file hors ligne chiffrée sur disque) entre deux images :
/// `pumpAndSettle` seul ne les fait pas avancer (temps simulé).
Future<void> settle(WidgetTester tester, [int rounds = 25]) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> pumpField(WidgetTester tester, FakeApi fake, Directory dir) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    GlobusFieldApp(
      config: _fieldConfig,
      services: fakeServices(fake, app: GlobusApp.field),
      offlineDirectory: () async => dir,
    ),
  );
  await settle(tester);
}

Future<void> login(WidgetTester tester) async {
  await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'chef@globus.test');
  await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
  await tester.pump();
  await tester.tap(find.text('Se connecter'));
  await settle(tester);
}

Future<void> openMenu(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Menu'));
  await settle(tester, 8);
}

/// Libellés du menu latéral (liste paresseuse : parcourue jusqu'en bas).
Future<Set<String>> drawerEntries(WidgetTester tester) async {
  final seen = <String>{};
  final scrollable = find.descendant(of: find.byType(NavigationDrawer), matching: find.byType(Scrollable)).first;
  for (var i = 0; i < 12; i++) {
    for (final t in find.descendant(of: find.byType(NavigationDrawer), matching: find.byType(Text)).evaluate()) {
      final data = (t.widget as Text).data;
      if (data != null) seen.add(data);
    }
    await tester.drag(scrollable, const Offset(0, -300));
    await tester.pump(const Duration(milliseconds: 200));
  }
  return seen;
}

void main() {
  const chef = [
    'projects:read',
    'planning:read',
    'site:report',
    'qhse:write',
    'deliveries:read',
    'deliveries:receive',
    'documents:read',
    'chat:use',
    'attendance:self',
  ];

  testWidgets('chef de chantier : accueil du chantier affecté, actions rapides et menu filtrés par permissions', (tester) async {
    final fake = fieldServer(chef);
    final dir = await tester.runAsync(_tempDir);
    await pumpField(tester, fake, dir!);
    expect(find.text('GLOBUS Terrain'), findsOneWidget);
    await login(tester);

    expect(fake.requests.firstWhere((r) => r.path == '/auth/login').headers['X-Client-App'], 'mobile-field');
    expect(find.text('Villa Bonapriso'), findsWidgets);
    expect(find.text('GE-2026-001 — Villa Bonapriso'), findsOneWidget, reason: 'sélecteur de chantier (chantiers archivés exclus)');
    expect(find.text('43$nbsp%'), findsOneWidget);
    for (final action in ['Scanner un QR', 'Rapport vocal', 'Journal du jour', 'Incident QHSE', 'Réception', 'Pointage']) {
      expect(find.text(action), findsOneWidget, reason: action);
    }
    expect(find.text('Stock chantier'), findsNothing, reason: 'pas de droit inventory:*');
    final page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
    await tester.scrollUntilVisible(find.text('Coffrage poteaux R+1'), 250, scrollable: page);
    expect(find.text('Coffrage poteaux R+1'), findsOneWidget);

    await openMenu(tester);
    final seen = await drawerEntries(tester);
    for (final item in [
      'Mes tâches',
      'Journal de chantier',
      'Plans et maquette',
      'Livraisons',
      'QHSE',
      'Pointage',
      'Mon espace RH',
      'Messagerie',
      'Synchronisation',
      'Documentation',
    ]) {
      expect(seen, contains(item), reason: item);
    }
    for (final hidden in ['Stock chantier', 'Matériel et engins', 'SAV et entretien', 'Issues BIM', 'Appels', 'Agenda']) {
      expect(seen, isNot(contains(hidden)), reason: '$hidden : permission absente');
    }
  });

  testWidgets('incident signalé hors ligne : conservé sur le téléphone puis envoyé au retour du réseau', (tester) async {
    final fake = fieldServer(chef);
    final dir = await tester.runAsync(_tempDir);
    await pumpField(tester, fake, dir!);
    await login(tester);

    await tester.tap(find.text('Incident QHSE'));
    await settle(tester, 8);
    expect(find.text('Signaler un incident'), findsWidgets);
    fake.offline = true;
    await tester.enterText(find.widgetWithText(TextField, 'Que s\'est-il passé ? *'), 'Garde-corps manquant au R+1');
    await tester.pump();
    final send = find.text('Envoyer le signalement');
    await tester.scrollUntilVisible(send, 250, scrollable: find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first);
    await tester.tap(send);
    await settle(tester, 40);
    expect(find.textContaining('Incident enregistré sur le téléphone'), findsOneWidget);
    expect(fake.requests.where((r) => r.path == '/sync/push'), isEmpty);

    // Retour du réseau : la file part, sans doublon.
    Map<String, dynamic>? pushed;
    fake
      ..offline = false
      ..on('POST', '/sync/push', (r) {
        final m = ((r.body as Map)['mutations'] as List).single as Map<String, dynamic>;
        pushed = m;
        return (
          200,
          {
            'results': [
              {'client_mutation_id': m['client_mutation_id'], 'status': 'applied', 'id': 'srv-1'},
            ],
          },
        );
      });
    await tester.tap(find.text('Chantier').last);
    await settle(tester, 8);
    await openMenu(tester);
    await tester.tap(find.text('Synchronisation'));
    await settle(tester, 8);
    expect(find.text('Incident : Garde-corps manquant au R+1'), findsOneWidget);
    await tester.tap(find.text('Synchroniser maintenant'));
    await settle(tester, 40);
    expect(pushed?['entity'], 'incident');
    expect((pushed?['payload'] as Map)['project_id'], 'p1');
    // Canal déclaré selon l'état réseau connu du téléphone (surveillance réseau inactive en test : « mobile »).
    expect((pushed?['payload'] as Map)['source'], 'mobile');
    expect((pushed?['payload'] as Map)['title'], 'Garde-corps manquant au R+1');
    expect(find.text('Tout est synchronisé'), findsOneWidget);
  });

  testWidgets('compte client : accès refusé à l\'application du personnel', (tester) async {
    final fake = fieldServer(const ['client:pay'], spaces: const ['client']);
    final dir = await tester.runAsync(_tempDir);
    await pumpField(tester, fake, dir!);
    await login(tester);
    expect(find.text('Accès non autorisé à GLOBUS Terrain'), findsOneWidget);
  });
}
