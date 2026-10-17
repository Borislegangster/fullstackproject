import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import '../app.dart';
import '../field_state.dart';
import 'scanner.dart';

const _rejectionReasons = [
  ('damaged', 'Endommagé'),
  ('different', 'Non conforme à la commande'),
  ('missing', 'Manquant'),
  ('excess', 'Excédent'),
  ('quality', 'Qualité insuffisante'),
];

const _returnReasons = [
  ('damaged', 'Endommagé'),
  ('different', 'Non conforme à la commande'),
  ('excess', 'Excédent'),
  ('quality', 'Qualité insuffisante'),
  ('other', 'Autre motif'),
];

/// Livraisons du chantier : commandes attendues (réception en un geste) et bons de réception établis.
class DeliveriesScreen extends StatelessWidget {
  const DeliveriesScreen({super.key});

  Future<void> _receive(BuildContext context) async {
    final code = await scanCode(context, title: 'QR du bon de commande');
    if (code != null && context.mounted) await context.push('$base/livraisons/receptions/nouvelle', extra: code);
  }

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => DefaultTabController(
        length: 2,
        child: Scaffold(
          floatingActionButton: context.can('deliveries:receive')
              ? FloatingActionButton.extended(
                  heroTag: 'grn-new',
                  onPressed: () => _receive(context),
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Réceptionner'),
                )
              : null,
          body: Column(
            children: [
              const TabBar(
                tabs: [
                  Tab(text: 'Attendues'),
                  Tab(text: 'Réceptions'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _Expected(projectId: project.s('id')),
                    PagedListView(
                      path: '/goods-receipts',
                      query: {'project_id': project.s('id')},
                      padding: const EdgeInsets.only(bottom: 96),
                      empty: const EmptyView(
                        icon: Icons.inventory_outlined,
                        title: 'Aucune réception',
                        text: 'Les bons de réception établis sur ce chantier apparaissent ici.',
                      ),
                      itemBuilder: (context, r, _) => ListTile(
                        onTap: () => context.push('$base/livraisons/receptions/${r.s('id')}'),
                        leading: Icon(
                          r.b('has_exceptions') ? Icons.report_problem_outlined : Icons.inventory_2_outlined,
                          color: r.b('has_exceptions') ? GlobusColors.warning : GlobusColors.primary,
                        ),
                        title: Text('${r.s('number')}${r.has('po_number') ? ' · ${r.s('po_number')}' : ''}'),
                        subtitle: Text([if (r.has('supplier')) r.s('supplier'), dateTime(r['received_at'])].join(' · ')),
                        trailing: StatusBadge(r.s('status')),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Expected extends StatelessWidget {
  const _Expected({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/deliveries/expected',
      query: {'project_id': projectId, 'days': 30},
      refreshOn: const ['notification'],
      builder: (context, data, _) {
        final list = listOf(data);
        if (list.isEmpty) {
          return const EmptyView(
            icon: Icons.local_shipping_outlined,
            title: 'Aucune livraison attendue',
            text: 'Les commandes confirmées ou expédiées vers ce chantier (30 prochains jours) apparaissent ici.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.only(bottom: 96),
          itemCount: list.length,
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, i) {
            final po = list[i];
            final lines = po.list('lines');
            return ListTile(
              onTap: context.can('deliveries:receive') ? () => context.push('$base/livraisons/receptions/nouvelle', extra: po.s('number')) : null,
              leading: Icon(Icons.local_shipping_outlined, color: po.b('late') ? GlobusColors.danger : GlobusColors.primary),
              title: Text('${po.s('number')} · ${po.s('supplier')}'),
              subtitle: Text(
                [
                  if (po.has('eta')) 'arrivée prévue ${dateTime(po['eta'])}' else if (po.has('expected_date')) 'attendue le ${date(po['expected_date'])}',
                  '${lines.length} ligne(s)',
                  if (po.has('carrier')) po.s('carrier'),
                ].join(' · '),
              ),
              trailing: Wrap(
                spacing: 4,
                children: [
                  if (po.b('urgent')) const ToneBadge('Urgent', tone: Tone.danger),
                  if (po.b('late')) const ToneBadge('En retard', tone: Tone.warning) else StatusBadge(po.s('status')),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _LineInput {
  _LineInput(this.line) : received = TextEditingController(text: _qty(line['remaining'])), rejected = TextEditingController(text: '0');
  final J line;
  final TextEditingController received;
  final TextEditingController rejected;
  final notes = TextEditingController();
  final batch = TextEditingController();
  String? reason;

  static String _qty(Object? v) {
    final n = toDouble(v);
    return n == n.roundToDouble() ? n.toInt().toString() : n.toString();
  }

  double get receivedValue => double.tryParse(received.text.replaceAll(',', '.').trim()) ?? -1;
  double get rejectedValue => double.tryParse(rejected.text.replaceAll(',', '.').trim()) ?? -1;

  void dispose() {
    received.dispose();
    rejected.dispose();
    notes.dispose();
    batch.dispose();
  }
}

/// Réception d'une livraison à partir du QR (ou du numéro) du bon de commande : quantités reçues / refusées
/// ligne à ligne avec motif, photos géolocalisées et bon de livraison, puis validation (entrée en stock ou
/// affectation directe au chantier). Envoi idempotent : un double appui ne crée jamais deux réceptions.
class ReceiptFormScreen extends StatefulWidget {
  const ReceiptFormScreen({super.key, required this.code});
  final String code;
  @override
  State<ReceiptFormScreen> createState() => _ReceiptFormScreenState();
}

class _ReceiptFormScreenState extends State<ReceiptFormScreen> {
  J? _po;
  Object? _error;
  List<_LineInput> _lines = const [];
  final _driver = TextEditingController();
  final _plate = TextEditingController();
  final _noteRef = TextEditingController();
  final _notes = TextEditingController();
  String _destination = 'stock';
  J? _warehouse;
  final List<UploadFile> _photos = [];
  UploadFile? _deliveryNote;
  bool _busy = false;
  String _step = '';
  final _idem = newKey();
  String? _createdId;

  @override
  void initState() {
    super.initState();
    unawaited(_lookup());
  }

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    _driver.dispose();
    _plate.dispose();
    _noteRef.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    setState(() => _error = null);
    try {
      final po = J.of(await context.api.get('/goods-receipts/lookup', query: {'code': widget.code}));
      if (!mounted) return;
      setState(() {
        _po = po;
        _lines = [for (final l in po.list('remaining')) _LineInput(l)];
        final delivery = po.list('deliveries').firstOrNull;
        if (delivery != null) {
          _driver.text = delivery.str('driver_name') ?? '';
          _plate.text = delivery.str('vehicle_plate') ?? '';
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  String? _problem() {
    if (!_lines.any((l) => l.receivedValue > 0 || l.rejectedValue > 0)) return 'Saisissez au moins une quantité reçue.';
    for (final l in _lines) {
      if (l.receivedValue < 0 || l.rejectedValue < 0) return 'Quantité invalide : « ${l.line.s('description')} ».';
      if (l.rejectedValue > l.receivedValue) return 'Quantité refusée supérieure à la quantité reçue : « ${l.line.s('description')} ».';
      if (l.rejectedValue > 0 && l.reason == null) return 'Motif du refus requis : « ${l.line.s('description')} ».';
    }
    if (_destination == 'stock' && _warehouse == null && _lines.any((l) => l.line.has('stock_item_id'))) return 'Choisissez l\'entrepôt de destination.';
    if (_photos.isEmpty && _deliveryNote == null) return 'Ajoutez au moins une photo de la livraison ou du bon de livraison.';
    return null;
  }

  Future<void> _submit({required bool validate}) async {
    final problem = _problem();
    if (problem != null) {
      context.toast(problem, error: true);
      return;
    }
    final po = _po!;
    setState(() {
      _busy = true;
      _step = 'Position du téléphone…';
    });
    try {
      final position = await currentPosition(context);
      if (!mounted) return;
      var id = _createdId;
      if (id == null) {
        setState(() => _step = 'Enregistrement de la réception…');
        final created = J.of(
          await context.api.post(
            '/goods-receipts',
            idempotent: _idem,
            body: {
              'purchase_order_id': po.s('id'),
              'destination': _destination,
              if (_warehouse != null) 'warehouse_id': _warehouse!.s('id'),
              'latitude': position?.latitude,
              'longitude': position?.longitude,
              'geo_accuracy_m': position?.accuracy,
              if (_driver.text.trim().isNotEmpty) 'driver_name': _driver.text.trim(),
              if (_plate.text.trim().isNotEmpty) 'vehicle_plate': _plate.text.trim(),
              if (_noteRef.text.trim().isNotEmpty) 'delivery_note_ref': _noteRef.text.trim(),
              if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
              if (po.list('deliveries').isNotEmpty) 'delivery_id': po.list('deliveries').first.s('id'),
              'source': widget.code.toUpperCase().startsWith('GLOBUS:PO:') ? 'qr' : 'mobile',
              'lines': [
                for (final l in _lines)
                  if (l.receivedValue > 0 || l.rejectedValue > 0)
                    {
                      'po_line_id': l.line.s('po_line_id'),
                      if (l.line.has('stock_item_id')) 'stock_item_id': l.line.s('stock_item_id'),
                      'quantity_received': l.receivedValue,
                      'quantity_rejected': l.rejectedValue,
                      if (l.reason != null) 'rejection_reason': l.reason,
                      if (l.notes.text.trim().isNotEmpty) 'condition_notes': l.notes.text.trim(),
                      if (l.batch.text.trim().isNotEmpty) 'batch_number': l.batch.text.trim(),
                    },
              ],
            },
          ),
        );
        id = created.s('id');
        _createdId = id;
      }
      final geo = {if (position != null) 'latitude': position.latitude, if (position != null) 'longitude': position.longitude};
      for (var i = 0; i < _photos.length; i++) {
        if (!mounted) return;
        setState(() => _step = 'Photo ${i + 1} / ${_photos.length}…');
        await context.api.upload('/goods-receipts/$id/attachments', files: [_photos[i]], fields: {'kind': 'photo', ...geo});
      }
      _photos.clear();
      if (_deliveryNote != null && mounted) {
        setState(() => _step = 'Bon de livraison…');
        await context.api.upload('/goods-receipts/$id/attachments', files: [_deliveryNote!], fields: {'kind': 'delivery_note', ...geo});
        _deliveryNote = null;
      }
      if (validate && mounted) {
        setState(() => _step = 'Validation…');
        await context.api.post('/goods-receipts/$id/validate');
      }
      if (!mounted) return;
      context.toast(validate ? 'Réception validée' : 'Réception enregistrée (brouillon)', success: true);
      context.pushReplacement('$base/livraisons/receptions/$id');
    } catch (e) {
      if (mounted) context.toastError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addPhotos() async {
    final files = await pickAttachments(context, imagesOnly: true);
    if (files.isNotEmpty) setState(() => _photos.addAll(files));
  }

  Future<void> _addNote() async {
    final files = await pickAttachments(context, multiple: false);
    if (files.isNotEmpty) setState(() => _deliveryNote = files.first);
  }

  @override
  Widget build(BuildContext context) {
    final po = _po;
    return Scaffold(
      body: _error != null
          ? ErrorView(error: _error, onRetry: _lookup)
          : po == null
          ? const LoadingView()
          : PageList(
              children: [
                SectionCard(
                  title: 'Bon de commande ${po.s('number')}',
                  icon: Icons.receipt_long_outlined,
                  child: Column(
                    children: [
                      InfoRow('Fournisseur', po.obj('supplier').str('legal_name')),
                      InfoRow('Chantier', po.objOrNull('project') == null ? null : '${po.obj('project').s('code')} — ${po.obj('project').s('name')}'),
                      InfoRow('Statut', statusLabel(po.s('status'))),
                    ],
                  ),
                ),
                if (po.list('deliveries').isNotEmpty)
                  AlertBox(tone: Tone.info, message: 'Livraison annoncée ${po.list('deliveries').first.s('number')} : la réception lui est rattachée.'),
                SectionCard(
                  title: 'Quantités livrées',
                  subtitle: 'Pré-remplies avec le reliquat à recevoir : corrigez si besoin.',
                  child: Column(
                    children: [for (final l in _lines) _LineCard(input: l, onChanged: () => setState(() {}))],
                  ),
                ),
                SectionCard(
                  title: 'Destination',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'stock', label: Text('Entrée en stock'), icon: Icon(Icons.warehouse_outlined)),
                          ButtonSegment(value: 'site_allocation', label: Text('Affecté au chantier'), icon: Icon(Icons.engineering_outlined)),
                        ],
                        selected: {_destination},
                        onSelectionChanged: (v) => setState(() => _destination = v.first),
                      ),
                      if (_destination == 'stock') ...[
                        const SizedBox(height: 12),
                        RefField(
                          label: 'Entrepôt',
                          source: Refs.warehouses,
                          value: _warehouse,
                          onChanged: (v) => setState(() => _warehouse = v),
                          required: true,
                        ),
                      ],
                    ],
                  ),
                ),
                SectionCard(
                  title: 'Transport',
                  child: Column(
                    children: [
                      TextField(
                        controller: _driver,
                        decoration: const InputDecoration(labelText: 'Chauffeur'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _plate,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(labelText: 'Immatriculation'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _noteRef,
                        decoration: const InputDecoration(labelText: 'N° du bon de livraison'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _notes,
                        maxLines: 3,
                        decoration: const InputDecoration(labelText: 'Observations'),
                      ),
                    ],
                  ),
                ),
                SectionCard(
                  title: 'Photos et bon de livraison',
                  subtitle: 'Au moins une photo ou le bon de livraison signé (géolocalisés).',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_photos.isNotEmpty)
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            for (final (i, f) in _photos.indexed)
                              InputChip(
                                label: Text(f.name, overflow: TextOverflow.ellipsis),
                                avatar: const Icon(Icons.photo_outlined),
                                onDeleted: () => setState(() => _photos.removeAt(i)),
                              ),
                          ],
                        ),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : _addPhotos,
                        icon: const Icon(Icons.add_a_photo_outlined),
                        label: const Text('Photos de la livraison'),
                      ),
                      const SizedBox(height: 8),
                      if (_deliveryNote != null)
                        InputChip(
                          label: Text(_deliveryNote!.name),
                          avatar: const Icon(Icons.description_outlined),
                          onDeleted: () => setState(() => _deliveryNote = null),
                        ),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : _addNote,
                        icon: const Icon(Icons.document_scanner_outlined),
                        label: const Text('Bon de livraison signé'),
                      ),
                    ],
                  ),
                ),
                if (_busy)
                  Row(
                    children: [
                      const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                      const SizedBox(width: 10),
                      Text(_step),
                    ],
                  ),
                BusyButton(label: 'Valider la réception', icon: Icons.verified_outlined, busy: _busy, expand: true, onPressed: () => _submit(validate: true)),
                OutlinedButton(onPressed: _busy ? null : () => _submit(validate: false), child: const Text('Enregistrer sans valider')),
              ],
            ),
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.input, required this.onChanged});
  final _LineInput input;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l = input.line;
    final unit = l.str('unit') ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.s('description'), style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(
            'Commandé ${number(l['ordered'], 2)} $unit · déjà reçu ${number(l['received'], 2)} · reste ${number(l['remaining'], 2)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: input.received,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Reçu', suffixText: unit, isDense: true),
                  onChanged: (_) => onChanged(),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: input.rejected,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Refusé', suffixText: unit, isDense: true),
                  onChanged: (_) => onChanged(),
                ),
              ),
            ],
          ),
          if (input.rejectedValue > 0) ...[
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: input.reason,
              decoration: const InputDecoration(labelText: 'Motif du refus', isDense: true),
              items: [for (final r in _rejectionReasons) DropdownMenuItem(value: r.$1, child: Text(r.$2))],
              onChanged: (v) {
                input.reason = v;
                onChanged();
              },
            ),
            const SizedBox(height: 6),
            TextField(
              controller: input.notes,
              decoration: const InputDecoration(labelText: 'État constaté', isDense: true),
            ),
          ],
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            dense: true,
            title: const Text('Lot / n° de série'),
            children: [
              TextField(
                controller: input.batch,
                decoration: const InputDecoration(labelText: 'N° de lot', isDense: true),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Écart de réception en français (types calculés par le serveur à l'enregistrement).
String _exceptionText(J e) {
  final line = e.str('line') ?? '';
  final reason = _rejectionReasons.where((r) => r.$1 == e.str('type')).firstOrNull?.$2;
  return switch (e.str('type')) {
    'partial_delivery' => 'Livraison partielle : $line (manque ${number(e['missing'], 2)})',
    'excess_delivery' => 'Excédent : $line (+${number(e['excess'], 2)})',
    'rejected' => 'Refus : $line (${number(e['quantity'], 2)})',
    _ when reason != null => 'Refus « ${reason.toLowerCase()} » : $line (${number(e['quantity'], 2)})',
    _ => [e.str('message') ?? optionLabel(e.str('type')), if (line.isNotEmpty) line].join(' : '),
  };
}

/// Bon de réception : lignes, écarts, pièces jointes ; compléments et validation tant qu'il est en brouillon,
/// retour fournisseur après validation en cas d'écart.
class ReceiptDetailScreen extends StatelessWidget {
  const ReceiptDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/goods-receipts/$id',
      builder: (context, data, handle) {
        final r = J.of(data);
        final draft = r.s('status') == 'draft';
        final canReceive = context.can('deliveries:receive');
        final files = [
          for (final f in r.strings('photo_file_ids')) GalleryItem(url: '/goods-receipts/$id/files/$f', caption: 'Photo de livraison'),
          if (r.has('delivery_note_file_id')) GalleryItem(url: '/goods-receipts/$id/files/${r.s('delivery_note_file_id')}', caption: 'Bon de livraison'),
        ];
        Future<void> attach(String kind) async {
          final picked = await pickAttachments(context, imagesOnly: kind == 'photo', multiple: kind == 'photo');
          if (picked.isEmpty || !context.mounted) return;
          final position = await currentPosition(context);
          if (!context.mounted) return;
          await runAction(context, () async {
            for (final f in picked) {
              await context.api.upload(
                '/goods-receipts/$id/attachments',
                files: [f],
                fields: {
                  'kind': kind,
                  if (position != null) 'latitude': position.latitude,
                  if (position != null) 'longitude': position.longitude,
                },
              );
            }
          }, success: 'Pièce jointe ajoutée');
          await handle.reload();
        }

        return PageList(
          children: [
            PageHeader(
              title: r.s('number'),
              subtitle: [if (r.has('po_number')) 'BC ${r.s('po_number')}', if (r.has('supplier')) r.s('supplier'), dateTime(r['received_at'])].join(' · '),
              trailing: StatusBadge(r.s('status')),
            ),
            if (r.b('has_exceptions'))
              AlertBox(
                tone: Tone.warning,
                title: 'Écarts constatés',
                message: r.list('exceptions').map((e) => '• ${_exceptionText(e)}').join('\n'),
              ),
            SectionCard(
              title: 'Lignes',
              child: Column(
                children: [
                  for (final l in r.list('lines'))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l.s('description')),
                      subtitle: Text(
                        [
                          'reçu ${number(l['quantity_received'], 2)} ${l.s('unit')}',
                          'accepté ${number(l['quantity_accepted'], 2)}',
                          if (toDouble(l['quantity_rejected']) > 0) 'refusé ${number(l['quantity_rejected'], 2)} (${optionLabel(l.str('rejection_reason'))})',
                          if (l.has('batch_number')) 'lot ${l.s('batch_number')}',
                        ].join(' · '),
                      ),
                      trailing: l.b('is_substitution')
                          ? ToneBadge('Substitution ${statusLabel(l.str('substitution_status') ?? 'pending').toLowerCase()}', tone: Tone.warning)
                          : null,
                    ),
                ],
              ),
            ),
            SectionCard(
              title: 'Transport',
              child: Column(
                children: [
                  InfoRow('Destination', r.s('destination') == 'stock' ? 'Entrée en stock' : 'Affecté au chantier'),
                  InfoRow('Chauffeur', r.str('driver_name')),
                  InfoRow('Immatriculation', r.str('vehicle_plate')),
                  InfoRow('Bon de livraison', r.str('delivery_note_ref')),
                  if (r.has('notes')) InfoRow('Observations', r.s('notes')),
                ],
              ),
            ),
            SectionCard(
              title: 'Pièces jointes',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (files.isEmpty) const Text('Aucune pièce jointe.'),
                  if (files.isNotEmpty)
                    SizedBox(
                      height: 96,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: files.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (context, i) => SizedBox(
                          width: 96,
                          child: MediaThumb(url: files[i].url, caption: files[i].caption, onTap: () => GalleryScreen.open(context, files, i)),
                        ),
                      ),
                    ),
                  if (draft && canReceive) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        OutlinedButton.icon(onPressed: () => attach('photo'), icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Photo')),
                        OutlinedButton.icon(
                          onPressed: () => attach('delivery_note'),
                          icon: const Icon(Icons.document_scanner_outlined),
                          label: const Text('Bon de livraison'),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (draft && canReceive)
              FilledButton.icon(
                onPressed: () async {
                  await runAction(context, () => context.api.post('/goods-receipts/$id/validate'), success: 'Réception validée');
                  await handle.reload();
                },
                icon: const Icon(Icons.verified_outlined),
                label: const Text('Valider la réception'),
              ),
            if (!draft && r.b('has_exceptions') && canReceive && r.has('supplier_id'))
              OutlinedButton.icon(
                onPressed: () async {
                  final reason = await pickOption<String>(context, title: 'Motif du retour', options: _returnReasons);
                  if (reason == null || !context.mounted) return;
                  await runAction(
                    context,
                    () => context.api.post('/goods-receipts/$id/returns', body: {'reason': reason}),
                    success: 'Retour fournisseur demandé',
                  );
                },
                icon: const Icon(Icons.assignment_return_outlined),
                label: const Text('Retour fournisseur'),
              ),
          ],
        );
      },
    );
  }
}

/// Livraison annoncée (lien des notifications) : arrivée sur site géolocalisée, lignes attendues, réceptions.
class DeliveryScreen extends StatelessWidget {
  const DeliveryScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/deliveries/$id',
      builder: (context, data, handle) {
        final d = J.of(data);
        final canReceive = context.can('deliveries:receive');
        return PageList(
          children: [
            PageHeader(
              eyebrow: d.s('number'),
              title: d.s('supplier', 'Livraison'),
              subtitle: [if (d.has('po_number')) 'BC ${d.s('po_number')}', if (d.has('eta')) 'arrivée prévue ${dateTime(d['eta'])}'].join(' · '),
              trailing: StatusBadge(d.s('status')),
            ),
            SectionCard(
              title: 'Lignes attendues',
              child: Column(
                children: [
                  for (final l in d.list('lines'))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(l.s('description')),
                      trailing: Text('${number(l['received'], 2)} / ${number(l['quantity'], 2)} ${l.s('unit')}'),
                    ),
                ],
              ),
            ),
            if (d.list('receipts').isNotEmpty)
              SectionCard(
                title: 'Réceptions',
                child: Column(
                  children: [
                    for (final r in d.list('receipts'))
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(r.s('number')),
                        subtitle: Text(dateTime(r['received_at'])),
                        trailing: StatusBadge(r.s('status')),
                        onTap: () => context.push('$base/livraisons/receptions/${r.s('id')}'),
                      ),
                  ],
                ),
              ),
            if (canReceive && const ['announced', 'in_transit'].contains(d.s('status')))
              OutlinedButton.icon(
                onPressed: () async {
                  final pos = await currentPosition(context);
                  if (!context.mounted) return;
                  await runAction(
                    context,
                    () => context.api.post('/deliveries/$id/arrived', body: {'latitude': pos?.latitude, 'longitude': pos?.longitude}),
                    success: 'Arrivée du camion enregistrée',
                  );
                  await handle.reload();
                },
                icon: const Icon(Icons.local_shipping_outlined),
                label: const Text('Camion arrivé sur site'),
              ),
            if (canReceive && d.has('po_number') && d.s('status') != 'received')
              FilledButton.icon(
                onPressed: () => context.push('$base/livraisons/receptions/nouvelle', extra: d.s('po_number')),
                icon: const Icon(Icons.inventory_outlined),
                label: const Text('Réceptionner'),
              ),
          ],
        );
      },
    );
  }
}
