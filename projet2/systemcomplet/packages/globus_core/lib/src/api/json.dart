/// Accès typé et tolérant aux réponses JSON de l'API (les montants Decimal arrivent en chaînes).
typedef JsonMap = Map<String, dynamic>;

extension type const J(JsonMap raw) {
  factory J.of(Object? value) => J(value is Map ? value.cast<String, dynamic>() : <String, dynamic>{});

  Object? operator [](String key) => raw[key];
  bool has(String key) => raw[key] != null;

  String? str(String key) {
    final v = raw[key];
    if (v == null) return null;
    final s = v.toString();
    return s.isEmpty ? null : s;
  }

  String s(String key, [String fallback = '']) => str(key) ?? fallback;

  num? numOrNull(String key) => toNum(raw[key]);
  double d(String key, [double fallback = 0]) => toNum(raw[key])?.toDouble() ?? fallback;
  int i(String key, [int fallback = 0]) => toNum(raw[key])?.toInt() ?? fallback;
  int? intOrNull(String key) => toNum(raw[key])?.toInt();
  bool b(String key, [bool fallback = false]) {
    final v = raw[key];
    if (v is bool) return v;
    if (v is num) return v != 0;
    if (v is String) return v == 'true' || v == '1';
    return fallback;
  }

  DateTime? date(String key) => parseDate(raw[key]);

  J obj(String key) => J.of(raw[key]);
  J? objOrNull(String key) => raw[key] is Map ? J.of(raw[key]) : null;
  List<J> list(String key) => listOf(raw[key]);
  List<String> strings(String key) => (raw[key] is List) ? (raw[key] as List).map((e) => e.toString()).toList() : const [];
}

num? toNum(Object? v) {
  if (v == null) return null;
  if (v is num) return v;
  return num.tryParse(v.toString());
}

double toDouble(Object? v) => toNum(v)?.toDouble() ?? 0;

DateTime? parseDate(Object? v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  final s = v.toString();
  if (s.isEmpty) return null;
  return DateTime.tryParse(s);
}

List<J> listOf(Object? value) {
  if (value is List) return value.whereType<Map<dynamic, dynamic>>().map(J.of).toList();
  if (value is Map && value['items'] is List) return listOf(value['items']);
  return const [];
}
