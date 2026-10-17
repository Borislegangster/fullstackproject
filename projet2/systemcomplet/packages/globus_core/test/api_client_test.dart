import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';

import 'package:globus_core/testing.dart';

void main() {
  group('ApiClient', () {
    test('envoie X-Client-App, le jeton bearer et la langue', () async {
      final fake = FakeApi()..on('GET', '/ping', (_) => (200, {'ok': true}));
      final store = MemorySessionStore();
      await store.write(SessionStore.accessKey, 'A1');
      final api = fakeClient(fake, store: store);
      await api.restore();
      expect(await api.get('/ping'), {'ok': true});
      final h = fake.requests.single.headers;
      expect(h['X-Client-App'], 'mobile-client');
      expect(h['Authorization'], 'Bearer A1');
      expect(h['Accept-Language'], 'fr');
    });

    test('401 : renouvelle la session une seule fois pour des requêtes concurrentes puis rejoue', () async {
      final fake = FakeApi();
      var refreshCalls = 0;
      fake
        ..on(
          'GET',
          '/data',
          (r) => r.headers['Authorization'] == 'Bearer NEW'
              ? (200, {'v': 1})
              : (
                  401,
                  {
                    'error': {'code': 'TOKEN_EXPIRED', 'message': 'Session expirée'},
                  },
                ),
        )
        ..on('POST', '/auth/refresh', (r) {
          refreshCalls++;
          expect((r.body as Map)['refresh_token'], 'R1');
          return (200, {'access_token': 'NEW', 'refresh_token': 'R2'});
        });
      final store = MemorySessionStore();
      await store.write(SessionStore.accessKey, 'OLD');
      await store.write(SessionStore.refreshKey, 'R1');
      final api = fakeClient(fake, store: store);
      await api.restore();
      final results = await Future.wait([api.get('/data'), api.get('/data'), api.get('/data')]);
      expect(results, everyElement({'v': 1}));
      expect(refreshCalls, 1);
      expect(await store.read(SessionStore.refreshKey), 'R2');
    });

    test('refresh refusé : session effacée et signal « session expirée »', () async {
      final fake = FakeApi()
        ..on(
          'GET',
          '/data',
          (_) => (
            401,
            {
              'error': {'code': 'TOKEN_EXPIRED', 'message': 'Session expirée'},
            },
          ),
        )
        ..on(
          'POST',
          '/auth/refresh',
          (_) => (
            401,
            {
              'error': {'code': 'SESSION_REVOKED', 'message': 'Session révoquée'},
            },
          ),
        );
      final store = MemorySessionStore();
      await store.write(SessionStore.refreshKey, 'R1');
      final api = fakeClient(fake, store: store);
      await api.restore();
      var expired = 0;
      api.sessionExpired.addListener(() => expired++);
      await expectLater(api.get('/data'), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
      expect(expired, 1);
      expect(await store.read(SessionStore.refreshKey), isNull);
    });

    test('erreurs normalisées en français (enveloppe, validation 422, 429)', () async {
      final fake = FakeApi()
        ..on(
          'POST',
          '/a',
          (_) => (
            409,
            {
              'error': {'code': 'CONFLICT', 'message': 'Déjà existant', 'correlation_id': 'c-1'},
            },
          ),
        )
        ..on(
          'POST',
          '/b',
          (_) => (
            422,
            {
              'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Données invalides',
                'details': [
                  {'field': 'body.subject', 'type': 'string_too_short', 'message': 'trop court'},
                ],
              },
            },
          ),
        )
        ..on(
          'POST',
          '/c',
          (_) => (
            429,
            {
              'error': {'code': 'RATE_LIMITED', 'message': 'Trop de requêtes'},
            },
          ),
        );
      final api = fakeClient(fake);
      try {
        await api.post('/a');
        fail('exception attendue');
      } on ApiException catch (e) {
        expect(e.code, 'CONFLICT');
        expect(e.correlationId, 'c-1');
        expect(errorMessage(e), 'Déjà existant');
      }
      try {
        await api.post('/b');
        fail('exception attendue');
      } on ApiException catch (e) {
        expect(e.userMessage, 'Données invalides — Objet : valeur trop courte');
      }
      try {
        await api.post('/c');
        fail('exception attendue');
      } on ApiException catch (e) {
        expect(e.userMessage, startsWith('Trop de tentatives'));
      }
    });

    test("clé d'idempotence : fournie, générée, et conservée au rejeu après renouvellement", () async {
      final fake = FakeApi();
      var calls = 0;
      fake
        ..on('POST', '/pay', (r) {
          calls++;
          return calls == 1
              ? (
                  401,
                  {
                    'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'},
                  },
                )
              : (200, {'ok': true});
        })
        ..on('POST', '/auth/refresh', (_) => (200, {'access_token': 'A2', 'refresh_token': 'R2'}));
      final store = MemorySessionStore();
      await store.write(SessionStore.refreshKey, 'R1');
      final api = fakeClient(fake, store: store);
      await api.restore();
      await api.post('/pay', idempotent: 'cle-paiement-1');
      final keys = fake.requests.where((r) => r.path == '/pay').map((r) => r.headers['Idempotency-Key']).toList();
      expect(keys, ['cle-paiement-1', 'cle-paiement-1']);
      await api.post('/pay', idempotent: true);
      expect(fake.requests.last.headers['Idempotency-Key'], matches(RegExp(r'^[0-9a-f-]{36}$')));
    });

    test('hors ligne : renvoie la dernière lecture connue avec sa date', () async {
      final fake = FakeApi()
        ..on(
          'GET',
          '/client/projects',
          (_) => (
            200,
            [
              {'id': 'p1', 'name': 'Villa'},
            ],
          ),
        );
      final api = fakeClient(fake);
      final fresh = await api.fetch('/client/projects');
      expect(fresh.isStale, isFalse);
      await Future<void>.delayed(Duration.zero);
      fake.offline = true;
      final cached = await api.fetch('/client/projects');
      expect(cached.isStale, isTrue);
      expect((cached.data as List).single['name'], 'Villa');
      expect(api.reachable.value, isFalse);
      await expectLater(api.fetch('/inconnu'), throwsA(isA<ApiException>().having((e) => e.isNetwork, 'réseau', true)));
    });

    test('MFA obligatoire non activée : signal dédié', () async {
      final fake = FakeApi()
        ..on(
          'GET',
          '/client/projects',
          (_) => (
            403,
            {
              'error': {'code': 'MFA_ENROLLMENT_REQUIRED', 'message': 'MFA obligatoire'},
            },
          ),
        );
      final api = fakeClient(fake);
      var signals = 0;
      api.mfaRequired.addListener(() => signals++);
      await expectLater(api.get('/client/projects'), throwsA(isA<ApiException>()));
      expect(signals, 1);
    });

    test('URL absolues : chemins API, ressources publiques, adresses externes', () {
      final api = fakeClient(FakeApi());
      expect(api.url('/client/projects'), 'https://globus.test/api/v1/client/projects');
      expect(api.url('/api/v1/public/brand/icon-192.png?v=1'), 'https://globus.test/api/v1/public/brand/icon-192.png?v=1');
      expect(api.url('https://cdn.example.com/x.png'), 'https://cdn.example.com/x.png');
    });
  });

  group('AuthController', () {
    test('connexion avec double authentification puis déconnexion (cache purgé)', () async {
      final fake = FakeApi()
        ..on('POST', '/auth/login', (r) {
          final body = r.body as Map;
          expect(body['device_key'], isNotEmpty);
          return (
            200,
            {
              'mfa_required': true,
              'mfa_token': 'M1',
              'methods': ['totp'],
            },
          );
        })
        ..on('POST', '/auth/mfa/verify', (r) {
          expect((r.body as Map)['code'], '123456');
          return (200, {'access_token': 'A', 'refresh_token': 'R', 'user': meJson()});
        })
        ..on('POST', '/auth/logout', (_) => (200, {'status': 'ok'}));
      final cache = MemoryCache();
      final api = fakeClient(fake, cache: cache);
      final auth = AuthController(api);
      final step = await auth.login('client@example.com', 'secret');
      expect(step.needsMfa, isTrue);
      expect(step.methods, ['totp']);
      await auth.verifyMfa('M1', code: '123456');
      expect(auth.status, AuthStatus.signedIn);
      expect(auth.user!.fullName, 'Awa Ngono');
      expect(auth.can('client:pay'), isTrue);
      await cache.write('u-1', '/x', {'a': 1});
      await auth.logout();
      expect(auth.status, AuthStatus.signedOut);
      expect(cache.entries, isEmpty);
      expect(api.hasSession, isFalse);
    });

    test('démarrage hors ligne : session restaurée avec le dernier profil connu', () async {
      final fake = FakeApi()..offline = true;
      final store = MemorySessionStore();
      await store.write(SessionStore.refreshKey, 'R');
      await store.write(
        SessionStore.userKey,
        '{"id":"u-1","email":"client@example.com","first_name":"Awa","last_name":"Ngono","roles":[],"permissions":[],"spaces":["client"],"locale":"fr","timezone":"Africa/Douala"}',
      );
      final auth = AuthController(fakeClient(fake, store: store));
      await auth.bootstrap();
      expect(auth.status, AuthStatus.signedIn);
      expect(auth.offline, isTrue);
      expect(auth.user!.spaces, ['client']);
    });

    test('session expirée côté serveur : retour à la connexion avec message', () async {
      final fake = FakeApi()
        ..on('GET', '/auth/me', (_) => (200, meJson()))
        ..on(
          'GET',
          '/client/projects',
          (_) => (
            401,
            {
              'error': {'code': 'SESSION_REVOKED', 'message': 'Session révoquée'},
            },
          ),
        )
        ..on(
          'POST',
          '/auth/refresh',
          (_) => (
            401,
            {
              'error': {'code': 'SESSION_REVOKED', 'message': 'Session révoquée'},
            },
          ),
        );
      final store = MemorySessionStore();
      await store.write(SessionStore.refreshKey, 'R');
      await store.write(SessionStore.accessKey, 'A');
      final api = fakeClient(fake, store: store);
      final auth = AuthController(api);
      await auth.bootstrap();
      expect(auth.status, AuthStatus.signedIn);
      await expectLater(api.get('/client/projects'), throwsA(isA<ApiException>()));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(auth.status, AuthStatus.signedOut);
      expect(auth.notice, contains('expiré'));
    });
  });
}
