import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../context.dart';
import '../widgets/states.dart';

/// Liens internes de l'application : base de l'espace (« /espace-client », « /erp ») et routes connues.
///
/// Les applications reprennent les chemins du web : un lien de notification (`/espace-client/sav/…`) ouvre
/// directement l'écran mobile correspondant ; un chemin sans écran mobile s'ouvre sur le site web.
class AppLinks {
  const AppLinks({required this.base, required this.isKnown});
  final String base;
  final bool Function(String path) isKnown;

  /// Traduit un lien (générique ou propre à un espace) en route de l'application (miroir de resolveLink du web).
  String? resolve(String? link, String origin) {
    if (link == null || link.isEmpty) return null;
    final uri = Uri.tryParse(link);
    if (uri == null) return null;
    if (uri.hasScheme) {
      final o = Uri.parse(origin);
      if (uri.host != o.host) return null;
    }
    final path = uri.path + (uri.hasQuery ? '?${uri.query}' : '');
    // « Mon compte » de l'application (alerte de nouvelle connexion, y compris les anciennes notifications).
    if (RegExp(r'^/compte(\?|$)').hasMatch(path)) return '$base$path';
    if (path == '/erp/securite' && base != '/erp') return '$base/compte?onglet=sessions';
    if (path == '/erp/appels' && base != '/erp') return '$base/appels';
    if (RegExp(r'^/(erp|espace-client|extranet)(/|$)').hasMatch(path)) return path;
    final m = RegExp(r'^/(agenda|appels|messagerie)(?:/([^/?]+))?(?:\?|$)').firstMatch(path);
    if (m != null) {
      const params = {'agenda': 'event', 'appels': 'call', 'messagerie': 'c'};
      final id = m.group(2);
      return id == null ? '$base/${m.group(1)}' : '$base/${m.group(1)}?${params[m.group(1)]}=$id';
    }
    if (path.startsWith('/notifications')) return '$base/notifications';
    return path;
  }
}

/// Ouvre un lien interne (écran de l'application) ou, à défaut, la page web correspondante.
Future<void> openAppLink(BuildContext context, String? link) async {
  final links = context.read<AppLinks>();
  final origin = context.config.origin;
  final target = links.resolve(link, origin);
  if (target == null) {
    if (link != null && link.startsWith('http')) await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    return;
  }
  final path = target.split('?').first;
  if (links.isKnown(path)) {
    if (context.mounted) await GoRouter.of(context).push(target);
  } else {
    await launchUrl(Uri.parse('$origin$target'), mode: LaunchMode.externalApplication);
  }
}

/// Écran affiché pour une route inconnue : proposition d'ouvrir la page sur le site web.
class UnknownRouteScreen extends StatelessWidget {
  const UnknownRouteScreen({super.key, required this.path});
  final String path;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Page indisponible')),
      body: EmptyView(
        icon: Icons.open_in_browser,
        title: "Cette page n'existe pas dans l'application",
        text: 'Vous pouvez la consulter sur le site web GLOBUS ENGINEERING.',
        action: FilledButton.icon(
          onPressed: () => launchUrl(Uri.parse('${context.config.origin}$path'), mode: LaunchMode.externalApplication),
          icon: const Icon(Icons.open_in_new),
          label: const Text('Ouvrir sur le site'),
        ),
      ),
    );
  }
}
