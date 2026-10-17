import 'package:flutter/foundation.dart';

/// Application cliente (en-tête `X-Client-App`, reconnu par l'API : jetons bearer au lieu des cookies du web).
enum GlobusApp {
  client('mobile-client', 'GLOBUS Client', 'client'),
  field('mobile-field', 'GLOBUS Terrain', 'erp'),
  direction('mobile-direction', 'GLOBUS Direction', 'erp');

  const GlobusApp(this.header, this.displayName, this.space);

  /// Valeur de l'en-tête `X-Client-App`.
  final String header;
  final String displayName;

  /// Espace de l'utilisateur requis (`Me.spaces`).
  final String space;
}

/// Configuration de construction (`--dart-define` / `--dart-define-from-file=config/<env>.json`).
///
/// Aucune adresse n'est codée en dur : une application construite sans `GLOBUS_API_URL` affiche un écran
/// « application non configurée ». En production (build release) seule une adresse HTTPS est acceptée (§0.2 règle 3).
class GlobusConfig {
  const GlobusConfig({required this.app, required this.apiUrl, this.environment = 'production', this.firebase});

  factory GlobusConfig.fromEnvironment(GlobusApp app) {
    const url = String.fromEnvironment('GLOBUS_API_URL');
    const env = String.fromEnvironment('GLOBUS_ENV', defaultValue: 'production');
    return GlobusConfig(app: app, apiUrl: url.trim(), environment: env, firebase: FirebaseConfig.fromEnvironment());
  }

  final GlobusApp app;

  /// Origine du serveur (ex. https://globus.example.com), sans `/api/v1`.
  final String apiUrl;
  final String environment;
  final FirebaseConfig? firebase;

  String get origin => apiUrl.endsWith('/') ? apiUrl.substring(0, apiUrl.length - 1) : apiUrl;
  String get apiBase => '$origin/api/v1';

  /// Message d'erreur si la configuration est inutilisable, sinon `null`.
  String? get problem {
    if (apiUrl.isEmpty) return "Adresse du serveur GLOBUS absente : l'application doit être construite avec GLOBUS_API_URL.";
    final uri = Uri.tryParse(apiUrl);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return 'Adresse du serveur GLOBUS invalide : $apiUrl';
    // HTTP local : poste de développement uniquement (debug, ou profil pour les parcours de bout en bout), jamais en release.
    if (uri.scheme != 'https' && !((kDebugMode || kProfileMode) && _isLocal(uri.host))) {
      return 'Connexion non sécurisée refusée : le serveur GLOBUS doit être joint en HTTPS.';
    }
    return null;
  }

  static bool _isLocal(String host) =>
      host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2' || host.endsWith('.localhost') || host.endsWith('.test');

  /// Convertit un chemin de l'API (`/api/v1/...`, `/public/...`) ou une URL absolue en URL complète.
  String absolute(String pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
    if (pathOrUrl.startsWith('/api/')) return '$origin$pathOrUrl';
    if (pathOrUrl.startsWith('/')) return '$apiBase$pathOrUrl';
    return '$apiBase/$pathOrUrl';
  }
}

/// Paramètres Firebase (push FCM) fournis à la construction ; push désactivé s'ils sont absents.
class FirebaseConfig {
  const FirebaseConfig({required this.apiKey, required this.appId, required this.senderId, required this.projectId, this.iosBundleId});

  static FirebaseConfig? fromEnvironment() {
    const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
    const appId = String.fromEnvironment('FIREBASE_APP_ID');
    const sender = String.fromEnvironment('FIREBASE_SENDER_ID');
    const project = String.fromEnvironment('FIREBASE_PROJECT_ID');
    const iosBundle = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');
    if (apiKey.isEmpty || appId.isEmpty || sender.isEmpty || project.isEmpty) return null;
    return const FirebaseConfig(
      apiKey: apiKey,
      appId: appId,
      senderId: sender,
      projectId: project,
      iosBundleId: iosBundle == '' ? null : iosBundle,
    );
  }

  final String apiKey;
  final String appId;
  final String senderId;
  final String projectId;
  final String? iosBundleId;
}
