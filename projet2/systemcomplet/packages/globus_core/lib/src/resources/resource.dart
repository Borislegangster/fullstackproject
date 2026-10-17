import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/json.dart';
import '../auth/auth_controller.dart';
import '../auth/me.dart';
import '../context.dart';
import '../format/format.dart';
import '../format/labels.dart';
import '../forms/schema_form.dart';
import '../theme/globus_theme.dart';
import '../widgets/api_view.dart';
import '../widgets/dialogs.dart';
import '../widgets/paged_list.dart';
import '../widgets/primitives.dart';
import '../widgets/states.dart';

/// Action sur une ligne (miroir de RowAction du web) : formulaire généré, confirmation simple avec motif, ou
/// action personnalisée.
class ResourceAction {
  const ResourceAction({
    required this.label,
    this.endpoint,
    this.path,
    this.method = 'POST',
    this.when,
    this.perms = const [],
    this.anyPerms = const [],
    this.confirm,
    this.reasonLabel,
    this.reasonRequired = true,
    this.danger = false,
    this.fields = const {},
    this.only,
    this.exclude = const [],
    this.initial,
    this.fixed,
    this.success,
    this.idempotent = false,
    this.body,
    this.run,
    this.icon,
    this.otp = false,
  });

  final String label;

  /// Point d'entrée à formulaire (clé kBodies, ex. « POST /procurement/orders/{order_id}/approve ») : le paramètre
  /// de chemin reçoit l'identifiant de la ligne.
  final String? endpoint;

  /// Chemin sans formulaire (confirmation simple, motif éventuel).
  final String Function(J row)? path;
  final String method;
  final bool Function(J row)? when;
  final List<String> perms;
  final List<String> anyPerms;
  final String? confirm;
  final String? reasonLabel;
  final bool reasonRequired;
  final bool danger;
  final Map<String, FieldConfig> fields;
  final List<String>? only;
  final List<String> exclude;
  final Map<String, dynamic> Function(J row)? initial;
  final Map<String, dynamic> Function(J row)? fixed;
  final String? success;
  final bool idempotent;

  /// Corps JSON d'une action à confirmation simple (reçoit le motif saisi).
  final Map<String, dynamic> Function(J row, String? reason)? body;

  /// Action personnalisée (écran dédié, téléchargement…).
  final Future<void> Function(BuildContext context, J row)? run;
  final IconData? icon;

  /// Double validation par code (OTP) exigée par le serveur pour cette action.
  final bool otp;

  bool visibleFor(Me? user, J row) {
    if (user == null) return false;
    if (perms.isNotEmpty && !user.canAll(perms)) return false;
    if (anyPerms.isNotEmpty && !user.canAny(anyPerms)) return false;
    return when?.call(row) ?? true;
  }
}

/// Filtre de liste (valeurs fixes en puces).
class ResourceFilter {
  const ResourceFilter(this.key, this.label, this.options);
  final String key;
  final String label;
  final List<(String, String)> options;
}

/// Champ affiché dans la fiche (sinon : affichage automatique de tous les champs lisibles).
class DetailField {
  const DetailField(this.key, [this.label, this.format]);
  final String key;
  final String? label;
  final String Function(J row)? format;
}

/// Création depuis la liste (formulaire généré).
class ResourceCreate {
  const ResourceCreate({
    required this.endpoint,
    this.label = 'Nouveau',
    this.fields = const {},
    this.only,
    this.exclude = const [],
    this.order,
    this.fixed,
    this.initial,
    this.perms = const [],
    this.idempotent = false,
  });
  final String endpoint;
  final String label;
  final Map<String, FieldConfig> fields;
  final List<String>? only;
  final List<String> exclude;
  final List<String>? order;
  final Map<String, dynamic> Function(BuildContext context)? fixed;
  final Map<String, dynamic>? initial;
  final List<String> perms;
  final bool idempotent;
}

/// Écran de ressource déclaratif (miroir de ResourceConfig du web) : liste paginée filtrable, fiche, actions.
class ResourceConfig {
  const ResourceConfig({
    required this.title,
    required this.path,
    required this.itemTitle,
    this.subtitle,
    this.query = const {},
    this.queryOf,
    this.itemSubtitle,
    this.itemTrailing,
    this.itemBadge,
    this.icon = Icons.description_outlined,
    this.filters = const [],
    this.search = true,
    this.create,
    this.update,
    this.actions = const [],
    this.detailPath,
    this.detailFields,
    this.detailExtra,
    this.open,
    this.emptyText,
    this.pageSize = 25,
  });

  final String title;
  final String? subtitle;
  final String path;
  final Map<String, dynamic> query;

  /// Filtres dépendant du contexte (chantier courant…).
  final Map<String, dynamic> Function(BuildContext context)? queryOf;
  final String Function(J row) itemTitle;
  final String? Function(J row)? itemSubtitle;
  final String? Function(J row)? itemTrailing;

  /// Pastille de statut (par défaut : champ « status »).
  final String? Function(J row)? itemBadge;
  final IconData icon;
  final List<ResourceFilter> filters;
  final bool search;
  final ResourceCreate? create;

  /// Modification : clé kBodies PATCH (formulaire partiel).
  final ResourceCreate? update;
  final List<ResourceAction> actions;
  final String Function(J row)? detailPath;
  final List<DetailField>? detailFields;

  /// Contenu supplémentaire de la fiche (lignes, historique…).
  final Widget Function(BuildContext context, J row, Future<void> Function() reload)? detailExtra;

  /// Ouverture personnalisée d'une ligne (route dédiée) à la place de la fiche générique.
  final void Function(BuildContext context, J row)? open;
  final String? emptyText;
  final int pageSize;

  /// Variante (onglet « à valider », chantier imposé…) : filtres fixes ajoutés, puces éventuellement retirées.
  ResourceConfig copyWith({
    String? title,
    Map<String, dynamic>? query,
    List<ResourceFilter>? filters,
    String? emptyText,
    ResourceCreate? create,
    bool keepCreate = true,
  }) => ResourceConfig(
    title: title ?? this.title,
    subtitle: subtitle,
    path: path,
    query: {...this.query, ...?query},
    queryOf: queryOf,
    itemTitle: itemTitle,
    itemSubtitle: itemSubtitle,
    itemTrailing: itemTrailing,
    itemBadge: itemBadge,
    icon: icon,
    filters: filters ?? this.filters,
    search: search,
    create: create ?? (keepCreate ? this.create : null),
    update: update,
    actions: actions,
    detailPath: detailPath,
    detailFields: detailFields,
    detailExtra: detailExtra,
    open: open,
    emptyText: emptyText ?? this.emptyText,
    pageSize: pageSize,
  );
}

String? _defaultBadge(J row) => row.str('status');

/// Liste d'une ressource : recherche, filtres en puces, création, ouverture de la fiche.
class ResourceListScreen extends StatefulWidget {
  const ResourceListScreen({super.key, required this.config, this.header});
  final ResourceConfig config;
  final Widget? header;
  @override
  State<ResourceListScreen> createState() => _ResourceListScreenState();
}

class _ResourceListScreenState extends State<ResourceListScreen> {
  final _list = PagedListController();
  final Map<String, String?> _filters = {};
  String _q = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _create() async {
    final c = widget.config.create!;
    final res = await showSchemaForm(
      context,
      title: c.label,
      endpoint: c.endpoint,
      fields: c.fields,
      only: c.only,
      exclude: c.exclude,
      order: c.order,
      fixed: c.fixed?.call(context) ?? const {},
      initial: c.initial ?? const {},
      idempotent: c.idempotent,
      submitLabel: 'Créer',
    );
    if (res == null || !mounted) return;
    context.toast('Enregistré', success: true);
    unawaited(_list.reload());
    final row = J.of(res);
    if (row.has('id')) await openResource(context, widget.config, row);
    if (mounted) unawaited(_list.reload());
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.config;
    final user = context.watch<AuthController>().user;
    final canCreate = c.create != null && (c.create!.perms.isEmpty || (user?.canAll(c.create!.perms) ?? false));
    return Scaffold(
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(heroTag: 'create-${c.path}', onPressed: _create, icon: const Icon(Icons.add), label: Text(c.create!.label))
          : null,
      body: Column(
        children: [
          if (c.search || c.filters.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Column(
                children: [
                  if (c.search)
                    TextField(
                      decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher', isDense: true),
                      onChanged: (v) {
                        _debounce?.cancel();
                        _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _q = v.trim()));
                      },
                    ),
                  for (final f in c.filters)
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(right: 6, top: 6),
                            child: ChoiceChip(
                              label: Text('${f.label} : tous'),
                              selected: _filters[f.key] == null,
                              onSelected: (_) => setState(() => _filters.remove(f.key)),
                            ),
                          ),
                          for (final o in f.options)
                            Padding(
                              padding: const EdgeInsets.only(right: 6, top: 6),
                              child: ChoiceChip(
                                label: Text(o.$2),
                                selected: _filters[f.key] == o.$1,
                                onSelected: (_) => setState(() => _filters[f.key] = o.$1),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          Expanded(
            child: PagedListView(
              path: c.path,
              controller: _list,
              pageSize: c.pageSize,
              query: {...c.query, ...?c.queryOf?.call(context), ..._filters, if (_q.isNotEmpty) 'q': _q},
              refreshOn: const ['notification'],
              header: widget.header,
              padding: const EdgeInsets.only(bottom: 96),
              empty: EmptyView(icon: c.icon, title: c.emptyText ?? 'Aucun élément'),
              itemBuilder: (context, row, _) {
                final badge = (c.itemBadge ?? _defaultBadge)(row);
                final trailing = c.itemTrailing?.call(row);
                final sub = c.itemSubtitle?.call(row);
                return ListTile(
                  leading: Icon(c.icon, color: GlobusColors.primary),
                  title: Text(c.itemTitle(row), maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: sub == null || sub.isEmpty ? null : Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: badge == null && trailing == null
                      ? const Icon(Icons.chevron_right)
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (badge != null) StatusBadge(badge),
                            if (trailing != null) Text(trailing, style: const TextStyle(fontWeight: FontWeight.w600)),
                          ],
                        ),
                  onTap: () async {
                    await openResource(context, c, row);
                    unawaited(_list.reload());
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Ouvre la fiche d'une ligne (écran dédié si configuré).
Future<void> openResource(BuildContext context, ResourceConfig config, J row) async {
  if (config.open != null) {
    config.open!(context, row);
    return;
  }
  await Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      builder: (_) => ResourceDetailScreen(config: config, row: row),
    ),
  );
}

const _hiddenKeys = {'id', 'version', 'deleted_at', 'portal_token_hash', 'qr_token', 'badge_token', 'password_hash', 'settings', 'metadata', 'extra'};

bool _readable(String key, Object? v) {
  if (_hiddenKeys.contains(key)) return false;
  if (key.endsWith('_id') || key.endsWith('_ids') || key.endsWith('_hash') || key.endsWith('_token')) return false;
  if (v is Map) return J.of(v).has('name') || J.of(v).has('title') || J.of(v).has('legal_name') || J.of(v).has('full_name');
  if (v is List) return v.every((x) => x is! Map) || v.isEmpty;
  return true;
}

/// Fiche générique : en-tête, champs lisibles (jamais d'identifiant technique), actions autorisées.
class ResourceDetailScreen extends StatefulWidget {
  const ResourceDetailScreen({super.key, required this.config, required this.row});
  final ResourceConfig config;
  final J row;
  @override
  State<ResourceDetailScreen> createState() => _ResourceDetailScreenState();
}

class _ResourceDetailScreenState extends State<ResourceDetailScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.config.itemTitle(widget.row), overflow: TextOverflow.ellipsis)),
      body: ResourceDetailBody(config: widget.config, row: widget.row),
    );
  }
}

/// Contenu de la fiche (sans barre) : utilisable comme page du routeur (lien de notification `…/{id}`).
class ResourceDetailBody extends StatefulWidget {
  const ResourceDetailBody({super.key, required this.config, required this.row});
  final ResourceConfig config;
  final J row;
  @override
  State<ResourceDetailBody> createState() => _ResourceDetailBodyState();
}

class _ResourceDetailBodyState extends State<ResourceDetailBody> {
  @override
  Widget build(BuildContext context) {
    final c = widget.config;
    final path = c.detailPath?.call(widget.row);
    if (path == null) return _Detail(config: c, row: widget.row, reload: () async => setState(() {}));
    return ApiView(
      path: path,
      builder: (context, data, handle) => _Detail(config: c, row: J.of(data), reload: handle.reload),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.config, required this.row, required this.reload});
  final ResourceConfig config;
  final J row;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final c = config;
    final user = context.watch<AuthController>().user;
    final actions = c.actions.where((a) => a.visibleFor(user, row)).toList();
    final badge = (c.itemBadge ?? _defaultBadge)(row);
    final fields =
        c.detailFields ??
        [
          for (final e in row.raw.entries)
            if (_readable(e.key, e.value) && e.value != null && e.value != '' && !(e.value is List && (e.value as List).isEmpty)) DetailField(e.key),
        ];
    final canUpdate = c.update != null && (c.update!.perms.isEmpty || (user?.canAll(c.update!.perms) ?? false));
    return PageList(
      children: [
        PageHeader(title: c.itemTitle(row), subtitle: c.itemSubtitle?.call(row), trailing: badge == null ? null : StatusBadge(badge)),
        if (actions.isNotEmpty || canUpdate)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (canUpdate)
                OutlinedButton.icon(
                  onPressed: () async {
                    final u = c.update!;
                    final res = await showSchemaForm(
                      context,
                      title: 'Modifier',
                      endpoint: u.endpoint,
                      params: {_param(u.endpoint): row.s('id')},
                      initial: row.raw,
                      fields: u.fields,
                      only: u.only,
                      exclude: u.exclude,
                      order: u.order,
                      partial: true,
                    );
                    if (res != null && context.mounted) {
                      context.toast('Modifications enregistrées', success: true);
                      await reload();
                    }
                  },
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Modifier'),
                ),
              for (final a in actions)
                if (a.danger)
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(foregroundColor: GlobusColors.danger),
                    onPressed: () => runResourceAction(context, a, row, reload),
                    icon: Icon(a.icon ?? Icons.block),
                    label: Text(a.label),
                  )
                else
                  FilledButton.tonalIcon(
                    onPressed: () => runResourceAction(context, a, row, reload),
                    icon: Icon(a.icon ?? Icons.check_circle_outline),
                    label: Text(a.label),
                  ),
            ],
          ),
        SectionCard(
          child: Column(
            children: [
              for (final f in fields) InfoRow(f.label ?? fieldLabel(f.key), f.format?.call(row) ?? displayValue(f.key, row[f.key])),
            ],
          ),
        ),
        ?c.detailExtra?.call(context, row, reload),
      ],
    );
  }
}

String _param(String endpoint) => RegExp(r'\{(\w+)\}').firstMatch(endpoint)?.group(1) ?? 'id';

/// Exécute une action (formulaire, confirmation, motif, code OTP) puis recharge la fiche.
Future<void> runResourceAction(BuildContext context, ResourceAction a, J row, Future<void> Function() reload) async {
  if (a.run != null) {
    await a.run!(context, row);
    await reload();
    return;
  }
  Object? result;
  if (a.endpoint != null) {
    result = await showSchemaForm(
      context,
      title: a.label,
      endpoint: a.endpoint,
      params: {_param(a.endpoint!): row.s('id')},
      initial: a.initial?.call(row) ?? const {},
      fixed: a.fixed?.call(row) ?? const {},
      fields: a.fields,
      only: a.only,
      exclude: a.exclude,
      idempotent: a.idempotent,
      submitLabel: a.label,
      danger: a.danger,
      intro: a.confirm,
    );
  } else if (a.path != null) {
    String? reason;
    if (a.reasonLabel != null) {
      reason = await promptText(
        context,
        title: a.label,
        message: a.confirm,
        label: a.reasonLabel!,
        required: a.reasonRequired,
        danger: a.danger,
        confirm: a.label,
      );
      if (reason == null) return;
    } else if (!await confirmDialog(context, title: a.label, message: a.confirm ?? 'Confirmer cette action ?', confirm: a.label, danger: a.danger)) {
      return;
    }
    if (!context.mounted) return;
    result = await runAction<bool>(context, () async {
      await context.api.request(
        a.method,
        a.path!(row),
        body: a.body?.call(row, reason) ?? (reason == null ? null : {'reason': reason}),
        idempotent: a.idempotent ? true : null,
      );
      return true;
    });
  }
  if (result != null && context.mounted) {
    context.toast(a.success ?? 'Action enregistrée', success: true);
    await reload();
  }
}

/// Tableau clé / valeur à partir d'une liste d'objets (lignes d'une commande, d'une situation…).
class LinesTable extends StatelessWidget {
  const LinesTable({super.key, required this.title, required this.rows, required this.label, this.value, this.subtitle});
  final String title;
  final List<J> rows;
  final String Function(J row) label;
  final String Function(J row)? value;
  final String Function(J row)? subtitle;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return SectionCard(
      title: title,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (final r in rows)
            ListTile(
              dense: true,
              title: Text(label(r)),
              subtitle: subtitle == null ? null : Text(subtitle!(r)),
              trailing: value == null ? null : Text(value!(r), style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}

/// Montant + date courts pour une ligne de liste.
String moneyDate(Object? amount, Object? when) => [if (amount != null) money(amount), if (when != null) date(when)].join(' · ');
