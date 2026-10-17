import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../api/api_client.dart';
import '../api/response_cache.dart';
import '../api/session_store.dart';
import '../auth/auth_controller.dart';
import '../brand/brand.dart';
import '../config.dart';
import '../features/calls/call_controller.dart';
import '../features/notifications/notifications.dart';
import '../push/push_service.dart';
import '../realtime/realtime.dart';

/// Services d'une application GLOBUS (créés une fois au démarrage) et leur cycle de vie.
class GlobusServices with WidgetsBindingObserver {
  GlobusServices._(this.config, this.api, this.auth, this.realtime, this.push, this.notifications, this.calls, this.brand, this.liveFeatures);

  /// [dio] et [liveFeatures] servent aux tests (serveur simulé, sans WebSocket ni réseau de l'appareil).
  factory GlobusServices.create(GlobusConfig config, {SessionStore? store, ResponseCache? cache, Dio? dio, bool liveFeatures = true}) {
    final s = store ?? (kIsWeb ? MemorySessionStore() : SecureSessionStore());
    final api = ApiClient(config: config, store: s, cache: cache ?? (kIsWeb ? MemoryCache() : EncryptedFileCache(s)), dio: dio);
    final auth = AuthController(api);
    final realtime = Realtime(api);
    final push = PushService(api, config);
    final notifications = NotificationCenter(api, realtime);
    final calls = CallController(api, realtime, auth, push);
    return GlobusServices._(config, api, auth, realtime, push, notifications, calls, BrandService(api), liveFeatures);
  }

  /// Temps réel, push et surveillance du réseau (désactivés dans les tests de widgets).
  final bool liveFeatures;

  final GlobusConfig config;
  final ApiClient api;
  final AuthController auth;
  final Realtime realtime;
  final PushService push;
  final NotificationCenter notifications;
  final CallController calls;
  final BrandService brand;
  StreamSubscription<List<ConnectivityResult>>? _net;

  /// Vrai si l'appareil n'a aucun réseau (bandeau « hors ligne » global).
  final ValueNotifier<bool> offline = ValueNotifier(false);

  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    auth
      ..onSignIn((user) async {
        if (liveFeatures) await realtime.start();
        calls.attach();
        await notifications.start();
        if (liveFeatures) await push.onSignIn();
      })
      ..onSignOut(() async {
        await push.disable(remember: false);
        calls.detach();
        notifications.stop();
        await realtime.stop();
      });
    unawaited(brand.load());
    if (liveFeatures) unawaited(push.init());
    if (liveFeatures) {
      _net = Connectivity().onConnectivityChanged.listen(
        (results) {
          final none = results.isEmpty || results.every((r) => r == ConnectivityResult.none);
          final wasOffline = offline.value;
          offline.value = none;
          if (wasOffline && !none) _onBack();
        },
        onError: (Object _) {},
      );
    }
    await auth.bootstrap();
  }

  void _onBack() {
    realtime.nudge();
    if (auth.status == AuthStatus.signedIn) {
      unawaited(notifications.refresh());
      if (auth.offline) unawaited(auth.reload());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _onBack();
  }

  Future<void> dispose() async {
    WidgetsBinding.instance.removeObserver(this);
    await _net?.cancel();
    calls.dispose();
    await realtime.stop();
  }
}
