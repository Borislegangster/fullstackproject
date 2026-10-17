import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../auth/auth_controller.dart';
import '../brand/brand.dart';
import '../config.dart';
import '../features/calls/call_controller.dart';
import '../features/calls/call_views.dart';
import '../features/notifications/notifications.dart';
import '../push/push_service.dart';
import '../realtime/realtime.dart';
import '../routing/links.dart';
import '../theme/globus_theme.dart';
import '../widgets/states.dart';
import 'services.dart';

/// Préférence d'affichage (clair / sombre / système), mémorisée sur l'appareil.
class ThemeSettings extends ChangeNotifier {
  ThemeMode mode = ThemeMode.system;
  static const _key = 'globus.theme';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    mode = ThemeMode.values.firstWhere((m) => m.name == prefs.getString(_key), orElse: () => ThemeMode.system);
    notifyListeners();
  }

  Future<void> set(ThemeMode value) async {
    mode = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, value.name);
  }
}

/// Racine d'une application GLOBUS : services, fournisseurs, thème de la charte, français, routeur, appels.
class GlobusAppRoot extends StatefulWidget {
  const GlobusAppRoot({super.key, required this.config, required this.base, required this.routerBuilder, this.services, this.providers});

  final GlobusConfig config;

  /// Base des routes de l'espace (« /espace-client », « /erp »).
  final String base;
  final GoRouter Function(GlobusServices services) routerBuilder;

  /// Fournisseurs propres à l'application (projet courant…).
  final List<SingleChildWidget> Function(GlobusServices services)? providers;

  /// Services injectés (tests) ; sinon créés au démarrage.
  final GlobusServices? services;

  @override
  State<GlobusAppRoot> createState() => _GlobusAppRootState();
}

class _GlobusAppRootState extends State<GlobusAppRoot> {
  late final GlobusServices _services = widget.services ?? GlobusServices.create(widget.config);
  late final GoRouter _router = widget.routerBuilder(_services);
  final _theme = ThemeSettings();

  @override
  void initState() {
    super.initState();
    unawaited(_theme.load());
    if (widget.config.problem == null) unawaited(_services.start());
  }

  @override
  void dispose() {
    unawaited(_services.dispose());
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final problem = widget.config.problem;
    if (problem != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: GlobusTheme.light(),
        home: Scaffold(
          body: SafeArea(
            child: EmptyView(icon: Icons.settings_outlined, title: 'Application non configurée', text: problem),
          ),
        ),
      );
    }
    final s = _services;
    return MultiProvider(
      providers: [
        Provider<GlobusServices>.value(value: s),
        Provider<GlobusConfig>.value(value: s.config),
        Provider<ApiClient>.value(value: s.api),
        Provider<AppLinks>.value(
          value: AppLinks(base: widget.base, isKnown: (path) => _known(path)),
        ),
        ChangeNotifierProvider<AuthController>.value(value: s.auth),
        ChangeNotifierProvider<Realtime>.value(value: s.realtime),
        ChangeNotifierProvider<PushService?>.value(value: s.push),
        ChangeNotifierProvider<NotificationCenter>.value(value: s.notifications),
        ChangeNotifierProvider<CallController?>.value(value: s.calls),
        ChangeNotifierProvider<CallController>.value(value: s.calls),
        ChangeNotifierProvider<BrandService?>.value(value: s.brand),
        ChangeNotifierProvider<ThemeSettings>.value(value: _theme),
        ...?widget.providers?.call(s),
      ],
      child: Consumer<ThemeSettings>(
        builder: (context, theme, _) => MaterialApp.router(
          title: s.config.app.displayName,
          debugShowCheckedModeBanner: false,
          theme: GlobusTheme.light(),
          darkTheme: GlobusTheme.dark(),
          themeMode: theme.mode,
          locale: const Locale('fr', 'FR'),
          supportedLocales: const [Locale('fr', 'FR'), Locale('fr')],
          localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
          routerConfig: _router,
          builder: (context, child) => CallOverlay(child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }

  /// Une route est « connue » si le routeur de l'application sait l'afficher.
  bool _known(String path) {
    try {
      final match = _router.configuration.findMatch(Uri.parse(path));
      return match.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}
