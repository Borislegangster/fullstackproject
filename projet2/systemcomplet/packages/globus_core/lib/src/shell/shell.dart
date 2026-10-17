import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../auth/auth_controller.dart';
import '../auth/me.dart';
import '../brand/brand.dart';
import '../config.dart';
import '../context.dart';
import '../features/auth/auth_screens.dart';
import '../features/notifications/notifications.dart';
import '../routing/links.dart';
import '../theme/globus_theme.dart';
import '../widgets/primitives.dart';
import '../widgets/states.dart';
import 'services.dart';

/// Entrée de menu (miroir du NavItem du web) : visible selon permissions et modules optionnels activés.
class NavItem {
  const NavItem(this.path, this.label, this.icon, {this.perms = const [], this.feature, this.anyPerms = const []});
  final String path;
  final String label;
  final IconData icon;
  final List<String> perms;
  final List<String> anyPerms;
  final String? feature;

  bool visibleFor(Me? user) {
    if (user == null) return false;
    if (perms.isNotEmpty && !user.canAll(perms)) return false;
    if (anyPerms.isNotEmpty && !user.canAny(anyPerms)) return false;
    if (feature != null && !user.hasFeature(feature!)) return false;
    return true;
  }
}

class NavSection {
  const NavSection(this.items, {this.title});
  final String? title;
  final List<NavItem> items;
}

/// Page de l'application (chemin calqué sur le web, titre affiché dans la barre).
class AppPage {
  const AppPage(this.path, this.title, this.builder, {this.top = false});
  final String path;
  final String title;
  final Widget Function(BuildContext context, GoRouterState state) builder;

  /// Page de premier niveau (menu) : bouton menu au lieu du retour.
  final bool top;
}

/// Construit le routeur : démarrage, authentification, garde d'espace, MFA obligatoire, pages de l'application,
/// liens profonds (notifications, push, liens d'activation / réinitialisation).
GoRouter buildGlobusRouter({
  required GlobusServices services,
  required String base,
  required String home,
  required List<AppPage> pages,
  required Widget Function(BuildContext context, GoRouterState state, Widget child) shell,
  bool Function(Me user)? allowed,
}) {
  final auth = services.auth;
  final app = services.config.app;
  String? pending;
  // MFA exigée par le serveur (MFA_ENROLLMENT_REQUIRED, mode « enforce ») : seul « Mon compte » reste accessible
  // jusqu'à l'activation. En mode « warn », l'utilisateur est seulement orienté vers la sécurité à la connexion.
  var mfaLock = false;
  const public = ['/connexion', '/mot-de-passe-oublie', '/reset', '/activation'];
  final router = GoRouter(
    initialLocation: '/demarrage',
    refreshListenable: auth,
    errorBuilder: (context, state) => UnknownRouteScreen(path: state.uri.path),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final full = state.uri.toString();
      final isPublic = public.any((p) => loc == p || loc.startsWith('$p/'));
      switch (auth.status) {
        case AuthStatus.unknown:
          if (loc != '/demarrage' && !isPublic) pending ??= full;
          return loc == '/demarrage' ? null : '/demarrage';
        case AuthStatus.signedOut:
          if (isPublic) return null;
          if (loc != '/demarrage' && loc != '/acces-refuse' && loc.startsWith(base)) pending = full;
          return '/connexion';
        case AuthStatus.signedIn:
          final user = auth.user!;
          final ok = user.spaces.contains(app.space) && (allowed?.call(user) ?? true);
          if (!ok) return loc == '/acces-refuse' ? null : '/acces-refuse';
          if (user.mfaEnabled) mfaLock = false;
          if (mfaLock) return loc == '$base/compte' ? null : '$base/compte?mfa=obligatoire';
          if (loc == '/demarrage' || isPublic || loc == '/acces-refuse' || loc == '/') {
            final target = pending;
            pending = null;
            // Première connexion / activation d'un profil à MFA obligatoire : activer la double authentification d'abord.
            if (user.mustEnrollMfa && loc != '/demarrage') return '$base/compte?mfa=obligatoire';
            return target ?? home;
          }
          return null;
      }
    },
    routes: [
      GoRoute(path: '/', redirect: (_, _) => home),
      GoRoute(path: '/demarrage', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/connexion', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/mot-de-passe-oublie', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/reset',
        builder: (_, s) => ResetPasswordScreen(token: s.uri.queryParameters['token']),
      ),
      GoRoute(
        path: '/activation',
        builder: (_, s) => ActivationScreen(token: s.uri.queryParameters['invitation']),
      ),
      GoRoute(path: '/acces-refuse', builder: (_, _) => const NoAccessScreen()),
      ShellRoute(
        builder: shell,
        routes: [
          for (final p in pages)
            GoRoute(
              path: p.path,
              pageBuilder: (context, state) => NoTransitionPage(key: state.pageKey, child: p.builder(context, state)),
            ),
        ],
      ),
    ],
  );
  // Lien d'une notification push touchée, ou MFA devenue obligatoire.
  services.push.openLink.addListener(() {
    final link = services.push.openLink.value;
    if (link == null) return;
    services.push.openLink.value = null;
    final target = AppLinks(base: base, isKnown: (_) => true).resolve(link, services.config.origin);
    if (target != null) unawaited(router.push(target));
  });
  services.api.mfaRequired.addListener(() {
    mfaLock = true;
    router.go('$base/compte?mfa=obligatoire');
  });
  return router;
}

/// Correspondance chemin courant → page déclarée (motifs go_router `:param`).
AppPage? matchPage(List<AppPage> pages, String location) {
  final path = Uri.parse(location).path;
  for (final p in pages) {
    final re = RegExp('^${p.path.replaceAllMapped(RegExp(r':(\w+)'), (_) => '[^/]+')}\$');
    if (re.hasMatch(path)) return p;
  }
  return null;
}

/// Cadre des pages de l'application : barre (titre, sélecteur, cloche), menu latéral complet, barre d'onglets,
/// bandeau hors ligne global.
class GlobusShell extends StatelessWidget {
  const GlobusShell({
    super.key,
    required this.state,
    required this.child,
    required this.pages,
    required this.sections,
    required this.tabs,
    required this.base,
    this.topbar,
    this.drawerHeader,
  });

  final GoRouterState state;
  final Widget child;
  final List<AppPage> pages;
  final List<NavSection> sections;
  final List<NavItem> tabs;
  final String base;

  /// Contenu affiché sous la barre (sélecteur de projet…).
  final Widget? topbar;
  final Widget? drawerHeader;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final services = context.read<GlobusServices>();
    final location = state.uri.path;
    final page = matchPage(pages, location);
    final visibleTabs = tabs.where((t) => t.visibleFor(user)).toList();
    final tabIndex = visibleTabs.indexWhere((t) => location == t.path || location.startsWith('${t.path}/'));
    final isTop = page?.top ?? false;
    return Scaffold(
      appBar: AppBar(
        leading: isTop
            ? Builder(
                builder: (ctx) => IconButton(tooltip: 'Menu', icon: const Icon(Icons.menu), onPressed: () => Scaffold.of(ctx).openDrawer()),
              )
            : IconButton(
                tooltip: 'Retour',
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.canPop() ? context.pop() : context.go(_parent(location)),
              ),
        title: Text(page?.title ?? services.config.app.displayName),
        actions: [
          NotificationBell(onOpen: () => context.push('$base/notifications')),
          const SizedBox(width: 4),
        ],
        bottom: topbar == null ? null : PreferredSize(preferredSize: const Size.fromHeight(44), child: topbar!),
      ),
      drawer: _NavDrawer(sections: sections, base: base, location: location, header: drawerHeader),
      body: Column(
        children: [
          ValueListenableBuilder<bool>(
            valueListenable: services.offline,
            builder: (_, off, _) => off ? const OfflineBanner() : const SizedBox.shrink(),
          ),
          Expanded(child: _InAppNotifications(child: child)),
        ],
      ),
      bottomNavigationBar: visibleTabs.length < 2
          ? null
          : NavigationBar(
              selectedIndex: tabIndex < 0 ? visibleTabs.length - 1 : tabIndex,
              onDestinationSelected: (i) => context.go(visibleTabs[i].path),
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              height: 64,
              destinations: [for (final t in visibleTabs) NavigationDestination(icon: Icon(t.icon), label: t.label)],
            ),
    );
  }

  String _parent(String location) {
    final parts = location.split('/')..removeLast();
    final parent = parts.join('/');
    return parent.isEmpty || parent == base ? base : parent;
  }
}

class _NavDrawer extends StatelessWidget {
  const _NavDrawer({required this.sections, required this.base, required this.location, this.header});
  final List<NavSection> sections;
  final String base;
  final String location;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final app = context.read<GlobusConfig>().app;
    final theme = Theme.of(context);
    return NavigationDrawer(
      children: [
        DrawerHeader(
          decoration: const BoxDecoration(color: GlobusTokens.brand900),
          child: Row(
            children: [
              const BrandIcon(size: 48),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.displayName,
                      style: const TextStyle(fontFamily: GlobusFonts.title, color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    if (user != null)
                      Text(
                        user.fullName,
                        style: const TextStyle(color: GlobusTokens.brand200),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    if (user != null)
                      Text(
                        user.email,
                        style: const TextStyle(color: GlobusTokens.brand200, fontSize: 11.5),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        ?header,
        for (final section in sections) ...[
          if (section.title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 14, 16, 6),
              child: Text(
                section.title!.toUpperCase(),
                style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 1.2, fontWeight: FontWeight.w700, color: theme.colorScheme.onSurfaceVariant),
              ),
            ),
          for (final item in section.items.where((i) => i.visibleFor(user)))
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: ListTile(
                dense: true,
                selected: location == item.path || location.startsWith('${item.path}/'),
                selectedTileColor: theme.colorScheme.primaryContainer,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                leading: Icon(item.icon),
                title: Text(item.label),
                onTap: () {
                  Navigator.pop(context);
                  context.go(item.path);
                },
              ),
            ),
        ],
        const Divider(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: ListTile(
            dense: true,
            leading: const Icon(Icons.logout),
            title: const Text('Se déconnecter'),
            onTap: () async {
              Navigator.pop(context);
              await context.auth.logout();
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// Bandeau des notifications reçues en temps réel pendant l'utilisation.
class _InAppNotifications extends StatefulWidget {
  const _InAppNotifications({required this.child});
  final Widget child;
  @override
  State<_InAppNotifications> createState() => _InAppNotificationsState();
}

class _InAppNotificationsState extends State<_InAppNotifications> {
  late final NotificationCenter _center = context.read<NotificationCenter>();

  @override
  void initState() {
    super.initState();
    _center.incoming.addListener(_show);
  }

  @override
  void dispose() {
    _center.incoming.removeListener(_show);
    super.dispose();
  }

  void _show() {
    final n = _center.incoming.value;
    if (n == null || !mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      SnackBar(
        backgroundColor: GlobusTokens.brand800,
        duration: const Duration(seconds: 5),
        // Avec une action, Flutter rend le bandeau persistant par défaut : il masquerait le bas de l'écran indéfiniment.
        persist: false,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              n.s('title'),
              style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
            ),
            if (n.has('body'))
              Text(
                n.s('body'),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: GlobusTokens.brand100),
              ),
          ],
        ),
        action: n.has('link') ? SnackBarAction(label: 'Voir', textColor: GlobusTokens.accent300, onPressed: () => openAppLink(context, n.str('link'))) : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Grille d'accès rapide (écran « Plus ») reprenant toutes les entrées du menu visibles pour l'utilisateur.
class MenuGrid extends StatelessWidget {
  const MenuGrid({super.key, required this.sections});
  final List<NavSection> sections;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        for (final section in sections) ...[
          if (section.title != null) GroupTitle(section.title!),
          Card(
            child: Column(
              children: [
                for (final (i, item) in section.items.where((it) => it.visibleFor(user)).indexed) ...[
                  if (i > 0) const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: Icon(item.icon, color: theme.colorScheme.primary),
                    title: Text(item.label),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push(item.path),
                  ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        OutlinedButton.icon(onPressed: () => context.auth.logout(), icon: const Icon(Icons.logout), label: const Text('Se déconnecter')),
        const SizedBox(height: 8),
        if (context.read<GlobusServices>().auth.offline)
          const EmptyView(icon: Icons.cloud_off, title: 'Mode hors ligne', text: 'Les données affichées sont celles enregistrées sur ce téléphone.'),
      ],
    );
  }
}
