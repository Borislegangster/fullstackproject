import '../generated/labels.g.dart';

export '../generated/labels.g.dart' show kHiddenFields, kPersonTrades;

/// Champ affichable dans une fiche générique (miroir de isHiddenField du web) : ni identifiant, ni empreinte, ni
/// jeton, ni donnée technique.
bool isHiddenField(String name) => kHiddenFields.contains(name) || RegExp(r'(_id|_ids|_hash|_token)$').hasMatch(name);

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

/// Corps de métier de la sous-traitance (sans les métiers de chantier du personnel), en options (valeur, libellé).
List<(String, String)> subcontractingTradeOptions() => [
  for (final g in kPersonTrades)
    if (g.family != 'Métiers de chantier')
      for (final code in g.codes) (code, optionLabel(code)),
];

/// Tous les métiers (personnel et sous-traitance), en options (valeur, libellé).
List<(String, String)> tradeOptions() => [for (final o in personTradeOptions()) (o.value, o.label)];

/// Version d'un document (« V1.0 », « 2 » → « v2 ») sans doublon de préfixe.
String versionLabel(String? label) {
  final l = (label ?? '').trim();
  if (l.isEmpty) return '';
  return RegExp(r'^[vV]').hasMatch(l) ? l : 'v$l';
}
