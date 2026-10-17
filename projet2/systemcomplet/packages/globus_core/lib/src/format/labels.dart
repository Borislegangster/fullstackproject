import '../generated/labels.g.dart';

export '../generated/labels.g.dart' show kPersonTrades;

/// Libellé français d'un champ de l'API (miroir de `fieldLabel` du web).
String fieldLabel(String name) {
  final known = kFieldLabels[name];
  if (known != null) return known;
  final words = name.split('_').map((w) => kFieldWords[w] ?? w).where((w) => w.isNotEmpty).join(' ');
  if (words.isEmpty) return name;
  return words[0].toUpperCase() + words.substring(1);
}

/// Libellé français d'une valeur d'énumération (statut, type, catégorie…).
String optionLabel(Object? value) {
  if (value == null) return '—';
  final key = value.toString();
  if (key.isEmpty) return '—';
  return kOptionLabels[key] ?? key.replaceAll('_', ' ');
}

String statusLabel(String? status) {
  if (status == null || status.isEmpty) return '—';
  return kStatusLabels[status] ?? kOptionLabels[status] ?? status.replaceAll('_', ' ');
}

/// Ton visuel d'un statut : neutral / info / success / warning / danger / accent.
enum Tone { neutral, info, success, warning, danger, accent }

Tone statusTone(String? status) {
  if (status == null) return Tone.neutral;
  return switch (kStatusTones[status]) {
    'success' => Tone.success,
    'danger' => Tone.danger,
    'warning' => Tone.warning,
    'info' => Tone.info,
    'accent' => Tone.accent,
    _ => Tone.neutral,
  };
}

/// Métiers des personnes en options (valeur, libellé).
List<({String value, String label})> personTradeOptions() => [
  for (final g in kPersonTrades)
    for (final code in g.codes) (value: code, label: optionLabel(code)),
];
