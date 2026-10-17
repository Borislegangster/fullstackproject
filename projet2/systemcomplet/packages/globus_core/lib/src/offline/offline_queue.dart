import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/json.dart';
import '../api/session_store.dart';

/// Opération saisie sur le terrain, en attente d'envoi (§14.3 « Offline-first », V4-DATA-32/33).
///
/// - `mutation` : envoyée par `/sync/push` (clé `client_mutation_id`, version de base connue → conflit explicite) ;
/// - `upload` : fichier (photo, rapport vocal, preuve) envoyé en multipart avec une clé d'idempotence.
class PendingOp {
  PendingOp({
    required this.id,
    required this.kind,
    required this.label,
    required this.createdAt,
    this.entity,
    this.entityId,
    this.operation,
    this.baseVersion,
    this.payload = const {},
    this.path,
    this.fields = const {},
    this.filePath,
    this.fileName,
    this.fileField = 'file',
    this.status = 'pending',
    this.error,
    this.conflict,
    this.serverId,
    this.attempts = 0,
  });

  factory PendingOp.fromJson(Map<String, dynamic> j) => PendingOp(
    id: j['id'] as String,
    kind: j['kind'] as String,
    label: j['label'] as String? ?? '',
    createdAt: DateTime.parse(j['created_at'] as String),
    entity: j['entity'] as String?,
    entityId: j['entity_id'] as String?,
    operation: j['operation'] as String?,
    baseVersion: j['base_version'] as int?,
    payload: (j['payload'] as Map?)?.cast<String, dynamic>() ?? const {},
    path: j['path'] as String?,
    fields: (j['fields'] as Map?)?.cast<String, dynamic>() ?? const {},
    filePath: j['file_path'] as String?,
    fileName: j['file_name'] as String?,
    fileField: j['file_field'] as String? ?? 'file',
    status: j['status'] as String? ?? 'pending',
    error: j['error'] as String?,
    conflict: (j['conflict'] as Map?)?.cast<String, dynamic>(),
    serverId: j['server_id'] as String?,
    attempts: j['attempts'] as int? ?? 0,
  );

  final String id;
  final String kind; // mutation / upload / request
  final String label;
  final DateTime createdAt;
  final String? entity;
  final String? entityId;
  final String? operation;
  final int? baseVersion;
  final Map<String, dynamic> payload;
  final String? path;
  final Map<String, dynamic> fields;
  final String? filePath;
  final String? fileName;
  final String fileField;
  String status; // pending / conflict / rejected
  String? error;
  Map<String, dynamic>? conflict;
  String? serverId;
  int attempts;

  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind,
    'label': label,
    'created_at': createdAt.toUtc().toIso8601String(),
    'entity': entity,
    'entity_id': entityId,
    'operation': operation,
    'base_version': baseVersion,
    'payload': payload,
    'path': path,
    'fields': fields,
    'file_path': filePath,
    'file_name': fileName,
    'file_field': fileField,
    'status': status,
    'error': error,
    'conflict': conflict,
    'server_id': serverId,
    'attempts': attempts,
  };
}

/// Résultat d'une synchronisation.
class SyncReport {
  const SyncReport({this.applied = 0, this.conflicts = 0, this.rejected = 0, this.remaining = 0, this.offline = false});
  final int applied;
  final int conflicts;
  final int rejected;
  final int remaining;
  final bool offline;
}

/// File locale chiffrée (AES-256-GCM, clé dans le stockage sécurisé) des opérations hors ligne, envoyée dès que le
/// réseau revient. Aucune mutation n'écrase silencieusement le serveur : un écart de version devient un conflit à
/// résoudre explicitement (garder ma version / garder celle du serveur / fusion), journalisé côté serveur.
class OfflineQueue extends ChangeNotifier {
  OfflineQueue(this.api, this.store, {Future<Directory> Function()? directory}) : _directory = directory ?? getApplicationSupportDirectory;

  final ApiClient api;
  final SessionStore store;
  final Future<Directory> Function() _directory;
  final _algo = AesGcm.with256bits();
  static const _keyName = 'globus.queuekey';
  final List<PendingOp> items = [];
  bool syncing = false;
  DateTime? lastSync;
  String? deviceId;
  bool _loaded = false;
  Future<SyncReport>? _running;

  int get pendingCount => items.where((o) => o.status == 'pending').length;
  int get conflictCount => items.where((o) => o.status == 'conflict').length;
  int get rejectedCount => items.where((o) => o.status == 'rejected').length;

  Future<File> _file() async {
    final dir = Directory('${(await _directory()).path}${Platform.pathSeparator}globus_offline');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return File('${dir.path}${Platform.pathSeparator}queue.bin');
  }

  /// Dossier des pièces (photos, audio) en attente : conservées jusqu'à l'envoi.
  Future<Directory> attachmentsDir() async {
    final dir = Directory('${(await _directory()).path}${Platform.pathSeparator}globus_offline${Platform.pathSeparator}pieces');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir;
  }

  Future<SecretKey> _key() async {
    final existing = await store.read(_keyName);
    if (existing != null) return SecretKey(base64Decode(existing));
    final key = await _algo.newSecretKey();
    await store.write(_keyName, base64Encode(await key.extractBytes()));
    return key;
  }

  Future<void> load() async {
    if (_loaded || kIsWeb) return;
    _loaded = true;
    deviceId = await api.deviceKey();
    try {
      final file = await _file();
      if (!file.existsSync()) return;
      final box = SecretBox.fromConcatenation(await file.readAsBytes(), nonceLength: 12, macLength: 16);
      final clear = await _algo.decrypt(box, secretKey: await _key());
      final data = (jsonDecode(utf8.decode(clear)) as Map).cast<String, dynamic>();
      items
        ..clear()
        ..addAll(((data['items'] as List?) ?? const []).map((e) => PendingOp.fromJson((e as Map).cast<String, dynamic>())));
      final last = data['last_sync'] as String?;
      lastSync = last == null ? null : DateTime.parse(last);
      notifyListeners();
    } catch (e) {
      debugPrint('File hors ligne illisible : $e');
    }
  }

  Future<void> _save() async {
    if (kIsWeb) return;
    final payload = utf8.encode(
      jsonEncode({
        'items': [for (final o in items) o.toJson()],
        'last_sync': lastSync?.toUtc().toIso8601String(),
      }),
    );
    final box = await _algo.encrypt(payload, secretKey: await _key());
    final file = await _file();
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsBytes(box.concatenation(), flush: true);
    await tmp.rename(file.path);
  }

  /// Ajoute une mutation métier (avancement de tâche, journal, incident, pointage, sortie de stock…).
  Future<PendingOp> enqueueMutation({
    required String label,
    required String entity,
    required String operation,
    String? entityId,
    int? baseVersion,
    required Map<String, dynamic> payload,
  }) async {
    await load();
    final op = PendingOp(
      id: newKey(),
      kind: 'mutation',
      label: label,
      createdAt: DateTime.now(),
      entity: entity,
      entityId: entityId,
      operation: operation,
      baseVersion: baseVersion,
      payload: payload,
    );
    items.add(op);
    await _save();
    notifyListeners();
    unawaited(sync());
    return op;
  }

  /// Ajoute un appel d'API rejouable (POST avec `client_mutation_id` et clé d'idempotence) : auto-pointage,
  /// actions sans gestionnaire de synchronisation dédié.
  Future<PendingOp> enqueueRequest({required String label, required String path, required Map<String, dynamic> body}) async {
    await load();
    final id = newKey();
    final op = PendingOp(id: id, kind: 'request', label: label, createdAt: DateTime.now(), path: path, payload: {...body, 'client_mutation_id': id});
    items.add(op);
    await _save();
    notifyListeners();
    unawaited(sync());
    return op;
  }

  /// Ajoute un envoi de fichier (copié dans le dossier de l'application jusqu'à l'envoi).
  Future<PendingOp> enqueueUpload({
    required String label,
    required String path,
    required String sourceFile,
    required String fileName,
    String fileField = 'file',
    Map<String, dynamic> fields = const {},
  }) async {
    await load();
    final id = newKey();
    final dir = await attachmentsDir();
    final kept = await File(sourceFile).copy('${dir.path}${Platform.pathSeparator}$id-${fileName.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_')}');
    final op = PendingOp(
      id: id,
      kind: 'upload',
      label: label,
      createdAt: DateTime.now(),
      path: path,
      fields: {...fields, 'client_mutation_id': id},
      filePath: kept.path,
      fileName: fileName,
      fileField: fileField,
    );
    items.add(op);
    await _save();
    notifyListeners();
    unawaited(sync());
    return op;
  }

  /// Envoie les opérations en attente (appelée à l'ajout, au retour du réseau, au premier plan).
  Future<SyncReport> sync() {
    // Un seul envoi à la fois : les appels concurrents reçoivent le même rapport (dont « hors ligne »).
    final running = _running;
    if (running != null) return running;
    final future = _sync();
    _running = future;
    // Libéré avant la reprise des appelants (écouteur enregistré en premier) : l'appel suivant relance un envoi.
    unawaited(future.then((_) => _running = null, onError: (Object _) => _running = null));
    return future;
  }

  SyncReport _report({bool offline = false}) => SyncReport(remaining: pendingCount, conflicts: conflictCount, rejected: rejectedCount, offline: offline);

  Future<SyncReport> _sync() async {
    await load();
    if (!api.hasSession) return _report();
    syncing = true;
    notifyListeners();
    var applied = 0;
    try {
      // 1. Fichiers d'abord : une mutation peut référencer une pièce envoyée.
      for (final op in items.where((o) => o.kind == 'upload' && o.status == 'pending').toList()) {
        try {
          await api.upload(
            op.path!,
            files: [UploadFile(name: op.fileName ?? 'piece', path: op.filePath, field: op.fileField)],
            fields: op.fields,
            idempotent: op.id,
          );
          items.remove(op);
          applied++;
          try {
            File(op.filePath!).deleteSync();
          } catch (_) {}
        } on ApiException catch (e) {
          if (e.isNetwork) return _report(offline: true);
          op
            ..attempts += 1
            ..status = e.status >= 500 ? 'pending' : 'rejected'
            ..error = e.userMessage;
        }
        await _save();
        notifyListeners();
      }
      // 2. Appels rejouables, dans l'ordre de saisie.
      for (final op in items.where((o) => o.kind == 'request' && o.status == 'pending').toList()) {
        try {
          await api.post(op.path!, body: op.payload, idempotent: op.id);
          items.remove(op);
          applied++;
        } on ApiException catch (e) {
          if (e.isNetwork) return _report(offline: true);
          op
            ..attempts += 1
            ..status = e.status >= 500 ? 'pending' : 'rejected'
            ..error = e.userMessage;
        }
        await _save();
        notifyListeners();
      }
      // 3. Mutations par lots de 50, dans l'ordre de saisie.
      final pending = items.where((o) => o.kind == 'mutation' && o.status == 'pending').toList();
      for (var i = 0; i < pending.length; i += 50) {
        final batch = pending.skip(i).take(50).toList();
        final J res;
        try {
          res = J.of(
            await api.post(
              '/sync/push',
              body: {
                'device_id': deviceId,
                'mutations': [
                  for (final op in batch)
                    {
                      'client_mutation_id': op.id,
                      'entity': op.entity,
                      'entity_id': op.entityId,
                      'operation': op.operation,
                      'base_version': op.baseVersion,
                      'payload': op.payload,
                      'client_created_at': op.createdAt.toUtc().toIso8601String(),
                    },
                ],
              },
            ),
          );
        } on ApiException catch (e) {
          if (e.isNetwork) return _report(offline: true);
          final permanent = e.status >= 400 && e.status < 500 && !const [401, 408, 429].contains(e.status);
          for (final op in batch) {
            op
              ..attempts += 1
              ..status = permanent ? 'rejected' : 'pending'
              ..error = e.userMessage;
          }
          await _save();
          break;
        }
        for (final r in res.list('results')) {
          final op = batch.where((o) => o.id == r.s('client_mutation_id')).firstOrNull;
          if (op == null) continue;
          switch (r.s('status')) {
            case 'applied' || 'resolved':
              items.remove(op);
              applied++;
            case 'conflict':
              op
                ..status = 'conflict'
                ..conflict = r.objOrNull('conflict')?.raw
                ..serverId = r.str('id');
            default:
              op
                ..status = 'rejected'
                ..error = r.str('error') ?? 'Refusé par le serveur'
                ..serverId = r.str('id');
          }
        }
        await _save();
        notifyListeners();
      }
      lastSync = DateTime.now();
      await _save();
      return SyncReport(applied: applied, conflicts: conflictCount, rejected: rejectedCount, remaining: pendingCount);
    } finally {
      syncing = false;
      notifyListeners();
    }
  }

  /// Résolution explicite d'un conflit (V4-DATA-32) : garder ma version, celle du serveur, ou une fusion.
  Future<void> resolve(PendingOp op, String resolution, {Map<String, dynamic>? merged}) async {
    if (op.serverId == null) throw StateError('Conflit sans référence serveur');
    final res = J.of(await api.post('/sync/conflicts/${op.serverId}/resolve', body: {'resolution': resolution, 'merged': merged}));
    if (const ['resolved', 'applied'].contains(res.s('status')) || resolution == 'server_wins') {
      items.remove(op);
    } else {
      op
        ..status = 'rejected'
        ..error = res.str('error');
    }
    await _save();
    notifyListeners();
  }

  /// Abandon d'une opération refusée (après lecture du motif).
  Future<void> discard(PendingOp op) async {
    items.remove(op);
    if (op.filePath != null) {
      try {
        File(op.filePath!).deleteSync();
      } catch (_) {}
    }
    await _save();
    notifyListeners();
  }

  /// Purge contrôlée (déconnexion) : opérations non envoyées perdues — l'interface prévient avant.
  Future<void> purge() async {
    items.clear();
    lastSync = null;
    _loaded = false;
    if (!kIsWeb) {
      try {
        final dir = Directory('${(await _directory()).path}${Platform.pathSeparator}globus_offline');
        if (dir.existsSync()) dir.deleteSync(recursive: true);
      } catch (_) {}
    }
    await store.write(_keyName, null);
    notifyListeners();
  }
}
