import 'dart:io';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'field_state.dart';

/// GLOBUS Terrain — application unique du personnel (terrain et entreprise), écrans filtrés par rôle, métier et
/// permissions, opérations hors ligne synchronisées sans écrasement silencieux (§2.5, §14, V4-DATA-32/33).
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(GlobusFieldApp(config: GlobusConfig.fromEnvironment(GlobusApp.field)));
}

class GlobusFieldApp extends StatelessWidget {
  const GlobusFieldApp({super.key, required this.config, this.services, this.offlineDirectory});
  final GlobusConfig config;
  final GlobusServices? services;

  /// Dossier de la file hors ligne (tests) ; par défaut le dossier privé de l'application.
  final Future<Directory> Function()? offlineDirectory;

  @override
  Widget build(BuildContext context) {
    return GlobusAppRoot(
      config: config,
      base: base,
      services: services,
      routerBuilder: buildRouter,
      providers: (s) => [
        ChangeNotifierProvider<FieldProjects>(create: (_) => FieldProjects(s.api, s.auth)),
        ChangeNotifierProvider<OfflineQueue>(
          lazy: false,
          create: (_) {
            final queue = OfflineQueue(s.api, s.api.store, directory: offlineDirectory);
            // Purge contrôlée à la déconnexion (§14.3) ; l'écran de synchronisation prévient avant.
            s.auth.onSignOut(queue.purge);
            return queue;
          },
        ),
        // Envoi automatique (démarrage, retour du réseau, premier plan, toutes les 2 minutes) ; libéré avec l'application.
        Provider<FieldSync>(lazy: false, create: (context) => FieldSync(context.read<OfflineQueue>(), s), dispose: (_, sync) => sync.dispose()),
      ],
    );
  }
}
