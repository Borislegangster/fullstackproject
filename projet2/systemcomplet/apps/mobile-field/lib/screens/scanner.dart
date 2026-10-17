import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import '../field_state.dart';

bool get cameraScanSupported => kIsWeb || defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS;

/// Lecture d'un QR (caméra) ou saisie du code ; renvoie le texte lu.
Future<String?> scanCode(BuildContext context, {String title = 'Scanner un QR'}) {
  return Navigator.of(context, rootNavigator: true).push<String>(MaterialPageRoute(fullscreenDialog: true, builder: (_) => _ScanPage(title: title)));
}

class _ScanPage extends StatefulWidget {
  const _ScanPage({required this.title});
  final String title;
  @override
  State<_ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<_ScanPage> {
  final MobileScannerController? _controller = cameraScanSupported ? MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates) : null;
  final _manual = TextEditingController();
  bool _done = false;

  @override
  void dispose() {
    unawaited(_controller?.dispose());
    _manual.dispose();
    super.dispose();
  }

  void _found(String code) {
    if (_done || code.trim().isEmpty) return;
    _done = true;
    Navigator.pop(context, code.trim());
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (controller != null) IconButton(tooltip: 'Lampe', onPressed: () => controller.toggleTorch(), icon: const Icon(Icons.flashlight_on_outlined)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: controller == null
                ? const EmptyView(icon: Icons.qr_code_2, title: 'Caméra indisponible sur cet appareil', text: 'Saisissez le code imprimé sous le QR.')
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
                        controller: controller,
                        onDetect: (capture) {
                          final value = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
                          if (value != null) _found(value);
                        },
                        errorBuilder: (context, error) => const EmptyView(
                          icon: Icons.no_photography_outlined,
                          title: 'Caméra refusée',
                          text: 'Autorisez la caméra dans les réglages du téléphone ou saisissez le code.',
                        ),
                      ),
                      Center(
                        child: Container(
                          width: 240,
                          height: 240,
                          decoration: BoxDecoration(
                            border: Border.all(color: GlobusColors.accent, width: 3),
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _manual,
                      decoration: const InputDecoration(labelText: 'Ou saisir le code', isDense: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(onPressed: () => _found(_manual.text), child: const Text('Valider')),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Scanner universel du chantier : zone (QR spatial), chantier (auto-pointage), badge ouvrier (pointage),
/// bon de commande (réception), matériel (fiche, utilisation). Chaque scan est journalisé côté serveur.
class ScannerScreen extends StatelessWidget {
  const ScannerScreen({super.key});

  Future<void> _scan(BuildContext context) async {
    final code = await scanCode(context);
    if (code == null || !context.mounted) return;
    await handleScannedCode(context, code);
  }

  @override
  Widget build(BuildContext context) {
    return PageList(
      children: [
        const PageHeader(title: 'Scanner', subtitle: 'Un seul scanner pour tous les QR GLOBUS du chantier.'),
        SizedBox(
          height: 160,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
            onPressed: () => _scan(context),
            icon: const Icon(Icons.qr_code_scanner, size: 48),
            label: const Text('Scanner un QR', style: TextStyle(fontSize: 18)),
          ),
        ),
        const SectionCard(
          title: 'QR reconnus',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Kind(Icons.place_outlined, 'Zone / pièce', 'plans autorisés, tâches de la zone, check-lists, photos avant / après, issues BIM.'),
              _Kind(Icons.badge_outlined, 'Chantier', 'auto-pointage (arrivée / départ) avec la position du téléphone.'),
              _Kind(Icons.person_pin_outlined, 'Badge ouvrier', 'pointage de l\'équipe par le chef de chantier (même hors ligne).'),
              _Kind(Icons.local_shipping_outlined, 'Bon de commande', 'réception de livraison : quantités, écarts, photos, bon de livraison.'),
              _Kind(Icons.construction_outlined, 'Matériel', 'fiche, affectation, compteur d\'utilisation, incident.'),
            ],
          ),
        ),
      ],
    );
  }
}

class _Kind extends StatelessWidget {
  const _Kind(this.icon, this.title, this.text);
  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: GlobusColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$title : ',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                TextSpan(text: text),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

/// Aiguillage d'un code lu selon son préfixe (GLOBUS:ZONE / SITE / EMP / PO / EQP).
Future<void> handleScannedCode(BuildContext context, String code) async {
  final upper = code.toUpperCase();
  if (upper.startsWith('GLOBUS:ZONE:')) {
    await context.push('$base/terrain/zones/scan', extra: code);
  } else if (upper.startsWith('GLOBUS:SITE:')) {
    await context.push('$base/terrain/pointage', extra: code);
  } else if (upper.startsWith('GLOBUS:EMP:')) {
    await recordBadgeScan(context, code);
  } else if (upper.startsWith('GLOBUS:PO:')) {
    await context.push('$base/livraisons/receptions/nouvelle', extra: code);
  } else if (upper.startsWith('GLOBUS:EQP:')) {
    await context.push('$base/materiel/scan', extra: code);
  } else {
    context.toast('QR non reconnu : $code', error: true);
  }
}

/// Pointage d'un ouvrier par son badge (chef de chantier) : arrivée / départ, hors ligne possible.
Future<void> recordBadgeScan(BuildContext context, String badge) async {
  if (!(context.can('hr:write') || context.can('site:report'))) {
    context.toast("Pointage des badges réservé à l'encadrement chantier.", error: true);
    return;
  }
  final action = await pickOption<String>(context, title: 'Pointage du badge', options: const [('in', 'Arrivée'), ('out', 'Départ')]);
  if (action == null || !context.mounted) return;
  final position = await currentPosition(context);
  if (!context.mounted) return;
  final projectId = context.read<FieldProjects>().projectId;
  final queue = context.read<OfflineQueue>();
  await queue.enqueueMutation(
    label: 'Pointage badge (${action == 'in' ? 'arrivée' : 'départ'})',
    entity: 'attendance_scan',
    operation: 'action',
    payload: {
      'badge': badge,
      'project_id': projectId,
      'action': action,
      'at': DateTime.now().toUtc().toIso8601String(),
      'latitude': position?.latitude,
      'longitude': position?.longitude,
    },
  );
  final report = await queue.sync();
  if (context.mounted) {
    context.toast(report.offline ? 'Pointage enregistré sur le téléphone : envoi au retour du réseau.' : 'Pointage enregistré', success: !report.offline);
  }
}
