import 'dart:async';
import 'dart:convert';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/session_store.dart';
import 'me.dart';

enum AuthStatus { unknown, signedOut, signedIn }

/// Étape de connexion : identifiants acceptés, ou double authentification à fournir.
class LoginStep {
  const LoginStep.done(this.user) : mfaToken = null, methods = const [];
  const LoginStep.mfa(this.mfaToken, this.methods) : user = null;

  final Me? user;
  final String? mfaToken;
  final List<String> methods;
  bool get needsMfa => mfaToken != null;
}

/// État d'authentification de l'application : session restaurée au démarrage (hors ligne compris), connexion,
/// double authentification, activation d'invitation, déconnexion, expiration de session.
class AuthController extends ChangeNotifier {
  AuthController(this.api) {
    api.sessionExpired.addListener(_onExpired);
  }

  final ApiClient api;
  AuthStatus status = AuthStatus.unknown;
  Me? user;

  /// Message à afficher sur l'écran de connexion (session expirée, compte non autorisé…).
  String? notice;

  /// Session ouverte avec le dernier profil connu, sans réseau.
  bool offline = false;

  final List<Future<void> Function(Me user)> _onSignIn = [];
  final List<Future<void> Function()> _onSignOut = [];

  /// Actions à exécuter à chaque connexion (temps réel, push) et à la déconnexion.
  void onSignIn(Future<void> Function(Me user) cb) => _onSignIn.add(cb);
  void onSignOut(Future<void> Function() cb) => _onSignOut.add(cb);

  bool can(String permission) => user?.can(permission) ?? false;

  Future<void> bootstrap() async {
    await api.restore();
    if (!api.hasSession) {
      _set(AuthStatus.signedOut, null);
      return;
    }
    try {
      final me = Me((await api.get('/auth/me') as Map).cast<String, dynamic>());
      await _signedIn(me);
    } on ApiException catch (e) {
      if (e.isNetwork) {
        final cached = await api.store.read(SessionStore.userKey);
        if (cached != null) {
          offline = true;
          await _signedIn(Me((jsonDecode(cached) as Map).cast<String, dynamic>()), persist: false);
          return;
        }
      }
      await api.clearSession(purgeCache: false);
      _set(AuthStatus.signedOut, null);
    }
  }

  Future<LoginStep> login(String email, String password, {bool remember = true}) async {
    final res = (await api.post(
      '/auth/login',
      body: {
        'email': email.trim(),
        'password': password,
        'remember': remember,
        'device_key': await api.deviceKey(),
        'device_name': await deviceName(),
      },
    ) as Map).cast<String, dynamic>();
    if (res['mfa_required'] == true) {
      return LoginStep.mfa(res['mfa_token'] as String, (res['methods'] as List? ?? const ['totp']).map((e) => e.toString()).toList());
    }
    return LoginStep.done(await _complete(res));
  }

  Future<Me> verifyMfa(String mfaToken, {String? code, String? recoveryCode, bool trustDevice = false}) async {
    final res = (await api.post(
      '/auth/mfa/verify',
      body: {
        'mfa_token': mfaToken,
        'code': code,
        'recovery_code': recoveryCode,
        'trust_device': trustDevice,
      },
    ) as Map).cast<String, dynamic>();
    return _complete(res);
  }

  /// Activation d'un accès créé par GLOBUS (lien d'invitation reçu par e-mail ou WhatsApp).
  Future<Me> acceptInvitation({required String token, required String password, String? firstName, String? lastName, String? phone}) async {
    final res = (await api.post(
      '/auth/invitations/accept',
      body: {
        'token': token,
        'password': password,
        'first_name': _nullIfEmpty(firstName),
        'last_name': _nullIfEmpty(lastName),
        'phone': _nullIfEmpty(phone),
      },
    ) as Map).cast<String, dynamic>();
    return _complete(res);
  }

  Future<Me> _complete(Map<String, dynamic> res) async {
    await api.saveTokens(res);
    final me = Me((res['user'] as Map).cast<String, dynamic>());
    await _signedIn(me);
    return me;
  }

  Future<Me?> reload() async {
    try {
      final me = Me((await api.get('/auth/me') as Map).cast<String, dynamic>());
      user = me;
      offline = false;
      await api.store.write(SessionStore.userKey, jsonEncode(me.raw));
      notifyListeners();
      return me;
    } on ApiException catch (e) {
      if (e.isNetwork) return user;
      rethrow;
    }
  }

  /// Met à jour le profil local après une modification (avatar, préférences) sans nouvel appel réseau.
  void replaceUser(Map<String, dynamic> raw) {
    user = Me(raw);
    unawaited(api.store.write(SessionStore.userKey, jsonEncode(raw)));
    notifyListeners();
  }

  Future<void> logout({String? notice}) async {
    for (final cb in _onSignOut) {
      try {
        await cb();
      } catch (_) {}
    }
    try {
      if (api.hasSession) await api.post('/auth/logout');
    } catch (_) {
      // Session déjà expirée côté serveur.
    }
    await api.clearSession();
    this.notice = notice;
    _set(AuthStatus.signedOut, null);
  }

  Future<void> _signedIn(Me me, {bool persist = true}) async {
    api.setCacheScope(me.id);
    if (persist) {
      offline = false;
      await api.store.write(SessionStore.userKey, jsonEncode(me.raw));
    }
    notice = null;
    _set(AuthStatus.signedIn, me);
    for (final cb in _onSignIn) {
      unawaited(cb(me).catchError((Object _) {}));
    }
  }

  void _onExpired() {
    if (status != AuthStatus.signedIn) return;
    unawaited(_expire());
  }

  Future<void> _expire() async {
    for (final cb in _onSignOut) {
      try {
        await cb();
      } catch (_) {}
    }
    await api.clearSession();
    notice = 'Votre session a expiré. Reconnectez-vous.';
    _set(AuthStatus.signedOut, null);
  }

  void _set(AuthStatus s, Me? me) {
    status = s;
    user = me;
    notifyListeners();
  }

  static String? _nullIfEmpty(String? v) => v == null || v.trim().isEmpty ? null : v.trim();

  @override
  void dispose() {
    api.sessionExpired.removeListener(_onExpired);
    super.dispose();
  }
}

/// Nom lisible de l'appareil (historique des connexions, appareils de confiance).
Future<String> deviceName() async {
  if (kIsWeb) return 'Navigateur';
  try {
    return await _deviceName().timeout(const Duration(seconds: 3));
  } catch (_) {
    // Information facultative : jamais bloquante pour la connexion.
    return 'Appareil mobile';
  }
}

Future<String> _deviceName() async {
  final info = DeviceInfoPlugin();
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      final a = await info.androidInfo;
      return '${a.manufacturer} ${a.model} · Android ${a.version.release}';
    case TargetPlatform.iOS:
      final i = await info.iosInfo;
      return '${i.name} · iOS ${i.systemVersion}';
    case TargetPlatform.windows:
      final w = await info.windowsInfo;
      return '${w.computerName} · Windows';
    default:
      return 'Appareil mobile';
  }
}
