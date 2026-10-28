import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_client/main.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_core/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Parcours de l'application client contre un serveur API simulé au niveau HTTP (vrai client, vrai routeur).
FakeApi clientServer({bool mfaEnrolled = true}) {
  final fake = FakeApi();
  fake
    ..on('POST', '/auth/login', (_) => (200, {'access_token': 'A', 'refresh_token': 'R', 'user': meJson(mfaRequired: true, mfaEnabled: mfaEnrolled)}))
    ..on('GET', '/auth/me', (_) => (200, meJson(mfaRequired: true, mfaEnabled: mfaEnrolled)))
    ..on('POST', '/auth/logout', (_) => (200, {'status': 'ok'}))
    ..on('GET', '/notifications/unread-count', (_) => (200, {'unread': 3}))
    ..on(
      'GET',
      '/client/projects',
      (_) => (
        200,
        [
          {'id': 'p1', 'code': 'GE-2026-001', 'name': 'Villa Bonapriso', 'status': 'in_progress', 'progress_pct': '42.5', 'city': 'Douala'},
          {'id': 'p2', 'code': 'GE-2026-002', 'name': 'Immeuble Akwa', 'status': 'planned'},
        ],
      ),
    )
    ..on(
      'GET',
      '/client/projects/p1/dashboard',
      (_) => (
        200,
        {
          'project': {
            'id': 'p1',
            'code': 'GE-2026-001',
            'name': 'Villa Bonapriso',
            'status': 'in_progress',
            'progress_pct': '42.5',
            'city': 'Douala',
            'start_planned': '2026-01-10',
            'end_planned': '2027-03-30',
          },
          'milestones': [
            {'id': 'm1', 'name': 'Gros œuvre', 'due_date': '2026-06-30', 'achieved_at': '2026-06-28', 'status': 'achieved'},
            {'id': 'm2', 'name': 'Toiture', 'due_date': '2026-09-30', 'status': 'planned'},
          ],
          'finance': {
            'contract_amount': '85000000',
            'approved_changes': '2500000',
            'called': '40000000',
            'paid': '35000000',
            'due': '5000000',
            'overdue_count': 1,
            'remaining_to_call': '47500000',
            'currency': 'XAF',
          },
          'alerts': [
            {'kind': 'payment_overdue', 'message': 'Un appel de fonds est en retard de paiement.'},
          ],
          'pending_decisions': [
            {'id': 'd1', 'title': 'Choix du carrelage de la terrasse', 'due_date': '2026-10-30', 'price_impact': '350000', 'delay_impact_days': 2},
          ],
          'digest': {'summary': 'Coulage de la dalle du R+1 terminé.', 'period_start': '2026-10-05', 'period_end': '2026-10-11'},
          'recent_media': <Object>[],
        },
      ),
    )
    ..on(
      'GET',
      '/client/projects/p1/trust',
      (_) => (
        200,
        {
          'project_id': 'p1',
          'score': 78,
          'level': 'bon',
          'as_of': '2026-10-15',
          'trend_7d': 2.5,
          'components': [
            {
              'key': 'planning',
              'label': 'Respect du planning',
              'weight': 40,
              'score': 72,
              'facts': ['1 jalon en retard'],
            },
          ],
          'history': <Object>[],
          'method': ['Données réelles du chantier'],
        },
      ),
    )
    ..on('GET', '/auth/mfa/factors', (_) => (200, <Object>[]));
  return fake;
}

Future<void> pumpApp(WidgetTester tester, FakeApi fake) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(GlobusClientApp(config: testConfig, services: fakeServices(fake)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('connexion puis tableau de bord du projet (avancement, finances, décisions, jalons)', (tester) async {
    final fake = clientServer();
    await pumpApp(tester, fake);
    expect(find.text('Connexion'), findsOneWidget);
    expect(find.text('GLOBUS Client'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'client@example.com');
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();

    final login = fake.requests.firstWhere((r) => r.path == '/auth/login');
    expect(login.headers['X-Client-App'], 'mobile-client');
    expect(find.text('Tableau de bord'), findsWidgets);
    expect(find.text('Villa Bonapriso'), findsWidgets);
    expect(find.text('43 %'), findsOneWidget);
    expect(find.text('Un appel de fonds est en retard de paiement.'), findsOneWidget);
    // Cloche : notifications non lues.
    expect(find.text('3'), findsWidgets);
    final page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
    for (final text in [
      'Indice de confiance',
      money(87500000),
      'Choix du carrelage de la terrasse',
      'Gros œuvre',
      'Toiture',
      'Coulage de la dalle du R+1 terminé.',
    ]) {
      await tester.scrollUntilVisible(find.text(text), 250, scrollable: page);
      expect(find.text(text), findsOneWidget);
    }
  });

  testWidgets('MFA obligatoire non activée : seul « Mon compte › Sécurité » est accessible', (tester) async {
    final fake = clientServer(mfaEnrolled: false);
    await pumpApp(tester, fake);
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'client@example.com');
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();
    expect(find.text('Double authentification (MFA)'), findsOneWidget);
    expect(find.text('Obligatoire'), findsOneWidget);
    expect(find.textContaining('Votre profil exige la double authentification'), findsOneWidget);
    expect(find.text("Configurer une application d'authentification"), findsOneWidget);
  });

  testWidgets('MFA exigée par le serveur (mode enforce) : retour forcé à « Mon compte » tant qu’elle n’est pas activée', (tester) async {
    final fake = clientServer(mfaEnrolled: false)
      ..on(
        'GET',
        '/client/projects',
        (_) => (
          403,
          {
            'error': {'code': 'MFA_ENROLLMENT_REQUIRED', 'message': "L'activation du MFA est obligatoire pour ce compte"},
          },
        ),
      )
      ..on(
        'GET',
        '/notifications/unread-count',
        (_) => (
          403,
          {
            'error': {'code': 'MFA_ENROLLMENT_REQUIRED', 'message': 'MFA'},
          },
        ),
      );
    await pumpApp(tester, fake);
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'client@example.com');
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();
    expect(find.text('Double authentification (MFA)'), findsOneWidget);
    await tester.tap(find.text('Accueil'));
    await tester.pumpAndSettle();
    expect(find.text('Double authentification (MFA)'), findsOneWidget);
  });

  testWidgets('compte non client : accès refusé et changement de compte', (tester) async {
    final fake = clientServer()
      ..on(
        'POST',
        '/auth/login',
        (_) => (
          200,
          {
            'access_token': 'A',
            'refresh_token': 'R',
            'user': meJson(spaces: ['erp'], mfaEnabled: true),
          },
        ),
      );
    await pumpApp(tester, fake);
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'chef@example.com');
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();
    expect(find.text('Accès non autorisé à GLOBUS Client'), findsOneWidget);
    await tester.tap(find.text('Changer de compte'));
    await tester.pumpAndSettle();
    expect(find.text('Connexion'), findsOneWidget);
  });
  testWidgets('Mes rendez-vous : le client demande un créneau, en attente de confirmation par l’équipe', (tester) async {
    final start = DateTime.now().add(const Duration(days: 2)).toUtc();
    final created = {
      'id': 'ev1',
      'title': 'Choix des finitions',
      'kind': 'appointment',
      'status': 'tentative',
      'client_visible': true,
      'project_id': 'p1',
      'organizer_id': 'u-1',
      'starts_at': start.toIso8601String(),
      'ends_at': start.add(const Duration(hours: 1)).toIso8601String(),
      'attendees': [
        {'id': 'a1', 'user_id': 'u-1', 'name': 'Awa Ngono', 'response': 'accepted'},
        {'id': 'a2', 'user_id': 'u-2', 'name': 'Chef de projet', 'response': 'pending'},
      ],
    };
    final fake = clientServer()
      ..on('GET', '/agenda/events', (_) => (200, <Object>[]))
      ..on('POST', '/agenda/requests', (_) => (201, created))
      ..on('GET', '/agenda/events/ev1', (_) => (200, created));
    await pumpApp(tester, fake);
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'client@example.com');
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Plus'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Mes rendez-vous'), 200, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Mes rendez-vous'));
    await tester.pumpAndSettle();
    expect(find.text('Demander un rendez-vous'), findsOneWidget);

    await tester.tap(find.text('Demander un rendez-vous'));
    await tester.pumpAndSettle();
    expect(find.text('Envoyer la demande'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Objet *'), 'Choix des finitions');
    await tester.pump();
    await tester.tap(find.text('Envoyer la demande'));
    await tester.pumpAndSettle();

    final post = fake.requests.firstWhere((r) => r.method == 'POST' && r.path == '/agenda/requests');
    final body = post.body! as Map;
    expect(body['project_id'], 'p1');
    expect(body['subject'], 'Choix des finitions');
    expect(body['kind'], 'appointment');
    expect(body['duration_minutes'], 60);
    expect(DateTime.parse(body['starts_at'] as String).isAfter(DateTime.now()), isTrue);
    // Le rendez-vous s'ouvre : le client voit qu'il attend la confirmation de l'équipe (pas de bouton « Confirmer »).
    expect(find.text("En attente de confirmation par l'équipe du projet : vous serez prévenu."), findsOneWidget);
    expect(find.text('Confirmer le rendez-vous'), findsNothing);
  });
  testWidgets('Messagerie : conversation directe listée, photo en vignette et PDF joint', (tester) async {
    final at = DateTime.now().toUtc().toIso8601String();
    final conversation = {
      'id': 'c1',
      'kind': 'direct',
      'title': 'Chef de projet',
      'project_id': null,
      'members': [
        {'user_id': 'u-1', 'name': 'Awa Ngono'},
        {'user_id': 'u-2', 'name': 'Chef de projet'},
      ],
      'unread': 0,
      'last_message': {'body': 'Voici le plan', 'at': at, 'sender_id': 'u-2', 'kind': 'file'},
      'last_message_at': at,
    };
    final message = {
      'id': 'm1',
      'conversation_id': 'c1',
      'sender': {'id': 'u-2', 'name': 'Chef de projet'},
      'body': 'Voici le plan',
      'kind': 'file',
      'created_at': at,
      'attachments': [
        {'id': 'att1', 'name': 'photo-chantier.jpg', 'mime_type': 'image/jpeg', 'size_bytes': 120000},
        {'id': 'att2', 'name': 'plan-rdc.pdf', 'mime_type': 'application/pdf', 'size_bytes': 250000},
      ],
    };
    final fake = clientServer()
      ..on('GET', '/conversations', (_) => (200, [conversation]))
      ..on('GET', '/conversations/c1/messages', (_) => (200, {'items': [message], 'has_more': false}))
      ..on('POST', '/conversations/c1/read', (_) => (200, {'status': 'ok'}));
    await pumpApp(tester, fake);
    await tester.enterText(find.widgetWithText(TextField, 'Adresse e-mail'), 'client@example.com');
    await tester.enterText(find.widgetWithText(TextField, 'Mot de passe'), 'Globus!Test2026');
    await tester.pump();
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Messages'));
    await tester.pumpAndSettle();
    // Conversation directe (hors projet) affichée dans la messagerie du projet : pas besoin de la recréer.
    expect(fake.requests.lastWhere((r) => r.path == '/conversations').query['project_id'], 'p1');
    expect(find.text('Chef de projet'), findsWidgets);
    await tester.tap(find.text('Voici le plan').first);
    await tester.pumpAndSettle();
    expect(find.byType(AuthImage), findsOneWidget);
    expect(find.text('plan-rdc.pdf'), findsOneWidget);
    expect(find.byIcon(Icons.picture_as_pdf_outlined), findsOneWidget);
  });
}
