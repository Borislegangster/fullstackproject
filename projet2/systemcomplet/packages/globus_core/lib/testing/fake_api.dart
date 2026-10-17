import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:globus_core/globus_core.dart';

/// Requête reçue par le serveur simulé (tests uniquement).
class FakeRequest {
  FakeRequest(this.method, this.path, this.headers, this.body, this.query);
  final String method;
  final String path;
  final Map<String, dynamic> headers;
  final Object? body;
  final Map<String, dynamic> query;
}

typedef FakeHandler = FutureOr<(int, Object?)> Function(FakeRequest request);

/// Serveur API simulé au niveau HTTP (adaptateur Dio) : les tests exercent le vrai client, ses en-têtes,
/// le renouvellement de session, les erreurs et le cache hors ligne.
class FakeApi implements HttpClientAdapter {
  final List<FakeRequest> requests = [];
  final Map<String, FakeHandler> routes = {};
  bool offline = false;

  void on(String method, String path, FakeHandler handler) => routes['$method $path'] = handler;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    if (offline) {
      throw DioException(requestOptions: options, type: DioExceptionType.connectionError, error: 'hors ligne');
    }
    // Corps lu jusqu'au bout comme par un vrai serveur (fichiers des envois multipart refermés).
    await requestStream?.drain<void>();
    final path = options.uri.path.replaceFirst('/api/v1', '');
    Object? body = options.data;
    if (body is String && body.isNotEmpty) body = jsonDecode(body);
    final request = FakeRequest(options.method, path, options.headers, body, options.uri.queryParameters);
    requests.add(request);
    final handler = routes['${options.method} $path'];
    if (handler == null) {
      return _json(404, {
        'error': {'code': 'NOT_FOUND', 'message': 'Route inconnue $path'},
      });
    }
    final (status, payload) = await handler(request);
    return _json(status, payload);
  }

  ResponseBody _json(int status, Object? payload) => ResponseBody.fromString(
    jsonEncode(payload),
    status,
    headers: {
      Headers.contentTypeHeader: ['application/json'],
    },
  );

  @override
  void close({bool force = false}) {}
}

const testConfig = GlobusConfig(app: GlobusApp.client, apiUrl: 'https://globus.test');

ApiClient fakeClient(FakeApi fake, {SessionStore? store, ResponseCache? cache}) {
  final dio = Dio()..httpClientAdapter = fake;
  return ApiClient(config: testConfig, store: store ?? MemorySessionStore(), cache: cache ?? MemoryCache(), dio: dio);
}

Map<String, dynamic> meJson({List<String> spaces = const ['client'], bool mfaRequired = false, bool mfaEnabled = false}) => {
  'id': 'u-1',
  'email': 'client@example.com',
  'first_name': 'Awa',
  'last_name': 'Ngono',
  'full_name': 'Awa Ngono',
  'locale': 'fr',
  'timezone': 'Africa/Douala',
  'roles': ['CLIENT'],
  'permissions': ['client:pay', 'client:decide', 'chat:use', 'calls:use'],
  'spaces': spaces,
  'features': <String>[],
  'mfa_enabled': mfaEnabled,
  'mfa_required': mfaRequired,
  'preferences': <String, dynamic>{},
  'email_verified': true,
};

/// Services d'application branchés sur le serveur simulé (sans WebSocket, push ni surveillance réseau).
GlobusServices fakeServices(FakeApi fake, {GlobusApp app = GlobusApp.client, SessionStore? store}) {
  final dio = Dio()..httpClientAdapter = fake;
  return GlobusServices.create(
    GlobusConfig(app: app, apiUrl: 'https://globus.test'),
    store: store ?? MemorySessionStore(),
    cache: MemoryCache(),
    dio: dio,
    liveFeatures: false,
  );
}
