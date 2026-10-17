import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import '../field_state.dart';
import 'scanner.dart';

double? _qty(String text) => double.tryParse(text.replaceAll(',', '.').replaceAll(' ', '').trim());

/// Magasin du chantier : matériaux affectés (sortie, consommation, retour), niveaux de stock (scan d'un
/// article, sortie vers le chantier même hors ligne) et inventaires tournants.
class StockScreen extends StatelessWidget {
  const StockScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => DefaultTabController(
        length: 3,
        child: Column(
          children: [
            const TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [
                Tab(text: 'Affecté au chantier'),
                Tab(text: 'Stock'),
                Tab(text: 'Inventaires'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _Allocations(project: project),
                  _Levels(project: project),
                  const _Counts(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ affectations
class _Allocations extends StatefulWidget {
  const _Allocations({required this.project});
  final J project;
  @override
  State<_Allocations> createState() => _AllocationsState();
}

class _AllocationsState extends State<_Allocations> {
  final _list = PagedListController();
  String? _status = 'reserved';

  Future<void> _act(J a, String action) async {
    final unit = a.s('unit');
    final remaining = toDouble(a['quantity']) - toDouble(a['quantity_issued']);
    double? quantity;
    String? reason;
    if (action != 'consume') {
      final text = await promptText(
        context,
        title: action == 'issue' ? 'Sortie du magasin' : 'Retour au magasin',
        message: action == 'issue' ? 'Reste à sortir : ${number(remaining, 2)} $unit' : 'Sorti : ${number(a['quantity_issued'], 2)} $unit',
        label: 'Quantité ($unit)',
        initial: action == 'issue' ? number(remaining, 2).replaceAll(nbsp, '') : null,
        required: true,
      );
      if (text == null) return;
      quantity = _qty(text);
      if (quantity == null || quantity <= 0) {
        if (mounted) context.toast('Quantité invalide', error: true);
        return;
      }
      if (action == 'return' && mounted) reason = await promptText(context, title: 'Motif du retour', label: 'Motif');
    } else if (!await confirmDialog(context, title: 'Déclarer consommé ?', message: '${a.s('item')} : la totalité sortie est imputée au chantier.')) {
      return;
    }
    if (!mounted) return;
    final ok = await runAction(
      context,
      () => context.api.post(
        '/stock-allocations/${a.s('id')}/$action',
        body: {
          'quantity': ?quantity,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
          'client_mutation_id': newKey(),
        },
      ),
      success: switch (action) {
        'issue' => 'Sortie enregistrée',
        'return' => 'Retour enregistré',
        _ => 'Consommation déclarée',
      },
    );
    if (ok != null) unawaited(_list.reload());
  }

  @override
  Widget build(BuildContext context) {
    final canWrite = context.can('inventory:write');
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: [
              for (final s in const [('reserved', 'À sortir'), ('issued', 'Sortis'), ('consumed', 'Consommés'), (null, 'Tous')])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(label: Text(s.$2), selected: _status == s.$1, onSelected: (_) => setState(() => _status = s.$1)),
                ),
            ],
          ),
        ),
        Expanded(
          child: PagedListView(
            path: '/stock-allocations',
            controller: _list,
            query: {'project_id': widget.project.s('id'), 'status': _status},
            empty: const EmptyView(
              icon: Icons.inventory_2_outlined,
              title: 'Aucun matériau affecté',
              text: 'Les réservations du magasin pour ce chantier apparaissent ici.',
            ),
            itemBuilder: (context, a, _) {
              final status = a.s('status');
              return ListTile(
                title: Text(a.s('item')),
                subtitle: Text(
                  [
                    'réservé ${number(a['quantity'], 2)} ${a.s('unit')}',
                    if (toDouble(a['quantity_issued']) > 0) 'sorti ${number(a['quantity_issued'], 2)}',
                    if (toDouble(a['quantity_returned']) > 0) 'retourné ${number(a['quantity_returned'], 2)}',
                  ].join(' · '),
                ),
                trailing: canWrite && (status == 'reserved' || status == 'issued')
                    ? PopupMenuButton<String>(
                        onSelected: (v) => _act(a, v),
                        itemBuilder: (_) => [
                          if (status == 'reserved') const PopupMenuItem(value: 'issue', child: Text('Sortir du magasin')),
                          if (status == 'issued') const PopupMenuItem(value: 'consume', child: Text('Déclarer consommé')),
                          if (status == 'issued') const PopupMenuItem(value: 'return', child: Text('Retourner au magasin')),
                        ],
                        child: StatusBadge(status),
                      )
                    : StatusBadge(status),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ------------------------------------------------------------------------------------------------ niveaux
class _Levels extends StatefulWidget {
  const _Levels({required this.project});
  final J project;
  @override
  State<_Levels> createState() => _LevelsState();
}

class _LevelsState extends State<_Levels> {
  String _q = '';
  bool _low = false;

  Future<void> _scan() async {
    final code = await scanCode(context, title: 'Code de l\'article');
    if (code == null || !mounted) return;
    try {
      final res = J.of(await context.api.get('/inventory/lookup', query: {'code': code}));
      if (mounted) await StockItemSheet.open(context, res, widget.project);
    } catch (e) {
      if (mounted) context.toastError(e);
    }
  }

  Future<void> _open(J row) async {
    try {
      final res = J.of(await context.api.get('/stock-items/${row.s('id')}/levels'));
      if (mounted) await StockItemSheet.open(context, res, widget.project);
    } catch (e) {
      if (mounted) context.toastError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Article ou référence', isDense: true),
                  onChanged: (v) => setState(() => _q = v.trim().toLowerCase()),
                ),
              ),
              IconButton.filledTonal(tooltip: 'Scanner un article', onPressed: _scan, icon: const Icon(Icons.qr_code_scanner)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            title: const Text('Sous le seuil d\'alerte uniquement'),
            value: _low,
            onChanged: (v) => setState(() => _low = v),
          ),
        ),
        Expanded(
          child: ApiView(
            path: '/inventory/overview',
            query: {'below_threshold': _low},
            builder: (context, data, _) {
              final rows = listOf(data).where((r) => _q.isEmpty || '${r.s('sku')} ${r.s('name')}'.toLowerCase().contains(_q)).toList();
              if (rows.isEmpty) return const EmptyView(icon: Icons.warehouse_outlined, title: 'Aucun article');
              return ListView.separated(
                itemCount: rows.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final r = rows[i];
                  return ListTile(
                    onTap: () => _open(r),
                    leading: Icon(Icons.category_outlined, color: r.b('below_threshold') ? GlobusColors.danger : GlobusColors.primary),
                    title: Text(r.s('name')),
                    subtitle: Text('${r.s('sku')}${r.has('category') ? ' · ${r.s('category')}' : ''}'),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('${number(r['available'], 2)} ${r.s('unit')}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        if (r.b('below_threshold')) const Text('sous le seuil', style: TextStyle(color: GlobusColors.danger, fontSize: 12)),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Fiche d'un article (scan ou liste) : disponible par entrepôt / emplacement / lot, sortie vers le chantier
/// enregistrée hors ligne si besoin (mutation `stock_issue`, rejouable sans doublon).
class StockItemSheet extends StatelessWidget {
  const StockItemSheet({super.key, required this.data, required this.project});
  final J data;
  final J project;

  static Future<void> open(BuildContext context, J data, J project) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: 0.85,
      child: StockItemSheet(data: data, project: project),
    ),
  );

  Future<void> _issue(BuildContext context, J level) async {
    final item = data.obj('item');
    final text = await promptText(
      context,
      title: 'Sortie vers ${project.s('code')}',
      message: '${item.s('name')} · disponible ${number(level['quantity'], 2)} ${item.s('unit')} (${level.s('warehouse')})',
      label: 'Quantité (${item.s('unit')})',
      required: true,
    );
    if (text == null || !context.mounted) return;
    final quantity = _qty(text);
    if (quantity == null || quantity <= 0 || quantity > toDouble(level['quantity'])) {
      context.toast('Quantité invalide (maximum ${number(level['quantity'], 2)})', error: true);
      return;
    }
    final reason = await promptText(context, title: 'Usage', label: 'Ouvrage / tâche concernée');
    if (!context.mounted) return;
    final queue = context.read<OfflineQueue>();
    await queue.enqueueMutation(
      label: 'Sortie de stock : ${item.s('name')} (${number(quantity, 2)} ${item.s('unit')})',
      entity: 'stock_issue',
      operation: 'action',
      payload: {
        'project_id': project.s('id'),
        'item_id': item.s('id'),
        'warehouse_id': level.s('warehouse_id'),
        'quantity': quantity,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
    final report = await queue.sync();
    if (!context.mounted) return;
    Navigator.pop(context);
    context.toast(report.offline ? 'Sortie enregistrée sur le téléphone : envoi au retour du réseau.' : 'Sortie enregistrée', success: !report.offline);
  }

  @override
  Widget build(BuildContext context) {
    final item = data.obj('item');
    final canWrite = context.can('inventory:write');
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(item.s('name'), style: Theme.of(context).textTheme.titleLarge),
          Text('${item.s('sku')} · ${item.s('unit')}', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          StatGrid(
            children: [
              StatTile(label: 'En stock', value: '${number(data['on_hand'], 2)} ${item.s('unit')}', icon: Icons.inventory_2_outlined),
              StatTile(label: 'Disponible', value: '${number(data['available'], 2)} ${item.s('unit')}', icon: Icons.check_circle_outline, tone: Tone.success),
            ],
          ),
          const SizedBox(height: 12),
          const GroupTitle('Par entrepôt'),
          if (data.list('levels').isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('Aucun stock.')),
          for (final l in data.list('levels'))
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l.s('warehouse')),
              subtitle: Text(
                [
                  if (l.has('location')) 'emplacement ${l.s('location')}',
                  if (l.has('batch')) 'lot ${l.s('batch')}',
                  if (l.has('expiry_date')) 'péremption ${date(l['expiry_date'])}',
                  if (toDouble(l['reserved']) > 0) 'réservé ${number(l['reserved'], 2)}',
                ].join(' · '),
              ),
              trailing: canWrite && toDouble(l['quantity']) > 0
                  ? FilledButton.tonal(onPressed: () => _issue(context, l), child: Text('Sortir (${number(l['quantity'], 2)})'))
                  : Text(number(l['quantity'], 2)),
            ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ inventaires
class _Counts extends StatelessWidget {
  const _Counts();

  @override
  Widget build(BuildContext context) {
    return PagedListView(
      path: '/inventory-counts',
      query: const {'status': 'in_progress'},
      empty: const EmptyView(
        icon: Icons.fact_check_outlined,
        title: 'Aucun inventaire en cours',
        text: 'Le magasinier ouvre l\'inventaire d\'un entrepôt : le comptage se fait ici, article par article.',
      ),
      itemBuilder: (context, c, _) => ListTile(
        leading: const Icon(Icons.fact_check_outlined, color: GlobusColors.primary),
        title: Text(c.str('number') ?? 'Inventaire du ${date(c['created_at'])}'),
        subtitle: Text('${c.i('lines_count')} article(s) · ouvert le ${date(c['created_at'])}'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(builder: (_) => CountScreen(id: c.s('id')))),
      ),
    );
  }
}

/// Comptage d'un inventaire : quantité comptée par article (scan ou liste), écart affiché, enregistrement
/// par lot. La validation reste au bureau (séparation des tâches : compteur ≠ valideur).
class CountScreen extends StatefulWidget {
  const CountScreen({super.key, required this.id});
  final String id;
  @override
  State<CountScreen> createState() => _CountScreenState();
}

class _CountScreenState extends State<CountScreen> {
  J? _count;
  Object? _error;
  final Map<String, TextEditingController> _inputs = {};
  bool _busy = false;
  String _q = '';

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    for (final c in _inputs.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final c = J.of(await context.api.get('/inventory-counts/${widget.id}'));
      if (!mounted) return;
      setState(() {
        _count = c;
        _error = null;
        for (final l in c.list('lines')) {
          _inputs.putIfAbsent(l.s('item_id'), () => TextEditingController(text: l.has('counted') ? number(l['counted'], 3).replaceAll(nbsp, '') : ''));
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _save() async {
    final lines = <Map<String, dynamic>>[];
    for (final e in _inputs.entries) {
      if (e.value.text.trim().isEmpty) continue;
      final v = _qty(e.value.text);
      if (v == null || v < 0) {
        context.toast('Quantité invalide', error: true);
        return;
      }
      lines.add({'item_id': e.key, 'counted': v});
    }
    if (lines.isEmpty) return;
    setState(() => _busy = true);
    final res = await runAction(context, () => context.api.put('/inventory-counts/${widget.id}/lines', body: {'lines': lines}), success: 'Comptage enregistré');
    if (!mounted) return;
    setState(() => _busy = false);
    if (res != null) await _load();
  }

  Future<void> _scan() async {
    final code = await scanCode(context, title: 'Article compté');
    if (code == null || !mounted) return;
    try {
      final res = J.of(await context.api.get('/inventory/lookup', query: {'code': code}));
      final item = res.obj('item');
      if (!mounted) return;
      final text = await promptText(context, title: item.s('name'), label: 'Quantité comptée (${item.s('unit')})', required: true);
      if (text == null || !mounted) return;
      final v = _qty(text);
      if (v == null || v < 0) {
        context.toast('Quantité invalide', error: true);
        return;
      }
      setState(() => _inputs.putIfAbsent(item.s('id'), TextEditingController.new).text = text);
      await _save();
    } catch (e) {
      if (mounted) context.toastError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _count;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Comptage'),
        actions: [IconButton(tooltip: 'Scanner un article', onPressed: _scan, icon: const Icon(Icons.qr_code_scanner))],
      ),
      floatingActionButton: c == null
          ? null
          : FloatingActionButton.extended(onPressed: _busy ? null : _save, icon: const Icon(Icons.save_outlined), label: const Text('Enregistrer')),
      body: _error != null
          ? ErrorView(error: _error, onRetry: _load)
          : c == null
          ? const LoadingView()
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Filtrer les articles', isDense: true),
                    onChanged: (v) => setState(() => _q = v.trim().toLowerCase()),
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 96),
                    children: [
                      for (final l in c.list('lines'))
                        if (_q.isEmpty || '${l.s('sku')} ${l.s('item')}'.toLowerCase().contains(_q))
                          ListTile(
                            title: Text(l.s('item')),
                            subtitle: Text(
                              [
                                l.s('sku'),
                                'attendu ${number(l['expected'], 2)} ${l.s('unit')}',
                                if (l.has('variance')) 'écart ${toDouble(l['variance']) > 0 ? '+' : ''}${number(l['variance'], 2)}',
                              ].join(' · '),
                            ),
                            trailing: SizedBox(
                              width: 96,
                              child: TextField(
                                controller: _inputs[l.s('item_id')],
                                textAlign: TextAlign.end,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: InputDecoration(isDense: true, hintText: 'Compté', suffixText: l.s('unit')),
                              ),
                            ),
                          ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
