import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../api/json.dart';
import '../../context.dart';
import '../../files/files.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/primitives.dart';
import '../../widgets/ref_picker.dart';
import '../../widgets/states.dart';
import '../agenda/agenda.dart' show pickDateTime;

/// Fiche SAV (§18.1) : échanges, pièces (photo, document, avant / après), diagnostic, garantie, interventions,
/// validation et satisfaction du client, réouverture. [staff] : actions du technicien / responsable SAV.
/// Miroir de components/support/ticket-detail.tsx.
class TicketDetailScreen extends StatefulWidget {
  const TicketDetailScreen({super.key, required this.ticketId, this.staff = false});
  final String ticketId;
  final bool staff;

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  J? _t;
  Object? _error;
  final _message = TextEditingController();
  bool _internal = false;
  String? _busy;

  ApiClient get _api => context.api;
  String get _id => widget.ticketId;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await _api.fetch('/support/tickets/$_id');
      if (mounted) {
        setState(() {
          _t = J.of(res.data);
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<bool> _post(String key, Future<dynamic> Function() fn, {String? success}) async {
    setState(() => _busy = key);
    try {
      final res = await fn();
      if (res is Map && res.containsKey('number')) {
        setState(() => _t = J.of(res));
      } else {
        await _load();
      }
      if (success != null && mounted) context.toast(success, success: true);
      return true;
    } catch (e) {
      if (mounted) context.toastError(e);
      return false;
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _upload() async {
    final kind = await pickOption<String>(
      context,
      title: 'Type de pièce',
      options: [
        for (final k in const ['photo', 'document', 'before', 'after']) (k, optionLabel(k)),
      ],
    );
    if (kind == null || !mounted) return;
    final files = await pickAttachments(context);
    if (files.isEmpty) return;
    await _post('upload', () async {
      for (final f in files) {
        await _api.upload('/support/tickets/$_id/attachments', files: [f], fields: {'kind': kind});
      }
      return null;
    }, success: 'Fichiers envoyés');
  }

  Future<void> _validate() async {
    var rating = 5;
    final comment = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: const Text("Valider l'intervention"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Votre satisfaction'),
              Row(
                children: [
                  for (var n = 1; n <= 5; n++)
                    IconButton(
                      tooltip: '$n étoile(s)',
                      onPressed: () => set(() => rating = n),
                      icon: Icon(n <= rating ? Icons.star : Icons.star_border, color: GlobusColors.accent, size: 32),
                    ),
                ],
              ),
              TextField(
                controller: comment,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Commentaire (facultatif)'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Valider')),
          ],
        ),
      ),
    );
    final text = comment.text.trim();
    comment.dispose();
    if (ok != true || !mounted) return;
    await _post(
      'validate',
      () => _api.post('/support/tickets/$_id/validate', body: {'rating': rating, 'comment': text.isEmpty ? null : text}),
      success: 'Merci pour votre retour',
    );
  }

  Future<void> _reopen() async {
    final reason = await promptText(
      context,
      title: 'Rouvrir le ticket',
      label: 'Pourquoi le problème persiste-t-il ?',
      required: true,
      minLength: 5,
      confirm: 'Rouvrir',
    );
    if (reason == null || !mounted) return;
    await _post('reopen', () => _api.post('/support/tickets/$_id/reopen', body: {'reason': reason}), success: 'Ticket rouvert');
  }

  // ------------------------------------------------------------------ actions SAV (équipe)
  Future<void> _assign() async {
    final u = await pickRef(context, Refs.users, title: 'Technicien / responsable');
    if (u == null || !mounted) return;
    await _post('assign', () => _api.post('/support/tickets/$_id/assign', body: {'assignee_id': u.s('id')}), success: 'Ticket affecté');
  }

  Future<void> _diagnosis() async {
    final text = await promptText(
      context,
      title: 'Diagnostic',
      label: 'Diagnostic',
      initial: _t?.str('diagnosis'),
      required: true,
      minLength: 5,
      maxLines: 8,
      confirm: 'Enregistrer',
    );
    if (text == null || !mounted) return;
    await _post('diag', () => _api.post('/support/tickets/$_id/diagnosis', body: {'diagnosis': text}), success: 'Diagnostic enregistré');
  }

  Future<void> _warranty() async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(context: context, isScrollControlled: true, builder: (_) => const _WarrantySheet());
    if (result == null || !mounted) return;
    await _post('warranty', () => _api.post('/support/tickets/$_id/warranty', body: result), success: 'Décision de garantie enregistrée');
  }

  Future<void> _schedule() async {
    final when = await pickDateTime(context, DateTime.now().add(const Duration(days: 1)));
    if (when == null || !mounted) return;
    final tech = await pickRef(context, Refs.users, title: 'Technicien (facultatif)');
    if (!mounted) return;
    await _post(
      'schedule',
      () => _api.post('/support/tickets/$_id/interventions', body: {'scheduled_at': when.toUtc().toIso8601String(), 'technician_id': tech?.s('id')}),
      success: 'Intervention planifiée',
    );
  }

  Future<void> _finish(String interventionId) async {
    final body = await Navigator.of(context, rootNavigator: true).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => _FinishScreen(ticketId: _id, attachments: _t?.list('attachments') ?? const []),
      ),
    );
    if (body == null || !mounted) return;
    await _post(
      'finish-$interventionId',
      () => _api.post('/support/interventions/$interventionId/finish', body: body),
      success: "Rapport d'intervention enregistré",
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_t == null) return _error != null ? ErrorView(error: _error, onRetry: _load) : const LoadingView();
    final t = _t!;
    final theme = Theme.of(context);
    final me = context.auth.user?.id;
    final interventions = t.list('interventions');
    final closed = const ['closed', 'cancelled'].contains(t.s('status'));
    final awaitingClient = t.s('status') == 'resolved' || interventions.any((i) => i.s('status') == 'done' && !i.b('client_validated'));
    final warranty = t.objOrNull('warranty_claim');
    final ww = t['within_warranty'];
    return RefreshIndicator(
      onRefresh: _load,
      child: PageList(
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${t.s('number')} · ouvert le ${dateTime(t['created_at'])}', style: theme.textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(t.s('subject'), style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    ToneBadge(optionLabel(t.s('priority')), tone: const ['urgent', 'high'].contains(t.s('priority')) ? Tone.danger : Tone.neutral),
                    StatusBadge(t.s('status')),
                    if (t.b('response_breached') || t.b('resolution_breached')) const ToneBadge('SLA dépassé', tone: Tone.danger),
                  ],
                ),
                if (t.has('description')) Padding(padding: const EdgeInsets.only(top: 10), child: Text(t.s('description'))),
                const SizedBox(height: 10),
                InfoRow('Catégorie', optionLabel(t.s('category'))),
                InfoRow('Localisation', t.str('location')),
                InfoRow('Sous garantie', ww == null ? 'À déterminer' : (ww == true ? 'Oui' : 'Non')),
                InfoRow('Réponse attendue', dateTime(t['response_due_at'])),
                InfoRow('Résolution attendue', dateTime(t['resolution_due_at'])),
                if (widget.staff) InfoRow('Coût total', money(t['total_cost'] ?? 0)),
                if (t.has('diagnosis'))
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: theme.colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Diagnostic', style: TextStyle(fontWeight: FontWeight.w700)),
                        Text(t.s('diagnosis')),
                      ],
                    ),
                  ),
                if (warranty != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: AlertBox(
                      tone: warranty.s('decision') == 'covered' ? Tone.success : (warranty.s('decision') == 'partial' ? Tone.warning : Tone.danger),
                      title: 'Garantie : ${optionLabel(warranty.s('decision'))}',
                      message: warranty.s('reason'),
                    ),
                  ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (widget.staff && !closed) ...[
                      OutlinedButton(onPressed: _assign, child: const Text('Affecter')),
                      OutlinedButton(onPressed: _diagnosis, child: const Text('Diagnostic')),
                      OutlinedButton(onPressed: _warranty, child: const Text('Décision garantie')),
                      FilledButton.icon(onPressed: _schedule, icon: const Icon(Icons.build_outlined), label: const Text('Planifier une intervention')),
                      TextButton.icon(
                        onPressed: _busy == 'ai'
                            ? null
                            : () => _post('ai', () async {
                                final res = J.of(await _api.post('/support/tickets/$_id/ai-draft'));
                                if (res.has('draft')) _message.text = res.s('draft');
                                return null;
                              }),
                        icon: const Icon(Icons.smart_toy_outlined),
                        label: const Text('Proposer une réponse (IA)'),
                      ),
                    ],
                    if (!widget.staff && awaitingClient && !closed)
                      FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
                        onPressed: _validate,
                        icon: const Icon(Icons.star_outline),
                        label: const Text("Valider l'intervention"),
                      ),
                    if (const ['resolved', 'closed'].contains(t.s('status')))
                      TextButton.icon(onPressed: _reopen, icon: const Icon(Icons.replay), label: const Text('Rouvrir')),
                  ],
                ),
              ],
            ),
          ),
          if (interventions.isNotEmpty)
            SectionCard(
              title: 'Interventions',
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final i in interventions)
                    ListTile(
                      title: Text('${i.s('number')} · ${dateTime(i['scheduled_at'])}'),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              StatusBadge(i.s('status')),
                              if (i.b('client_validated')) const ToneBadge('Validée par le client', tone: Tone.success),
                            ],
                          ),
                          if (i.has('report')) Padding(padding: const EdgeInsets.only(top: 4), child: Text(i.s('report'))),
                          if (widget.staff && (i.has('labor_cost') || i.has('material_cost')))
                            Text(
                              "Main-d'œuvre ${money(i['labor_cost'] ?? 0)} · matériel ${money(i['material_cost'] ?? 0)} · ${number(i['time_spent_hours'] ?? 0, 1)} h",
                            ),
                        ],
                      ),
                      trailing: !widget.staff
                          ? null
                          : i.s('status') == 'scheduled'
                          ? OutlinedButton(
                              onPressed: () =>
                                  _post('start-${i.s('id')}', () => _api.post('/support/interventions/${i.s('id')}/start'), success: 'Intervention démarrée'),
                              child: const Text('Démarrer'),
                            )
                          : (i.s('status') == 'in_progress' ? FilledButton(onPressed: () => _finish(i.s('id')), child: const Text('Terminer')) : null),
                    ),
                ],
              ),
            ),
          SectionCard(
            title: 'Échanges',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (t.list('messages').isEmpty) const Text('Aucun échange pour le moment.'),
                for (final m in t.list('messages'))
                  Align(
                    alignment: m.s('author_id') == me ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
                      decoration: BoxDecoration(
                        color: m.b('internal')
                            ? GlobusColors.warning.withValues(alpha: 0.12)
                            : (m.s('author_id') == me ? GlobusTokens.brand500 : theme.colorScheme.surfaceContainer),
                        borderRadius: BorderRadius.circular(14),
                        border: m.b('internal') ? Border.all(color: GlobusColors.warning.withValues(alpha: 0.4)) : null,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (m.b('internal'))
                            const Text(
                              'NOTE INTERNE',
                              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: GlobusColors.warning),
                            ),
                          Text(m.s('body'), style: TextStyle(color: m.s('author_id') == me && !m.b('internal') ? Colors.white : null)),
                          Text(
                            dateTime(m['created_at']),
                            style: TextStyle(
                              fontSize: 10.5,
                              color: m.s('author_id') == me && !m.b('internal') ? GlobusTokens.brand100 : theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (!closed) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _message,
                    minLines: 2,
                    maxLines: 6,
                    maxLength: 8000,
                    decoration: const InputDecoration(hintText: 'Votre message…'),
                    onChanged: (_) => setState(() {}),
                  ),
                  if (widget.staff)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _internal,
                      onChanged: (v) => setState(() => _internal = v ?? false),
                      title: const Text('Note interne (invisible du client)'),
                    ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: BusyButton(
                      label: 'Envoyer',
                      icon: Icons.send,
                      busy: _busy == 'msg',
                      onPressed: _message.text.trim().isEmpty
                          ? null
                          : () async {
                              final ok = await _post(
                                'msg',
                                () => _api.post('/support/tickets/$_id/messages', body: {'body': _message.text.trim(), 'internal': widget.staff && _internal}),
                              );
                              if (ok) setState(_message.clear);
                            },
                    ),
                  ),
                ],
              ],
            ),
          ),
          SectionCard(
            title: 'Photos et documents',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (t.list('attachments').isEmpty) const Text('Aucune pièce jointe.'),
                for (final a in t.list('attachments'))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(a.s('kind') == 'document' ? Icons.description_outlined : Icons.photo_outlined, color: GlobusColors.primary),
                    title: Text(optionLabel(a.s('kind'))),
                    subtitle: Text(dateTime(a['created_at'])),
                    onTap: () => openRemoteFile(context, '/support/attachments/${a.s('id')}'),
                  ),
                if (!closed)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: OutlinedButton.icon(
                      onPressed: _busy == 'upload' ? null : _upload,
                      icon: _busy == 'upload'
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.add_a_photo_outlined),
                      label: const Text('Ajouter des photos ou documents'),
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

class _WarrantySheet extends StatefulWidget {
  const _WarrantySheet();
  @override
  State<_WarrantySheet> createState() => _WarrantySheetState();
}

class _WarrantySheetState extends State<_WarrantySheet> {
  String _decision = 'covered';
  String? _party;
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Décision de garantie', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _decision,
            decoration: const InputDecoration(labelText: 'Décision *'),
            items: [
              for (final d in const ['covered', 'partial', 'not_covered']) DropdownMenuItem(value: d, child: Text(optionLabel(d))),
            ],
            onChanged: (v) => setState(() => _decision = v ?? 'covered'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _party,
            decoration: const InputDecoration(labelText: 'Partie responsable'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('Non précisée')),
              for (final p in const ['globus', 'sous_traitant', 'fournisseur', 'client']) DropdownMenuItem<String?>(value: p, child: Text(optionLabel(p))),
            ],
            onChanged: (v) => setState(() => _party = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            minLines: 3,
            maxLines: 6,
            decoration: const InputDecoration(labelText: 'Motif *'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _reason.text.trim().length < 5
                ? null
                : () => Navigator.pop(context, {'decision': _decision, 'reason': _reason.text.trim(), 'responsible_party': _party}),
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
  }
}

/// Rapport d'intervention : compte rendu, temps passé, coûts, fournitures utilisées, photos de preuve.
class _FinishScreen extends StatefulWidget {
  const _FinishScreen({required this.ticketId, required this.attachments});
  final String ticketId;

  /// Pièces du ticket : les preuves de l'intervention sont choisies parmi elles (photos avant / après).
  final List<J> attachments;
  @override
  State<_FinishScreen> createState() => _FinishScreenState();
}

class _FinishScreenState extends State<_FinishScreen> {
  final _report = TextEditingController();
  final _hours = TextEditingController(text: '0');
  final _labor = TextEditingController(text: '0');
  final _material = TextEditingController(text: '0');
  final List<Map<String, dynamic>> _materials = [];
  late final List<J> _available = [
    for (final a in widget.attachments)
      if (a.s('kind') != 'document') a,
  ];
  late final Set<String> _proofs = {
    for (final a in _available)
      if (a.s('kind') == 'after') a.s('file_id'),
  };
  bool _uploading = false;

  @override
  void dispose() {
    for (final c in [_report, _hours, _labor, _material]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _addMaterial() async {
    final label = TextEditingController();
    final qty = TextEditingController(text: '1');
    final unit = TextEditingController(text: 'u');
    final cost = TextEditingController(text: '0');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Fourniture'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: label,
                decoration: const InputDecoration(labelText: 'Libellé', hintText: 'Ex. Disjoncteur 20 A'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: qty,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Quantité'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: unit,
                decoration: const InputDecoration(labelText: 'Unité', hintText: 'u, m, kg…'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: cost,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Coût (FCFA)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Ajouter')),
        ],
      ),
    );
    if (ok == true && label.text.trim().isNotEmpty) {
      setState(
        () => _materials.add({
          'label': label.text.trim(),
          'quantity': num.tryParse(qty.text.replaceAll(',', '.')) ?? 1,
          'unit': unit.text.trim(),
          'cost': num.tryParse(cost.text.replaceAll(',', '.')) ?? 0,
        }),
      );
    }
    for (final c in [label, qty, unit, cost]) {
      c.dispose();
    }
  }

  Future<void> _addProof() async {
    final files = await pickAttachments(context, imagesOnly: true);
    if (files.isEmpty || !mounted) return;
    setState(() => _uploading = true);
    try {
      for (final f in files) {
        final res = J.of(await context.api.upload('/support/tickets/${widget.ticketId}/attachments', files: [f], fields: {'kind': 'after'}));
        setState(() {
          _available.add(J({'file_id': res.s('file_id'), 'kind': 'after', 'created_at': DateTime.now().toUtc().toIso8601String()}));
          _proofs.add(res.s('file_id'));
        });
      }
    } catch (e) {
      if (mounted) context.toast(errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _materials.fold<num>(0, (s, m) => s + (m['cost'] as num));
    num parse(TextEditingController c) => num.tryParse(c.text.replaceAll(',', '.').replaceAll(' ', '')) ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text("Rapport d'intervention")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _report,
            minLines: 4,
            maxLines: 10,
            decoration: const InputDecoration(labelText: 'Compte rendu *'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _hours,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Temps passé (heures)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _labor,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: "Coût main-d'œuvre (FCFA)"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _material,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Coût matériel (FCFA)'),
          ),
          const GroupTitle('Fournitures utilisées'),
          if (_materials.isEmpty) const Text('Aucune fourniture utilisée.'),
          for (final m in _materials)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${m['label']}'),
              subtitle: Text('${number(m['quantity'], 2)} ${m['unit']} · ${money(m['cost'])}'),
              trailing: IconButton(tooltip: 'Retirer', icon: const Icon(Icons.delete_outline), onPressed: () => setState(() => _materials.remove(m))),
            ),
          if (_materials.isNotEmpty) Text('Total : ${money(total)} (à reporter dans le coût matériel)', style: Theme.of(context).textTheme.bodySmall),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(onPressed: _addMaterial, icon: const Icon(Icons.add), label: const Text('Fourniture')),
          ),
          const GroupTitle('Photos de preuve (avant / après) *'),
          for (final a in _available)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _proofs.contains(a.s('file_id')),
              onChanged: (v) => setState(() => v == true ? _proofs.add(a.s('file_id')) : _proofs.remove(a.s('file_id'))),
              title: Text(optionLabel(a.s('kind'))),
              subtitle: Text(dateTime(a['created_at'])),
            ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _uploading ? null : _addProof,
              icon: _uploading
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.add_a_photo_outlined),
              label: const Text('Photographier le résultat'),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _report.text.trim().length < 5 || _proofs.isEmpty
                ? null
                : () => Navigator.pop(context, {
                    'report': _report.text.trim(),
                    'time_spent_hours': parse(_hours),
                    'labor_cost': parse(_labor),
                    'material_cost': parse(_material),
                    'materials': _materials,
                    'proof_file_ids': _proofs.toList(),
                  }),
            child: const Text('Enregistrer le rapport'),
          ),
        ],
      ),
    );
  }
}
