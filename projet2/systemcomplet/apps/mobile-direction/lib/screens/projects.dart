import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import 'modules.dart';

const _health = [('on_track', 'Dans les temps'), ('at_risk', 'À surveiller'), ('critical', 'Critique')];

/// Portefeuille de chantiers : santé, avancement, filtres ; fiche synthétique pour la direction.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});
  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  String? _health0;
  String? _status = 'execution';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: TextField(
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Code, nom, ville', isDense: true),
            onSubmitted: (v) => setState(() => _q = v.trim()),
          ),
        ),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            children: [
              for (final s in const [
                ('execution', 'En exécution'),
                ('preparation', 'Préparation'),
                ('reception', 'Réception'),
                ('garantie', 'Garantie'),
                (null, 'Tous'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(label: Text(s.$2), selected: _status == s.$1, onSelected: (_) => setState(() => _status = s.$1)),
                ),
              const VerticalDivider(),
              for (final h in _health)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(label: Text(h.$2), selected: _health0 == h.$1, onSelected: (v) => setState(() => _health0 = v ? h.$1 : null)),
                ),
            ],
          ),
        ),
        Expanded(
          child: PagedListView(
            path: '/projects',
            query: {'status': _status, 'health': _health0, 'q': _q, 'sort': 'name'},
            empty: const EmptyView(icon: Icons.engineering_outlined, title: 'Aucun chantier'),
            itemBuilder: (context, p, _) => ListTile(
              onTap: () => context.push('$base/chantiers/${p.s('id')}'),
              leading: CircleAvatar(
                backgroundColor: GlobusColors.toneSoft(statusTone(p.str('health'))),
                child: Icon(Icons.engineering_outlined, color: GlobusColors.tone(statusTone(p.str('health')))),
              ),
              title: Text('${p.s('code')} — ${p.s('name')}', maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text([if (p.has('city')) p.s('city'), statusLabel(p.s('status')), if (p.has('end_planned')) 'fin ${date(p['end_planned'])}'].join(' · ')),
                  const SizedBox(height: 4),
                  GProgress(value: p.d('progress_pct'), tone: statusTone(p.str('health')) == Tone.neutral ? Tone.info : statusTone(p.str('health')), height: 5),
                ],
              ),
              trailing: Text('${number(p['progress_pct'])}$nbsp%', style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ),
      ],
    );
  }
}

/// Fiche chantier direction : indicateurs (budget, engagé, dépensé, marge), indice de confiance, synthèse IA,
/// planning, jalons, décisions client, incidents, photos récentes.
class ProjectScreen extends StatelessWidget {
  const ProjectScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    return ApiView(
      path: '/projects/$id',
      builder: (context, data, _) {
        final p = J.of(data);
        return DefaultTabController(
          length: 4,
          child: Column(
            children: [
              ListTile(
                title: Text('${p.s('code')} — ${p.s('name')}', style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text([if (p.has('city')) p.s('city'), statusLabel(p.s('status')), if (p.has('health')) optionLabel(p.s('health'))].join(' · ')),
                trailing: Text(
                  '${number(p['progress_pct'])}$nbsp%',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: GlobusTokens.brand700),
                ),
              ),
              const TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: [
                  Tab(text: 'Synthèse'),
                  Tab(text: 'Planning'),
                  Tab(text: 'Décisions'),
                  Tab(text: 'Terrain'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _Summary(project: p, canAi: user?.can('ai:use') ?? false, canFinance: user?.can('finance:read') ?? false),
                    _Planning(projectId: id),
                    ResourceListScreen(
                      config: ResourceConfig(
                        title: 'Décisions',
                        path: '/decisions',
                        query: {'project_id': id},
                        icon: Icons.how_to_vote_outlined,
                        itemTitle: (r) => r.s('title'),
                        itemSubtitle: (r) => [
                          if (r.has('due_date')) 'échéance ${date(r['due_date'])}',
                          if (toDouble(r['price_impact']) != 0) money(r['price_impact']),
                        ].join(' · '),
                        emptyText: 'Aucune décision',
                      ),
                    ),
                    _Field(projectId: id),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.project, required this.canAi, required this.canFinance});
  final J project;
  final bool canAi;
  final bool canFinance;

  @override
  Widget build(BuildContext context) {
    final id = project.s('id');
    return ApiView(
      path: '/projects/$id/kpis',
      builder: (context, data, _) {
        final k = J.of(data);
        return PageList(
          children: [
            StatGrid(
              children: [
                StatTile(
                  label: 'Tâches en retard',
                  value: '${k.i('tasks_late')} / ${k.i('tasks_total')}',
                  tone: k.i('tasks_late') > 0 ? Tone.danger : Tone.success,
                  icon: Icons.task_alt,
                ),
                StatTile(
                  label: 'Incidents ouverts',
                  value: '${k.i('incidents_open')}',
                  tone: k.i('incidents_open') > 0 ? Tone.warning : Tone.neutral,
                  icon: Icons.health_and_safety_outlined,
                ),
                if (canFinance) ...[
                  StatTile(label: 'Contrat (avenants non inclus)', value: money(k['contract_amount']), icon: Icons.handshake_outlined),
                  StatTile(label: 'Avenants approuvés', value: money(k['approved_changes']), hint: 'Total : ${money(k['total_with_changes'])}'),
                  StatTile(
                    label: 'Marge brute prévue',
                    value: k.has('gross_margin_pct') ? percent(k['gross_margin_pct'], 1) : '—',
                    hint: money(k['gross_margin']),
                    tone: toDouble(k['gross_margin_pct']) < 10 ? Tone.danger : Tone.success,
                  ),
                ],
              ],
            ),
            if (canFinance)
              SectionCard(
                title: 'Budget',
                subtitle: k.has('budget_version') ? 'Version ${k.s('budget_version')}' : null,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    InfoRow('Budget', money(k['budget'])),
                    InfoRow('Engagé', money(k['committed'])),
                    InfoRow('Dépensé', money(k['spent'])),
                    InfoRow('Reste à engager', money(k['remaining_to_commit'])),
                    InfoRow('Facturé au client', money(k['invoiced'])),
                    InfoRow('Encaissé', money(k['collected'])),
                    if (toDouble(k['funds_calls_due']) > 0) InfoRow('Appels de fonds dus', money(k['funds_calls_due'])),
                    const SizedBox(height: 8),
                    Text('Consommation du budget : ${percent(k['budget_consumption_pct'], 1)}', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 4),
                    GProgress(
                      value: toDouble(k['budget_consumption_pct']),
                      tone: toDouble(k['budget_consumption_pct']) > toDouble(k['progress_pct']) + 10 ? Tone.danger : Tone.info,
                    ),
                  ],
                ),
              ),
            TrustCard(path: '/projects/$id/trust', internal: true),
            if (k.list('next_milestones').isNotEmpty)
              SectionCard(
                title: 'Prochains jalons',
                child: Column(children: [for (final m in k.list('next_milestones')) InfoRow(m.s('name'), date(m['due_date']))]),
              ),
            if (canAi) _AiSummary(projectId: id),
          ],
        );
      },
    );
  }
}

/// Synthèse rédigée par l'IA (semaine écoulée) — à relire avant toute diffusion.
class _AiSummary extends StatefulWidget {
  const _AiSummary({required this.projectId});
  final String projectId;
  @override
  State<_AiSummary> createState() => _AiSummaryState();
}

class _AiSummaryState extends State<_AiSummary> {
  String? _text;
  bool _busy = false;

  Future<void> _generate() async {
    setState(() => _busy = true);
    final res = await runAction(context, () => context.api.post('/ai/projects/${widget.projectId}/summary', body: {'audience': 'direction'}));
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (res != null) _text = J.of(res).s('text');
    });
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Synthèse de la semaine (IA)',
      icon: Icons.auto_awesome_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_text != null) ...[Text(_text!), const SizedBox(height: 8), const FootNote('Texte proposé par l\'assistant : à vérifier avant toute diffusion.')],
          BusyButton(label: _text == null ? 'Rédiger la synthèse' : 'Régénérer', icon: Icons.auto_awesome, busy: _busy, onPressed: _generate),
        ],
      ),
    );
  }
}

class _Planning extends StatelessWidget {
  const _Planning({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/projects/$projectId/tasks',
      query: const {'page_size': 200},
      builder: (context, data, _) {
        final tasks = listOf(data);
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            SectionCard(
              title: 'Planning',
              padding: const EdgeInsets.all(8),
              child: SizedBox(
                height: 420,
                child: GanttChart(tasks: [for (final t in tasks) ganttTaskFrom(t, nameKey: 'title')]),
              ),
            ),
            for (final t in tasks.where(
              (t) => t.has('end_planned') && t.s('end_planned').compareTo(isoDate(DateTime.now())) < 0 && toDouble(t['progress_pct']) < 100,
            ))
              ListTile(
                dense: true,
                leading: const Icon(Icons.warning_amber_rounded, color: GlobusColors.danger),
                title: Text(t.s('title')),
                subtitle: Text('prévue le ${date(t['end_planned'])} · ${number(t['progress_pct'])}$nbsp%'),
              ),
          ],
        );
      },
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        ApiView(
          path: '/projects/$projectId/media',
          query: const {'page_size': 12},
          refreshable: false,
          loading: const LinearProgressIndicator(),
          builder: (context, data, _) {
            final media = listOf(data);
            final items = [for (final m in media) GalleryItem(url: m.obj('file').s('url'), caption: m.str('caption'), isVideo: m.s('kind') == 'video')];
            return SectionCard(
              title: 'Photos récentes',
              child: items.isEmpty
                  ? const Text('Aucune photo.')
                  : GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 6,
                      crossAxisSpacing: 6,
                      children: [
                        for (final (i, it) in items.indexed) MediaThumb(url: it.url, isVideo: it.isVideo, onTap: () => GalleryScreen.open(context, items, i)),
                      ],
                    ),
            );
          },
        ),
        const SizedBox(height: 12),
        // Incidents du chantier : liste simple dans la page (pas de liste défilante imbriquée).
        ApiView(
          path: '/qhse/incidents',
          query: {'project_id': projectId, 'page_size': 10},
          refreshable: false,
          loading: const SizedBox.shrink(),
          builder: (context, data, _) {
            final rows = listOf(data);
            return SectionCard(
              title: 'Incidents QHSE',
              padding: EdgeInsets.zero,
              child: rows.isEmpty
                  ? const Padding(padding: EdgeInsets.all(16), child: Text('Aucun incident déclaré.'))
                  : Column(
                      children: [
                        for (final r in rows)
                          ListTile(
                            leading: Icon(incidents.icon, color: GlobusColors.primary),
                            title: Text(incidents.itemTitle(r), maxLines: 2, overflow: TextOverflow.ellipsis),
                            subtitle: (incidents.itemSubtitle?.call(r) ?? '').isEmpty ? null : Text(incidents.itemSubtitle!(r)!),
                            trailing: r.has('status') ? StatusBadge(r.s('status')) : null,
                            onTap: () => openResource(context, incidents, r),
                          ),
                      ],
                    ),
            );
          },
        ),
      ],
    );
  }
}
