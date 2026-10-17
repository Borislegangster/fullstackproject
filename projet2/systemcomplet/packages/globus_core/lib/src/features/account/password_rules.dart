import 'package:flutter/material.dart';

import '../../theme/globus_theme.dart';

/// Règles alignées sur la politique serveur (validate_password_strength) — miroir de password-strength.tsx.
List<String> passwordIssues(String password, {int minLength = 12}) {
  return [
    if (password.length < minLength) '$minLength caractères minimum',
    if (!RegExp('[a-z]').hasMatch(password)) 'une minuscule',
    if (!RegExp('[A-Z]').hasMatch(password)) 'une majuscule',
    if (!RegExp(r'\d').hasMatch(password)) 'un chiffre',
    if (!RegExp('[^A-Za-z0-9]').hasMatch(password)) 'un caractère spécial',
  ];
}

class PasswordStrength extends StatelessWidget {
  const PasswordStrength({super.key, required this.password, this.minLength = 12});
  final String password;
  final int minLength;

  @override
  Widget build(BuildContext context) {
    final rules = [
      ('$minLength caractères minimum', password.length >= minLength),
      ('Une minuscule', RegExp('[a-z]').hasMatch(password)),
      ('Une majuscule', RegExp('[A-Z]').hasMatch(password)),
      ('Un chiffre', RegExp(r'\d').hasMatch(password)),
      ('Un caractère spécial', RegExp('[^A-Za-z0-9]').hasMatch(password)),
    ];
    final score = rules.where((r) => r.$2).length;
    final color = score >= 5 ? GlobusColors.success : (score >= 3 ? GlobusColors.warning : GlobusColors.danger);
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 0; i < rules.length; i++)
                Expanded(
                  child: Container(
                    height: 4,
                    margin: EdgeInsets.only(right: i < rules.length - 1 ? 4 : 0),
                    decoration: BoxDecoration(
                      color: i < score ? color : Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 12,
            runSpacing: 2,
            children: [
              for (final r in rules)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(r.$2 ? Icons.check : Icons.close, size: 13, color: r.$2 ? GlobusColors.success : muted),
                    const SizedBox(width: 3),
                    Text(r.$1, style: TextStyle(fontSize: 12, color: r.$2 ? GlobusColors.success : muted)),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
