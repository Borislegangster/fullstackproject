// Parcours réel de l'application client contre l'API de développement (backend/scripts/dev_server.py --seed).
//
// Émulateur Android (captures enregistrées sur le poste par le pilote test_driver/integration_test.dart) :
//   adb reverse tcp:8010 tcp:8010
//   flutter drive --driver=test_driver/integration_test.dart --target=integration_test/client_journey_test.dart \
//     -d emulator-5554 --dart-define=GLOBUS_API_URL=http://localhost:8010
// Sans pilote : flutter test integration_test -d <appareil> --dart-define=GLOBUS_API_URL=…
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_client/main.dart';
import 'package:globus_core/globus_core.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _api = String.fromEnvironment('GLOBUS_API_URL', defaultValue: 'http://127.0.0.1:8010');
const _email = String.fromEnvironment('DEMO_EMAIL', defaultValue: 'client@globus.demo');
const _password = String.fromEnvironment('DEMO_PASSWORD', defaultValue: 'Globus!Demo2026');

late IntegrationTestWidgetsFlutterBinding _binding;
var _surfaceReady = false;

/// Attend qu'un élément apparaisse (API réelle, émulateur lent) ; échoue après [seconds].
// Délai large : émulateur logiciel et serveur de développement sur le même poste (réponses parfois très lentes).
Future<void> _until(WidgetTester tester, Finder finder, {int seconds = 150}) async {
  for (var i = 0; i < seconds * 4; i++) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  await _shot(tester, 'echec-${DateTime.now().millisecondsSinceEpoch}');
  throw TestFailure('Non affiché après $seconds s : $finder');
}

Future<void> _wait(WidgetTester tester, [int seconds = 3]) async {
  for (var i = 0; i < seconds * 4; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

Future<void> _shot(WidgetTester tester, String name) async {
  try {
    if (!_surfaceReady) {
      await _binding.convertFlutterSurfaceToImage();
      _surfaceReady = true;
    }
    await tester.pump();
    await _binding.takeScreenshot(name);
  } catch (_) {
    // Plateforme ou mode sans capture (flutter test sans pilote) : le parcours continue.
  }
}

Future<void> _open(WidgetTester tester, String label) async {
  final target = find.text(label).last;
  await tester.ensureVisible(target);
  await tester.tap(target);
  await _wait(tester, 2);
}

void main() {
  _binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('client : connexion, tableau de bord et toutes les rubriques avec les données réelles', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final config = GlobusConfig(app: GlobusApp.client, apiUrl: _api, environment: 'development');
    final services = GlobusServices.create(config, store: MemorySessionStore(), cache: MemoryCache());
    await tester.pumpWidget(GlobusClientApp(config: config, services: services));
    await _until(tester, find.text('Connexion'));
    await _shot(tester, '01-connexion');

    // Saisie simulée : le clavier du système est remplacé pendant le parcours (sinon le texte saisi n'arrive pas en
    // mode profil / release).
    tester.testTextInput.register();
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), _email);
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), _password);
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await _until(tester, find.byWidgetPredicate((w) => w is Text && (w.data == 'Avancement global' || w.data == 'Double authentification (MFA)')));

    // Profil client à MFA obligatoire (mode « warn » en local) : orientation vers la sécurité, puis navigation libre.
    if (find.text('Double authentification (MFA)').evaluate().isNotEmpty) {
      await _shot(tester, '02-mfa-orientation');
      await tester.tap(find.text('Accueil'));
    }
    await _until(tester, find.text('Avancement global'));
    await _until(tester, find.text('Indice de confiance'));
    await _shot(tester, '03-tableau-de-bord');

    for (final (tab, expected) in [('Chantier', 'Suivi du chantier'), ('Finances', 'Appels de fonds'), ('Messages', 'Nouvelle conversation')]) {
      await _open(tester, tab);
      await _until(tester, find.textContaining(expected));
      await _shot(tester, '04-${tab.toLowerCase()}');
    }

    final rubriques = <(String, String)>[
      ('Passeport projet', 'Identité du projet'),
      ('Planning', 'Calendrier des travaux'),
      ('Mes rendez-vous', "Aujourd'hui"),
      ('Documents', 'Seule la version en vigueur'),
      ('Preuves certifiées', 'Comment ça marche ?'),
      ('Validations', 'Historique'),
      ('Maquette 3D / BIM', 'Explorez votre projet'),
      ('Configurateur', 'Configurateur de finitions'),
      ('Live, 360° et drone', 'Live'),
      ('Appels', 'Historique'),
      ('Mon bâtiment', "Carnet d'entretien"),
      ('Énergie et confort', 'Votre projet'),
      ('SAV et garanties', 'Signalez un désordre'),
      ('Dossier Tranquillité', 'Dossier Tranquillité'),
      ('Mon avis', 'Votre avis'),
      ('Notifications', 'Mes notifications'),
      ('Mon compte', 'Informations personnelles'),
      ('Documentation', "Rechercher dans l'aide"),
    ];
    for (final (i, (menu, expected)) in rubriques.indexed) {
      await _open(tester, 'Plus');
      await _open(tester, menu);
      await _until(tester, find.byWidgetPredicate((w) => w is Text && ((w.data ?? '').contains(expected) || w.data == 'Une erreur est survenue')));
      await _wait(tester, 1);
      await _shot(tester, '05-${(i + 1).toString().padLeft(2, '0')}-${menu.toLowerCase().replaceAll(RegExp(r'[^a-zà-ÿ0-9]+'), '-')}');
      expect(find.text('Une erreur est survenue'), findsNothing, reason: '$menu : écran en erreur');
      expect(find.text('Accès non autorisé'), findsNothing, reason: '$menu : accès refusé');
    }

    // Déconnexion : retour à l'écran de connexion, données de l'appareil effacées.
    await _open(tester, 'Plus');
    await tester.scrollUntilVisible(find.text('Se déconnecter'), 300, scrollable: find.byType(Scrollable).last);
    // Bandeau de notification éventuel au-dessus du bouton : fermé avant de toucher.
    for (final m in tester.stateList<ScaffoldMessengerState>(find.byType(ScaffoldMessenger))) {
      m.clearSnackBars();
    }
    await _wait(tester, 1);
    await tester.tap(find.text('Se déconnecter'));
    await _until(tester, find.text('Connexion'));
  });
}
