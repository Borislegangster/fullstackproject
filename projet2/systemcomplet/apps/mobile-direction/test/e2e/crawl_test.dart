// Parcours exhaustif de l'application direction contre l'API de développement (données de démonstration) :
// chaque rubrique du menu, sa première fiche, chaque formulaire et chaque action (ouverts puis refermés sans
// validation). Rapport et captures : build/parcours/direction/. Ignoré sans --dart-define=GLOBUS_E2E_API.
//
//   python backend/scripts/dev_server_isolated.py --seed --port 8010
//   flutter test test/e2e/crawl_test.dart --dart-define=GLOBUS_E2E_API=http://127.0.0.1:8010
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_direction/app.dart';
import 'package:globus_direction/main.dart';
import 'package:globus_e2e/globus_e2e.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _api = String.fromEnvironment('GLOBUS_E2E_API');
const _email = String.fromEnvironment('DEMO_EMAIL', defaultValue: 'direction@globus.demo');
const _password = String.fromEnvironment('DEMO_PASSWORD', defaultValue: 'Globus!Demo2026');

/// Rubriques dépendant du matériel (appels WebRTC) : ouvertes sans exploration.
const _noExplore = {'$base/appels'};

void main() {
  setUpAll(loadAppFonts);

  testWidgets(
    'direction : parcours exhaustif',
    (tester) async {
      tester.view.physicalSize = const Size(430, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      SharedPreferences.setMockInitialValues({});
      final services = e2eServices(GlobusApp.direction, _api);
      final rootKey = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: rootKey,
          child: GlobusDirectionApp(config: services.config, services: services),
        ),
      );
      final crawler = AppCrawler(tester, app: 'direction', rootKey: rootKey)..install();
      try {
        await crawler.waitFor(find.text('Connexion'));
        await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), _email);
        await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), _password);
        await tester.pump();
        await tester.tap(find.text('Se connecter'));
        await crawler.waitFor(find.byWidgetPredicate((w) => w is Text && (w.data == 'Chantiers actifs' || w.data == 'Double authentification (MFA)')));
        await crawler.settle();

        for (final item in visibleItems(sections, crawler.me)) {
          await crawler.visit(item.label, item.path, explore: !_noExplore.contains(item.path));
        }
        // Fiche chantier : chaque onglet.
        await crawler.visit('Chantiers', '$base/chantiers', explore: false);
        final firstProject = find.byType(ListTile);
        if (firstProject.evaluate().isNotEmpty) {
          await tester.tap(firstProject.first, warnIfMissed: false);
          await crawler.settle();
          crawler.scan('Chantier › fiche');
          await crawler.shot('chantier-fiche');
          final tabs = find.byType(Tab).evaluate().map((e) => (e.widget as Tab).text).whereType<String>().toList();
          for (final t in tabs) {
            await tester.tap(find.widgetWithText(Tab, t).first, warnIfMissed: false);
            await crawler.settle();
            crawler.scan('Chantier › $t');
            await crawler.shot('chantier-$t');
            await crawler.exploreActions('Chantier › $t');
          }
        }
      } finally {
        crawler.uninstall();
      }
      final report = crawler.report();
      File('${crawler.shotsDir}/rapport.txt').writeAsStringSync(report);
      debugPrint(report);
      expect(crawler.findings, isEmpty, reason: report);
    },
    skip: _api.isEmpty,
    timeout: const Timeout(Duration(minutes: 45)),
  );
}
