import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stockage chiffré des jetons de session (Keystore Android / Keychain iOS / DPAPI Windows) — §14.3 « chiffrement local ».
abstract class SessionStore {
  Future<String?> read(String key);
  Future<void> write(String key, String? value);
  Future<void> clear();

  static const accessKey = 'globus.access';
  static const refreshKey = 'globus.refresh';
  static const deviceKey = 'globus.device';
  static const userKey = 'globus.user';
}

class SecureSessionStore implements SessionStore {
  SecureSessionStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      // Trousseau illisible (restauration d'appareil, clé révoquée) : session considérée comme absente.
      return null;
    }
  }

  @override
  Future<void> write(String key, String? value) async {
    if (value == null) {
      await _storage.delete(key: key);
    } else {
      await _storage.write(key: key, value: value);
    }
  }

  /// Efface la session mais conserve l'identifiant d'appareil (appareil de confiance, historique des connexions).
  @override
  Future<void> clear() async {
    for (final key in [SessionStore.accessKey, SessionStore.refreshKey, SessionStore.userKey]) {
      await _storage.delete(key: key);
    }
  }
}

/// Stockage en mémoire (tests).
class MemorySessionStore implements SessionStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String? value) async {
    if (value == null) {
      values.remove(key);
    } else {
      values[key] = value;
    }
  }

  @override
  Future<void> clear() async {
    values.remove(SessionStore.accessKey);
    values.remove(SessionStore.refreshKey);
    values.remove(SessionStore.userKey);
  }
}

/// Identifiant aléatoire (UUID v4) pour les clés d'idempotence et l'appareil.
String newKey() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  String h(int i) => b[i].toRadixString(16).padLeft(2, '0');
  final s = List.generate(16, h).join();
  return '${s.substring(0, 8)}-${s.substring(8, 12)}-${s.substring(12, 16)}-${s.substring(16, 20)}-${s.substring(20)}';
}
