import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/json.dart';

/// Identité visuelle de la plateforme (`/public/brand`) : icône unique réglée dans le CMS (« Icône de la
/// plateforme »), distincte du logo. Les applications l'affichent à l'écran de connexion et dans l'assistant ;
/// l'icône du lanceur est générée à la construction à partir du même réglage (pack d'icônes).
class BrandService extends ChangeNotifier {
  BrandService(this.api);
  final ApiClient api;
  J? brand;

  String get name => brand?.str('short_name') ?? 'GLOBUS';

  /// URL de l'icône (192 px) ou `null` (icône embarquée).
  String? get iconUrl => brand?.obj('sizes').str('192') ?? brand?.str('icon');

  Future<void> load() async {
    try {
      final res = await api.fetch('/public/brand');
      brand = J.of(res.data);
      notifyListeners();
    } catch (_) {
      // Hors ligne sans cache : l'icône embarquée reste affichée.
    }
  }
}

/// Icône de la plateforme (jamais le logo).
class BrandIcon extends StatelessWidget {
  const BrandIcon({super.key, this.size = 64});
  final double size;

  @override
  Widget build(BuildContext context) {
    final brand = context.watch<BrandService?>();
    final url = brand?.iconUrl;
    const fallback = AssetImage('assets/brand/icon.png', package: 'globus_core');
    return SizedBox(
      width: size,
      height: size,
      child: url == null
          ? const Image(image: fallback, fit: BoxFit.contain)
          : Image.network(
              brand!.api.url(url),
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => const Image(image: fallback, fit: BoxFit.contain),
            ),
    );
  }
}
