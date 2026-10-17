import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart' show sha256;
import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'session_store.dart';

/// Entrée de cache : dernière réponse connue d'une lecture, affichée hors ligne avec sa date (état « offline »).
class CachedResponse {
  const CachedResponse(this.data, this.savedAt);
  final Object? data;
  final DateTime savedAt;
}

/// Cache local chiffré (AES-256-GCM, clé dans le stockage sécurisé) des lectures de l'API.
///
/// Seules les réponses GET marquées « consultables hors ligne » y sont écrites ; tout est purgé à la déconnexion.
abstract class ResponseCache {
  Future<CachedResponse?> read(String scope, String key);
  Future<void> write(String scope, String key, Object? data);
  Future<void> purge();
}

class EncryptedFileCache implements ResponseCache {
  EncryptedFileCache(this._store, {Future<Directory> Function()? directory}) : _directory = directory ?? getApplicationSupportDirectory;

  static const _keyName = 'globus.cachekey';
  final SessionStore _store;
  final Future<Directory> Function() _directory;
  final _algo = AesGcm.with256bits();
  SecretKey? _key;

  Future<SecretKey> _secret() async {
    if (_key != null) return _key!;
    final existing = await _store.read(_keyName);
    if (existing != null) {
      _key = SecretKey(base64Decode(existing));
    } else {
      final key = await _algo.newSecretKey();
      await _store.write(_keyName, base64Encode(await key.extractBytes()));
      _key = key;
    }
    return _key!;
  }

  Future<File> _file(String scope, String key) async {
    final dir = Directory('${(await _directory()).path}${Platform.pathSeparator}globus_cache');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    final name = sha256.convert(utf8.encode('$scope|$key')).toString();
    return File('${dir.path}${Platform.pathSeparator}$name.bin');
  }

  @override
  Future<CachedResponse?> read(String scope, String key) async {
    if (kIsWeb) return null;
    try {
      final file = await _file(scope, key);
      if (!file.existsSync()) return null;
      final box = SecretBox.fromConcatenation(await file.readAsBytes(), nonceLength: 12, macLength: 16);
      final clear = await _algo.decrypt(box, secretKey: await _secret());
      final json = jsonDecode(utf8.decode(clear)) as Map<String, dynamic>;
      return CachedResponse(json['data'], DateTime.parse(json['saved_at'] as String));
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String scope, String key, Object? data) async {
    if (kIsWeb) return;
    try {
      final payload = utf8.encode(jsonEncode({'saved_at': DateTime.now().toUtc().toIso8601String(), 'data': data}));
      final box = await _algo.encrypt(payload, secretKey: await _secret());
      final file = await _file(scope, key);
      await file.writeAsBytes(box.concatenation(), flush: true);
    } catch (_) {
      // Cache best-effort : une écriture impossible n'empêche jamais l'affichage des données fraîches.
    }
  }

  @override
  Future<void> purge() async {
    _key = null;
    await _store.write(_keyName, null);
    if (kIsWeb) return;
    try {
      final dir = Directory('${(await _directory()).path}${Platform.pathSeparator}globus_cache');
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    } catch (_) {}
  }
}

/// Cache en mémoire (tests, web).
class MemoryCache implements ResponseCache {
  final Map<String, CachedResponse> entries = {};

  @override
  Future<CachedResponse?> read(String scope, String key) async => entries['$scope|$key'];

  @override
  Future<void> write(String scope, String key, Object? data) async => entries['$scope|$key'] = CachedResponse(data, DateTime.now());

  @override
  Future<void> purge() async => entries.clear();
}
