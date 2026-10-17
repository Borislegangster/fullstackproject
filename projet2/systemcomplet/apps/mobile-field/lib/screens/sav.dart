import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import '../app.dart';
import '../field_state.dart';

/// Interventions SAV et entretien : tickets qui me sont affectés (diagnostic, photos avant / après, clôture
/// avec preuves), tickets du chantier, tâches d'entretien programmées du bâtiment livré.
class SavScreen extends StatelessWidget {
  const SavScreen({super.key});

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
                Tab(text: 'Mes interventions'),
                Tab(text: 'Chantier'),
                Tab(text: 'Entretien'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  const _Tickets(query: {'mine': true}),
                  _Tickets(query: {'project_id': project.s('id')}),
                  _Maintenance(projectId: project.s('id')),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tickets extends StatefulWidget {
  const _Tickets({required this.query});
  final Map<String, dynamic> query;
  @override
  State<_Tickets> createState() => _TicketsState();
}

class _TicketsState extends State<_Tickets> {
  String? _status;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: [
              for (final s in const [
                (null, 'Tous'),
                ('open', 'Ouverts'),
                ('in_progress', 'En cours'),
                ('waiting_client', 'En attente client'),
                ('resolved', 'Résolus'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(label: Text(s.$2), selected: _status == s.$1, onSelected: (_) => setState(() => _status = s.$1)),
                ),
            ],
          ),
        ),
        Expanded(
          child: PagedListView(
            path: '/support/tickets',
            query: {...widget.query, 'status': _status},
            refreshOn: const ['notification'],
            empty: const EmptyView(icon: Icons.support_agent_outlined, title: 'Aucun ticket'),
            itemBuilder: (context, t, _) => ListTile(
              onTap: () => context.push('$base/sav/${t.s('id')}'),
              leading: Icon(
                t.b('sla_breached') ? Icons.alarm : Icons.build_circle_outlined,
                color: t.b('sla_breached') ? GlobusColors.danger : GlobusColors.primary,
              ),
              title: Text(t.s('subject')),
              subtitle: Text([t.s('number'), optionLabel(t.s('category')), if (t.has('due_at')) 'échéance ${dateTime(t['due_at'])}'].join(' · ')),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusBadge(t.s('status')),
                  if (t.has('priority')) Text(statusLabel(t.s('priority')), style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Maintenance extends StatelessWidget {
  const _Maintenance({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/projects/$projectId/maintenance-tasks',
      builder: (context, data, handle) {
        final rows = listOf(data).where((t) => t.s('status') == 'planned').toList();
        if (rows.isEmpty) {
          return const EmptyView(
            icon: Icons.event_repeat_outlined,
            title: 'Aucun entretien programmé',
            text: 'Le carnet d\'entretien du bâtiment livré planifie les visites périodiques.',
          );
        }
        return ListView.separated(
          itemCount: rows.length,
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, i) {
            final t = rows[i];
            return ListTile(
              leading: Icon(Icons.event_repeat_outlined, color: t.b('overdue') ? GlobusColors.danger : GlobusColors.primary),
              title: Text(t.s('title')),
              subtitle: Text(
                [
                  'prévu le ${date(t['due_on'])}${t.b('overdue') ? ' · en retard' : ''}',
                  if (t.i('recurrence_days') > 0) 'tous les ${t.i('recurrence_days')} jours',
                  if (t.has('instructions')) t.s('instructions'),
                ].join(' · '),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: context.can('projects:write')
                  ? TextButton(
                      onPressed: () async {
                        final note = await promptText(context, title: 'Entretien réalisé', message: t.s('title'), label: 'Compte rendu');
                        if (note == null || !context.mounted) return;
                        await runAction(
                          context,
                          () => context.api.post('/maintenance-tasks/${t.s('id')}/complete', body: {if (note.isNotEmpty) 'note': note}),
                          success: 'Entretien enregistré : prochaine échéance programmée',
                        );
                        await handle.reload();
                      },
                      child: const Text('Fait'),
                    )
                  : null,
            );
          },
        );
      },
    );
  }
}
