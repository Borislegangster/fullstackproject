import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

import 'app.dart';

/// GLOBUS Direction — pilotage et validations de la direction et des responsables (KPI, approbations, CRM,
/// fournisseurs, sous-traitance, litiges, finance, RH, sécurité), mêmes droits que l'ERP web.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(GlobusDirectionApp(config: GlobusConfig.fromEnvironment(GlobusApp.direction)));
}

class GlobusDirectionApp extends StatelessWidget {
  const GlobusDirectionApp({super.key, required this.config, this.services});
  final GlobusConfig config;
  final GlobusServices? services;

  @override
  Widget build(BuildContext context) {
    return GlobusAppRoot(config: config, base: base, services: services, routerBuilder: buildRouter);
  }
}
