import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import 'api_exception.dart';
import 'response_cache.dart';
import 'session_store.dart';

/// Résultat d'une lecture : données et, si elles viennent du cache hors ligne, la date de la dernière synchronisation.
class Fetched<T> {
  const Fetched(this.data, {this.cachedAt});
  final T data;
  final DateTime? cachedAt;
  bool get isStale => cachedAt != null;
}

/// Fichier à envoyer (pièce jointe, photo, document).
class UploadFile {
  UploadFile({required this.name, this.path, this.bytes, this.field = 'file', this.contentType});
  final String name;
  final String? path;
  final List<int>? bytes;
  final String field;
  final String? contentType;

  Future<MultipartFile> toMultipart() async {
    final type = contentType != null ? DioMediaType.parse(contentType!) : null;
    if (bytes != null) return MultipartFile.fromBytes(bytes!, filename: name, contentType: type);
    return MultipartFile.fromFile(path!, filename: name, contentType: type);
  }
}

/// Client HTTP de l'API GLOBUS pour les applications mobiles.
///
/// - en-tête `X-Client-App` : l'API renvoie des jetons bearer (pas de cookies) ;
/// - renouvellement rotatif du jeton (`/auth/refresh`) unique et partagé entre requêtes concurrentes ;
/// - clés d'idempotence (`Idempotency-Key`) pour les opérations critiques (paiements, décisions, envois) ;
/// - erreurs normalisées en français ; lectures hors ligne depuis un cache chiffré.
class ApiClient {
  ApiClient({
    required this.config,
    required this.store,
    ResponseCache? cache,
    Dio? dio,
  }) : cache = cache ?? MemoryCache(),
       _dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 20),
               receiveTimeout: const Duration(seconds: 60),
               sendTimeout: const Duration(minutes: 5),
             ),
           );

  final GlobusConfig config;
  final SessionStore store;
  final ResponseCache cache;
  final Dio _dio;

  String? _access;
  String? _refresh;
  String? _deviceKey;
  String _cacheScope = 'anonyme';
  Future<bool>? _refreshing;

  /// Session expirée (refresh refusé) : l'application revient à l'écran de connexion.
  final ValueNotifier<int> sessionExpired = ValueNotifier(0);

  /// Double authentification obligatoire non activée (`MFA_ENROLLMENT_REQUIRED`).
  final ValueNotifier<int> mfaRequired = ValueNotifier(0);

  /// Dernier état réseau observé par les requêtes (false = serveur injoignable).
  final ValueNotifier<bool> reachable = ValueNotifier(true);

  bool get hasSession => _refresh != null || _access != null;
  String? get accessToken => _access;

  Future<void> restore() async {
    _access = await store.read(SessionStore.accessKey);
    _refresh = await store.read(SessionStore.refreshKey);
  }

  Future<String> deviceKey() async {
    if (_deviceKey != null) return _deviceKey!;
    var key = await store.read(SessionStore.deviceKey);
    if (key == null) {
      key = newKey();
      await store.write(SessionStore.deviceKey, key);
    }
    return _deviceKey = key;
  }

  /// Portée du cache hors ligne (un utilisateur ne lit jamais le cache d'un autre).
  void setCacheScope(String userId) => _cacheScope = userId;

  Future<void> saveTokens(Map<String, dynamic> body) async {
    final access = body['access_token'] as String?;
    final refresh = body['refresh_token'] as String?;
    if (access != null) {
      _access = access;
      await store.write(SessionStore.accessKey, access);
    }
    if (refresh != null) {
      _refresh = refresh;
      await store.write(SessionStore.refreshKey, refresh);
    }
  }

  Future<void> clearSession({bool purgeCache = true}) async {
    _access = null;
    _refresh = null;
    await store.clear();
    if (purgeCache) await cache.purge();
    _cacheScope = 'anonyme';
  }

  Map<String, String> get headers => {
    'X-Client-App': config.app.header,
    'Accept': 'application/json',
    'Accept-Language': 'fr',
    if (_access != null) 'Authorization': 'Bearer $_access',
  };

  /// En-têtes pour charger une image/vidéo protégée de l'API (Image.network, lecteur vidéo).
  Map<String, String> get mediaHeaders => {
    'X-Client-App': config.app.header,
    if (_access != null) 'Authorization': 'Bearer $_access',
  };

  String url(String path) => config.absolute(path);

  // ------------------------------------------------------------------ requêtes
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => request('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body, Map<String, dynamic>? query, Object? idempotent}) =>
      request('POST', path, body: body, query: query, idempotent: idempotent);

  Future<dynamic> put(String path, {Object? body, Object? idempotent}) => request('PUT', path, body: body, idempotent: idempotent);

  Future<dynamic> patch(String path, {Object? body, Object? idempotent}) => request('PATCH', path, body: body, idempotent: idempotent);

  Future<dynamic> delete(String path, {Object? body, Map<String, dynamic>? query}) => request('DELETE', path, body: body, query: query);

  /// Lecture consultable hors ligne : en cas d'échec réseau, renvoie la dernière réponse connue (chiffrée sur l'appareil).
  Future<Fetched<dynamic>> fetch(String path, {Map<String, dynamic>? query, bool offline = true}) async {
    final key = _cacheKey(path, query);
    try {
      final data = await get(path, query: query);
      if (offline) unawaited(cache.write(_cacheScope, key, data));
      return Fetched(data);
    } on ApiException catch (e) {
      if (offline && e.isNetwork) {
        final cached = await cache.read(_cacheScope, key);
        if (cached != null) return Fetched(cached.data, cachedAt: cached.savedAt);
      }
      rethrow;
    }
  }

  String _cacheKey(String path, Map<String, dynamic>? query) {
    if (query == null || query.isEmpty) return path;
    final keys = query.keys.toList()..sort();
    return '$path?${keys.map((k) => '$k=${query[k]}').join('&')}';
  }

  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    Object? idempotent,
    FormData Function()? form,
    void Function(int sent, int total)? onSendProgress,
    bool retried = false,
  }) async {
    final idemKey = idempotent == null || idempotent == false ? null : (idempotent is String ? idempotent : newKey());
    final response = await _send(
      () => _dio.request<dynamic>(
        url(path),
        data: form != null ? form() : body,
        queryParameters: _cleanQuery(query),
        onSendProgress: onSendProgress,
        options: Options(
          method: method,
          headers: {...headers, 'Idempotency-Key': ?idemKey},
          contentType: form != null ? null : Headers.jsonContentType,
          validateStatus: (_) => true,
          responseType: ResponseType.json,
        ),
      ),
    );
    if (response.statusCode == 401 && !retried && !_isAuthPath(path)) {
      if (await refreshSession()) {
        return request(method, path, body: body, query: query, idempotent: idemKey, form: form, onSendProgress: onSendProgress, retried: true);
      }
      sessionExpired.value++;
    }
    return _decode(response);
  }

  /// Envoi multipart (pièces jointes, photos) avec progression.
  Future<dynamic> upload(
    String path, {
    required List<UploadFile> files,
    Map<String, dynamic> fields = const {},
    void Function(int sent, int total)? onProgress,
    Object? idempotent,
    String method = 'POST',
  }) async {
    final parts = <MapEntry<String, MultipartFile>>[];
    for (final f in files) {
      parts.add(MapEntry(f.field, await f.toMultipart()));
    }
    FormData build() {
      final data = FormData();
      fields.forEach((k, v) {
        if (v == null) return;
        if (v is List) {
          for (final x in v) {
            data.fields.add(MapEntry(k, x.toString()));
          }
        } else {
          data.fields.add(MapEntry(k, v is Map ? jsonEncode(v) : v.toString()));
        }
      });
      // Un MultipartFile ne se lit qu'une fois : clonage en cas de nouvel essai après renouvellement de session.
      data.files.addAll(parts.map((e) => MapEntry(e.key, e.value.clone())));
      return data;
    }

    return request(method, path, form: build, onSendProgress: onProgress, idempotent: idempotent);
  }

  /// Téléchargement contrôlé vers le dossier de l'application ; renvoie le fichier local.
  Future<File> download(String path, {Map<String, dynamic>? query, String? filename, void Function(int, int)? onProgress}) async {
    final dir = await getTemporaryDirectory();
    final target = Directory('${dir.path}${Platform.pathSeparator}globus_fichiers');
    if (!target.existsSync()) target.createSync(recursive: true);
    Future<Response<dynamic>> go() => _dio.get<dynamic>(
      url(path),
      queryParameters: _cleanQuery(query),
      onReceiveProgress: onProgress,
      options: Options(headers: headers, responseType: ResponseType.bytes, validateStatus: (_) => true),
    );
    var response = await _send(go);
    if (response.statusCode == 401 && await refreshSession()) response = await _send(go);
    if ((response.statusCode ?? 0) >= 400) {
      _decode(
        Response<dynamic>(
          requestOptions: response.requestOptions,
          statusCode: response.statusCode,
          data: _tryJson(response.data),
          headers: response.headers,
        ),
      );
    }
    final name = _safeName(filename ?? _filenameFrom(response.headers) ?? path.split('/').last.split('?').first);
    final file = File('${target.path}${Platform.pathSeparator}$name');
    await file.writeAsBytes(response.data as List<int>, flush: true);
    return file;
  }

  /// Octets d'une ressource protégée (aperçu d'image, PDF).
  Future<List<int>> bytes(String path) async {
    Future<Response<dynamic>> go() => _dio.get<dynamic>(
      url(path),
      options: Options(headers: headers, responseType: ResponseType.bytes, validateStatus: (_) => true),
    );
    var response = await _send(go);
    if (response.statusCode == 401 && await refreshSession()) response = await _send(go);
    if ((response.statusCode ?? 0) >= 400) {
      throw ApiException(response.statusCode ?? 0, 'HTTP_${response.statusCode}', 'Fichier indisponible');
    }
    return response.data as List<int>;
  }

  // ------------------------------------------------------------------ session
  /// Renouvelle la session (rotation du refresh token). Une seule tentative partagée entre requêtes concurrentes.
  Future<bool> refreshSession() {
    final pending = _refreshing;
    if (pending != null) return pending;
    final future = _doRefresh();
    _refreshing = future;
    future.whenComplete(() => _refreshing = null);
    return future;
  }

  Future<bool> _doRefresh() async {
    final token = _refresh ?? await store.read(SessionStore.refreshKey);
    if (token == null) return false;
    try {
      final response = await _dio.post<dynamic>(
        url('/auth/refresh'),
        data: {'refresh_token': token},
        options: Options(headers: {'X-Client-App': config.app.header, 'Accept': 'application/json'}, validateStatus: (_) => true),
      );
      if (response.statusCode == 200 && response.data is Map) {
        await saveTokens((response.data as Map).cast<String, dynamic>());
        return true;
      }
      if (response.statusCode == 401 || response.statusCode == 403) {
        await clearSession(purgeCache: false);
      }
      return false;
    } on DioException {
      // Réseau indisponible : la session reste valide localement, nouvel essai à la prochaine requête.
      return false;
    }
  }

  // ------------------------------------------------------------------ internes
  bool _isAuthPath(String path) => path.startsWith('/auth/login') || path.startsWith('/auth/refresh') || path.startsWith('/auth/mfa/verify');

  Map<String, dynamic>? _cleanQuery(Map<String, dynamic>? query) {
    if (query == null) return null;
    final out = <String, dynamic>{};
    query.forEach((k, v) {
      if (v == null || v == '') return;
      out[k] = v is DateTime ? v.toIso8601String() : v;
    });
    return out;
  }

  Future<Response<dynamic>> _send(Future<Response<dynamic>> Function() call) async {
    try {
      final response = await call();
      reachable.value = true;
      return response;
    } on DioException catch (e) {
      if (e.type == DioExceptionType.badResponse && e.response != null) return e.response!;
      reachable.value = false;
      throw ApiException.network(
        e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.connectionTimeout
            ? 'Le serveur ne répond pas. Réessayez dans un instant.'
            : null,
      );
    } on SocketException {
      reachable.value = false;
      throw ApiException.network();
    }
  }

  dynamic _decode(Response<dynamic> response) {
    final status = response.statusCode ?? 0;
    final data = response.data;
    if (status >= 200 && status < 300) {
      if (status == 204) return null;
      return data;
    }
    final error = _parseError(status, data, response.statusMessage);
    if (error.code == 'MFA_ENROLLMENT_REQUIRED') mfaRequired.value++;
    throw error;
  }

  ApiException _parseError(int status, Object? data, String? statusMessage) {
    final payload = data is String ? _tryJson(data) : data;
    if (payload is Map) {
      final err = payload['error'];
      if (err is Map) {
        return ApiException(
          status,
          (err['code'] ?? 'ERROR').toString(),
          (err['message'] ?? 'Erreur').toString(),
          details: err['details'],
          correlationId: err['correlation_id']?.toString(),
        );
      }
      final detail = payload['detail'];
      if (detail is List && detail.isNotEmpty && detail.first is Map) {
        final first = detail.first as Map;
        final loc = first['loc'] is List ? (first['loc'] as List).where((x) => x != 'body').join('.') : '';
        return ApiException(status, 'VALIDATION_ERROR', '${loc.isNotEmpty ? '$loc : ' : ''}${first['msg'] ?? 'Données invalides'}', details: detail);
      }
      if (detail is String) return ApiException(status, 'HTTP_$status', detail);
    }
    return ApiException(status, 'HTTP_$status', statusMessage?.isNotEmpty == true ? statusMessage! : 'Erreur du serveur ($status)');
  }

  Object? _tryJson(Object? data) {
    try {
      if (data is List<int>) return jsonDecode(utf8.decode(data));
      if (data is String) return jsonDecode(data);
    } catch (_) {}
    return data;
  }

  String? _filenameFrom(Headers headers) {
    final disposition = headers.value('content-disposition');
    if (disposition == null) return null;
    final star = RegExp(r"filename\*=UTF-8''([^;]+)", caseSensitive: false).firstMatch(disposition);
    if (star != null) return Uri.decodeComponent(star.group(1)!);
    final plain = RegExp(r'filename="?([^";]+)"?', caseSensitive: false).firstMatch(disposition);
    return plain?.group(1);
  }

  String _safeName(String name) {
    final cleaned = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
    return cleaned.isEmpty ? 'document' : cleaned;
  }
}
