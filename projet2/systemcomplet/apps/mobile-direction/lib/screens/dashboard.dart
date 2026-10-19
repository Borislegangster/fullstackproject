import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';

/// Tableau de bord Direction (§7.1, miroir de /erp) : portefeuille, trésorerie, marges, retards, QHSE,
/// approbations en attente, satisfaction, livraisons, contrôles, partenaires, entonnoir commercial.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    return ApiView(
      path: '/reports/dashboard',
      refreshOn: const ['notification'],
      builder: (context, data, handle) {
        final d = J.of(data);
        final projects = d.obj('projects');
        final approvals = d.obj('approvals');
        final f = d.objOrNull('finance');
        final totalApprovals = ['purchase_requests', 'payments', 'situations', 'client_decisions_pending'].fold<int>(0, (t, k) => t + approvals.i(k));
        return PageList(
          children: [
            PageHeader(
              eyebrow: 'Tableau de bord',
              title: 'Bonjour ${user?.firstName ?? ''}',
              subtitle: 'Synthèse mise à jour le ${dateTime(d['generated_at'])}',
            ),
            StatGrid(
              children: [
                StatTile(
                  label: 'Chantiers actifs',
                  value: '${projects.i('active')} / ${projects.i('total')}',
                  hint: projects.has('avg_progress') ? 'Avancement moyen ${number(projects['avg_progress'], 1)}$nbsp%' : null,
                  icon: Icons.engineering_outlined,
                  tone: Tone.info,
                ),
                StatTile(
                  label: 'Jalons en retard',
                  value: '${d.obj('planning').i('late_milestones')}',
                  icon: Icons.warning_amber_rounded,
                  tone: d.obj('planning').i('late_milestones') > 0 ? Tone.danger : Tone.success,
                ),
                StatTile(
                  label: 'Incidents QHSE graves',
                  value: '${d.obj('qhse').i('open_serious_incidents')}',
                  icon: Icons.health_and_safety_outlined,
                  tone: d.obj('qhse').i('open_serious_incidents') > 0 ? Tone.danger : Tone.success,
                ),
                StatTile(
                  label: 'Tickets SAV ouverts',
                  value: '${d.obj('support').i('open_tickets')}',
                  hint: d.obj('support').i('sla_breached') > 0 ? '${d.obj('support').i('sla_breached')} hors délai' : 'Tous dans les délais',
                  icon: Icons.support_agent,
                  tone: d.obj('support').i('sla_breached') > 0 ? Tone.warning : Tone.neutral,
                ),
              ],
            ),
            SectionCard(
              title: 'Approbations en attente',
              trailing: totalApprovals > 0 ? ToneBadge('$totalApprovals', tone: Tone.accent) : null,
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _Approval(Icons.shopping_cart_outlined, "Demandes d'achat à approuver", approvals.i('purchase_requests'), '$base/validations?onglet=achats'),
                  _Approval(Icons.payments_outlined, 'Paiements à approuver', approvals.i('payments'), '$base/validations?onglet=paiements'),
                  _Approval(Icons.fact_check_outlined, 'Situations à valider', approvals.i('situations'), '$base/validations?onglet=situations'),
                  _Approval(
                    Icons.how_to_vote_outlined,
                    'Décisions client en attente',
                    approvals.i('client_decisions_pending'),
                    '$base/validations?onglet=decisions',
                  ),
                  _Approval(Icons.local_shipping_outlined, "Demandes d'achat soumises", approvals.i('draft_requests'), '$base/achats'),
                ],
              ),
            ),
            if (f != null) ..._finance(context, f),
            _Health(health: projects.obj('health')),
            if (user?.can('support:read') ?? false) const _Satisfaction(),
            if (user?.can('deliveries:read') ?? false) const _ExpectedDeliveries(),
            _Controls(user: user),
            if ((user?.can('suppliers:read') ?? false) || (user?.can('subcontracting:read') ?? false)) _Partners(user: user),
            if (user?.can('crm:read') ?? false) const _Funnel(),
          ],
        );
      },
    );
  }

  List<Widget> _finance(BuildContext context, J f) {
    final series = f.obj('cashflow').list('series');
    final margins = f.list('margins')..sort((a, b) => toDouble(a['gross_margin_pct']).compareTo(toDouble(b['gross_margin_pct'])));
    return [
      StatGrid(
        children: [
          StatTile(label: 'CA signé (chantiers actifs)', value: money(f['portfolio_value']), icon: Icons.account_balance_outlined, tone: Tone.info),
          StatTile(label: 'Facturé', value: money(f['invoiced']), hint: 'Encaissé ce mois : ${money(f['collected_this_month'])}'),
          StatTile(
            label: 'Créances à encaisser',
            value: money(f['receivable']),
            hint: 'dont en retard ${money(f['overdue'])}',
            tone: toDouble(f['overdue']) > 0 ? Tone.warning : Tone.neutral,
          ),
          StatTile(label: 'Dettes fournisseurs', value: money(f['payable'])),
        ],
      ),
      if (series.isNotEmpty)
        SectionCard(
          title: 'Trésorerie prévisionnelle (6 mois)',
          subtitle: 'Encaissements, décaissements et solde cumulé',
          child: SizedBox(height: 220, child: _CashflowChart(series: series)),
        ),
      if (margins.isNotEmpty)
        SectionCard(
          title: 'Marges par chantier',
          subtitle: 'De la plus faible à la plus forte',
          trailing: TextButton(onPressed: () => context.push('$base/finances'), child: const Text('Finances')),
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final m in margins.take(8))
                ListTile(
                  dense: true,
                  onTap: () => context.push('$base/chantiers/${m.s('project_id')}'),
                  title: Text('${m.s('code')} — ${m.s('name')}', maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('CA ${money(m['revenue'])} · coût prévu ${money(m['forecast_cost'])}'),
                  trailing: Text(
                    m.has('gross_margin_pct') ? percent(m['gross_margin_pct'], 1) : '—',
                    style: TextStyle(fontWeight: FontWeight.w700, color: toDouble(m['gross_margin_pct']) < 10 ? GlobusColors.danger : GlobusColors.success),
                  ),
                ),
            ],
          ),
        ),
    ];
  }
}

class _Approval extends StatelessWidget {
  const _Approval(this.icon, this.label, this.count, this.path);
  final IconData icon;
  final String label;
  final int count;
  final String path;

  @override
  Widget build(BuildContext context) => ListTile(
    dense: true,
    leading: Icon(icon, color: GlobusColors.primary),
    title: Text(label),
    trailing: count > 0 ? ToneBadge('$count', tone: Tone.accent) : Text('0', style: Theme.of(context).textTheme.bodySmall),
    onTap: () => context.push(path),
  );
}

class _CashflowChart extends StatelessWidget {
  const _CashflowChart({required this.series});
  final List<J> series;

  @override
  Widget build(BuildContext context) {
    LineChartBarData line(String key, Color color, {bool area = false}) => LineChartBarData(
      spots: [for (final (i, s) in series.indexed) FlSpot(i.toDouble(), toDouble(s[key]) / 1e6)],
      isCurved: true,
      color: color,
      barWidth: 2.5,
      dotData: const FlDotData(show: false),
      belowBarData: BarAreaData(show: area, color: color.withValues(alpha: 0.12)),
    );
    return Column(
      children: [
        Expanded(
          child: LineChart(
            LineChartData(
              lineBarsData: [
                line('inflow', GlobusColors.success),
                line('outflow', GlobusColors.danger),
                line('cumulative', GlobusColors.primary, area: true),
              ],
              gridData: const FlGridData(drawVerticalLine: false),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(),
                rightTitles: const AxisTitles(),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 44,
                    getTitlesWidget: (v, meta) => SideTitleWidget(
                      meta: meta,
                      child: Text('${number(v)} M', style: const TextStyle(fontSize: 10)),
                    ),
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    interval: 1,
                    getTitlesWidget: (v, meta) {
                      final i = v.toInt();
                      if (i < 0 || i >= series.length) return const SizedBox.shrink();
                      final month = int.tryParse(series[i].s('month').split('-').last) ?? 1;
                      return SideTitleWidget(
                        meta: meta,
                        child: Text(monthShort(month), style: const TextStyle(fontSize: 10)),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Wrap(
          spacing: 12,
          children: [
            _Legend(GlobusColors.success, 'Encaissements'),
            _Legend(GlobusColors.danger, 'Décaissements'),
            _Legend(GlobusColors.primary, 'Solde cumulé (M FCFA)'),
          ],
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.color, this.label);
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 4),
      Text(label, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}

class _Health extends StatelessWidget {
  const _Health({required this.health});
  final J health;

  @override
  Widget build(BuildContext context) {
    final entries = health.raw.entries.where((e) => toDouble(e.value) > 0).toList();
    if (entries.isEmpty) return const SizedBox.shrink();
    final total = entries.fold<double>(0, (t, e) => t + toDouble(e.value));
    return SectionCard(
      title: 'Santé des chantiers actifs',
      child: Row(
        children: [
          SizedBox(
            width: 120,
            height: 120,
            child: PieChart(
              PieChartData(
                sectionsSpace: 2,
                centerSpaceRadius: 30,
                sections: [
                  for (final e in entries)
                    PieChartSectionData(value: toDouble(e.value), color: GlobusColors.tone(statusTone(e.key)), radius: 26, showTitle: false),
                ],
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final e in entries)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(color: GlobusColors.tone(statusTone(e.key)), shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 6),
                        Expanded(child: Text(optionLabel(e.key))),
                        Text('${number(e.value)} (${percent(toDouble(e.value) * 100 / total)})'),
                      ],
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

class _Satisfaction extends StatelessWidget {
  const _Satisfaction();

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/support/statistics',
      query: const {'days': 90},
      refreshable: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, _) {
        final s = J.of(data);
        return SectionCard(
          title: 'Satisfaction client (90 jours)',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              InfoRow('Note moyenne', s.has('satisfaction_avg') ? '${number(s['satisfaction_avg'], 1)} / 5' : '—'),
              const SizedBox(height: 8),
              Text('Respect du délai de réponse SAV', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 4),
              GProgress(value: toDouble(s['sla_response_compliance']), tone: Tone.success),
            ],
          ),
        );
      },
    );
  }
}

class _ExpectedDeliveries extends StatelessWidget {
  const _ExpectedDeliveries();

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/deliveries/expected',
      query: const {'days': 7},
      refreshable: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, _) {
        final rows = listOf(data);
        return SectionCard(
          title: 'Livraisons attendues (7 jours)',
          trailing: TextButton(onPressed: () => context.push('$base/livraisons'), child: const Text('Livraisons')),
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              if (rows.isEmpty) const ListTile(title: Text('Aucune livraison attendue.')),
              for (final r in rows.take(6))
                ListTile(
                  dense: true,
                  leading: Icon(Icons.local_shipping_outlined, color: r.b('late') ? GlobusColors.danger : GlobusColors.primary),
                  title: Text('${r.s('number')} · ${r.s('supplier')}'),
                  subtitle: Text([if (r.has('site')) r.s('site'), if (r.has('eta')) dateTime(r['eta']) else date(r['expected_date'])].join(' · ')),
                  trailing: r.b('late') ? const ToneBadge('En retard', tone: Tone.danger) : null,
                ),
            ],
          ),
        );
      },
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({required this.user});
  final Me? user;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[
      if (user?.can('billing:read') ?? false)
        _Count(
          path: '/supplier-invoices',
          query: const {'status': 'exception', 'page_size': 1},
          label: 'Factures fournisseurs en anomalie',
          icon: Icons.receipt_long_outlined,
          route: '$base/facturation',
        ),
      if (user?.can('disputes:read') ?? false)
        _Count(
          path: '/disputes',
          query: const {'page_size': 1, 'status': 'OUVERT'},
          label: 'Litiges ouverts',
          icon: Icons.gavel_outlined,
          route: '$base/litiges',
        ),
      if (user?.can('ai:use') ?? false)
        _Count(
          path: '/ai/anomalies',
          query: const {'status': 'new', 'page_size': 1},
          label: 'Anomalies détectées par l\'IA',
          icon: Icons.policy_outlined,
          route: '$base/rapports/anomalies',
        ),
    ];
    if (items.isEmpty) return const SizedBox.shrink();
    return SectionCard(
      title: 'Contrôles',
      padding: EdgeInsets.zero,
      child: Column(children: items),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.path, required this.query, required this.label, required this.icon, required this.route});
  final String path;
  final Map<String, dynamic> query;
  final String label;
  final IconData icon;
  final String route;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: path,
      query: query,
      refreshable: false,
      loading: ListTile(dense: true, leading: Icon(icon), title: Text(label)),
      builder: (context, data, _) {
        final total = data is Map ? J.of(data).i('total') : listOf(data).length;
        return ListTile(
          dense: true,
          leading: Icon(icon, color: total > 0 ? GlobusColors.warning : GlobusColors.primary),
          title: Text(label),
          trailing: total > 0 ? ToneBadge('$total', tone: Tone.warning) : const Text('0'),
          onTap: () => context.push(route),
        );
      },
    );
  }
}

class _Partners extends StatelessWidget {
  const _Partners({required this.user});
  final Me? user;

  @override
  Widget build(BuildContext context) {
    Widget list(String path, Map<String, dynamic> query, String scoreKey, String title, String route) => ApiView(
      path: path,
      query: query,
      refreshable: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, _) {
        final rows = listOf(data);
        if (rows.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text('$title : aucune évaluation pour le moment.', style: Theme.of(context).textTheme.bodySmall),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GroupTitle(
              title,
              trailing: TextButton(onPressed: () => context.push(route), child: const Text('Tous')),
            ),
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(r.str('trade_name') ?? r.s('legal_name'), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        Text(r.has(scoreKey) ? '${number(r[scoreKey])} / 100' : '—'),
                      ],
                    ),
                    const SizedBox(height: 4),
                    GProgress(value: toDouble(r[scoreKey]), tone: Tone.success, height: 6),
                  ],
                ),
              ),
          ],
        );
      },
    );
    return SectionCard(
      title: 'Performance partenaires',
      child: Column(
        children: [
          if (user?.can('suppliers:read') ?? false)
            list('/suppliers', const {'sort': '-quality_score', 'page_size': 5, 'status': 'active'}, 'quality_score', 'Fournisseurs', '$base/fournisseurs'),
          if (user?.can('subcontracting:read') ?? false)
            list('/subcontractors', const {'sort': '-score', 'page_size': 5}, 'score', 'Sous-traitants', '$base/sous-traitants'),
        ],
      ),
    );
  }
}

class _Funnel extends StatelessWidget {
  const _Funnel();

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/crm/funnel',
      refreshable: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, _) {
        final f = J.of(data);
        final steps = [
          ('Leads', f.i('leads')),
          ('Devis envoyés', f.i('quotes_sent')),
          ('Devis acceptés', f.i('quotes_accepted')),
          ('Contrats signés', f.i('contracts_signed')),
        ];
        final max = steps.map((s) => s.$2).fold<int>(1, (m, v) => v > m ? v : m);
        return SectionCard(
          title: 'Entonnoir commercial',
          trailing: TextButton(onPressed: () => context.push('$base/crm'), child: const Text('CRM')),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (label, value) in steps)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      SizedBox(width: 120, child: Text(label)),
                      Expanded(
                        child: GProgress(value: value * 100 / max, tone: Tone.accent, height: 10),
                      ),
                      SizedBox(
                        width: 44,
                        child: Text(
                          '$value',
                          textAlign: TextAlign.end,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              InfoRow('Transformation lead → contrat', percent(f['lead_to_contract_rate'], 1)),
              InfoRow('Acceptation des devis', percent(f['quote_acceptance_rate'], 1)),
              if (f.has('sla_respect_rate')) InfoRow('Délai de rappel respecté', percent(f['sla_respect_rate'], 1)),
              if (f.list('by_source').isNotEmpty) ...[
                const GroupTitle('Leads par source'),
                for (final s in f.list('by_source')) InfoRow(optionLabel(s.s('source')), '${s.i('count')}'),
              ],
            ],
          ),
        );
      },
    );
  }
}
