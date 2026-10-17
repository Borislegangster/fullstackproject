import 'dart:async';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import '../field_state.dart';

const _kinds = [
  ('accident', 'Accident'),
  ('presque_accident', 'Presque-accident'),
  ('securite', 'Situation dangereuse'),
  ('qualite', 'Non-conformité qualité'),
  ('environnement', 'Environnement'),
  ('materiel', 'Matériel / engin'),
];
const _severities = [('low', 'Faible'), ('medium', 'Moyenne'), ('high', 'Élevée'), ('critical', 'Critique')];

String _label(List<(String, String)> list, String? value) => list.where((e) => e.$1 == value).firstOrNull?.$2 ?? optionLabel(value);

Tone _severityTone(String? s) => switch (s) {
  'critical' || 'high' => Tone.danger,
  'medium' => Tone.warning,
  _ => Tone.info,
};

/// Envoie des photos QHSE (géolocalisées) et renvoie leurs identifiants.
Future<List<String>> _uploadQhse(BuildContext context, List<UploadFile> files) async {
  final position = await currentPosition(context);
  if (!context.mounted) return const [];
  final ids = <String>[];
  for (final f in files) {
    final res = J.of(
      await context.api.upload(
        '/qhse/files',
        files: [f],
        fields: {
          if (position != null) 'latitude': position.latitude,
          if (position != null) 'longitude': position.longitude,
        },
      ),
    );
    ids.add(res.s('file_id'));
  }
  return ids;
}

/// QHSE terrain : incidents (déclaration hors ligne avec photos), inspections à réaliser, actions correctives
/// dont je suis responsable, quarts d'heure sécurité.
class QhseScreen extends StatelessWidget {
  const QhseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final read = context.can('qhse:read');
    return WithSite(
      builder: (context, project) => DefaultTabController(
        length: read ? 4 : 2,
        child: Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            heroTag: 'incident-new',
            backgroundColor: GlobusColors.danger,
            foregroundColor: Colors.white,
            onPressed: () => context.push('$base/qhse/incidents/nouveau'),
            icon: const Icon(Icons.report_outlined),
            label: const Text('Signaler'),
          ),
          body: Column(
            children: [
              TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: [
                  if (read) const Tab(text: 'Incidents'),
                  if (read) const Tab(text: 'Inspections'),
                  const Tab(text: 'Mes actions'),
                  const Tab(text: 'Quarts d\'heure'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    if (read) _Incidents(project: project),
                    if (read) _Inspections(project: project),
                    _Actions(project: project),
                    _Talks(project: project),
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

class _Incidents extends StatelessWidget {
  const _Incidents({required this.project});
  final J project;

  @override
  Widget build(BuildContext context) {
    return PagedListView(
      path: '/qhse/incidents',
      query: {'project_id': project.s('id')},
      refreshOn: const ['notification'],
      padding: const EdgeInsets.only(bottom: 96),
      empty: const EmptyView(
        icon: Icons.health_and_safety_outlined,
        title: 'Aucun incident',
        text: 'Signalez tout accident, presque-accident ou situation dangereuse : même hors ligne.',
      ),
      itemBuilder: (context, i, _) => ListTile(
        onTap: () => context.push('$base/qhse/incidents/${i.s('id')}'),
        leading: Icon(Icons.warning_amber_rounded, color: GlobusColors.tone(_severityTone(i.s('severity')))),
        title: Text(i.s('title')),
        subtitle: Text('${i.s('number')} · ${_label(_kinds, i.s('kind'))} · ${dateTime(i['occurred_at'])}'),
        trailing: StatusBadge(i.s('status')),
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ déclaration
/// Déclaration d'incident : enregistrée sur le téléphone puis envoyée (photos d'abord, rattachées par
/// empreinte) — aucune perte en zone blanche, aucun doublon au renvoi.
class IncidentFormScreen extends StatefulWidget {
  const IncidentFormScreen({super.key, this.zone});
  final J? zone;
  @override
  State<IncidentFormScreen> createState() => _IncidentFormScreenState();
}

class _IncidentFormScreenState extends State<IncidentFormScreen> {
  String _kind = 'securite';
  String _severity = 'medium';
  DateTime _at = DateTime.now();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _location = TextEditingController();
  final _injuries = TextEditingController();
  final _actions = TextEditingController();
  late J? _zone = widget.zone;
  final List<UploadFile> _photos = [];
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_title, _description, _location, _injuries, _actions]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit(J project) async {
    if (_title.text.trim().length < 3) {
      context.toast('Décrivez l\'incident en quelques mots (titre).', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final position = await currentPosition(context);
      if (!mounted) return;
      final queue = context.read<OfflineQueue>();
      final online = !context.read<GlobusServices>().offline.value;
      final checksums = <String>[];
      for (final f in _photos) {
        if (kIsWeb || f.path == null) continue;
        checksums.add(sha256.convert(await File(f.path!).readAsBytes()).toString());
        await queue.enqueueUpload(
          label: 'Photo d\'incident',
          path: '/qhse/files',
          sourceFile: f.path!,
          fileName: f.name,
          fields: {if (position != null) 'latitude': position.latitude, if (position != null) 'longitude': position.longitude},
        );
      }
      await queue.enqueueMutation(
        label: 'Incident : ${_title.text.trim()}',
        entity: 'incident',
        operation: 'create',
        payload: {
          'project_id': project.s('id'),
          if (_zone != null) 'zone_id': _zone!.s('id'),
          'kind': _kind,
          'severity': _severity,
          'occurred_at': _at.toUtc().toIso8601String(),
          'title': _title.text.trim(),
          if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
          if (_location.text.trim().isNotEmpty) 'location': _location.text.trim(),
          if (_injuries.text.trim().isNotEmpty) 'injuries': _injuries.text.trim(),
          if (_actions.text.trim().isNotEmpty) 'immediate_actions': _actions.text.trim(),
          'latitude': position?.latitude,
          'longitude': position?.longitude,
          'photo_checksums': checksums,
          'source': online ? 'mobile' : 'offline',
        },
      );
      final report = await queue.sync();
      if (!mounted) return;
      context.toast(
        report.offline ? 'Incident enregistré sur le téléphone : envoi automatique au retour du réseau.' : 'Incident signalé : le responsable QHSE est alerté.',
        success: !report.offline,
      );
      context.pop();
    } catch (e) {
      if (mounted) context.toastError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: WithSite(
        builder: (context, project) => PageList(
          children: [
            if (_kind == 'accident' || _severity == 'critical')
              const AlertBox(
                tone: Tone.danger,
                title: 'Urgence',
                message: 'Blessé grave : appelez d\'abord les secours (pompiers 18, SAMU 15), sécurisez la zone, puis déclarez.',
              ),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Nature'),
              items: [for (final k in _kinds) DropdownMenuItem(value: k.$1, child: Text(k.$2))],
              onChanged: (v) => setState(() => _kind = v ?? _kind),
            ),
            SegmentedButton<String>(
              segments: [for (final s in _severities) ButtonSegment(value: s.$1, label: Text(s.$2))],
              selected: {_severity},
              showSelectedIcon: false,
              onSelectionChanged: (v) => setState(() => _severity = v.first),
            ),
            TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Que s\'est-il passé ? *'),
            ),
            TextField(
              controller: _description,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Circonstances'),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.schedule),
              title: Text('Survenu le ${dateTime(_at.toUtc())}'),
              trailing: const Icon(Icons.edit_outlined),
              onTap: () async {
                final d = await pickDateTime(context, _at);
                if (d != null) setState(() => _at = d.isAfter(DateTime.now()) ? DateTime.now() : d);
              },
            ),
            RefField(label: 'Zone (facultatif)', source: Refs.zones(project.s('id')), value: _zone, onChanged: (v) => setState(() => _zone = v)),
            TextField(
              controller: _location,
              decoration: const InputDecoration(labelText: 'Lieu précis'),
            ),
            if (_kind == 'accident' || _kind == 'presque_accident')
              TextField(
                controller: _injuries,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Blessures constatées'),
              ),
            TextField(
              controller: _actions,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Mesures immédiates prises'),
            ),
            SectionCard(
              title: 'Photos',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final (i, f) in _photos.indexed)
                        InputChip(label: Text(f.name), avatar: const Icon(Icons.photo_outlined), onDeleted: () => setState(() => _photos.removeAt(i))),
                    ],
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final files = await pickAttachments(context, imagesOnly: true);
                      if (files.isNotEmpty) setState(() => _photos.addAll(files));
                    },
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: const Text('Ajouter des photos'),
                  ),
                ],
              ),
            ),
            BusyButton(label: 'Envoyer le signalement', icon: Icons.send_outlined, busy: _busy, expand: true, danger: true, onPressed: () => _submit(project)),
          ],
        ),
      ),
    );
  }
}

/// Fiche incident : faits, photos, analyse des causes, actions correctives, clôture.
class IncidentScreen extends StatelessWidget {
  const IncidentScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/qhse/incidents/$id',
      builder: (context, data, handle) {
        final i = J.of(data);
        final write = context.can('qhse:write');
        final photos = [for (final f in i.strings('photo_file_ids')) GalleryItem(url: '/qhse/files/$f', caption: i.s('number'))];
        return PageList(
          children: [
            PageHeader(eyebrow: i.s('number'), title: i.s('title'), trailing: StatusBadge(i.s('status'))),
            Wrap(
              spacing: 6,
              children: [
                ToneBadge(_label(_kinds, i.s('kind')), tone: Tone.info),
                ToneBadge('Gravité ${_label(_severities, i.s('severity')).toLowerCase()}', tone: _severityTone(i.s('severity'))),
              ],
            ),
            SectionCard(
              title: 'Faits',
              child: Column(
                children: [
                  InfoRow('Survenu le', dateTime(i['occurred_at'])),
                  InfoRow('Lieu', i.str('location')),
                  InfoRow('Circonstances', i.str('description')),
                  InfoRow('Blessures', i.str('injuries')),
                  InfoRow('Mesures immédiates', i.str('immediate_actions')),
                  if (i.i('lost_time_days') > 0) InfoRow('Jours d\'arrêt', '${i.i('lost_time_days')}'),
                  InfoRow('Cause racine', i.str('root_cause')),
                ],
              ),
            ),
            SectionCard(
              title: 'Photos',
              trailing: IconButton(
                tooltip: 'Ajouter',
                icon: const Icon(Icons.add_a_photo_outlined),
                onPressed: () async {
                  final files = await pickAttachments(context, imagesOnly: true);
                  if (files.isEmpty || !context.mounted) return;
                  await runAction(context, () async {
                    final ids = await _uploadQhse(context, files);
                    if (ids.isNotEmpty && context.mounted) await context.api.post('/qhse/incidents/$id/photos', body: {'file_ids': ids});
                  }, success: 'Photos ajoutées');
                  await handle.reload();
                },
              ),
              child: photos.isEmpty
                  ? const Text('Aucune photo.')
                  : SizedBox(
                      height: 96,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: photos.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (context, n) => SizedBox(
                          width: 96,
                          child: MediaThumb(url: photos[n].url, onTap: () => GalleryScreen.open(context, photos, n)),
                        ),
                      ),
                    ),
            ),
            if (i.list('actions').isNotEmpty)
              SectionCard(
                title: 'Actions correctives',
                child: Column(
                  children: [
                    for (final a in i.list('actions'))
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(a.s('title')),
                        subtitle: Text('${a.s('number')} · échéance ${date(a['due_date'])}'),
                        trailing: StatusBadge(a.s('status')),
                        onTap: () => Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(builder: (_) => ActionScreen(id: a.s('id')))),
                      ),
                  ],
                ),
              ),
            if (write && i.s('status') != 'closed') ...[
              OutlinedButton.icon(
                onPressed: () async {
                  final cause = await promptText(
                    context,
                    title: 'Analyse des causes',
                    label: 'Cause racine',
                    required: true,
                    minLength: 5,
                    initial: i.str('root_cause'),
                  );
                  if (cause == null || !context.mounted) return;
                  await runAction(
                    context,
                    () => context.api.post('/qhse/incidents/$id/investigation', body: {'root_cause': cause}),
                    success: 'Analyse enregistrée',
                  );
                  await handle.reload();
                },
                icon: const Icon(Icons.manage_search),
                label: const Text('Analyse des causes'),
              ),
              FilledButton.icon(
                onPressed: () async {
                  if (!await confirmDialog(context, title: 'Clôturer l\'incident ?', message: 'Les actions correctives doivent être vérifiées.')) return;
                  if (!context.mounted) return;
                  await runAction(context, () => context.api.post('/qhse/incidents/$id/close'), success: 'Incident clôturé');
                  await handle.reload();
                },
                icon: const Icon(Icons.task_alt),
                label: const Text('Clôturer'),
              ),
            ],
          ],
        );
      },
    );
  }
}

// ------------------------------------------------------------------------------------------------ inspections
class _Inspections extends StatefulWidget {
  const _Inspections({required this.project});
  final J project;
  @override
  State<_Inspections> createState() => _InspectionsState();
}

class _InspectionsState extends State<_Inspections> {
  final _list = PagedListController();

  Future<void> _start() async {
    final template = await pickRef(context, Refs.inspectionTemplates, title: 'Grille d\'inspection');
    if (template == null || !mounted) return;
    final res = await runAction(
      context,
      () => context.api.post('/qhse/inspections', body: {'project_id': widget.project.s('id'), 'template_id': template.s('id')}),
    );
    if (res == null || !mounted) return;
    await Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(builder: (_) => InspectionScreen(id: J.of(res).s('id'))));
    unawaited(_list.reload());
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (context.can('qhse:write'))
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: OutlinedButton.icon(onPressed: _start, icon: const Icon(Icons.playlist_add_check), label: const Text('Nouvelle inspection')),
          ),
        Expanded(
          child: PagedListView(
            path: '/qhse/inspections',
            controller: _list,
            query: {'project_id': widget.project.s('id')},
            padding: const EdgeInsets.only(bottom: 96),
            empty: const EmptyView(icon: Icons.fact_check_outlined, title: 'Aucune inspection'),
            itemBuilder: (context, r, _) => ListTile(
              onTap: () async {
                await Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(builder: (_) => InspectionScreen(id: r.s('id'))));
                unawaited(_list.reload());
              },
              leading: const Icon(Icons.fact_check_outlined, color: GlobusColors.primary),
              title: Text('${r.s('number')} · ${optionLabel(r.s('category'))}'),
              subtitle: Text([date(r['inspection_date']), if (r.has('score')) 'score ${percent(r['score'])}'].join(' · ')),
              trailing: StatusBadge(r.s('status')),
            ),
          ),
        ),
      ],
    );
  }
}

/// Inspection : chaque point conforme / non conforme / sans objet, commentaire et photo ; un point non
/// conforme ouvre automatiquement une action corrective à la validation.
class InspectionScreen extends StatefulWidget {
  const InspectionScreen({super.key, required this.id});
  final String id;
  @override
  State<InspectionScreen> createState() => _InspectionScreenState();
}

class _InspectionScreenState extends State<InspectionScreen> {
  J? _data;
  Object? _error;
  List<Map<String, dynamic>> _results = [];
  final _findings = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _findings.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = J.of(await context.api.get('/qhse/inspections/${widget.id}'));
      if (!mounted) return;
      setState(() {
        _data = d;
        _error = null;
        _results = [for (final r in d.list('results')) Map<String, dynamic>.of(r.raw)];
        _findings.text = d.str('findings') ?? '';
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _photo(Map<String, dynamic> r) async {
    final files = await pickAttachments(context, imagesOnly: true, multiple: false);
    if (files.isEmpty || !mounted) return;
    final ids = await runAction(context, () => _uploadQhse(context, files));
    if (ids != null && ids.isNotEmpty) setState(() => r['photo_file_id'] = ids.first);
  }

  Future<void> _complete() async {
    final missing = _results.where((r) => !const ['ok', 'nok', 'na'].contains(r['status'])).length;
    if (missing > 0) {
      context.toast('$missing point(s) non renseigné(s).', error: true);
      return;
    }
    final nok = _results.where((r) => r['status'] == 'nok').length;
    if (!await confirmDialog(
      context,
      title: 'Terminer l\'inspection ?',
      message: nok > 0 ? '$nok non-conformité(s) : une action corrective sera ouverte pour chacune.' : 'Tous les points sont conformes.',
    )) {
      return;
    }
    if (!mounted) return;
    setState(() => _busy = true);
    final res = await runAction(
      context,
      () => context.api.post(
        '/qhse/inspections/${widget.id}/complete',
        body: {
          'results': [
            for (final r in _results)
              {
                'key': r['key'],
                'label': r['label'],
                'weight': r['weight'] ?? 1,
                'status': r['status'],
                if ((r['comment'] as String?)?.isNotEmpty ?? false) 'comment': r['comment'],
                if (r['photo_file_id'] != null) 'photo_file_id': r['photo_file_id'],
              },
          ],
          if (_findings.text.trim().isNotEmpty) 'findings': _findings.text.trim(),
        },
      ),
      success: 'Inspection terminée',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (res != null) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final d = _data;
    final editable = d?.s('status') == 'draft' && context.can('qhse:write');
    return Scaffold(
      appBar: AppBar(title: Text(d?.s('number') ?? 'Inspection')),
      body: _error != null
          ? ErrorView(error: _error, onRetry: _load)
          : d == null
          ? const LoadingView()
          : PageList(
              children: [
                Row(
                  children: [
                    StatusBadge(d.s('status')),
                    const SizedBox(width: 8),
                    Text('${optionLabel(d.s('category'))} · ${date(d['inspection_date'])}'),
                    const Spacer(),
                    if (d.has('score')) Text('Score ${percent(d['score'])}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                if (_results.isEmpty) const EmptyView(icon: Icons.checklist, title: 'Grille vide'),
                for (final r in _results)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('${r['label']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          SegmentedButton<String>(
                            emptySelectionAllowed: true,
                            showSelectedIcon: false,
                            segments: const [
                              ButtonSegment(value: 'ok', label: Text('Conforme')),
                              ButtonSegment(value: 'nok', label: Text('Non conforme')),
                              ButtonSegment(value: 'na', label: Text('S.O.')),
                            ],
                            selected: {if (r['status'] != null) r['status'] as String},
                            onSelectionChanged: editable ? (v) => setState(() => r['status'] = v.firstOrNull) : null,
                          ),
                          if (r['status'] == 'nok' || (r['comment'] as String?)?.isNotEmpty == true)
                            TextFormField(
                              initialValue: r['comment'] as String?,
                              enabled: editable,
                              decoration: const InputDecoration(labelText: 'Constat', isDense: true),
                              onChanged: (v) => r['comment'] = v,
                            ),
                          if (editable || r['photo_file_id'] != null)
                            Align(
                              alignment: Alignment.centerLeft,
                              child: r['photo_file_id'] != null
                                  ? SizedBox(
                                      width: 72,
                                      height: 72,
                                      child: MediaThumb(
                                        url: '/qhse/files/${r['photo_file_id']}',
                                        onTap: () => GalleryScreen.open(context, [GalleryItem(url: '/qhse/files/${r['photo_file_id']}')]),
                                      ),
                                    )
                                  : TextButton.icon(
                                      onPressed: () => _photo(r),
                                      icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                                      label: const Text('Photo'),
                                    ),
                            ),
                        ],
                      ),
                    ),
                  ),
                TextField(
                  controller: _findings,
                  enabled: editable,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Observations générales'),
                ),
                if (editable) BusyButton(label: 'Terminer l\'inspection', icon: Icons.task_alt, busy: _busy, expand: true, onPressed: _complete),
                if (d.s('status') == 'completed' && context.can('qhse:write'))
                  OutlinedButton.icon(
                    onPressed: () async {
                      final res = await runAction(context, () => context.api.post('/qhse/inspections/${widget.id}/close'), success: 'Inspection clôturée');
                      if (res != null) await _load();
                    },
                    icon: const Icon(Icons.lock_outline),
                    label: const Text('Clôturer (actions vérifiées)'),
                  ),
              ],
            ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ actions
class _Actions extends StatelessWidget {
  const _Actions({required this.project});
  final J project;

  @override
  Widget build(BuildContext context) {
    return PagedListView(
      path: '/qhse/actions',
      query: {'project_id': project.s('id'), 'mine': true},
      padding: const EdgeInsets.only(bottom: 96),
      empty: const EmptyView(
        icon: Icons.assignment_turned_in_outlined,
        title: 'Aucune action à mener',
        text: 'Les actions correctives dont vous êtes responsable apparaissent ici.',
      ),
      itemBuilder: (context, a, _) {
        final late = const ['open', 'in_progress'].contains(a.s('status')) && (a.date('due_date')?.isBefore(DateTime.now()) ?? false);
        return ListTile(
          onTap: () => Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(builder: (_) => ActionScreen(id: a.s('id')))),
          leading: Icon(Icons.assignment_outlined, color: late ? GlobusColors.danger : GlobusColors.primary),
          title: Text(a.s('title')),
          subtitle: Text('${a.s('number')} · échéance ${date(a['due_date'])}${late ? ' · en retard' : ''}'),
          trailing: StatusBadge(a.s('status')),
        );
      },
    );
  }
}

/// Action corrective : démarrer, puis terminer avec une note et au moins une preuve photo.
class ActionScreen extends StatelessWidget {
  const ActionScreen({super.key, required this.id, this.routed = false});
  final String id;

  /// Page du routeur (barre fournie par le cadre de l'application).
  final bool routed;

  Future<void> _complete(BuildContext context, ApiHandle handle) async {
    final note = await promptText(context, title: 'Action réalisée', label: 'Ce qui a été fait', required: true, minLength: 5);
    if (note == null || !context.mounted) return;
    final files = await pickAttachments(context, imagesOnly: true);
    if (!context.mounted) return;
    if (files.isEmpty) {
      context.toast('Au moins une photo de preuve est requise.', error: true);
      return;
    }
    await runAction(context, () async {
      final ids = await _uploadQhse(context, files);
      if (context.mounted) await context.api.post('/qhse/actions/$id/complete', body: {'note': note, 'evidence_file_ids': ids});
    }, success: 'Action terminée : en attente de vérification');
    await handle.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: routed ? null : AppBar(title: const Text('Action corrective')),
      body: ApiView(
        path: '/qhse/actions/$id',
        builder: (context, data, handle) {
          final a = J.of(data);
          final source = a.objOrNull('source');
          final evidence = [for (final f in a.strings('closure_evidence_file_ids')) GalleryItem(url: '/qhse/files/$f')];
          return PageList(
            children: [
              PageHeader(eyebrow: a.s('number'), title: a.s('title'), trailing: StatusBadge(a.s('status'))),
              SectionCard(
                child: Column(
                  children: [
                    InfoRow('Échéance', date(a['due_date'])),
                    InfoRow('Description', a.str('description')),
                    if (source != null) InfoRow('Origine', '${source.s('type') == 'incident' ? 'Incident' : 'Inspection'} ${source.s('number')}'),
                    InfoRow('Compte rendu', a.str('closure_note')),
                  ],
                ),
              ),
              if (evidence.isNotEmpty)
                Wrap(
                  spacing: 8,
                  children: [
                    for (final (n, e) in evidence.indexed)
                      SizedBox(
                        width: 88,
                        height: 88,
                        child: MediaThumb(url: e.url, onTap: () => GalleryScreen.open(context, evidence, n)),
                      ),
                  ],
                ),
              if (a.s('status') == 'open')
                FilledButton.icon(
                  onPressed: () async {
                    await runAction(context, () => context.api.post('/qhse/actions/$id/start'), success: 'Action démarrée');
                    await handle.reload();
                  },
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Démarrer'),
                ),
              if (a.s('status') == 'open' || a.s('status') == 'in_progress')
                OutlinedButton.icon(onPressed: () => _complete(context, handle), icon: const Icon(Icons.task_alt), label: const Text('Terminer avec preuve')),
            ],
          );
        },
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ quarts d'heure
class _Talks extends StatefulWidget {
  const _Talks({required this.project});
  final J project;
  @override
  State<_Talks> createState() => _TalksState();
}

class _TalksState extends State<_Talks> {
  final _list = PagedListController();

  @override
  Widget build(BuildContext context) {
    final canCreate = context.can('qhse:write') || context.can('site:report');
    return Column(
      children: [
        if (canCreate)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: OutlinedButton.icon(
              onPressed: () async {
                final ok = await Navigator.of(
                  context,
                  rootNavigator: true,
                ).push<bool>(MaterialPageRoute(builder: (_) => SafetyTalkScreen(project: widget.project)));
                if (ok == true) unawaited(_list.reload());
              },
              icon: const Icon(Icons.record_voice_over_outlined),
              label: const Text('Animer un quart d\'heure sécurité'),
            ),
          ),
        Expanded(
          child: context.can('qhse:read')
              ? PagedListView(
                  path: '/qhse/safety-talks',
                  controller: _list,
                  query: {'project_id': widget.project.s('id')},
                  padding: const EdgeInsets.only(bottom: 96),
                  empty: const EmptyView(icon: Icons.record_voice_over_outlined, title: 'Aucun quart d\'heure sécurité'),
                  itemBuilder: (context, t, _) => ListTile(
                    leading: const Icon(Icons.record_voice_over_outlined, color: GlobusColors.primary),
                    title: Text(t.s('topic')),
                    subtitle: Text('${date(t['talk_date'])} · ${t.i('attendee_count')} participant(s) · ${t.i('duration_minutes')} min'),
                  ),
                )
              : const EmptyView(
                  icon: Icons.record_voice_over_outlined,
                  title: 'Quarts d\'heure sécurité',
                  text: 'Animez la causerie du jour : participants pointés aujourd\'hui pré-cochés.',
                ),
        ),
      ],
    );
  }
}

/// Quart d'heure sécurité : sujet, contenu, participants (ouvriers pointés aujourd'hui pré-cochés, ajout libre),
/// photo de la causerie.
class SafetyTalkScreen extends StatefulWidget {
  const SafetyTalkScreen({super.key, required this.project});
  final J project;
  @override
  State<SafetyTalkScreen> createState() => _SafetyTalkScreenState();
}

class _SafetyTalkScreenState extends State<SafetyTalkScreen> {
  final _topic = TextEditingController();
  final _content = TextEditingController();
  int _duration = 15;
  final Map<String, (String, bool)> _present = {};
  final List<String> _extra = [];
  final List<UploadFile> _photos = [];
  bool _busy = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadPresent());
  }

  @override
  void dispose() {
    _topic.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _loadPresent() async {
    try {
      final today = isoDate(DateTime.now());
      final res = await context.api.get('/hr/attendance', query: {'project_id': widget.project.s('id'), 'start': today, 'end': today, 'page_size': 200});
      for (final a in listOf(res)) {
        _present[a.s('employee_id')] = (a.s('employee'), true);
      }
    } catch (_) {}
    if (mounted) setState(() => _loaded = true);
  }

  Future<void> _submit() async {
    final attendees = [
      for (final e in _present.entries)
        if (e.value.$2) {'employee_id': e.key, 'name': e.value.$1, 'signed': true},
      for (final n in _extra) {'name': n, 'signed': true},
    ];
    if (_topic.text.trim().length < 3 || attendees.isEmpty) {
      context.toast('Sujet et au moins un participant requis.', error: true);
      return;
    }
    setState(() => _busy = true);
    final res = await runAction(context, () async {
      final photos = _photos.isEmpty ? const <String>[] : await _uploadQhse(context, _photos);
      if (!mounted) return null;
      return context.api.post(
        '/qhse/safety-talks',
        body: {
          'project_id': widget.project.s('id'),
          'topic': _topic.text.trim(),
          if (_content.text.trim().isNotEmpty) 'content': _content.text.trim(),
          'duration_minutes': _duration,
          'attendees': attendees,
          'photo_file_ids': photos,
        },
      );
    }, success: 'Quart d\'heure sécurité enregistré');
    if (!mounted) return;
    setState(() => _busy = false);
    if (res != null) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final count = _present.values.where((v) => v.$2).length + _extra.length;
    return Scaffold(
      appBar: AppBar(title: const Text('Quart d\'heure sécurité')),
      body: PageList(
        children: [
          TextField(
            controller: _topic,
            decoration: const InputDecoration(labelText: 'Sujet *', hintText: 'Travail en hauteur, port des EPI…'),
          ),
          TextField(
            controller: _content,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Points abordés'),
          ),
          DropdownButtonFormField<int>(
            isExpanded: true,
            initialValue: _duration,
            decoration: const InputDecoration(labelText: 'Durée'),
            items: [
              for (final m in const [5, 10, 15, 20, 30, 45, 60]) DropdownMenuItem(value: m, child: Text('$m min')),
            ],
            onChanged: (v) => setState(() => _duration = v ?? 15),
          ),
          SectionCard(
            title: 'Participants ($count)',
            trailing: IconButton(
              tooltip: 'Ajouter un participant',
              icon: const Icon(Icons.person_add_alt),
              onPressed: () async {
                final name = await promptText(context, title: 'Participant', label: 'Nom et prénom', required: true, maxLines: 1);
                if (name != null && name.trim().isNotEmpty) setState(() => _extra.add(name.trim()));
              },
            ),
            child: !_loaded
                ? const LinearProgressIndicator()
                : Column(
                    children: [
                      if (_present.isEmpty && _extra.isEmpty) const Text('Aucun ouvrier pointé aujourd\'hui : ajoutez les participants.'),
                      for (final e in _present.entries)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          value: e.value.$2,
                          title: Text(e.value.$1),
                          onChanged: (v) => setState(() => _present[e.key] = (e.value.$1, v ?? false)),
                        ),
                      for (final (i, n) in _extra.indexed)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: Text(n),
                          trailing: IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => _extra.removeAt(i))),
                        ),
                    ],
                  ),
          ),
          OutlinedButton.icon(
            onPressed: () async {
              final files = await pickAttachments(context, imagesOnly: true);
              if (files.isNotEmpty) setState(() => _photos.addAll(files));
            },
            icon: const Icon(Icons.add_a_photo_outlined),
            label: Text(_photos.isEmpty ? 'Photo de la causerie' : '${_photos.length} photo(s)'),
          ),
          BusyButton(label: 'Enregistrer', icon: Icons.check, busy: _busy, expand: true, onPressed: _submit),
        ],
      ),
    );
  }
}
