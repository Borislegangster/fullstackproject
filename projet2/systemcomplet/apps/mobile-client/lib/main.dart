import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'project.dart';

/// GLOBUS Client — application mobile de l'espace client (§2, §6 du cahier des charges).
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(GlobusClientApp(config: GlobusConfig.fromEnvironment(GlobusApp.client)));
}

class GlobusClientApp extends StatelessWidget {
  const GlobusClientApp({super.key, required this.config, this.services});
  final GlobusConfig config;
  final GlobusServices? services;

  @override
  Widget build(BuildContext context) {
    return GlobusAppRoot(
      config: config,
      base: base,
      services: services,
      routerBuilder: buildRouter,
      providers: (s) => [ChangeNotifierProvider<ClientProjects>(create: (_) => ClientProjects(s.api, s.auth))],
    );
  }
}
