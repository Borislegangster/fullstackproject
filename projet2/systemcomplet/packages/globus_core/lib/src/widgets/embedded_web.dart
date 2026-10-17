import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../api/api_exception.dart';
import '../api/json.dart';
import '../context.dart';
import '../theme/globus_theme.dart';
import 'states.dart';

/// Contrôle d'une page embarquée : envoi de commandes à la page (pont JavaScript).
class EmbeddedWebHandle {
  WebViewController? _controller;

  Future<void> send(Map<String, dynamic> message) async {
    final c = _controller;
    if (c == null) return;
    await c.runJavaScript('window.globusBridge && window.globusBridge.receive(${jsonEncode(message)});');
  }
}

bool get embeddedWebSupported => !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);

/// Visionneuse 3D du web (maquette BIM, configurateur, visite 360°) affichée dans l'application.
///
/// La session web est ouverte par un lien à usage unique (`POST /auth/web-session`, 60 s), limité aux pages
/// `/embarque/…` ; aucun jeton n'est placé dans l'adresse de la page. Sur les plateformes sans vue web intégrée,
/// la page s'ouvre dans le navigateur avec le même lien à usage unique.
class EmbeddedWebView extends StatefulWidget {
  const EmbeddedWebView({super.key, required this.path, this.onMessage, this.handle});

  /// Chemin de la page embarquée (`/embarque/…`).
  final String path;
  final void Function(J message)? onMessage;
  final EmbeddedWebHandle? handle;

  @override
  State<EmbeddedWebView> createState() => _EmbeddedWebViewState();
}

class _EmbeddedWebViewState extends State<EmbeddedWebView> {
  WebViewController? _controller;
  Object? _error;
  int _progress = 0;
  String? _handoffUrl;

  @override
  void initState() {
    super.initState();
    unawaited(_open());
  }

  Future<void> _open() async {
    setState(() {
      _error = null;
      _progress = 0;
    });
    try {
      final res = J.of(await context.api.post('/auth/web-session', body: {'next': widget.path}));
      final url = res.s('url');
      if (!mounted) return;
      if (!embeddedWebSupported) {
        setState(() => _handoffUrl = url);
        return;
      }
      // Réglages appliqués dans l'ordre (canal JavaScript enregistré avant le chargement de la page).
      final controller = WebViewController();
      await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
      await controller.setBackgroundColor(GlobusTokens.brand900);
      await controller.addJavaScriptChannel(
        'GlobusApp',
        onMessageReceived: (m) {
          try {
            final msg = J.of(jsonDecode(m.message));
            if (msg.s('type') == 'error') setState(() => _error = ApiException(0, 'VIEWER', msg.s('message', 'Affichage impossible')));
            widget.onMessage?.call(msg);
          } catch (_) {}
        },
      );
      await controller.setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (mounted) setState(() => _progress = p);
          },
          onNavigationRequest: (request) {
            // La vue web reste sur le site GLOBUS ; tout autre lien s'ouvre dans le navigateur.
            final origin = Uri.parse(context.config.origin);
            final target = Uri.tryParse(request.url);
            if (target != null && target.host != origin.host && target.scheme.startsWith('http')) {
              unawaited(launchUrl(target, mode: LaunchMode.externalApplication));
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onWebResourceError: (e) {
            if (e.isForMainFrame == true && mounted) setState(() => _error = ApiException.network(e.description));
          },
        ),
      );
      await controller.loadRequest(Uri.parse(url));
      if (!mounted) return;
      widget.handle?._controller = controller;
      setState(() => _controller = controller);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return ColoredBox(
        color: Theme.of(context).colorScheme.surface,
        child: ErrorView(error: _error, onRetry: _open),
      );
    }
    if (_handoffUrl != null) {
      return EmptyView(
        icon: Icons.view_in_ar,
        title: 'Visionneuse 3D',
        text: "Sur cet appareil, la visionneuse s'ouvre dans le navigateur (lien sécurisé à usage unique).",
        action: FilledButton.icon(
          onPressed: () async {
            await launchUrl(Uri.parse(_handoffUrl!), mode: LaunchMode.externalApplication);
            if (mounted) unawaited(_open());
          },
          icon: const Icon(Icons.open_in_new),
          label: const Text('Ouvrir la visionneuse'),
        ),
      );
    }
    final controller = _controller;
    if (controller == null) {
      return const ColoredBox(
        color: GlobusTokens.brand900,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    return Stack(
      children: [
        WebViewWidget(controller: controller),
        if (_progress < 100) LinearProgressIndicator(value: _progress == 0 ? null : _progress / 100),
      ],
    );
  }
}

/// Écran plein écran d'une visionneuse embarquée (thème sombre BIM, §3.1).
class EmbeddedViewerScreen extends StatelessWidget {
  const EmbeddedViewerScreen({super.key, required this.title, required this.path});
  final String title;
  final String path;

  static Future<void> open(BuildContext context, {required String title, required String path}) => Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      builder: (_) => EmbeddedViewerScreen(title: title, path: path),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: GlobusTheme.dark(),
      child: Scaffold(
        appBar: AppBar(title: Text(title)),
        body: EmbeddedWebView(path: path),
      ),
    );
  }
}
