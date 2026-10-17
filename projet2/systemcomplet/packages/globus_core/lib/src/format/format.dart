import '../api/json.dart';

/// Formats français (Cameroun, fuseau Africa/Douala = UTC+1 sans heure d'été) : montants FCFA, dates, tailles.
/// Miroir de apps/web/src/lib/format.ts.
const _months = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const _monthsShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const _days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/// Heure murale de Douala pour un instant (les dates sans heure restent telles quelles).
DateTime douala(DateTime d) => d.isUtc ? d.add(const Duration(hours: 1)) : d;

String _two(int n) => n.toString().padLeft(2, '0');

/// Espace insécable (séparateur des milliers, avant l'unité).
const nbsp = '\u00a0';

String _group(int n) {
  final neg = n < 0;
  final digits = n.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    // Espace insécable : un montant n'est jamais coupé en fin de ligne.
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write(nbsp);
    buf.write(digits[i]);
  }
  return '${neg ? '-' : ''}$buf';
}

/// Nombre au format français (espace des milliers, virgule décimale).
String number(Object? value, [int digits = 0]) {
  if (value == null || value == '') return '—';
  final n = toDouble(value);
  if (digits == 0) return _group(n.round());
  final fixed = n.toStringAsFixed(digits);
  final parts = fixed.split('.');
  var dec = parts.length > 1 ? parts[1] : '';
  dec = dec.replaceFirst(RegExp(r'0+$'), '');
  final intPart = _group(int.parse(parts[0].replaceAll('-', '')) * (n < 0 ? -1 : 1));
  final sign = n < 0 && intPart == '0' ? '-' : '';
  return dec.isEmpty ? '$sign$intPart' : '$sign$intPart,$dec';
}

String currencyLabel(String? currency) => (currency == null || currency == 'XAF') ? 'FCFA' : currency;

String money(Object? value, [String? currency]) {
  if (value == null || value == '') return '—';
  return '${number(value)}$nbsp${currencyLabel(currency)}';
}

String percent(Object? value, [int digits = 0]) {
  if (value == null || value == '') return '—';
  return '${number(value, digits)}$nbsp%';
}

String date(Object? value) {
  final d = parseDate(value);
  if (d == null) return '—';
  final l = douala(d);
  return '${_two(l.day)}/${_two(l.month)}/${l.year}';
}

String dateTime(Object? value) {
  final d = parseDate(value);
  if (d == null) return '—';
  final l = douala(d);
  return '${_two(l.day)}/${_two(l.month)}/${l.year} ${_two(l.hour)}:${_two(l.minute)}';
}

String time(Object? value) {
  final d = parseDate(value);
  if (d == null) return '—';
  final l = douala(d);
  return '${_two(l.hour)}:${_two(l.minute)}';
}

String dateLong(Object? value) {
  final d = parseDate(value);
  if (d == null) return '—';
  final l = douala(d);
  return '${l.day} ${_months[l.month - 1]} ${l.year}';
}

String dayLong(Object? value) {
  final d = parseDate(value);
  if (d == null) return '—';
  final l = douala(d);
  return '${_days[l.weekday - 1]} ${l.day} ${_months[l.month - 1]}';
}

String monthShort(int month) => _monthsShort[month - 1];
String monthLong(int month) => _months[month - 1];

/// « il y a 5 minutes », « hier »… puis date au-delà de 30 jours.
String relative(Object? value, {DateTime? now}) {
  final d = parseDate(value);
  if (d == null) return '—';
  final diff = (now ?? DateTime.now()).difference(d).inSeconds;
  final abs = diff.abs();
  final future = diff < 0;
  String fmt(int n, String unit, String plural) => future ? 'dans $n ${n > 1 ? plural : unit}' : 'il y a $n ${n > 1 ? plural : unit}';
  if (abs < 60) return future ? 'dans un instant' : "à l'instant";
  if (abs < 3600) return fmt(abs ~/ 60, 'minute', 'minutes');
  if (abs < 86400) return fmt(abs ~/ 3600, 'heure', 'heures');
  final days = abs ~/ 86400;
  if (days == 1) return future ? 'demain' : 'hier';
  if (days < 30) return fmt(days, 'jour', 'jours');
  return date(d);
}

String fileSize(Object? bytes) {
  final n = toDouble(bytes);
  if (n < 1024) return '${n.toInt()} o';
  if (n < 1024 * 1024) return '${(n / 1024).toStringAsFixed(0)} Ko';
  if (n < 1024 * 1024 * 1024) return '${(n / 1024 / 1024).toStringAsFixed(1).replaceAll('.', ',')} Mo';
  return '${(n / 1024 / 1024 / 1024).toStringAsFixed(2).replaceAll('.', ',')} Go';
}

String initials(String? name) {
  if (name == null || name.trim().isEmpty) return '?';
  return name.trim().split(RegExp(r'\s+')).take(2).map((p) => p[0].toUpperCase()).join();
}

/// Date ISO (AAAA-MM-JJ) pour l'API.
String isoDate(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

/// Durée « 1 h 05 min » / « 3 min 20 s ».
String duration(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  final s = d.inSeconds % 60;
  if (h > 0) return '$h h ${_two(m)} min';
  if (m > 0) return '$m min ${_two(s)} s';
  return '$s s';
}
