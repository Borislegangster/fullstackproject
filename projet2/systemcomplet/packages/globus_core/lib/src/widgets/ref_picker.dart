import 'dart:async';

import 'package:flutter/material.dart';

import '../api/json.dart';
import '../context.dart';
import '../format/labels.dart';
import 'states.dart';

/// Source d'une liste de sélection (clé étrangère) : jamais d'identifiant technique saisi à la main.
class RefSource {
  const RefSource({required this.path, required this.label, this.sublabel, this.query = const {}, this.searchable = true});
  final String path;
  final Map<String, dynamic> query;
  final String Function(J row) label;
  final String? Function(J row)? sublabel;
  final bool searchable;
}

String _name(J r) => r.str('name') ?? r.str('title') ?? r.str('label') ?? r.str('full_name') ?? r.str('code') ?? r.s('id');
String _person(J r) => r.str('full_name') ?? [r.str('first_name'), r.str('last_name')].whereType<String>().join(' ').ifBlank(r.s('email'));

extension on String {
  String ifBlank(String other) => trim().isEmpty ? other : this;
}

/// Référentiels courants (miroir de apps/web/src/lib/refs.ts).
abstract final class Refs {
  static final projects = RefSource(
    path: '/projects',
    label: (r) => '${r.has('code') ? '${r.s('code')} — ' : ''}${r.s('name')}',
    sublabel: (r) => r.str('city'),
  );
  static RefSource tasks(String projectId) =>
      RefSource(path: '/projects/$projectId/tasks', label: (r) => '${r.has('wbs_code') ? '${r.s('wbs_code')} ' : ''}${r.s('title')}');
  static final users = RefSource(path: '/users/directory', label: _person, sublabel: (r) => r.str('job_title') ?? r.str('email'), searchable: false);
  static final employees = RefSource(path: '/hr/employees', label: (r) => '${r.s('first_name')} ${r.s('last_name')}', sublabel: (r) => r.str('job_title'));
  static final suppliers = RefSource(path: '/suppliers', label: (r) => r.str('trade_name') ?? r.s('legal_name'), sublabel: (r) => r.str('city'));
  static final subcontractors = RefSource(
    path: '/subcontractors',
    label: (r) => r.str('trade_name') ?? r.s('legal_name'),
    sublabel: (r) => r.strings('trades').map(optionLabel).join(', '),
  );
  static final stockItems = RefSource(path: '/stock-items', label: (r) => '${r.s('sku')} — ${r.s('name')}', sublabel: (r) => r.str('unit'));
  static final warehouses = RefSource(path: '/warehouses', label: (r) => '${r.s('code')} — ${r.s('name')}');
  static final equipment = RefSource(path: '/equipment', label: (r) => '${r.s('code')} — ${r.s('name')}');
  static final teams = RefSource(path: '/teams', label: _name, searchable: false);
  static final ppeItems = RefSource(path: '/qhse/ppe-items', label: (r) => '${r.s('name')}${r.has('size') ? ' (${r.s('size')})' : ''}');
  static final inspectionTemplates = RefSource(path: '/qhse/inspection-templates', label: _name, sublabel: (r) => optionLabel(r.str('category')));
  static final purchaseOrders = RefSource(
    path: '/procurement/orders',
    label: (r) => '${r.s('number')}${r.has('supplier_name') ? ' — ${r.s('supplier_name')}' : ''}',
  );
  static RefSource zones(String projectId) =>
      RefSource(path: '/projects/$projectId/bim/zones', label: (r) => '${r.s('code')} — ${r.s('name')}', searchable: false);
  static RefSource sites(String projectId) =>
      RefSource(path: '/sites', query: {'project_id': projectId}, label: (r) => '${r.has('code') ? '${r.s('code')} — ' : ''}${r.s('name')}');
  static RefSource lots(String projectId) => RefSource(path: '/lots', query: {'project_id': projectId}, label: (r) => '${r.s('code')} — ${r.s('name')}');
}

/// Ouvre la recherche dans un référentiel et renvoie la ligne choisie.
Future<J?> pickRef(BuildContext context, RefSource source, {String title = 'Choisir'}) {
  return showModalBottomSheet<J>(
    context: context,
    isScrollControlled: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: 0.85,
      child: _RefSheet(source: source, title: title),
    ),
  );
}

class _RefSheet extends StatefulWidget {
  const _RefSheet({required this.source, required this.title});
  final RefSource source;
  final String title;
  @override
  State<_RefSheet> createState() => _RefSheetState();
}

class _RefSheetState extends State<_RefSheet> {
  final _q = TextEditingController();
  Timer? _debounce;
  List<J>? _rows;
  Object? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await context.api.get(
        widget.source.path,
        query: {
          ...widget.source.query,
          'page_size': 50,
          if (widget.source.searchable && _q.text.trim().isNotEmpty) 'q': _q.text.trim(),
        },
      );
      if (!mounted) return;
      var rows = listOf(data);
      if (!widget.source.searchable && _q.text.trim().isNotEmpty) {
        final q = _q.text.trim().toLowerCase();
        rows = rows.where((r) => widget.source.label(r).toLowerCase().contains(q)).toList();
      }
      setState(() {
        _rows = rows;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              TextField(
                controller: _q,
                autofocus: true,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher…'),
                onChanged: (_) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 300), () => unawaited(_load()));
                },
              ),
            ],
          ),
        ),
        Expanded(
          child: _error != null
              ? ErrorView(error: _error, onRetry: _load)
              : _rows == null
              ? const Center(child: CircularProgressIndicator())
              : _rows!.isEmpty
              ? const EmptyView(title: 'Aucun résultat')
              : ListView.separated(
                  itemCount: _rows!.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final r = _rows![i];
                    final sub = widget.source.sublabel?.call(r);
                    return ListTile(
                      title: Text(widget.source.label(r)),
                      subtitle: sub == null || sub.isEmpty ? null : Text(sub),
                      onTap: () => Navigator.pop(context, r),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

/// Champ de formulaire « sélection dans un référentiel » (affiche le libellé, jamais l'identifiant).
class RefField extends StatelessWidget {
  const RefField({super.key, required this.label, required this.source, required this.value, required this.onChanged, this.required = false});
  final String label;
  final RefSource source;
  final J? value;
  final ValueChanged<J?> onChanged;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final r = await pickRef(context, source, title: label);
        if (r != null) onChanged(r);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: required ? '$label *' : label,
          suffixIcon: value != null && !required
              ? IconButton(tooltip: 'Effacer', icon: const Icon(Icons.close), onPressed: () => onChanged(null))
              : const Icon(Icons.arrow_drop_down),
        ),
        child: Text(value == null ? 'Choisir…' : source.label(value!), style: value == null ? TextStyle(color: Theme.of(context).hintColor) : null),
      ),
    );
  }
}
