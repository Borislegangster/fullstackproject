// Synchronise l'icône du lanceur avec l'icône de la plateforme réglée dans le CMS (« Icône de la plateforme »).
//
// Usage : dart run tool/sync_brand.dart https://globus.example.com
// Télécharge les déclinaisons publiques (/api/v1/public/brand/...) puis régénère les icônes Android / iOS / Windows
// avec flutter_launcher_icons. Le logo n'est jamais utilisé comme icône.
import 'dart:io';

Future<void> main(List<String> args) async {
  if (args.isEmpty) {
    stderr.writeln('Usage : dart run tool/sync_brand.dart <URL du serveur GLOBUS>');
    exitCode = 64;
    return;
  }
  final origin = args.first.replaceAll(RegExp(r'/+$'), '');
  final dir = Directory('assets/brand')..createSync(recursive: true);
  final client = HttpClient();
  try {
    for (final name in ['icon-1024.png', 'icon-maskable-512.png']) {
      final request = await client.getUrl(Uri.parse('$origin/api/v1/public/brand/$name'));
      final response = await request.close();
      if (response.statusCode != 200) {
        stderr.writeln('$name : HTTP ${response.statusCode}');
        exitCode = 1;
        return;
      }
      final bytes = await response.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      File('${dir.path}/$name').writeAsBytesSync(bytes);
      stdout.writeln('$name : ${bytes.length} octets');
    }
  } finally {
    client.close();
  }
  final result = await Process.run('dart', ['run', 'flutter_launcher_icons'], runInShell: true);
  stdout.write(result.stdout);
  stderr.write(result.stderr);
  exitCode = result.exitCode;
}
