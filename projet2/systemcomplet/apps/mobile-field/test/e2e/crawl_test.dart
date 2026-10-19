// Parcours exhaustif de l'application terrain contre l'API de développement (données de démonstration) :
// chaque rubrique du menu, sa première fiche, chaque formulaire et chaque action (ouverts puis refermés sans
// validation). Rapport et captures : build/parcours/terrain/. Ignoré sans --dart-define=GLOBUS_E2E_API.
//
//   python backend/scripts/dev_server_isolated.py --seed --port 8010
//   flutter test test/e2e/crawl_test.dart --dart-define=GLOBUS_E2E_API=http://127.0.0.1:8010
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_e2e/globus_e2e.dart';
import 'package:globus_field/app.dart';
import 'package:globus_field/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _api = String.fromEnvironment('GLOBUS_E2E_API');
const _email = String.fromEnvironment('DEMO_EMAIL', defaultValue: 'chef.chantier@globus.demo');
const _password = String.fromEnvironment('DEMO_PASSWORD', defaultValue: 'Globus!Demo2026');

/// Rubriques dépendant du matériel (appels WebRTC) : ouvertes sans exploration ; celles qui exigent caméra ou vue web
/// embarquée (absentes d'un test sans appareil) ne sont pas ouvertes.
const _noExplore = {'$base/appels'};
const _skip = {'$base/terrain/scanner'};

void main() {
  setUpAll(loadAppFonts);

  testWidgets(
    'terrain : parcours exhaustif',
    (tester) async {
      tester.view.physicalSize = const Size(430, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      // Chantier de démonstration le plus fourni (documents, incidents, matériel, SAV).
      final project = await tester.runAsync(() => e2eProjectId(_api, GlobusApp.field, _email, _password, code: 'PRJ-2026-00001'));
      SharedPreferences.setMockInitialValues({'globus.field.project': ?project});
      final services = e2eServices(GlobusApp.field, _api);
      final rootKey = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: rootKey,
          child: GlobusFieldApp(config: services.config, services: services),
        ),
      );
      final crawler = AppCrawler(tester, app: 'terrain', rootKey: rootKey)..install();
      try {
        await crawler.waitFor(find.text('Connexion'));
        await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), _email);
        await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), _password);
        await tester.pump();
        await tester.tap(find.text('Se connecter'));
        await crawler.waitFor(find.byWidgetPredicate((w) => w is Text && (w.data == 'Avancement du chantier' || w.data == 'Double authentification (MFA)')));
        await crawler.settle();

        for (final item in visibleItems(sections, crawler.me)) {
          if (_skip.contains(item.path)) continue;
          await crawler.visit(item.label, item.path, explore: !_noExplore.contains(item.path));
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
