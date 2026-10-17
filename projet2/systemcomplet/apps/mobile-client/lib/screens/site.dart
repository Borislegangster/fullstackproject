import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

import '../project.dart';

/// Suivi du chantier : avancement, jumeau numérique, time-lapse, journal visuel par date (filtre par étape),
/// jalons, incidents communiqués.
class SiteScreen extends StatefulWidget {
  const SiteScreen({super.key});
  @override
  State<SiteScreen> createState() => _SiteScreenState();
}

class _SiteScreenState extends State<SiteScreen> {
  String? _stage;

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final id = project.s('id');
        return ApiView(
          path: '/client/projects/$id/timeline',
          builder: (context, data, _) {
            final d = J.of(data);
            final all = d.list('media');
            final media = all.where((m) => _stage == null || m.str('stage') == _stage).toList();
            final stages = {
              for (final m in all)
                if (m.has('stage')) m.s('stage'),
            }.toList();
            final groups = <String, List<J>>{};
            for (final m in media) {
              final key = m.has('taken_at') ? m.s('taken_at').substring(0, 10) : 'sans-date';
              (groups[key] ??= []).add(m);
            }
            final gallery = [
              for (final m in media)
                GalleryItem(
                  url: m.s('url'),
                  isVideo: m.s('type') == 'video',
                  caption: m.str('caption') ?? optionLabel(m.str('stage')),
                  subtitle: dateTime(m['taken_at']),
                ),
            ];
            final theme = Theme.of(context);
            return PageList(
              children: [
                const PageHeader(title: 'Suivi du chantier', subtitle: 'Photos et vidéos datées publiées par votre équipe projet.'),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text('Avancement des travaux', style: TextStyle(fontWeight: FontWeight.w600)),
                            ),
                            Text(
                              '${number(d['progress_pct'] ?? 0)} %',
                              style: const TextStyle(fontWeight: FontWeight.w800, color: GlobusTokens.brand700),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        GProgress(value: d.d('progress_pct'), tone: Tone.accent),
                      ],
                    ),
                  ),
                ),
                ClientTwinCard(projectId: id, onProof: (code) => openExternal(context, '${context.config.origin}/verification/$code')),
                TimelapseGallery(path: '/client/projects/$id/timelapses', emptyText: 'Chaque lundi, la semaine écoulée de votre chantier en une courte vidéo.'),
                Row(
                  children: [
                    Expanded(child: Text('Journal visuel', style: theme.textTheme.titleMedium)),
                    if (stages.isNotEmpty)
                      ActionChip(
                        avatar: const Icon(Icons.filter_list, size: 18),
                        label: Text(_stage == null ? 'Toutes les étapes' : optionLabel(_stage)),
                        onPressed: () async {
                          final v = await pickOption<String>(
                            context,
                            title: 'Étape',
                            selected: _stage ?? '',
                            options: [('', 'Toutes les étapes'), for (final s in stages) (s, optionLabel(s))],
                          );
                          if (v != null) setState(() => _stage = v.isEmpty ? null : v);
                        },
                      ),
                  ],
                ),
                if (groups.isEmpty)
                  const EmptyView(
                    icon: Icons.photo_camera_outlined,
                    title: 'Aucune image publiée',
                    text: 'Les photos et vidéos validées par votre chef de projet apparaîtront ici.',
                  ),
                for (final entry in groups.entries)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          entry.key == 'sans-date' ? 'Date non renseignée' : dateLong(entry.key),
                          style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      GridView.count(
                        crossAxisCount: 3,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 6,
                        crossAxisSpacing: 6,
                        childAspectRatio: 4 / 3,
                        children: [
                          for (final m in entry.value)
                            MediaThumb(
                              url: m.s('url'),
                              isVideo: m.s('type') == 'video',
                              caption: m.str('caption') ?? optionLabel(m.str('stage')),
                              onTap: () => GalleryScreen.open(context, gallery, media.indexOf(m)),
                            ),
                        ],
                      ),
                    ],
                  ),
                SectionCard(
                  title: 'Jalons',
                  child: MilestoneTimeline(items: d.list('milestones')),
                ),
                SectionCard(
                  title: 'Incidents communiqués',
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      if (d.list('incidents').isEmpty) const ListTile(title: Text('Aucun incident communiqué.')),
                      for (final i in d.list('incidents'))
                        ListTile(
                          leading: const Icon(Icons.report_outlined, color: GlobusColors.warning),
                          title: Text(i.s('summary')),
                          subtitle: Text(dateTime(i['date'])),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

/// Planning : Gantt des travaux et jalons, réunions et rendez-vous (à venir puis passés).
class PlanningScreen extends StatelessWidget {
  const PlanningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/planning',
        builder: (context, data, _) {
          final d = J.of(data);
          final now = DateTime.now().toUtc().toIso8601String();
          final meetings = d.list('meetings');
          final upcoming = meetings.where((m) => m.s('starts_at').compareTo(now) >= 0).toList();
          final past = meetings.where((m) => m.s('starts_at').compareTo(now) < 0).toList().reversed.toList();
          final tasks = [
            for (final t in d.list('tasks')) ganttTaskFrom(t),
            for (final m in d.list('milestones'))
              GanttTask(
                id: 'm-${m.s('id')}',
                name: m.s('name'),
                start: m.date('due_date'),
                end: m.date('due_date'),
                milestone: true,
                status: m.s('status'),
                progress: m.has('achieved_at') ? 100 : 0,
              ),
          ];
          return PageList(
            children: [
              const PageHeader(title: 'Planning', subtitle: 'Calendrier des travaux, jalons et rendez-vous de votre projet.'),
              SectionCard(
                title: 'Calendrier des travaux',
                child: GanttChart(tasks: tasks),
              ),
              SectionCard(
                title: 'Jalons',
                child: MilestoneTimeline(items: d.list('milestones')),
              ),
              SectionCard(
                title: 'Réunions et rendez-vous',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (meetings.isEmpty) const ListTile(title: Text('Aucun rendez-vous planifié.')),
                    for (final m in [...upcoming, ...past])
                      Opacity(
                        opacity: m.s('starts_at').compareTo(now) < 0 ? 0.6 : 1,
                        child: ListTile(
                          leading: const Icon(Icons.event, color: GlobusColors.primary),
                          title: Text(m.s('title')),
                          subtitle: Text([dateTime(m['starts_at']), optionLabel(m.s('kind')), if (m.has('location')) m.s('location')].join(' · ')),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
