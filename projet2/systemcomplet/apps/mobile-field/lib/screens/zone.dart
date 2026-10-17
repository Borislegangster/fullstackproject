import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import '../field_state.dart';
import 'media.dart';
import 'tasks.dart';

/// QR spatial (§14.2) : zone / pièce → plans autorisés, tâches de la zone, check-lists, photos avant / après,
/// issues BIM ouvertes ; le scan est journalisé.
class ZoneScreen extends StatefulWidget {
  const ZoneScreen({super.key, this.code, this.zoneId});
  final String? code;
  final String? zoneId;
  @override
  State<ZoneScreen> createState() => _ZoneScreenState();
}

class _ZoneScreenState extends State<ZoneScreen> {
  J? _data;
  Object? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      if (widget.code != null) {
        final position = await currentPosition(context);
        if (!mounted) return;
        final res = await context.api.post(
          '/bim/zones/scan',
          body: {
            'code': widget.code,
            'latitude': position?.latitude,
            'longitude': position?.longitude,
            'application': 'mobile-field',
          },
        );
        setState(() => _data = J.of(res));
      } else {
        final projectId = context.read<FieldProjects>().projectId;
        final zones = listOf(await context.api.get('/projects/$projectId/bim/zones'));
        final zone = zones.where((z) => z.s('id') == widget.zoneId).firstOrNull;
        if (zone == null) throw ApiException(404, 'NOT_FOUND', 'Zone introuvable');
        setState(() => _data = J({'zone': zone.raw, 'open_issues': <Object>[], 'viewpoints': <Object>[]}));
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_data == null) return _error != null ? ErrorView(error: _error, onRetry: _load) : const LoadingView();
    final zone = _data!.obj('zone');
    final projectId = zone.s('project_id');
    final issues = _data!.list('open_issues');
    return PageList(
      children: [
        PageHeader(
          eyebrow: zone.s('code'),
          title: zone.s('name'),
          subtitle: [
            if (zone.has('level')) 'Niveau ${zone.s('level')}',
            if (zone.has('discipline')) optionLabel(zone.s('discipline')),
            if (zone.has('zone_type')) optionLabel(zone.s('zone_type')),
            if (zone.has('area_m2')) '${number(zone['area_m2'], 1)} m²',
          ].join(' · '),
        ),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () =>
                    EmbeddedViewerScreen.open(context, title: 'Plans et maquette — ${zone.s('name')}', path: '/embarque/maquette/$projectId?source=erp'),
                icon: const Icon(Icons.view_in_ar),
                label: const Text('Maquette 3D'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => context.push('$base/terrain/plans'),
                icon: const Icon(Icons.map_outlined),
                label: const Text('Plans'),
              ),
            ),
          ],
        ),
        if (zone.list('checklist').isNotEmpty)
          SectionCard(
            title: 'Check-list de la zone',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final item in zone.list('checklist'))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Icon(item.b('done') ? Icons.check_box : Icons.check_box_outline_blank, size: 20, color: item.b('done') ? GlobusColors.success : null),
                        const SizedBox(width: 8),
                        Expanded(child: Text(item.str('label') ?? item.str('title') ?? item.s('text'))),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        SectionCard(
          title: 'Photos avant / après',
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextButton(
                onPressed: () => captureSiteMedia(context, projectId: projectId, zoneId: zone.s('id'), stage: 'before', label: zone.s('name')),
                child: const Text('Avant'),
              ),
              TextButton(
                onPressed: () => captureSiteMedia(context, projectId: projectId, zoneId: zone.s('id'), stage: 'after', label: zone.s('name')),
                child: const Text('Après'),
              ),
            ],
          ),
          child: SiteMediaStrip(projectId: projectId, zoneId: zone.s('id')),
        ),
        SectionCard(
          title: 'Tâches de la zone',
          padding: EdgeInsets.zero,
          child: ApiView(
            path: '/projects/$projectId/tasks',
            query: {'zone_id': zone.s('id'), 'page_size': 50},
            refreshable: false,
            loading: const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
            builder: (context, data, _) {
              final tasks = listOf(data);
              if (tasks.isEmpty) return const ListTile(title: Text('Aucune tâche rattachée à cette zone.'));
              return Column(children: [for (final t in tasks) TaskTile(task: t)]);
            },
          ),
        ),
        SectionCard(
          title: 'Issues BIM ouvertes',
          trailing: issues.isEmpty ? null : ToneBadge('${issues.length}', tone: Tone.warning),
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              if (issues.isEmpty) const ListTile(title: Text('Aucune issue ouverte dans cette zone.')),
              for (final i in issues)
                ListTile(
                  leading: Icon(
                    Icons.report_problem_outlined,
                    color: GlobusColors.tone(statusTone(i.s('priority')) == Tone.neutral ? Tone.warning : statusTone(i.s('priority'))),
                  ),
                  title: Text(i.s('title')),
                  subtitle: Text('${i.s('number')} · ${optionLabel(i.s('discipline'))} · ${optionLabel(i.s('priority'))}'),
                  trailing: StatusBadge(i.s('status')),
                  onTap: () => context.push('$base/hub/issues/${i.s('id')}'),
                ),
            ],
          ),
        ),
        if (_data!.list('viewpoints').isNotEmpty)
          SectionCard(
            title: 'Points de vue enregistrés',
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final v in _data!.list('viewpoints'))
                  ListTile(leading: const Icon(Icons.camera_alt_outlined), title: Text(v.s('name')), subtitle: Text(dateTime(v['created_at']))),
              ],
            ),
          ),
      ],
    );
  }
}

const _issueTransitions = <String, List<String>>{
  'open': ['in_progress', 'resolved'],
  'in_progress': ['resolved'],
  'resolved': ['closed', 'reopened'],
  'closed': ['reopened'],
  'reopened': ['in_progress', 'resolved'],
};

/// Issue BIM : description, assignation, statut, commentaires (coordination terrain ↔ bureau d'études).
class IssueScreen extends StatelessWidget {
  const IssueScreen({super.key, required this.issueId});
  final String issueId;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/bim/issues/$issueId',
      builder: (context, data, handle) {
        final i = J.of(data);
        final transitions = _issueTransitions[i.s('status')] ?? const <String>[];
        return PageList(
          children: [
            PageHeader(eyebrow: i.s('number'), title: i.s('title'), subtitle: i.str('description')),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                StatusBadge(i.s('status')),
                ToneBadge(optionLabel(i.s('priority')), tone: const ['high', 'critical'].contains(i.s('priority')) ? Tone.danger : Tone.neutral),
                if (i.has('discipline')) ToneBadge(optionLabel(i.s('discipline'))),
              ],
            ),
            SectionCard(
              child: Column(
                children: [
                  InfoRow('Échéance', date(i['due_date'])),
                  InfoRow('Créée le', dateTime(i['created_at'])),
                ],
              ),
            ),
            if (transitions.isNotEmpty)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final t in transitions)
                    OutlinedButton(
                      onPressed: () async {
                        final note = await promptText(context, title: optionLabel(t), label: 'Commentaire (facultatif)', confirm: 'Confirmer');
                        if (note == null || !context.mounted) return;
                        final res = await runAction(
                          context,
                          () => context.api.post('/bim/issues/$issueId/transition', body: {'target': t, 'note': note.isEmpty ? null : note}),
                        );
                        if (res != null) await handle.reload();
                      },
                      child: Text(optionLabel(t)),
                    ),
                ],
              ),
            SectionCard(
              title: 'Commentaires',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final c in i.list('comments'))
                    ListTile(contentPadding: EdgeInsets.zero, title: Text(c.s('body')), subtitle: Text(dateTime(c['created_at']))),
                  if (i.list('comments').isEmpty) Text('Aucun commentaire.', style: Theme.of(context).textTheme.bodySmall),
                  TextButton.icon(
                    onPressed: () async {
                      final body = await promptText(context, title: 'Commenter', label: 'Commentaire', required: true, confirm: 'Envoyer');
                      if (body == null || !context.mounted) return;
                      final res = await runAction(context, () => context.api.post('/bim/issues/$issueId/comments', body: {'body': body}));
                      if (res != null) await handle.reload();
                    },
                    icon: const Icon(Icons.add_comment_outlined),
                    label: const Text('Commenter'),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Issues BIM du chantier : les miennes par défaut, filtre par statut.
class IssuesScreen extends StatefulWidget {
  const IssuesScreen({super.key});
  @override
  State<IssuesScreen> createState() => _IssuesScreenState();
}

class _IssuesScreenState extends State<IssuesScreen> {
  bool _mine = true;
  String? _status;

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                FilterChip(label: const Text('Qui me sont assignées'), selected: _mine, onSelected: (v) => setState(() => _mine = v)),
                const SizedBox(width: 6),
                for (final s in const [(null, 'Tous statuts'), ('open', 'Ouvertes'), ('in_progress', 'En cours'), ('resolved', 'Résolues')])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(label: Text(s.$2), selected: _status == s.$1, onSelected: (_) => setState(() => _status = s.$1)),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ApiView(
              path: '/projects/${project.s('id')}/bim/issues',
              query: {'mine': _mine, 'status': _status},
              refreshOn: const ['notification'],
              builder: (context, data, _) {
                final issues = listOf(data);
                if (issues.isEmpty) return const EmptyView(icon: Icons.report_problem_outlined, title: 'Aucune issue BIM');
                return ListView.separated(
                  itemCount: issues.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, n) {
                    final i = issues[n];
                    return ListTile(
                      leading: Icon(
                        Icons.report_problem_outlined,
                        color: GlobusColors.tone(statusTone(i.s('priority')) == Tone.neutral ? Tone.warning : statusTone(i.s('priority'))),
                      ),
                      title: Text(i.s('title')),
                      subtitle: Text([i.s('number'), optionLabel(i.s('discipline')), if (i.has('due_date')) 'échéance ${date(i['due_date'])}'].join(' · ')),
                      trailing: StatusBadge(i.s('status')),
                      onTap: () => context.push('$base/hub/issues/${i.s('id')}'),
                    );
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
