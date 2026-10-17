// Parcours réel de l'application terrain contre l'API de développement (backend/scripts/dev_server.py --seed),
// compte de démonstration « chef de chantier ».
//
// Émulateur Android (captures enregistrées sur le poste par le pilote test_driver/integration_test.dart) :
//   adb reverse tcp:8010 tcp:8010
//   flutter drive --driver=test_driver/integration_test.dart --target=integration_test/field_journey_test.dart \
//     -d emulator-5554 --dart-define=GLOBUS_API_URL=http://localhost:8010
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_field/main.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _api = String.fromEnvironment('GLOBUS_API_URL', defaultValue: 'http://127.0.0.1:8010');
const _email = String.fromEnvironment('DEMO_EMAIL', defaultValue: 'chef.chantier@globus.demo');
const _password = String.fromEnvironment('DEMO_PASSWORD', defaultValue: 'Globus!Demo2026');

late IntegrationTestWidgetsFlutterBinding _binding;
var _surfaceReady = false;

const _errors = ['Une erreur est survenue', 'Accès non autorisé', 'Élément introuvable'];

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
    // Plateforme ou mode sans capture : le parcours continue.
  }
}

Future<void> _open(WidgetTester tester, String label) async {
  final target = find.text(label).last;
  await tester.ensureVisible(target);
  await tester.tap(target);
  await _wait(tester, 2);
}

String _slug(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-zà-ÿ0-9]+'), '-');

void main() {
  _binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('terrain : connexion du chef de chantier et toutes les rubriques avec les données réelles', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final config = GlobusConfig(app: GlobusApp.field, apiUrl: _api, environment: 'development');
    final services = GlobusServices.create(config, store: MemorySessionStore(), cache: MemoryCache());
    await tester.pumpWidget(GlobusFieldApp(config: config, services: services));
    await _until(tester, find.text('Connexion'));
    await _shot(tester, '01-connexion');

    // Saisie simulée : le clavier du système est remplacé pendant le parcours (sinon le texte saisi n'arrive pas en
    // mode profil / release).
    tester.testTextInput.register();
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), _email);
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), _password);
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await _until(tester, find.byWidgetPredicate((w) => w is Text && (w.data == 'Avancement du chantier' || w.data == 'Double authentification (MFA)')));
    if (find.text('Double authentification (MFA)').evaluate().isNotEmpty) {
      await _shot(tester, '02-mfa-orientation');
      await _open(tester, 'Chantier');
    }
    await _until(tester, find.text('Avancement du chantier'));
    await _wait(tester, 3);
    await _shot(tester, '03-accueil-chantier');

    final rubriques = <(String, String?)>[
      ('Mes tâches', null),
      ('Planning', null),
      ('Journal de chantier', null),
      ('Photos et vidéos', null),
      ('Rapports vocaux', null),
      ('Plans et maquette', 'Plans'),
      ('Issues BIM', 'Qui me sont assignées'),
      ('Synchronisation', 'Synchroniser maintenant'),
      ('Livraisons', 'Attendues'),
      ('Lecture de documents (IA)', 'Photographier la pièce'),
      ('Stock chantier', 'Affecté au chantier'),
      ('Matériel et engins', null),
      ('QHSE', 'Mes actions'),
      ('SAV et entretien', 'Mes interventions'),
      ('Pointage', null),
      ('Mon espace RH', null),
      ('Appels', null),
      ('Agenda', null),
      ('Notifications', 'Mes notifications'),
      ('Mon compte', 'Informations personnelles'),
      ('Documentation', "Rechercher dans l'aide"),
    ];
    for (final (i, (menu, expected)) in rubriques.indexed) {
      await _open(tester, 'Plus');
      await _open(tester, menu);
      if (expected != null) {
        await _until(tester, find.byWidgetPredicate((w) => w is Text && ((w.data ?? '').contains(expected) || _errors.contains(w.data))));
      }
      await _wait(tester, 2);
      await _shot(tester, '04-${(i + 1).toString().padLeft(2, '0')}-${_slug(menu)}');
      for (final e in _errors) {
        expect(find.text(e), findsNothing, reason: '$menu : $e');
      }
    }

    // Scanner (onglet) et retour à l'accueil.
    await _open(tester, 'Scanner');
    await _until(tester, find.text('Scanner un QR'));
    await _shot(tester, '05-scanner');
    await _open(tester, 'Chantier');
    await _until(tester, find.text('Avancement du chantier'));

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
