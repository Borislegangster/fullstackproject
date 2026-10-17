import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import '../field_state.dart';
import 'media.dart';

const _taskStatuses = ['todo', 'in_progress', 'blocked', 'done'];

/// Mes tâches (ou toutes les tâches du chantier selon les droits), filtre de statut, avancement.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key, this.zoneId});
  final String? zoneId;
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  bool _mine = true;
  String? _status;
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final canAll = context.can('planning:write') || context.can('projects:write');
    return WithSite(
      builder: (context, project) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher une tâche (titre, code WBS)', isDense: true),
                  onSubmitted: (v) => setState(() => _q = v.trim()),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      if (canAll) ...[
                        FilterChip(label: const Text('Mes tâches'), selected: _mine, onSelected: (v) => setState(() => _mine = v)),
                        const SizedBox(width: 6),
                      ],
                      ChoiceChip(label: const Text('Tous statuts'), selected: _status == null, onSelected: (_) => setState(() => _status = null)),
                      for (final s in _taskStatuses)
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(label: Text(statusLabel(s)), selected: _status == s, onSelected: (_) => setState(() => _status = s)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: PagedListView(
              path: '/projects/${project.s('id')}/tasks',
              pageSize: 100,
              query: {'mine': _mine || !canAll ? true : null, 'status': _status, 'q': _q, 'zone_id': widget.zoneId, 'sort': 'start'},
              empty: const EmptyView(icon: Icons.task_alt, title: 'Aucune tâche', text: 'Les tâches qui vous sont affectées apparaissent ici.'),
              itemBuilder: (context, t, _) => TaskTile(task: t),
            ),
          ),
        ],
      ),
    );
  }
}

class TaskTile extends StatelessWidget {
  const TaskTile({super.key, required this.task});
  final J task;

  @override
  Widget build(BuildContext context) {
    final t = task;
    final late = t.has('end_planned') && t.s('end_planned').compareTo(isoDate(DateTime.now())) < 0 && !const ['done', 'cancelled'].contains(t.s('status'));
    return ListTile(
      onTap: () => context.push('$base/terrain/taches/${t.s('id')}'),
      title: Text('${t.has('wbs_code') ? '${t.s('wbs_code')} · ' : ''}${t.s('title')}', maxLines: 2, overflow: TextOverflow.ellipsis),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          children: [
            StatusBadge(t.s('status')),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '${t.has('start_planned') ? '${date(t['start_planned'])} → ${date(t['end_planned'])}' : 'Non planifiée'}${late ? ' · en retard' : ''}',
                style: TextStyle(fontSize: 12, color: late ? GlobusColors.danger : null),
              ),
            ),
          ],
        ),
      ),
      trailing: SizedBox(
        width: 56,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('${number(t['progress_pct'])}$nbsp%', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            GProgress(value: t.d('progress_pct'), height: 5),
          ],
        ),
      ),
    );
  }
}

/// Fiche tâche : avancement (hors ligne, version connue → conflit explicite), note, check-list, photos.
class TaskDetailScreen extends StatefulWidget {
  const TaskDetailScreen({super.key, required this.taskId});
  final String taskId;
  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  int _v = 0;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      key: ValueKey(_v),
      path: '/tasks/${widget.taskId}',
      builder: (context, data, handle) {
        final t = J.of(data);
        final queue = context.watch<OfflineQueue>();
        final pendingHere = queue.items.where((o) => o.entity == 'task_progress' && o.entityId == t.s('id')).toList();
        final theme = Theme.of(context);
        return PageList(
          children: [
            PageHeader(eyebrow: t.str('wbs_code'), title: t.s('title'), subtitle: t.str('description')),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                StatusBadge(t.s('status')),
                ToneBadge(
                  'Priorité ${optionLabel(t.s('priority'))}',
                  tone: t.s('priority') == 'high' || t.s('priority') == 'urgent' ? Tone.danger : Tone.neutral,
                ),
                if (t.b('is_milestone')) const ToneBadge('Jalon', tone: Tone.accent),
              ],
            ),
            for (final op in pendingHere)
              AlertBox(
                tone: op.status == 'conflict' ? Tone.danger : (op.status == 'rejected' ? Tone.danger : Tone.warning),
                title: op.status == 'conflict' ? 'Conflit à résoudre' : (op.status == 'rejected' ? 'Avancement refusé' : 'En attente d\'envoi'),
                message: '${op.label}${op.error != null ? ' — ${op.error}' : ''}',
                action: op.status == 'pending'
                    ? null
                    : TextButton(onPressed: () => context.push('$base/terrain/synchronisation'), child: const Text('Traiter')),
              ),
            SectionCard(
              title: 'Avancement',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Text('${number(t['progress_pct'])}$nbsp%', style: theme.textTheme.headlineSmall?.copyWith(color: GlobusTokens.brand700)),
                      const Spacer(),
                      Text('Version ${t.i('version', 1)}', style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 8),
                  GProgress(value: t.d('progress_pct'), tone: Tone.accent, height: 10),
                  const SizedBox(height: 10),
                  InfoRow('Prévu', t.has('start_planned') ? '${date(t['start_planned'])} → ${date(t['end_planned'])}' : 'Non planifiée'),
                  InfoRow('Réel', t.has('start_actual') ? '${date(t['start_actual'])} → ${date(t['end_actual'])}' : 'Non démarrée'),
                  const SizedBox(height: 10),
                  if (context.can('site:report') || context.can('planning:write'))
                    FilledButton.icon(
                      onPressed: () async {
                        final saved = await showModalBottomSheet<bool>(
                          context: context,
                          isScrollControlled: true,
                          builder: (_) => ProgressSheet(task: t),
                        );
                        if (saved == true) setState(() => _v++);
                      },
                      icon: const Icon(Icons.trending_up),
                      label: const Text("Déclarer l'avancement"),
                    ),
                ],
              ),
            ),
            if (t.list('checklist').isNotEmpty)
              SectionCard(
                title: 'Check-list',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final (i, item) in t.list('checklist').indexed)
                      CheckboxListTile(
                        value: item.b('done'),
                        title: Text(item.str('label') ?? item.str('title') ?? 'Point ${i + 1}'),
                        subtitle: item.b('done') && item.has('done_at') ? Text('Fait le ${dateTime(item['done_at'])}') : null,
                        onChanged: (_) async {
                          final res = await runAction(context, () => context.api.post('/tasks/${t.s('id')}/checklist/$i'));
                          if (res != null) handle.data = res;
                        },
                      ),
                  ],
                ),
              ),
            SectionCard(
              title: 'Photos de la tâche',
              trailing: TextButton.icon(
                onPressed: () => captureSiteMedia(context, projectId: t.s('project_id'), taskId: t.s('id'), zoneId: t.str('zone_id'), label: t.s('title')),
                icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                label: const Text('Ajouter'),
              ),
              child: SiteMediaStrip(projectId: t.s('project_id'), taskId: t.s('id')),
            ),
            if (t.has('zone_id'))
              OutlinedButton.icon(
                onPressed: () => context.push('$base/terrain/zones/${t.s('zone_id')}'),
                icon: const Icon(Icons.place_outlined),
                label: const Text('Voir la zone (plans, issues, photos)'),
              ),
          ],
        );
      },
    );
  }
}

/// Saisie de l'avancement : envoyée immédiatement si possible, sinon mise en file (hors ligne).
class ProgressSheet extends StatefulWidget {
  const ProgressSheet({super.key, required this.task});
  final J task;
  @override
  State<ProgressSheet> createState() => _ProgressSheetState();
}

class _ProgressSheetState extends State<ProgressSheet> {
  late double _pct = widget.task.d('progress_pct');
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final t = widget.task;
    final queue = context.read<OfflineQueue>();
    await queue.enqueueMutation(
      label: 'Avancement « ${t.s('title')} » : ${_pct.round()}$nbsp%',
      entity: 'task_progress',
      operation: 'update',
      entityId: t.s('id'),
      baseVersion: t.intOrNull('version'),
      payload: {'progress_pct': _pct.round(), 'note': _note.text.trim().isEmpty ? null : _note.text.trim(), 'evidence_file_ids': <String>[]},
    );
    final report = await queue.sync();
    if (!mounted) return;
    context.toast(
      report.offline
          ? 'Hors ligne : avancement enregistré sur le téléphone, envoi automatique au retour du réseau.'
          : (report.conflicts > 0 ? 'Conflit : la tâche a changé entre-temps. Ouvrez « Synchronisation » pour choisir.' : 'Avancement enregistré'),
      success: !report.offline && report.conflicts == 0,
    );
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text("Déclarer l'avancement", style: Theme.of(context).textTheme.titleLarge),
          Text(widget.task.s('title'), style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 16),
          Center(
            child: Text(
              '${_pct.round()}$nbsp%',
              style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: GlobusTokens.brand700),
            ),
          ),
          Slider(value: _pct.clamp(0, 100), max: 100, divisions: 20, label: '${_pct.round()}$nbsp%', onChanged: (v) => setState(() => _pct = v)),
          Wrap(
            spacing: 6,
            alignment: WrapAlignment.center,
            children: [
              for (final v in const [0, 25, 50, 75, 100]) ActionChip(label: Text('$v$nbsp%'), onPressed: () => setState(() => _pct = v.toDouble())),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            minLines: 2,
            maxLines: 5,
            maxLength: 4000,
            decoration: const InputDecoration(labelText: 'Note (travaux réalisés, difficultés)'),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(onPressed: _save, icon: const Icon(Icons.save_outlined), label: const Text('Enregistrer')),
          const SizedBox(height: 4),
          const FootNote(
            "Sans réseau, l'avancement est conservé chiffré sur le téléphone et envoyé automatiquement ; il n'écrase jamais une modification faite entre-temps au bureau.",
          ),
        ],
      ),
    );
  }
}

/// Planning du chantier (Gantt).
class FieldPlanningScreen extends StatelessWidget {
  const FieldPlanningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => ApiView(
        path: '/projects/${project.s('id')}/tasks',
        query: const {'page_size': 200, 'sort': 'start'},
        builder: (context, data, _) {
          final tasks = listOf(data);
          return PageList(
            children: [
              PageHeader(title: 'Planning', subtitle: '${tasks.length} tâche(s) — touchez une ligne pour ouvrir la tâche.'),
              SectionCard(
                child: GanttChart(
                  tasks: [
                    for (final t in tasks)
                      GanttTask(
                        id: t.s('id'),
                        name: t.s('title'),
                        start: t.date('start_planned'),
                        end: t.date('end_planned'),
                        progress: t.d('progress_pct'),
                        status: t.s('status'),
                        milestone: t.b('is_milestone'),
                      ),
                  ],
                  onSelect: (g) => unawaited(context.push('$base/terrain/taches/${g.id}')),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
