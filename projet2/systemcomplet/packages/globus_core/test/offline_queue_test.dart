import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_core/testing.dart';

Future<(OfflineQueue, FakeApi, Directory, MemorySessionStore)> _queue() async {
  final fake = FakeApi();
  final store = MemorySessionStore();
  await store.write(SessionStore.accessKey, 'A1');
  final api = fakeClient(fake, store: store);
  await api.restore();
  final dir = await Directory.systemTemp.createTemp('globus_queue_');
  addTearDown(() => dir.delete(recursive: true));
  return (OfflineQueue(api, store, directory: () async => dir), fake, dir, store);
}

Map<String, dynamic> _result(String id, String status, {Map<String, dynamic>? conflict, String? error}) => {
  'client_mutation_id': id,
  'status': status,
  'conflict': conflict,
  'error': error,
  'id': 'srv-$id',
};

void main() {
  group('file hors ligne (V4-DATA-32/33)', () {
    test('hors ligne : la mutation reste en attente, chiffrée sur le disque, puis part au retour du réseau', () async {
      final (queue, fake, dir, store) = await _queue();
      fake.offline = true;
      final op = await queue.enqueueMutation(
        label: 'Avancement',
        entity: 'task_progress',
        operation: 'update',
        entityId: 't-1',
        baseVersion: 3,
        payload: {'progress_pct': 40},
      );
      final offline = await queue.sync();
      expect(offline.offline, isTrue);
      expect(queue.pendingCount, 1);

      final file = File('${dir.path}${Platform.pathSeparator}globus_offline${Platform.pathSeparator}queue.bin');
      expect(file.existsSync(), isTrue);
      expect(String.fromCharCodes(file.readAsBytesSync()).contains('task_progress'), isFalse, reason: 'contenu chiffré (AES-256-GCM)');

      // Relecture par une nouvelle instance (redémarrage de l'application) : rien n'est perdu.
      final api2 = fakeClient(fake, store: store);
      await api2.restore();
      final reopened = OfflineQueue(api2, store, directory: () async => dir);
      await reopened.load();
      expect(reopened.items.single.id, op.id);
      expect(reopened.items.single.baseVersion, 3);

      fake
        ..offline = false
        ..on('POST', '/sync/push', (r) {
          final m = ((r.body as Map)['mutations'] as List).single as Map;
          expect(m['client_mutation_id'], op.id);
          expect(m['base_version'], 3);
          expect(m['entity_id'], 't-1');
          return (
            200,
            {
              'results': [_result(op.id, 'applied')],
            },
          );
        });
      final report = await reopened.sync();
      expect(report.applied, 1);
      expect(reopened.items, isEmpty);
      expect(reopened.lastSync, isNotNull);
    });

    test('conflit : conservé avec les deux versions, résolu explicitement', () async {
      final (queue, fake, _, _) = await _queue();
      late String id;
      fake.on('POST', '/sync/push', (r) {
        id = (((r.body as Map)['mutations'] as List).single as Map)['client_mutation_id'] as String;
        return (
          200,
          {
            'results': [
              _result(
                id,
                'conflict',
                conflict: {
                  'server_version': 5,
                  'server_data': {'progress_pct': 60},
                  'fields': ['progress_pct'],
                  'client_data': {'progress_pct': 40},
                },
              ),
            ],
          },
        );
      });
      await queue.enqueueMutation(label: 'Avancement', entity: 'task_progress', operation: 'update', baseVersion: 3, payload: {'progress_pct': 40});
      await queue.sync();
      expect(queue.conflictCount, 1);
      final op = queue.items.single;
      expect(J.of(op.conflict).strings('fields'), ['progress_pct']);
      expect(op.serverId, 'srv-$id');

      fake.on('POST', '/sync/conflicts/srv-$id/resolve', (r) {
        expect((r.body as Map)['resolution'], 'merged');
        expect((r.body as Map)['merged'], {'progress_pct': 50});
        return (200, _result(id, 'resolved'));
      });
      await queue.resolve(op, 'merged', merged: {'progress_pct': 50});
      expect(queue.items, isEmpty);
    });

    test('refus métier et lot refusé (4xx) : visibles, jamais rejoués en boucle', () async {
      final (queue, fake, _, _) = await _queue();
      fake.on('POST', '/sync/push', (r) {
        final ms = (r.body as Map)['mutations'] as List;
        return (
          200,
          {
            'results': [for (final m in ms) _result((m as Map)['client_mutation_id'] as String, 'rejected', error: 'Article introuvable')],
          },
        );
      });
      await queue.enqueueMutation(label: 'Sortie de stock', entity: 'stock_issue', operation: 'action', payload: {'quantity': 2});
      await queue.sync();
      expect(queue.rejectedCount, 1);
      expect(queue.items.single.error, 'Article introuvable');
      await queue.discard(queue.items.single);
      expect(queue.items, isEmpty);

      fake.on(
        'POST',
        '/sync/push',
        (_) => (
          422,
          {
            'error': {'code': 'VALIDATION_ERROR', 'message': 'Données invalides'},
          },
        ),
      );
      await queue.enqueueMutation(label: 'Journal', entity: 'daily_log', operation: 'create', payload: {});
      await queue.sync();
      expect(queue.rejectedCount, 1, reason: 'un lot invalide ne repart pas toutes les 2 minutes');

      fake.on(
        'POST',
        '/sync/push',
        (_) => (
          503,
          {
            'error': {'code': 'UNAVAILABLE', 'message': 'Maintenance'},
          },
        ),
      );
      await queue.enqueueMutation(label: 'Journal 2', entity: 'daily_log', operation: 'create', payload: {});
      await queue.sync();
      expect(queue.pendingCount, 1, reason: 'erreur serveur temporaire : nouvel essai');
    });

    test('appel rejouable (auto-pointage) : clé d\'idempotence et client_mutation_id identiques au renvoi', () async {
      final (queue, fake, _, _) = await _queue();
      final keys = <String>[];
      var calls = 0;
      fake.on('POST', '/hr/attendance/self', (r) {
        calls++;
        keys.add('${r.headers['Idempotency-Key']}|${(r.body as Map)['client_mutation_id']}');
        return calls == 1
            ? (
                502,
                {
                  'error': {'code': 'BAD_GATEWAY', 'message': 'Passerelle'},
                },
              )
            : (200, {'scan': 'in'});
      });
      final op = await queue.enqueueRequest(
        label: 'Auto-pointage',
        path: '/hr/attendance/self',
        body: {'site_code': 'GLOBUS:SITE:S1', 'latitude': 4.05, 'longitude': 9.7},
      );
      await queue.sync();
      expect(queue.pendingCount, 1);
      await queue.sync();
      expect(queue.items, isEmpty);
      expect(keys.toSet().length, 1, reason: 'même opération : même clé au renvoi');
      expect(keys.first, '${op.id}|${op.id}');
    });

    test('fichiers envoyés avant les mutations, copiés puis supprimés après envoi', () async {
      final (queue, fake, dir, _) = await _queue();
      final order = <String>[];
      fake
        ..on('POST', '/qhse/files', (r) {
          order.add('file');
          expect(r.body, isA<FormData>());
          final fields = {for (final f in (r.body! as FormData).fields) f.key: f.value};
          expect(fields['client_mutation_id'], isNotEmpty);
          return (201, {'file_id': 'f-1'});
        })
        ..on('POST', '/sync/push', (r) {
          order.add('mutation');
          final m = ((r.body as Map)['mutations'] as List).single as Map;
          return (
            200,
            {
              'results': [_result(m['client_mutation_id'] as String, 'applied')],
            },
          );
        });
      final photo = File('${dir.path}${Platform.pathSeparator}photo.jpg')..writeAsBytesSync(List.filled(64, 7));
      fake.offline = true;
      await queue.enqueueUpload(label: 'Photo', path: '/qhse/files', sourceFile: photo.path, fileName: 'photo.jpg');
      await queue.enqueueMutation(
        label: 'Incident',
        entity: 'incident',
        operation: 'create',
        payload: {
          'photo_checksums': ['x'],
        },
      );
      final kept = queue.items.first.filePath!;
      expect(File(kept).existsSync(), isTrue);
      fake.offline = false;
      await queue.sync();
      expect(order, ['file', 'mutation']);
      expect(queue.items, isEmpty);
      expect(File(kept).existsSync(), isFalse);
    });

    test('déconnexion : purge des opérations et des pièces copiées', () async {
      final (queue, fake, dir, _) = await _queue();
      fake.offline = true;
      await queue.enqueueMutation(label: 'Journal', entity: 'daily_log', operation: 'create', payload: {});
      await queue.purge();
      expect(queue.items, isEmpty);
      expect(Directory('${dir.path}${Platform.pathSeparator}globus_offline').existsSync(), isFalse);
    });
  });
}
