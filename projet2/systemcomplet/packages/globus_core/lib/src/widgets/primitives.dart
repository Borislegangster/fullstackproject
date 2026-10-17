import 'package:flutter/material.dart';

import '../context.dart';
import '../format/format.dart';
import '../format/labels.dart';
import '../theme/globus_theme.dart';

/// Carte de section avec en-tête (titre, sous-titre, action).
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    this.title,
    this.subtitle,
    this.trailing,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.icon,
  });

  final String? title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;
  final EdgeInsets padding;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (icon != null) ...[Icon(icon, size: 20, color: theme.colorScheme.primary), const SizedBox(width: 8)],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title!, style: theme.textTheme.titleMedium),
                        if (subtitle != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(subtitle!, style: theme.textTheme.bodySmall),
                          ),
                      ],
                    ),
                  ),
                  ?trailing,
                ],
              ),
            ),
          Padding(padding: padding, child: child),
        ],
      ),
    );
  }
}

/// Indicateur chiffré (montant, compteur).
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.hint, this.icon, this.tone = Tone.neutral});
  final String label;
  final String value;
  final String? hint;
  final IconData? icon;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = tone == Tone.neutral ? theme.colorScheme.primary : GlobusColors.tone(tone);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(label, style: theme.textTheme.bodySmall, maxLines: 2)),
                if (icon != null) Icon(icon, size: 18, color: color),
              ],
            ),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: theme.textTheme.titleLarge?.copyWith(color: color, fontSize: 19)),
            ),
            if (hint != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(hint!, style: theme.textTheme.bodySmall),
              ),
          ],
        ),
      ),
    );
  }
}

/// Grille responsive d'indicateurs (2 colonnes sur téléphone, 4 sur tablette).
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final cols = box.maxWidth > 700 ? 4 : 2;
        final width = (box.maxWidth - (cols - 1) * 10) / cols;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [for (final c in children) SizedBox(width: width, child: c)],
        );
      },
    );
  }
}

class ToneBadge extends StatelessWidget {
  const ToneBadge(this.text, {super.key, this.tone = Tone.neutral, this.icon});
  final String text;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = GlobusColors.tone(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: GlobusColors.toneSoft(tone, dark: dark),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              text,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontFamily: GlobusFonts.body, fontSize: 11.5, fontWeight: FontWeight.w600, color: dark ? Colors.white : color),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pastille de statut (libellé et ton issus du référentiel partagé avec le web).
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key, this.label});
  final String? status;
  final String? label;

  @override
  Widget build(BuildContext context) => ToneBadge(label ?? statusLabel(status), tone: statusTone(status));
}

class GProgress extends StatelessWidget {
  const GProgress({super.key, required this.value, this.tone = Tone.info, this.height = 8});

  /// Pourcentage 0–100.
  final double value;
  final Tone tone;
  final double height;

  @override
  Widget build(BuildContext context) {
    final v = (value / 100).clamp(0.0, 1.0);
    return Semantics(
      value: '${value.round()} %',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(
          value: v,
          minHeight: height,
          backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
          color: tone == Tone.accent ? GlobusColors.accent : GlobusColors.tone(tone),
        ),
      ),
    );
  }
}

class AlertBox extends StatelessWidget {
  const AlertBox({super.key, required this.message, this.title, this.tone = Tone.info, this.icon, this.action});
  final String message;
  final String? title;
  final Tone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = GlobusColors.tone(tone);
    final ic =
        icon ??
        switch (tone) {
          Tone.danger => Icons.error_outline,
          Tone.warning => Icons.warning_amber_rounded,
          Tone.success => Icons.check_circle_outline,
          _ => Icons.info_outline,
        };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: GlobusColors.toneSoft(tone, dark: dark),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(ic, size: 20, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Text(title!, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(message, style: Theme.of(context).textTheme.bodyMedium),
                if (action != null) Padding(padding: const EdgeInsets.only(top: 6), child: action),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Ligne libellé / valeur.
class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key, this.valueWidget});
  final String label;
  final String? value;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 4, child: Text(label, style: theme.textTheme.bodySmall)),
          const SizedBox(width: 10),
          Expanded(
            flex: 6,
            child:
                valueWidget ?? Text(value == null || value!.isEmpty ? '—' : value!, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

/// En-tête de page (surtitre, titre, sous-titre).
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.eyebrow, this.subtitle, this.trailing});
  final String title;
  final String? eyebrow;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null)
                Text(
                  eyebrow!.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(color: GlobusColors.accent, letterSpacing: 1.1, fontWeight: FontWeight.w700),
                ),
              Text(title, style: theme.textTheme.headlineSmall),
              if (subtitle != null && subtitle!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(subtitle!, style: theme.textTheme.bodySmall),
                ),
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// Avatar : photo (ressource protégée de l'API) ou initiales.
class Avatar extends StatelessWidget {
  const Avatar({super.key, this.name, this.url, this.size = 40, this.online});
  final String? name;
  final String? url;
  final double size;
  final bool? online;

  @override
  Widget build(BuildContext context) {
    final api = context.api;
    final circle = CircleAvatar(
      radius: size / 2,
      backgroundColor: GlobusTokens.brand100,
      foregroundImage: url == null ? null : NetworkImage(api.url(url!), headers: api.mediaHeaders),
      child: Text(
        initials(name),
        style: TextStyle(fontFamily: GlobusFonts.title, fontWeight: FontWeight.w700, color: GlobusTokens.brand700, fontSize: size * 0.36),
      ),
    );
    if (online == null) return circle;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        circle,
        Positioned(
          right: -1,
          bottom: -1,
          child: Container(
            width: size * 0.3,
            height: size * 0.3,
            decoration: BoxDecoration(
              color: online! ? GlobusColors.success : GlobusTokens.line,
              shape: BoxShape.circle,
              border: Border.all(color: Theme.of(context).colorScheme.surface, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

/// Titre de groupe dans une liste.
class GroupTitle extends StatelessWidget {
  const GroupTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text.toUpperCase(),
              style: Theme.of(context).textTheme.labelMedium
                  ?.copyWith(letterSpacing: 1, color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w700),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Liste verticale espacée pour les pages (marges standard, fin de page dégagée).
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, this.padding = const EdgeInsets.fromLTRB(16, 16, 16, 32), this.gap = 14});
  final List<Widget> children;
  final EdgeInsets padding;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: padding,
      itemCount: children.length,
      separatorBuilder: (_, _) => SizedBox(height: gap),
      itemBuilder: (_, i) => children[i],
    );
  }
}

/// Texte d'aide discret sous une liste.
class FootNote extends StatelessWidget {
  const FootNote(this.text, {super.key, this.icon = Icons.info_outline});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: style?.color),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: style)),
      ],
    );
  }
}

/// Montant + ton (rouge si négatif).
String moneyOr(Object? value, String? currency) => money(value, currency);
