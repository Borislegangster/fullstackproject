import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../format/format.dart';
import '../theme/globus_theme.dart';

/// États explicites de l'interface (§3.1) : chargement, vide, erreur, hors ligne, expiré, interdit.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.lines = 4, this.padding = const EdgeInsets.all(16)});
  final int lines;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Chargement en cours',
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton(height: 28, width: 200),
            const SizedBox(height: 16),
            const Skeleton(height: 120),
            for (var i = 0; i < lines - 1; i++) ...[const SizedBox(height: 12), const Skeleton(height: 64)],
          ],
        ),
      ),
    );
  }
}

class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 12});
  final double height;
  final double? width;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return FadeTransition(
      opacity: Tween<double>(begin: 0.45, end: 1).animate(_c),
      child: Container(
        height: widget.height,
        width: widget.width ?? double.infinity,
        decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(widget.radius)),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.title, this.text, this.icon = Icons.inbox_outlined, this.action});
  final String title;
  final String? text;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: theme.colorScheme.primaryContainer, shape: BoxShape.circle),
              child: Icon(icon, size: 32, color: theme.colorScheme.primary),
            ),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
            if (text != null) ...[
              const SizedBox(height: 6),
              Text(text!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
            ],
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}

enum ErrorKind { error, offline, forbidden, notFound, expired }

ErrorKind errorKindOf(Object? error) {
  if (error is ApiException) {
    if (error.isNetwork) return ErrorKind.offline;
    if (error.isForbidden) return ErrorKind.forbidden;
    if (error.isNotFound) return ErrorKind.notFound;
    if (error.status == 410 || error.code.contains('EXPIRED')) return ErrorKind.expired;
  }
  return ErrorKind.error;
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});
  final Object? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final kind = errorKindOf(error);
    final (icon, title) = switch (kind) {
      ErrorKind.offline => (Icons.cloud_off_outlined, 'Hors ligne'),
      ErrorKind.forbidden => (Icons.lock_outline, 'Accès non autorisé'),
      ErrorKind.notFound => (Icons.search_off_outlined, 'Élément introuvable'),
      ErrorKind.expired => (Icons.timer_off_outlined, 'Lien ou délai expiré'),
      ErrorKind.error => (Icons.error_outline, 'Une erreur est survenue'),
    };
    final text = switch (kind) {
      ErrorKind.offline => "Connexion au serveur impossible et aucune donnée enregistrée sur l'appareil pour cet écran.",
      ErrorKind.forbidden => '${errorMessage(error)}\nDemandez l\'accès à votre interlocuteur GLOBUS si nécessaire.',
      _ => errorMessage(error),
    };
    return EmptyView(
      icon: icon,
      title: title,
      text: text,
      action: onRetry == null || kind == ErrorKind.forbidden
          ? null
          : OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Réessayer')),
    );
  }
}

/// Bandeau « hors ligne » : données affichées depuis l'appareil, avec leur date.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, this.cachedAt});
  final DateTime? cachedAt;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: GlobusColors.warning.withValues(alpha: 0.14),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined, size: 18, color: GlobusColors.warning),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              cachedAt == null ? 'Hors ligne — reconnexion automatique dès que le réseau revient.' : 'Hors ligne — données du ${dateTime(cachedAt!.toUtc())}.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: GlobusTokens.ink, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
