import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

/// Adaptateur HTTP synchrone (curl) : permet de parcourir l'application contre une vraie API dans un test de widgets
/// (temps simulé de flutter_test, où les entrées / sorties asynchrones réelles n'avancent pas).
class CurlAdapter implements HttpClientAdapter {
  CurlAdapter({this.timeoutSeconds = 60});
  final int timeoutSeconds;

  /// Requêtes effectuées (méthode, chemin, statut) : utile au rapport.
  final calls = <({String method, String path, int status})>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final body = <int>[];
    if (requestStream != null) {
      await for (final chunk in requestStream) {
        body.addAll(chunk);
      }
    }
    final dir = Directory.systemTemp.createTempSync('globus-e2e-');
    try {
      final head = File('${dir.path}/head');
      final out = File('${dir.path}/out');
      final args = <String>['-sS', '-X', options.method, '--max-time', '$timeoutSeconds', '-D', head.path, '-o', out.path, '-w', '%{http_code}'];
      final headers = <String, String>{};
      options.headers.forEach((k, v) {
        if (v != null) headers[k.toLowerCase()] = '$v';
      });
      if (options.contentType != null && !headers.containsKey('content-type')) headers['content-type'] = options.contentType!;
      headers.forEach((k, v) => args.addAll(['-H', '$k: $v']));
      if (body.isNotEmpty) {
        final file = File('${dir.path}/body')..writeAsBytesSync(body);
        args.addAll(['--data-binary', '@${file.path}']);
      }
      args.add(options.uri.toString());
      final result = Process.runSync('curl', args, stdoutEncoding: utf8, stderrEncoding: utf8);
      final status = int.tryParse('${result.stdout}'.trim()) ?? 0;
      calls.add((method: options.method, path: options.uri.path, status: status));
      if (status == 0) {
        throw DioException(requestOptions: options, type: DioExceptionType.connectionError, error: '${result.stderr}'.trim());
      }
      final responseHeaders = <String, List<String>>{};
      if (head.existsSync()) {
        for (final line in head.readAsLinesSync()) {
          final i = line.indexOf(':');
          if (i <= 0 || line.startsWith('HTTP/')) continue;
          responseHeaders.putIfAbsent(line.substring(0, i).trim().toLowerCase(), () => []).add(line.substring(i + 1).trim());
        }
      }
      final data = out.existsSync() ? out.readAsBytesSync() : Uint8List(0);
      return ResponseBody.fromBytes(data, status, headers: responseHeaders);
    } finally {
      dir.deleteSync(recursive: true);
    }
  }

  @override
  void close({bool force = false}) {}
}

/// Charge les polices de l'application (charte GLOBUS, icônes Material) pour des captures lisibles.
Future<void> loadAppFonts() async {
  final manifest = json.decode(await rootBundle.loadString('FontManifest.json')) as List<dynamic>;
  for (final family in manifest.cast<Map<String, dynamic>>()) {
    final loader = FontLoader(family['family'] as String);
    for (final font in (family['fonts'] as List<dynamic>).cast<Map<String, dynamic>>()) {
      loader.addFont(rootBundle.load(font['asset'] as String));
    }
    await loader.load();
  }
}
