import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import '../project.dart';

/// Tableau de bord : avancement, alertes, indice de confiance, finances, jalons, décisions, résumé hebdomadaire,
/// dernières images (§6 Dashboard).
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/dashboard',
        refreshOn: const ['notification'],
        builder: (context, data, _) {
          final d = J.of(data);
          final p = d.obj('project');
          final f = d.obj('finance');
          final currency = cur(f);
          final media = d.list('recent_media');
          final decisions = d.list('pending_decisions');
          final digest = d.objOrNull('digest');
          final theme = Theme.of(context);
          return PageList(
            children: [
              PageHeader(
                eyebrow: p.s('code'),
                title: p.s('name'),
                subtitle: [
                  if (p.has('city')) p.s('city'),
                  if (p.has('start_planned')) 'du ${date(p['start_planned'])} au ${date(p['end_planned'])}',
                ].join(' · '),
              ),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  StatusBadge(p.s('status'), label: optionLabel(p.s('status'))),
                  if (p.has('health')) StatusBadge(p.s('health')),
                ],
              ),
              for (final a in d.list('alerts'))
                AlertBox(
                  tone: const ['payment_overdue', 'milestone_late'].contains(a.s('kind')) ? Tone.warning : Tone.info,
                  message: a.s('message'),
                ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Avancement global', style: theme.textTheme.bodySmall),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${number(p['progress_pct'] ?? 0)} %',
                            style: theme.textTheme.displaySmall?.copyWith(color: GlobusTokens.brand700, fontWeight: FontWeight.w800),
                          ),
                          const Spacer(),
                          Text('Livraison prévue\n${date(p['end_planned'])}', textAlign: TextAlign.right, style: theme.textTheme.bodySmall),
                        ],
                      ),
                      const SizedBox(height: 10),
                      GProgress(value: p.d('progress_pct'), tone: Tone.accent, height: 10),
                    ],
                  ),
                ),
              ),
              TrustCard(path: '/client/projects/${project.s('id')}/trust'),
              StatGrid(
                children: [
                  StatTile(
                    label: 'Montant du contrat (avenants non inclus)',
                    value: money(f['contract_amount'], currency),
                    icon: Icons.account_balance_wallet_outlined,
                    tone: Tone.info,
                  ),
                  StatTile(label: 'Avenants approuvés', value: money(f['approved_changes'], currency), hint: 'Facturés séparément du contrat'),
                  StatTile(label: 'Appelé', value: money(f['called'], currency), hint: 'Reste à appeler : ${money(f['remaining_to_call'], currency)}'),
                  StatTile(label: 'Payé', value: money(f['paid'], currency), tone: Tone.success),
                  StatTile(
                    label: 'À régler',
                    value: money(f['due'], currency),
                    tone: f.i('overdue_count') > 0 ? Tone.danger : Tone.warning,
                    hint: f.i('overdue_count') > 0 ? '${f.i('overdue_count')} en retard' : null,
                  ),
                ],
              ),
              SectionCard(
                title: 'Décisions à valider',
                trailing: decisions.isEmpty ? null : ToneBadge('${decisions.length}', tone: Tone.warning),
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (decisions.isEmpty) const ListTile(title: Text('Aucune décision en attente.')),
                    for (final dec in decisions)
                      ListTile(
                        title: Text(dec.s('title')),
                        subtitle: Text(
                          [
                            dec.has('due_date') ? 'Avant le ${date(dec['due_date'])}' : 'Sans échéance',
                            if (dec.d('price_impact') != 0) 'impact ${money(dec['price_impact'], currency)}',
                            if (dec.i('delay_impact_days') != 0) '${dec.i('delay_impact_days')} j',
                          ].join(' · '),
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/espace-client/validations'),
                      ),
                    if (decisions.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: FilledButton.icon(
                          onPressed: () => context.push('/espace-client/validations'),
                          icon: const Icon(Icons.fact_check_outlined),
                          label: const Text('Valider'),
                        ),
                      ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Jalons',
                trailing: TextButton(onPressed: () => context.push('/espace-client/planning'), child: const Text('Planning complet')),
                child: MilestoneTimeline(items: d.list('milestones')),
              ),
              if (digest != null)
                SectionCard(
                  title: 'Résumé de la semaine',
                  subtitle: 'Du ${date(digest['period_start'])} au ${date(digest['period_end'])}',
                  child: Text(digest.s('summary')),
                ),
              SectionCard(
                title: 'Dernières images du chantier',
                trailing: TextButton(onPressed: () => context.go('/espace-client/chantier'), child: const Text('Tout voir')),
                child: media.isEmpty
                    ? const FootNote('Les photos publiées par votre chef de projet apparaîtront ici.', icon: Icons.photo_camera_outlined)
                    : GridView.count(
                        crossAxisCount: 3,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        children: [
                          for (final (i, m) in media.indexed)
                            MediaThumb(
                              url: m.s('url'),
                              isVideo: m.s('type') == 'video',
                              caption: m.str('caption') ?? date(m['taken_at']),
                              onTap: () => GalleryScreen.open(
                                context,
                                [
                                  for (final x in media)
                                    GalleryItem(url: x.s('url'), isVideo: x.s('type') == 'video', caption: x.str('caption'), subtitle: date(x['taken_at'])),
                                ],
                                i,
                              ),
                            ),
                        ],
                      ),
              ),
              const FootNote('Données publiées par GLOBUS ENGINEERING pour votre projet.', icon: Icons.event_available),
            ],
          );
        },
      ),
    );
  }
}
