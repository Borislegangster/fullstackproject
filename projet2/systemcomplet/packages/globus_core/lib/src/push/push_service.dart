import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../auth/auth_controller.dart';
import '../config.dart';

enum PushState { unavailable, disabled, enabled, denied }

/// Notifications push mobiles (FCM HTTP v1 côté serveur) : enregistrement du jeton de l'appareil
/// (`/push/subscriptions`, kind « fcm »), ouverture du lien de la notification, réveil pour les appels entrants.
///
/// Sans configuration Firebase fournie à la construction, le push est indisponible : les notifications restent
/// reçues dans l'application (temps réel + liste) et par e-mail / WhatsApp selon les préférences.
class PushService extends ChangeNotifier {
  PushService(this.api, this.config);

  final ApiClient api;
  final GlobusConfig config;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  PushState state = PushState.unavailable;
  String? _token;
  bool _ready = false;
  StreamSubscription<String>? _refreshSub;
  StreamSubscription<RemoteMessage>? _openSub;

  /// Lien interne à ouvrir (notification touchée).
  final ValueNotifier<String?> openLink = ValueNotifier(null);

  static const _prefKey = 'globus.push.optout';

  bool get supported => config.firebase != null && !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);

  Future<void> init() async {
    if (_ready) return;
    _ready = true;
    await _initLocal();
    if (!supported) {
      state = PushState.unavailable;
      notifyListeners();
      return;
    }
    final fb = config.firebase!;
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: fb.apiKey,
          appId: fb.appId,
          messagingSenderId: fb.senderId,
          projectId: fb.projectId,
          iosBundleId: fb.iosBundleId,
        ),
      );
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _open(initial.data['url']?.toString());
      _openSub = FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data['url']?.toString()));
    } catch (e) {
      debugPrint('Push indisponible : $e');
      state = PushState.unavailable;
      notifyListeners();
    }
  }

  Future<void> _initLocal() async {
    if (kIsWeb) return;
    try {
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
        onDidReceiveNotificationResponse: (r) => _open(r.payload),
      );
    } catch (_) {
      // Plateforme sans notifications locales (tests, bureau) : sans effet.
    }
  }

  void _open(String? link) {
    if (link == null || link.isEmpty) return;
    openLink.value = link;
  }

  /// Notification locale (appel entrant, rappel) quand l'application est en arrière-plan.
  Future<void> showLocal({required int id, required String title, String? body, String? link, bool urgent = false}) async {
    if (kIsWeb) return;
    try {
      await _local.show(
        id: id,
        title: title,
        body: body,
        payload: link,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            urgent ? 'globus_urgent' : 'globus',
            urgent ? 'Appels et alertes' : 'Notifications GLOBUS',
            importance: urgent ? Importance.max : Importance.high,
            priority: urgent ? Priority.max : Priority.high,
            category: urgent ? AndroidNotificationCategory.call : null,
            fullScreenIntent: urgent,
          ),
          iOS: const DarwinNotificationDetails(presentAlert: true, presentSound: true),
        ),
      );
    } catch (_) {}
  }

  /// Après connexion : réactive le push si l'utilisateur ne l'a pas désactivé sur cet appareil.
  Future<void> onSignIn() async {
    if (!supported || state == PushState.unavailable && Firebase.apps.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_prefKey) == true) {
      state = PushState.disabled;
      notifyListeners();
      return;
    }
    await enable(silent: true);
  }

  Future<PushState> enable({bool silent = false}) async {
    if (!supported || Firebase.apps.isEmpty) return state = PushState.unavailable;
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      state = PushState.denied;
      notifyListeners();
      return state;
    }
    // Le jeton FCM arrive par onRegistered (premier enregistrement puis chaque renouvellement).
    await _refreshSub?.cancel();
    final first = Completer<String>();
    _refreshSub = messaging.onRegistered.listen((t) {
      _token = t;
      if (!first.isCompleted) first.complete(t);
      unawaited(_register(t).catchError((Object _) {}));
    });
    await messaging.register();
    try {
      await first.future.timeout(const Duration(seconds: 20));
    } on TimeoutException {
      return state = PushState.unavailable;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefKey);
    state = PushState.enabled;
    notifyListeners();
    return state;
  }

  Future<void> _register(String token) async {
    await api.post(
      '/push/subscriptions',
      body: {
        'kind': 'fcm',
        'endpoint': token,
        'application': config.app.header,
        'device_name': await deviceName(),
      },
    );
  }

  /// Désactivation sur cet appareil (préférence mémorisée) ou à la déconnexion (jeton retiré du compte).
  Future<void> disable({bool remember = true}) async {
    final token = _token;
    if (token != null) {
      try {
        await api.post('/push/unsubscribe', body: {'endpoint': token});
      } catch (_) {}
    }
    await _refreshSub?.cancel();
    _refreshSub = null;
    if (remember) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefKey, true);
    }
    state = supported ? PushState.disabled : PushState.unavailable;
    notifyListeners();
  }

  /// Notification de test sur tous les canaux actifs (vérification du parcours).
  Future<void> test() => api.post('/push/test');

  @override
  void dispose() {
    unawaited(_refreshSub?.cancel());
    unawaited(_openSub?.cancel());
    super.dispose();
  }
}
