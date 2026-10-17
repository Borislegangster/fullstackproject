// Pilote des parcours de bout en bout : enregistre les captures d'écran sur le poste (SHOTS_DIR ou build/captures).
import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() {
  final dir = Directory(Platform.environment['SHOTS_DIR'] ?? 'build/captures')..createSync(recursive: true);
  return integrationDriver(
    onScreenshot: (name, bytes, [args]) async {
      File('${dir.path}/$name.png').writeAsBytesSync(bytes);
      return true;
    },
  );
}
