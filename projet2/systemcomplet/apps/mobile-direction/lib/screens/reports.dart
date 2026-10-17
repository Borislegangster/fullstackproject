import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

/// Rapports de direction hebdomadaires (A7) : synthèse rédigée (IA si configurée), points clés, risques, décisions
/// à prendre, perspectives ; PDF ; régénération d'une semaine écoulée.
class ExecutiveReportsScreen extends StatelessWidget {
  const ExecutiveReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/reports/executive',
      builder: (context, data, handle) {
        final rows = listOf(data);
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            heroTag: 'exec-generate',
            onPressed: () async {
              final ok = await confirmDialog(
                context,
                title: 'Générer le rapport',
                message: 'Rapport de la semaine écoulée (lundi → dimanche), recalculé avec les données actuelles.',
                confirm: 'Générer',
              );
              if (!ok || !context.mounted) return;
              await runAction(context, () => context.api.post('/reports/executive/generate'), success: 'Rapport généré');
              await handle.reload();
            },
            icon: const Icon(Icons.auto_awesome),
            label: const Text('Générer'),
          ),
          body: rows.isEmpty
              ? const EmptyView(icon: Icons.summarize_outlined, title: 'Aucun rapport', text: 'Le rapport est produit chaque lundi pour la semaine écoulée.')
              : ListView.separated(
                  padding: const EdgeInsets.only(bottom: 96),
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final r = rows[i];
                    return ListTile(
                      leading: Icon(r.b('ai_generated') ? Icons.auto_awesome_outlined : Icons.summarize_outlined, color: GlobusColors.primary),
                      title: Text('Semaine du ${date(r['period_start'])} au ${date(r['period_end'])}'),
                      subtitle: Text(r.s('headline'), maxLines: 2, overflow: TextOverflow.ellipsis),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () =>
                          Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(builder: (_) => ExecutiveReportScreen(id: r.s('id')))),
                    );
                  },
                ),
        );
      },
    );
  }
}

class ExecutiveReportScreen extends StatelessWidget {
  const ExecutiveReportScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rapport de direction')),
      body: ApiView(
        path: '/reports/executive/$id',
        builder: (context, data, _) {
          final r = J.of(data);
          final n = r.obj('narrative');
          final d = r.obj('data');
          final finance = d.obj('finance');
          final projects = d.obj('projects');
          final commercial = d.obj('commercial');
          final controls = d.obj('controls');
          final support = d.obj('support');
          List<Widget> bullets(String title, List<String> items, IconData icon, Color color) => [
            if (items.isNotEmpty)
              SectionCard(
                title: title,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final t in items)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(icon, size: 18, color: color),
                            const SizedBox(width: 8),
                            Expanded(child: Text(t)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
          ];
          return PageList(
            children: [
              PageHeader(
                eyebrow: r.s('number'),
                title: 'Semaine du ${date(r['period_start'])} au ${date(r['period_end'])}',
                subtitle: r.b('ai_generated') ? 'Synthèse rédigée par l\'assistant à partir des chiffres réels' : 'Synthèse chiffrée',
              ),
              if (n.has('headline') || r.has('headline')) AlertBox(tone: Tone.info, message: n.str('headline') ?? r.s('headline')),
              ...bullets('Points clés', n.strings('highlights'), Icons.check_circle_outline, GlobusColors.success),
              ...bullets('Risques', n.strings('risks'), Icons.warning_amber_rounded, GlobusColors.danger),
              ...bullets('Décisions à prendre', n.strings('decisions'), Icons.how_to_vote_outlined, GlobusColors.accent),
              if (n.has('outlook')) SectionCard(title: 'Perspectives', child: Text(n.s('outlook'))),
              if (finance.raw.isNotEmpty)
                SectionCard(
                  title: 'Finance',
                  child: Column(
                    children: [
                      InfoRow('Facturé', money(finance['invoiced'])),
                      InfoRow('Encaissé', money(finance['collected'])),
                      InfoRow('Décaissé', money(finance['paid_out'])),
                      InfoRow('Créances', money(finance['receivable'])),
                      InfoRow('dont en retard', money(finance['overdue'])),
                      InfoRow('Dettes fournisseurs', money(finance['payable'])),
                    ],
                  ),
                ),
              if (projects.raw.isNotEmpty)
                SectionCard(
                  title: 'Chantiers',
                  child: Column(
                    children: [
                      InfoRow('Actifs', '${projects.i('active')}'),
                      InfoRow('Avancement moyen', projects.has('avg_progress') ? '${number(projects['avg_progress'], 1)} %' : null),
                      InfoRow('Jalons en retard', '${projects.i('late_milestones')}'),
                      InfoRow('Indice de confiance moyen', projects.has('trust_average') ? '${number(projects['trust_average'], 1)} / 100' : null),
                      for (final t in projects.list('trust_lowest')) InfoRow('À surveiller', '${t.s('code')} — ${number(t['score'])} / 100'),
                    ],
                  ),
                ),
              if (commercial.raw.isNotEmpty)
                SectionCard(
                  title: 'Commercial',
                  child: Column(
                    children: [
                      InfoRow('Leads', '${commercial.i('leads')}'),
                      InfoRow('Devis envoyés', '${commercial.i('quotes_sent')}'),
                      InfoRow('Devis acceptés', '${commercial.i('quotes_accepted')}'),
                      InfoRow('Contrats signés', '${commercial.i('contracts_signed')} (${money(commercial['contracts_amount'])})'),
                    ],
                  ),
                ),
              if (controls.raw.isNotEmpty || support.raw.isNotEmpty)
                SectionCard(
                  title: 'Contrôles et SAV',
                  child: Column(
                    children: [
                      InfoRow('Incidents graves ouverts', '${controls.i('serious_incidents_open')}'),
                      for (final a in controls.list('open_serious'))
                        InfoRow(optionLabel(a.str('kind')), a.has('amount') ? money(a['amount']) : a.s('description')),
                      InfoRow('Tickets SAV ouverts', '${support.i('open')}'),
                      InfoRow('Hors délai', '${support.i('sla_breached')}'),
                    ],
                  ),
                ),
              if (r.b('has_pdf'))
                OutlinedButton.icon(
                  onPressed: () => openRemoteFile(context, '/reports/executive/$id/pdf'),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('Rapport PDF'),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Anomalies détectées par l'IA (doublons de factures, prix hors norme, paiements inhabituels, pointages atypiques) :
/// revue humaine obligatoire.
final anomalies = ResourceConfig(
  title: 'Anomalies',
  path: '/ai/anomalies',
  icon: Icons.policy_outlined,
  search: false,
  itemTitle: (r) => optionLabel(r.str('kind')),
  itemSubtitle: (r) => [r.s('description'), if (r.has('amount_at_risk')) 'en jeu ${money(r['amount_at_risk'])}'].join(' · '),
  itemBadge: (r) => r.str('status'),
  filters: [
    ResourceFilter('status', 'Statut', [
      for (final s in const ['new', 'confirmed', 'dismissed', 'resolved']) (s, statusLabel(s)),
    ]),
  ],
  actions: [
    ResourceAction(label: 'Examiner', endpoint: 'POST /ai/anomalies/{anomaly_id}/review', when: (r) => r.s('status') == 'new', perms: const ['ai:use']),
  ],
);

/// Sécurité : adoption de la double authentification, comptes verrouillés, sessions par application, alertes.
class SecurityScreen extends StatelessWidget {
  const SecurityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/admin/security/overview',
      builder: (context, data, handle) {
        final s = J.of(data);
        final u = s.obj('users');
        final mfaRate = u.i('active') == 0 ? 0.0 : u.i('mfa_enabled') * 100 / u.i('active');
        return PageList(
          children: [
            StatGrid(
              children: [
                StatTile(label: 'Comptes actifs', value: '${u.i('active')} / ${u.i('total')}', icon: Icons.people_outline),
                StatTile(
                  label: 'Double authentification',
                  value: percent(mfaRate),
                  tone: mfaRate < 100 ? Tone.warning : Tone.success,
                  icon: Icons.phonelink_lock_outlined,
                ),
                StatTile(
                  label: 'Échecs de connexion (24 h)',
                  value: '${s.i('failed_logins_24h')}',
                  tone: s.i('failed_logins_24h') > 20 ? Tone.danger : Tone.neutral,
                  icon: Icons.gpp_maybe_outlined,
                ),
                StatTile(label: 'Sessions actives', value: '${s.obj('sessions').i('total')}', icon: Icons.devices_outlined),
              ],
            ),
            SectionCard(
              title: 'Sessions par application',
              child: Column(children: [for (final e in s.obj('sessions').obj('by_application').raw.entries) InfoRow(optionLabel(e.key), '${e.value}')]),
            ),
            if (s.list('locked_accounts').isNotEmpty)
              SectionCard(
                title: 'Comptes verrouillés',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final l in s.list('locked_accounts'))
                      ListTile(
                        title: Text(l.s('name')),
                        subtitle: Text('${l.s('email')} · ${l.i('failed_login_count')} échecs · jusqu\'au ${dateTime(l['locked_until'])}'),
                        trailing: TextButton(
                          onPressed: () async {
                            await runAction(context, () => context.api.post('/users/${l.s('id')}/unlock'), success: 'Compte déverrouillé');
                            await handle.reload();
                          },
                          child: const Text('Déverrouiller'),
                        ),
                      ),
                  ],
                ),
              ),
            if (u.list('mfa_missing').isNotEmpty)
              SectionCard(
                title: 'Sans double authentification',
                child: Column(children: [for (final m in u.list('mfa_missing').take(30)) InfoRow(m.s('name'), m.s('email'))]),
              ),
            SectionCard(
              title: 'Alertes de sécurité récentes',
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  if (s.list('alerts').isEmpty) const ListTile(title: Text('Aucune alerte.')),
                  for (final a in s.list('alerts').take(30))
                    ListTile(
                      dense: true,
                      leading: Icon(Icons.shield_outlined, color: a.s('criticality') == 'CRITICAL' ? GlobusColors.danger : GlobusColors.warning),
                      title: Text('${optionLabel(a.str('module'))} · ${a.s('action')}'),
                      subtitle: Text(dateTime(a['created_at'] ?? a['occurred_at'])),
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

/// Sessions actives de tous les utilisateurs ; révocation unitaire.
final sessions = ResourceConfig(
  title: 'Sessions actives',
  path: '/admin/security/sessions',
  icon: Icons.devices_outlined,
  search: false,
  itemTitle: (r) => '${r.s('user')} · ${optionLabel(r.str('application') ?? 'web')}',
  itemSubtitle: (r) => [r.s('email'), if (r.has('ip')) r.s('ip'), 'dernière activité ${relative(r['last_used_at'] ?? r['created_at'])}'].join(' · '),
  itemBadge: (r) => r.b('mfa_verified') ? 'mfa_verified' : null,
  actions: [
    ResourceAction(
      label: 'Déconnecter cet utilisateur partout',
      danger: true,
      path: (r) => '/users/${r.s('user_id')}/revoke-sessions',
      perms: const ['users:write'],
      confirm: 'Toutes les sessions et tous les appareils de cet utilisateur seront déconnectés immédiatement.',
    ),
  ],
);
