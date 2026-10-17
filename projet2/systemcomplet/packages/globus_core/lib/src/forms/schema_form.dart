import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/json.dart';
import '../api/session_store.dart';
import '../context.dart';
import '../features/agenda/agenda.dart' show pickDateTime;
import '../files/files.dart';
import '../format/format.dart';
import '../format/labels.dart';
import '../widgets/dialogs.dart';
import '../widgets/primitives.dart';
import '../widgets/ref_picker.dart';
import 'ref_registry.dart';
import 'schema.dart';

/// Réglage d'un champ du formulaire généré (libellé, masquage, choix imposés, référentiel…).
class FieldConfig {
  const FieldConfig({
    this.label,
    this.help,
    this.hidden = false,
    this.readOnly = false,
    this.options,
    this.ref,
    this.multiline,
    this.password = false,
    this.fields = const {},
  });

  final String? label;
  final String? help;
  final bool hidden;
  final bool readOnly;

  /// Choix imposés (valeur, libellé) à la place des valeurs du schéma.
  final List<(String, String)>? options;

  /// Nom du référentiel (clé de kRefs) quand le nom du champ ne suffit pas.
  final String? ref;
  final bool? multiline;
  final bool password;

  /// Réglages des sous-champs (lignes d'une liste d'objets).
  final Map<String, FieldConfig> fields;
}

typedef Values = Map<String, dynamic>;

bool _isEmpty(Object? v) => v == null || (v is String && v.trim().isEmpty) || (v is List && v.isEmpty);

/// Champ jamais présenté à la saisie : JSON brut, identifiant sans référentiel (règle : aucun code technique saisi).
bool _technical(FieldDef def, FieldConfig? cfg) {
  if (cfg?.options != null || cfg?.ref != null) return false;
  if (def.kind == 'json' || (def.kind == 'list' && (def.itemKind == 'json' || def.itemKind == 'object'))) return true;
  if (def.kind == 'uuid' && refForField(def.name) == null) return true;
  if (def.kind == 'list' && def.itemKind == 'uuid' && refForList(def.name) == null) return true;
  if ((def.kind == 'objects' || def.kind == 'object') && def.ref == null) return true;
  return false;
}

Object? _initial(FieldDef def, Object? raw) {
  final v = raw ?? def.defaultValue;
  switch (def.kind) {
    case 'boolean':
      return v is bool ? v : (v?.toString() == 'true');
    case 'list':
      return v is List ? [...v] : <Object?>[];
    case 'files':
      return <UploadFile>[];
    case 'file':
      return null;
    case 'objects':
      final rows = v is List ? v.whereType<Map<dynamic, dynamic>>().map((r) => r.cast<String, dynamic>()).toList() : <Values>[];
      if (rows.isEmpty && (def.minItems ?? 0) > 0 && def.ref != null) return [emptyValues(def.ref!)];
      return [for (final r in rows) emptyValues(def.ref ?? '', r)];
    case 'object':
      return v is Map ? emptyValues(def.ref ?? '', v.cast<String, dynamic>()) : null;
    case 'date':
      return v == null ? null : parseDate(v);
    case 'datetime':
      return v == null ? null : parseDate(v);
    case 'time':
      return v?.toString().substring(0, (v.toString().length).clamp(0, 5));
    default:
      return v?.toString() ?? '';
  }
}

/// Valeurs de départ d'un schéma (valeurs connues, sinon valeurs par défaut de l'API).
Values emptyValues(String schema, [Values init = const {}]) => {
  for (final f in schemaOf(schema) ?? const <FieldDef>[]) f.name: _initial(f, init[f.name]),
};

/// Conversion vers le contrat JSON de l'API (miroir de toPayload du web).
Values toPayload(String schema, Values values, {bool partial = false, Values? initial, List<String> keep = const []}) {
  final out = <String, dynamic>{};
  for (final def in schemaOf(schema) ?? const <FieldDef>[]) {
    if (!values.containsKey(def.name)) continue;
    final v = values[def.name];
    Object? converted;
    switch (def.kind) {
      case 'boolean':
        converted = v == true;
      case 'integer':
        converted = _isEmpty(v) ? null : int.tryParse(v.toString().replaceAll(RegExp(r'\s'), ''));
      case 'number':
        converted = _isEmpty(v) ? null : num.tryParse(v.toString().replaceAll(RegExp(r'\s'), '').replaceAll(',', '.'));
      case 'date':
        converted = v is DateTime ? isoDate(v) : (_isEmpty(v) ? null : v);
      case 'datetime':
        converted = v is DateTime ? v.toUtc().toIso8601String() : (_isEmpty(v) ? null : v);
      case 'objects':
        converted = [for (final row in (v as List? ?? const [])) def.ref != null ? toPayload(def.ref!, (row as Map).cast<String, dynamic>()) : row];
      case 'object':
        converted = v is Map && def.ref != null ? toPayload(def.ref!, v.cast<String, dynamic>()) : v;
      case 'list':
        converted = v is List ? v : const <Object?>[];
      case 'file' || 'files':
        continue;
      default:
        converted = _isEmpty(v) ? null : v;
    }
    if (converted == null) {
      if (def.required) {
        converted = def.kind == 'string' || def.kind == 'text' ? '' : null;
      } else if (!def.nullable && !partial) {
        continue;
      }
    }
    if (partial && initial != null && !keep.contains(def.name)) {
      final before = toPayload(schema, {def.name: _initial(def, initial[def.name])})[def.name];
      if (_same(before, converted)) continue;
    }
    if (converted == null && !def.nullable && !def.required) continue;
    out[def.name] = converted;
  }
  return out;
}

bool _same(Object? a, Object? b) {
  if (a is List && b is List) return a.length == b.length && [for (var i = 0; i < a.length; i++) _same(a[i], b[i])].every((x) => x);
  if (a is Map && b is Map) return a.length == b.length && a.keys.every((k) => _same(a[k], b[k]));
  return a == b;
}

Map<String, String> validateValues(String schema, Values values, Map<String, FieldConfig> configs, [String prefix = '']) {
  final errors = <String, String>{};
  for (final def in schemaOf(schema) ?? const <FieldDef>[]) {
    final cfg = configs[def.name];
    if ((cfg?.hidden ?? false) || !values.containsKey(def.name) || def.kind == 'boolean') continue;
    if (_technical(def, cfg)) continue;
    final v = values[def.name];
    final key = '$prefix${def.name}';
    if (def.required && _isEmpty(v) && def.kind != 'objects') {
      errors[key] = 'Champ obligatoire';
      continue;
    }
    if (v is String && v.isNotEmpty) {
      if (def.maxLength != null && v.length > def.maxLength!) errors[key] = '${def.maxLength} caractères maximum';
      if (def.minLength != null && v.trim().length < def.minLength!) errors[key] = '${def.minLength} caractères minimum';
      if (def.kind == 'number' || def.kind == 'integer') {
        final n = num.tryParse(v.replaceAll(RegExp(r'\s'), '').replaceAll(',', '.'));
        if (n == null || (def.kind == 'integer' && n is! int && n != n.roundToDouble())) {
          errors[key] = def.kind == 'integer' ? 'Nombre entier attendu' : 'Nombre attendu';
        } else if (def.min != null && n < def.min!) {
          errors[key] = 'Minimum : ${number(def.min, 2)}';
        } else if (def.max != null && n > def.max!) {
          errors[key] = 'Maximum : ${number(def.max, 2)}';
        }
      }
      if (def.kind == 'email' && !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) errors[key] = 'Adresse e-mail invalide';
    }
    if (def.kind == 'objects') {
      final rows = v is List ? v : const [];
      if ((def.minItems ?? 0) > rows.length) errors[key] = 'Au moins ${def.minItems} ligne(s) requise(s)';
      if (def.ref != null) {
        for (var i = 0; i < rows.length; i++) {
          errors.addAll(validateValues(def.ref!, (rows[i] as Map).cast<String, dynamic>(), cfg?.fields ?? const {}, '$key.$i.'));
        }
      }
    }
    if (def.kind == 'list' && (def.minItems ?? 0) > (v is List ? v.length : 0)) errors[key] = 'Au moins ${def.minItems} élément(s)';
  }
  return errors;
}

/// Formulaire généré depuis le schéma OpenAPI (miroir du SchemaForm web) : validation, référentiels (jamais
/// d'identifiant saisi), listes, lignes, fichiers, erreurs du serveur champ par champ.
class SchemaForm extends StatefulWidget {
  const SchemaForm({
    super.key,
    this.schema,
    this.endpoint,
    this.params = const {},
    this.initial = const {},
    this.fields = const {},
    this.only,
    this.exclude = const [],
    this.order,
    this.fixed = const {},
    this.partial = false,
    this.idempotent = false,
    this.submitLabel = 'Enregistrer',
    this.onSubmit,
    this.onSuccess,
    this.danger = false,
  });

  /// Schéma généré (ex. « PRIn ») ; déduit de [endpoint] si absent.
  final String? schema;

  /// Point d'entrée tel que dans kBodies, ex. « POST /procurement/requests/{request_id}/decision ».
  final String? endpoint;
  final Map<String, String> params;
  final Values initial;
  final Map<String, FieldConfig> fields;
  final List<String>? only;
  final List<String> exclude;
  final List<String>? order;

  /// Valeurs imposées (non affichées) ajoutées à la charge utile.
  final Values fixed;
  final bool partial;
  final bool idempotent;
  final String submitLabel;
  final Future<Object?> Function(Values payload, List<UploadFile> files)? onSubmit;
  final void Function(Object? result)? onSuccess;
  final bool danger;

  @override
  State<SchemaForm> createState() => _SchemaFormState();
}

class _SchemaFormState extends State<SchemaForm> {
  late final ({String type, String? schema})? _body = widget.endpoint == null ? null : bodyOf(widget.endpoint!);
  late final String _schema = widget.schema ?? _body?.schema ?? '';
  late final Values _values = emptyValues(_schema, {...widget.initial, ...widget.fixed});
  final Map<String, String> _labels = {};
  Map<String, String> _errors = {};
  String? _formError;
  bool _busy = false;
  late final String _idemKey = newKey();

  Map<String, FieldConfig> get _configs => {
    ...widget.fields,
    for (final k in widget.fixed.keys) k: const FieldConfig(hidden: true),
  };

  List<FieldDef> get _visible {
    final defs = (schemaOf(_schema) ?? const <FieldDef>[]).where((d) {
      final cfg = _configs[d.name];
      if (cfg?.hidden ?? false) return false;
      if (widget.only != null && !widget.only!.contains(d.name)) return false;
      if (widget.exclude.contains(d.name)) return false;
      return !_technical(d, cfg);
    }).toList();
    final order = widget.order;
    if (order != null) {
      defs.sort((a, b) {
        final ia = order.indexOf(a.name), ib = order.indexOf(b.name);
        return (ia < 0 ? 999 : ia).compareTo(ib < 0 ? 999 : ib);
      });
    }
    return defs;
  }

  Future<void> _submit() async {
    final values = {..._values, ...widget.fixed};
    final errors = validateValues(_schema, values, _configs);
    setState(() {
      _errors = errors;
      _formError = errors.isEmpty ? null : 'Vérifiez les champs signalés.';
    });
    if (errors.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      final files = <UploadFile>[
        for (final def in schemaOf(_schema) ?? const <FieldDef>[])
          if (def.kind == 'file' && values[def.name] is UploadFile)
            _withField(values[def.name] as UploadFile, def.name)
          else if (def.kind == 'files')
            for (final f in (values[def.name] as List? ?? const []).whereType<UploadFile>()) _withField(f, def.name),
      ];
      final payload = toPayload(_schema, values, partial: widget.partial, initial: widget.initial, keep: widget.fixed.keys.toList());
      Object? result;
      if (widget.onSubmit != null) {
        result = await widget.onSubmit!(payload, files);
      } else if (widget.endpoint != null) {
        final parts = widget.endpoint!.split(' ');
        final path = parts[1].replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => Uri.encodeComponent(widget.params[m[1]] ?? '${widget.fixed[m[1]] ?? ''}'));
        if (_body?.type == 'multipart') {
          result = await context.api.upload(
            path,
            method: parts[0],
            files: files,
            fields: {
              for (final e in payload.entries)
                if (e.value != null) e.key: e.value is List ? (e.value as List).map((x) => '$x').toList() : (e.value is bool ? '${e.value}' : e.value),
            },
            idempotent: widget.idempotent ? _idemKey : null,
          );
        } else {
          result = await context.api.request(parts[0], path, body: payload, idempotent: widget.idempotent ? _idemKey : null);
        }
      }
      widget.onSuccess?.call(result);
    } catch (e) {
      final mapped = <String, String>{};
      if (e is ApiException) {
        for (final f in e.fieldErrors) {
          mapped[f.field.replaceFirst(RegExp(r'^body\.'), '')] = f.message;
        }
      }
      if (mounted) {
        setState(() {
          _errors = mapped;
          _formError = errorMessage(e);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  UploadFile _withField(UploadFile f, String field) => UploadFile(name: f.name, path: f.path, bytes: f.bytes, field: field, contentType: f.contentType);

  @override
  Widget build(BuildContext context) {
    if (schemaOf(_schema) == null) {
      return AlertBox(tone: Tone.danger, message: 'Formulaire indisponible (schéma « ${_schema.isEmpty ? widget.endpoint : _schema} » inconnu).');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final def in _visible)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: SchemaControl(
              def: def,
              cfg: _configs[def.name],
              value: _values[def.name],
              values: {..._values, ...widget.fixed},
              labels: _labels,
              error: _errors[def.name],
              errors: _errors,
              errorPrefix: '${def.name}.',
              onChanged: (v) => setState(() {
                _values[def.name] = v;
                _errors.remove(def.name);
              }),
            ),
          ),
        if (_formError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: AlertBox(tone: Tone.danger, title: 'Enregistrement impossible', message: _formError!),
          ),
        BusyButton(label: widget.submitLabel, busy: _busy, expand: true, danger: widget.danger, onPressed: _submit),
      ],
    );
  }
}

/// Contrôle d'un champ selon son type (exposé pour les éditeurs de lignes).
class SchemaControl extends StatelessWidget {
  const SchemaControl({
    super.key,
    required this.def,
    required this.cfg,
    required this.value,
    required this.values,
    required this.labels,
    required this.onChanged,
    this.error,
    this.errors = const {},
    this.errorPrefix = '',
  });

  final FieldDef def;
  final FieldConfig? cfg;
  final Object? value;
  final Values values;
  final Map<String, String> labels;
  final ValueChanged<Object?> onChanged;
  final String? error;
  final Map<String, String> errors;
  final String errorPrefix;

  String get _label => '${cfg?.label ?? fieldLabel(def.name)}${def.required && def.kind != 'boolean' ? ' *' : ''}';

  InputDecoration _decoration(BuildContext context, {Widget? suffix}) =>
      InputDecoration(labelText: _label, helperText: cfg?.help ?? def.help, helperMaxLines: 3, errorText: error, suffixIcon: suffix);

  @override
  Widget build(BuildContext context) {
    final readOnly = cfg?.readOnly ?? false;
    final options = cfg?.options ?? def.options?.map((o) => (o, optionLabel(o))).toList();
    if (options != null && def.kind != 'list') {
      final current = value?.toString();
      return DropdownButtonFormField<String>(
        isExpanded: true,
        initialValue: options.any((o) => o.$1 == current) ? current : null,
        decoration: _decoration(context),
        items: [
          if (!def.required) const DropdownMenuItem<String>(child: Text('—')),
          for (final o in options)
            DropdownMenuItem(
              value: o.$1,
              child: Text(o.$2, overflow: TextOverflow.ellipsis),
            ),
        ],
        onChanged: readOnly ? null : onChanged,
      );
    }
    switch (def.kind) {
      case 'boolean':
        return SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(_label),
          subtitle: (cfg?.help ?? def.help) == null ? null : Text(cfg?.help ?? def.help!),
          value: value == true,
          onChanged: readOnly ? null : onChanged,
        );
      case 'date' || 'datetime' || 'time':
        return _DateControl(control: this, readOnly: readOnly);
      case 'uuid':
        return _RefControl(control: this, readOnly: readOnly);
      case 'list':
        return _ListControl(control: this, readOnly: readOnly);
      case 'objects':
        return _LinesControl(control: this);
      case 'object':
        return _ObjectControl(control: this);
      case 'file' || 'files':
        return _FileControl(control: this);
      default:
        final multiline = cfg?.multiline ?? (def.kind == 'text' || (def.maxLength ?? 0) > 300);
        final numeric = def.kind == 'number' || def.kind == 'integer';
        return TextFormField(
          initialValue: value?.toString() ?? '',
          readOnly: readOnly,
          obscureText: cfg?.password ?? false,
          minLines: multiline ? 3 : 1,
          maxLines: multiline ? 8 : 1,
          maxLength: def.maxLength != null && def.maxLength! <= 300 && !numeric ? def.maxLength : null,
          keyboardType: numeric
              ? TextInputType.numberWithOptions(decimal: def.kind == 'number', signed: (def.min ?? 0) < 0)
              : def.kind == 'email'
              ? TextInputType.emailAddress
              : (multiline ? TextInputType.multiline : TextInputType.text),
          decoration: _decoration(context),
          onChanged: onChanged,
        );
    }
  }
}

class _DateControl extends StatelessWidget {
  const _DateControl({required this.control, required this.readOnly});
  final SchemaControl control;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final c = control;
    final v = c.value;
    final text = switch (c.def.kind) {
      'time' => (v as String?)?.isNotEmpty == true ? v! : null,
      'datetime' => v is DateTime ? dateTime(v.toUtc()) : null,
      _ => v is DateTime ? date(v) : null,
    };
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: readOnly
          ? null
          : () async {
              final now = DateTime.now();
              if (c.def.kind == 'time') {
                final parts = (v as String? ?? '').split(':');
                final t = await showTimePicker(
                  context: context,
                  initialTime: parts.length == 2
                      ? TimeOfDay(hour: int.tryParse(parts[0]) ?? 8, minute: int.tryParse(parts[1]) ?? 0)
                      : const TimeOfDay(hour: 8, minute: 0),
                );
                if (t != null) c.onChanged('${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
              } else if (c.def.kind == 'datetime') {
                final d = await pickDateTime(context, v is DateTime ? v.toLocal() : now);
                if (d != null) c.onChanged(d);
              } else {
                final d = await showDatePicker(context: context, initialDate: v is DateTime ? v : now, firstDate: DateTime(2000), lastDate: DateTime(2100));
                if (d != null) c.onChanged(d);
              }
            },
      child: InputDecorator(
        decoration: c._decoration(
          context,
          suffix: text != null && !c.def.required && !readOnly
              ? IconButton(tooltip: 'Effacer', icon: const Icon(Icons.close), onPressed: () => c.onChanged(null))
              : Icon(c.def.kind == 'time' ? Icons.schedule : Icons.event),
        ),
        child: Text(text ?? 'Choisir…', style: text == null ? TextStyle(color: Theme.of(context).hintColor) : null),
      ),
    );
  }
}

class _RefControl extends StatelessWidget {
  const _RefControl({required this.control, required this.readOnly});
  final SchemaControl control;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final c = control;
    final named = c.cfg?.ref != null ? kRefs[c.cfg!.ref] : refForField(c.def.name);
    final source = named?.resolve(c.values);
    final id = c.value?.toString();
    final has = id != null && id.isNotEmpty;
    final label = has ? (c.labels[c.def.name] ?? 'Sélection actuelle') : null;
    final missing = named != null && source == null ? named.dependsOn.where((d) => _isEmpty(c.values[d])).map(fieldLabel).join(', ') : null;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: readOnly || source == null
          ? null
          : () async {
              final r = await pickRef(context, source, title: c.cfg?.label ?? fieldLabel(c.def.name));
              if (r != null) {
                c.labels[c.def.name] = source.label(r);
                c.onChanged(r.s('id'));
              }
            },
      child: InputDecorator(
        decoration: c
            ._decoration(
              context,
              suffix: has && !c.def.required && !readOnly
                  ? IconButton(
                      tooltip: 'Effacer',
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        c.labels.remove(c.def.name);
                        c.onChanged(null);
                      },
                    )
                  : const Icon(Icons.arrow_drop_down),
            )
            .copyWith(helperText: missing != null ? 'Choisissez d\'abord : $missing' : (c.cfg?.help ?? c.def.help)),
        child: Text(label ?? 'Choisir…', style: label == null ? TextStyle(color: Theme.of(context).hintColor) : null),
      ),
    );
  }
}

class _ListControl extends StatefulWidget {
  const _ListControl({required this.control, required this.readOnly});
  final SchemaControl control;
  final bool readOnly;
  @override
  State<_ListControl> createState() => _ListControlState();
}

class _ListControlState extends State<_ListControl> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  List<Object?> get _items => (widget.control.value as List?)?.toList() ?? <Object?>[];

  @override
  Widget build(BuildContext context) {
    final c = widget.control;
    final options = c.cfg?.options ?? c.def.itemOptions?.map((o) => (o, optionLabel(o))).toList() ?? c.def.options?.map((o) => (o, optionLabel(o))).toList();
    final theme = Theme.of(context);
    Widget wrap(Widget child) => InputDecorator(decoration: c._decoration(context), child: child);
    if (options != null) {
      return wrap(
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            for (final o in options)
              FilterChip(
                label: Text(o.$2),
                selected: _items.contains(o.$1),
                onSelected: widget.readOnly ? null : (s) => c.onChanged(s ? [..._items, o.$1] : _items.where((x) => x != o.$1).toList()),
              ),
          ],
        ),
      );
    }
    if (c.def.itemKind == 'uuid') {
      final named = c.cfg?.ref != null ? kRefs[c.cfg!.ref] : refForList(c.def.name);
      final source = named?.resolve(c.values);
      return wrap(
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            for (final id in _items)
              InputChip(
                label: Text(c.labels['${c.def.name}:$id'] ?? 'Sélection actuelle'),
                onDeleted: widget.readOnly ? null : () => c.onChanged(_items.where((x) => x != id).toList()),
              ),
            if (!widget.readOnly && source != null)
              ActionChip(
                avatar: const Icon(Icons.add, size: 18),
                label: const Text('Ajouter'),
                onPressed: () async {
                  final r = await pickRef(context, source, title: c.cfg?.label ?? fieldLabel(c.def.name));
                  if (r != null && !_items.contains(r.s('id'))) {
                    c.labels['${c.def.name}:${r.s('id')}'] = source.label(r);
                    c.onChanged([..._items, r.s('id')]);
                  }
                },
              ),
          ],
        ),
      );
    }
    void add() {
      final t = _text.text.trim();
      if (t.isEmpty) return;
      final numeric = c.def.itemKind == 'number' || c.def.itemKind == 'integer';
      c.onChanged([..._items, numeric ? (num.tryParse(t.replaceAll(',', '.')) ?? t) : t]);
      _text.clear();
    }

    return wrap(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_items.isNotEmpty)
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                for (final (i, item) in _items.indexed)
                  InputChip(
                    label: Text('$item'),
                    onDeleted: widget.readOnly ? null : () => c.onChanged([..._items]..removeAt(i)),
                  ),
              ],
            ),
          if (!widget.readOnly)
            TextField(
              controller: _text,
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Ajouter…',
                hintStyle: TextStyle(color: theme.hintColor),
                suffixIcon: IconButton(tooltip: 'Ajouter', icon: const Icon(Icons.add), onPressed: add),
              ),
              onSubmitted: (_) => add(),
            ),
        ],
      ),
    );
  }
}

class _LinesControl extends StatelessWidget {
  const _LinesControl({required this.control});
  final SchemaControl control;

  @override
  Widget build(BuildContext context) {
    final c = control;
    final rows = (c.value as List? ?? const []).map((r) => (r as Map).cast<String, dynamic>()).toList();
    final schema = c.def.ref!;
    final defs = (schemaOf(schema) ?? const <FieldDef>[])
        .where((d) => !(c.cfg?.fields[d.name]?.hidden ?? false) && !_technical(d, c.cfg?.fields[d.name]))
        .toList();
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(c._label, style: theme.textTheme.titleSmall),
        if (c.error != null) Text(c.error!, style: TextStyle(color: theme.colorScheme.error, fontSize: 12)),
        const SizedBox(height: 6),
        for (final (i, row) in rows.indexed)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 4, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Text('Ligne ${i + 1}', style: theme.textTheme.labelLarge),
                      const Spacer(),
                      IconButton(tooltip: 'Supprimer la ligne', icon: const Icon(Icons.delete_outline), onPressed: () => c.onChanged([...rows]..removeAt(i))),
                    ],
                  ),
                  for (final d in defs)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10, right: 8),
                      child: SchemaControl(
                        def: d,
                        cfg: c.cfg?.fields[d.name],
                        value: row[d.name],
                        values: {...c.values, ...row},
                        labels: c.labels,
                        error: c.errors['${c.errorPrefix}$i.${d.name}'],
                        onChanged: (v) {
                          final next = [...rows];
                          next[i] = {...row, d.name: v};
                          c.onChanged(next);
                        },
                      ),
                    ),
                ],
              ),
            ),
          ),
        if (c.def.maxItems == null || rows.length < c.def.maxItems!)
          OutlinedButton.icon(
            onPressed: () => c.onChanged([...rows, emptyValues(schema)]),
            icon: const Icon(Icons.add),
            label: const Text('Ajouter une ligne'),
          ),
      ],
    );
  }
}

class _ObjectControl extends StatelessWidget {
  const _ObjectControl({required this.control});
  final SchemaControl control;

  @override
  Widget build(BuildContext context) {
    final c = control;
    final schema = c.def.ref!;
    final value = (c.value as Map?)?.cast<String, dynamic>();
    if (value == null) {
      return OutlinedButton.icon(onPressed: () => c.onChanged(emptyValues(schema)), icon: const Icon(Icons.add), label: Text(c._label));
    }
    final defs = (schemaOf(schema) ?? const <FieldDef>[]).where((d) => !_technical(d, c.cfg?.fields[d.name])).toList();
    return SectionCard(
      title: c._label,
      trailing: c.def.required ? null : IconButton(tooltip: 'Retirer', icon: const Icon(Icons.close), onPressed: () => c.onChanged(null)),
      child: Column(
        children: [
          for (final d in defs)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SchemaControl(
                def: d,
                cfg: c.cfg?.fields[d.name],
                value: value[d.name],
                values: {...c.values, ...value},
                labels: c.labels,
                error: c.errors['${c.errorPrefix}${d.name}'],
                onChanged: (v) => c.onChanged({...value, d.name: v}),
              ),
            ),
        ],
      ),
    );
  }
}

class _FileControl extends StatelessWidget {
  const _FileControl({required this.control});
  final SchemaControl control;

  @override
  Widget build(BuildContext context) {
    final c = control;
    final multiple = c.def.kind == 'files';
    final files = multiple ? (c.value as List? ?? const []).whereType<UploadFile>().toList() : [if (c.value is UploadFile) c.value! as UploadFile];
    return InputDecorator(
      decoration: c._decoration(context),
      child: Wrap(
        spacing: 6,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          for (final (i, f) in files.indexed)
            InputChip(
              avatar: const Icon(Icons.attach_file, size: 18),
              label: Text(f.name, overflow: TextOverflow.ellipsis),
              onDeleted: () => c.onChanged(multiple ? ([...files]..removeAt(i)) : null),
            ),
          ActionChip(
            avatar: const Icon(Icons.upload_file, size: 18),
            label: Text(files.isEmpty ? 'Choisir un fichier' : (multiple ? 'Ajouter' : 'Remplacer')),
            onPressed: () async {
              final picked = await pickAttachments(context, multiple: multiple);
              if (picked.isEmpty) return;
              c.onChanged(multiple ? [...files, ...picked] : picked.first);
            },
          ),
        ],
      ),
    );
  }
}

/// Ouvre un formulaire généré dans une feuille ; renvoie la réponse de l'API (ou `null` si annulé).
Future<Object?> showSchemaForm(
  BuildContext context, {
  required String title,
  String? endpoint,
  String? schema,
  Map<String, String> params = const {},
  Values initial = const {},
  Map<String, FieldConfig> fields = const {},
  List<String>? only,
  List<String> exclude = const [],
  List<String>? order,
  Values fixed = const {},
  bool partial = false,
  bool idempotent = false,
  String submitLabel = 'Enregistrer',
  bool danger = false,
  String? intro,
  Future<Object?> Function(Values payload, List<UploadFile> files)? onSubmit,
}) {
  return showModalBottomSheet<Object?>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.9,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Text(title, style: Theme.of(ctx).textTheme.titleLarge),
            if (intro != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(intro)),
            const SizedBox(height: 16),
            SchemaForm(
              endpoint: endpoint,
              schema: schema,
              params: params,
              initial: initial,
              fields: fields,
              only: only,
              exclude: exclude,
              order: order,
              fixed: fixed,
              partial: partial,
              idempotent: idempotent,
              submitLabel: submitLabel,
              danger: danger,
              onSubmit: onSubmit,
              onSuccess: (r) => Navigator.of(ctx).pop(r ?? true),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Valeur affichable d'un champ quelconque d'une réponse (fiche détaillée générique).
String displayValue(String key, Object? v) {
  if (v == null || v == '') return '—';
  if (v is bool) return v ? 'Oui' : 'Non';
  if (v is List) {
    return v.isEmpty
        ? '—'
        : v.map((x) => x is Map ? (J.of(x).str('name') ?? J.of(x).str('title') ?? J.of(x).str('label') ?? '…') : optionLabel('$x')).join(', ');
  }
  if (v is Map) return J.of(v).str('name') ?? J.of(v).str('title') ?? J.of(v).str('legal_name') ?? J.of(v).str('full_name') ?? '…';
  final s = v.toString();
  if (RegExp(r'(_at|_on)$').hasMatch(key) && parseDate(s) != null && s.contains('T')) return dateTime(s);
  if (RegExp(r'(date|_on|_until|_from|_to)$').hasMatch(key) && parseDate(s) != null) return date(s);
  if (RegExp(r'(amount|price|cost|total|budget|value|salary|revenue|margin|paid|due|balance)(_ttc|_ht|_xaf)?$').hasMatch(key) && num.tryParse(s) != null) {
    return money(s);
  }
  if (RegExp(r'(_pct|_rate|percent)$').hasMatch(key) && num.tryParse(s) != null) return percent(s, 1);
  if (key == 'status' || key.endsWith('_status')) return statusLabel(s);
  if (RegExp(r'^[a-z_]+$').hasMatch(s) && s.contains('_')) return optionLabel(s);
  return s;
}
