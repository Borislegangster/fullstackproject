import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import '../field_state.dart';

/// Action rapide de l'accueil (visible selon les permissions).
class QuickAction {
  const QuickAction(this.label, this.icon, this.path, {this.anyPerms = const []});
  final String label;
  final IconData icon;
  final String path;
  final List<String> anyPerms;
}

const quickActions = <QuickAction>[
  QuickAction('Scanner un QR', Icons.qr_code_scanner, '$base/terrain/scanner'),
  QuickAction('Rapport vocal', Icons.mic_none, '$base/terrain/rapport-vocal', anyPerms: ['site:report']),
  QuickAction('Photo / vidéo', Icons.add_a_photo_outlined, '$base/terrain/photos', anyPerms: ['site:report']),
  QuickAction('Journal du jour', Icons.edit_note, '$base/terrain/journal', anyPerms: ['site:report']),
  QuickAction('Incident QHSE', Icons.report_gmailerrorred, '$base/qhse/incidents/nouveau', anyPerms: ['qhse:write', 'site:report']),
  QuickAction('Réception', Icons.local_shipping_outlined, '$base/livraisons', anyPerms: ['deliveries:receive']),
  QuickAction('Pointage', Icons.badge_outlined, '$base/terrain/pointage', anyPerms: ['attendance:self', 'hr:write', 'site:report']),
  QuickAction('Stock chantier', Icons.inventory_2_outlined, '$base/stocks', anyPerms: ['inventory:read', 'inventory:write']),
];

/// Accueil terrain : chantier courant, synchronisation, actions rapides, tâches du jour, journal, avancement.
class FieldHomeScreen extends StatelessWidget {
  const FieldHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    return WithSite(
      builder: (context, project) {
        final id = project.s('id');
        final actions = quickActions.where((a) => a.anyPerms.isEmpty || (user?.canAny(a.anyPerms) ?? false)).toList();
        return RefreshIndicator(
          onRefresh: () async {
            final projects = context.read<FieldProjects>();
            await context.read<OfflineQueue>().sync();
            await projects.load();
          },
          child: PageList(
            children: [
              PageHeader(
                eyebrow: project.s('code'),
                title: project.s('name'),
                subtitle: [if (project.has('city')) project.s('city'), optionLabel(project.s('status'))].join(' · '),
              ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text('Avancement du chantier', style: TextStyle(fontWeight: FontWeight.w600)),
                          ),
                          Text(
                            '${number(project['progress_pct'] ?? 0)}$nbsp%',
                            style: const TextStyle(fontWeight: FontWeight.w800, color: GlobusTokens.brand700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      GProgress(value: project.d('progress_pct'), tone: Tone.accent),
                      if (project.has('end_planned'))
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text('Fin prévue le ${date(project['end_planned'])}', style: Theme.of(context).textTheme.bodySmall),
                        ),
                    ],
                  ),
                ),
              ),
              const SyncCard(),
              GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 0.82,
                children: [
                  for (final a in actions)
                    Material(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => context.push(a.path),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: GlobusTokens.brand50, borderRadius: BorderRadius.circular(14)),
                                child: Icon(a.icon, color: GlobusColors.primary),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                a.label,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (user?.can('planning:read') ?? false)
                SectionCard(
                  title: 'Mes tâches',
                  trailing: TextButton(onPressed: () => context.go('$base/terrain/taches'), child: const Text('Toutes')),
                  padding: EdgeInsets.zero,
                  child: ApiView(
                    path: '/projects/$id/tasks',
                    query: const {'mine': true, 'page_size': 50},
                    refreshable: false,
                    loading: const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
                    builder: (context, data, _) {
                      final today = isoDate(DateTime.now());
                      final tasks = listOf(data).where((t) => !const ['done', 'cancelled'].contains(t.s('status'))).toList()
                        ..sort((a, b) => (a.str('end_planned') ?? '9999').compareTo(b.str('end_planned') ?? '9999'));
                      if (tasks.isEmpty) return const ListTile(title: Text('Aucune tâche en cours qui vous est affectée.'));
                      return Column(
                        children: [
                          for (final t in tasks.take(6))
                            ListTile(
                              onTap: () => context.push('$base/terrain/taches/${t.s('id')}'),
                              title: Text(t.s('title'), maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Text(
                                '${t.has('end_planned') ? 'Fin ${date(t['end_planned'])}' : 'Sans échéance'} · ${number(t['progress_pct'])}$nbsp%${t.has('end_planned') && t.s('end_planned').compareTo(today) < 0 ? ' · en retard' : ''}',
                                style: TextStyle(color: t.has('end_planned') && t.s('end_planned').compareTo(today) < 0 ? GlobusColors.danger : null),
                              ),
                              trailing: SizedBox(width: 60, child: GProgress(value: t.d('progress_pct'), height: 6)),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              if (user?.can('projects:read') ?? false)
                SectionCard(
                  title: 'Indicateurs du chantier',
                  child: ApiView(
                    path: '/projects/$id/kpis',
                    refreshable: false,
                    loading: const LinearProgressIndicator(),
                    builder: (context, data, _) {
                      final k = J.of(data);
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          StatGrid(
                            children: [
                              StatTile(label: 'Tâches en retard', value: '${k.i('tasks_late')}', tone: k.i('tasks_late') > 0 ? Tone.danger : Tone.success),
                              StatTile(label: 'Tâches planifiées', value: '${k.i('tasks_total')}'),
                              StatTile(
                                label: 'Incidents ouverts',
                                value: '${k.i('incidents_open')}',
                                tone: k.i('incidents_open') > 0 ? Tone.warning : Tone.neutral,
                              ),
                              StatTile(label: 'Santé du projet', value: optionLabel(k.str('health')), tone: statusTone(k.str('health'))),
                            ],
                          ),
                          if (k.list('next_milestones').isNotEmpty) ...[
                            const GroupTitle('Prochains jalons'),
                            for (final m in k.list('next_milestones'))
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Row(
                                  children: [
                                    const Icon(Icons.flag_outlined, size: 18, color: GlobusColors.accent),
                                    const SizedBox(width: 8),
                                    Expanded(child: Text(m.s('name'))),
                                    Text(date(m['due_date']), style: Theme.of(context).textTheme.bodySmall),
                                  ],
                                ),
                              ),
                          ],
                        ],
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// État de la synchronisation hors ligne (opérations en attente, conflits, dernière synchronisation).
class SyncCard extends StatelessWidget {
  const SyncCard({super.key});

  @override
  Widget build(BuildContext context) {
    final queue = context.watch<OfflineQueue>();
    final issues = queue.conflictCount + queue.rejectedCount;
    final tone = issues > 0 ? Tone.danger : (queue.pendingCount > 0 ? Tone.warning : Tone.success);
    return Card(
      child: ListTile(
        onTap: () => context.push('$base/terrain/synchronisation'),
        leading: Icon(
          issues > 0 ? Icons.sync_problem : (queue.pendingCount > 0 ? Icons.cloud_upload_outlined : Icons.cloud_done_outlined),
          color: GlobusColors.tone(tone),
        ),
        title: Text(
          issues > 0
              ? '$issues opération(s) à vérifier'
              : (queue.pendingCount > 0 ? '${queue.pendingCount} opération(s) en attente d\'envoi' : 'Tout est synchronisé'),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(queue.lastSync == null ? 'Aucune synchronisation sur cet appareil' : 'Dernière synchronisation ${relative(queue.lastSync!.toUtc())}'),
        trailing: queue.syncing
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
            : IconButton(tooltip: 'Synchroniser', icon: const Icon(Icons.sync), onPressed: () => queue.sync()),
      ),
    );
  }
}
