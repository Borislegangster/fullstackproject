import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

import '../project.dart';

String _optionValue(J o) => o.str('key') ?? o.str('value') ?? o.str('code') ?? o.str('label') ?? o.str('name') ?? jsonEncode(o.raw);
String _optionText(J o) => o.str('label') ?? o.str('name') ?? o.str('title') ?? o.str('key') ?? o.str('value') ?? 'Option';

/// Validations : décisions et avenants soumis à l'accord du client, sécurisés par code (OTP) et figés ; historique.
class ValidationsScreen extends StatefulWidget {
  const ValidationsScreen({super.key});
  @override
  State<ValidationsScreen> createState() => _ValidationsScreenState();
}

class _ValidationsScreenState extends State<ValidationsScreen> {
  int _v = 0;

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final projectId = project.s('id');
        return ApiView(
          key: ValueKey('dec$_v'),
          path: '/client/decisions',
          query: {'project_id': projectId},
          refreshable: false,
          builder: (context, decData, _) => ApiView(
            key: ValueKey('co$_v'),
            path: '/client/change-orders',
            query: {'project_id': projectId},
            refreshable: false,
            builder: (context, coData, _) => _content(context, listOf(decData), listOf(coData)),
          ),
        );
      },
    );
  }

  void _reload() => setState(() => _v++);

  Widget _content(BuildContext context, List<J> decisions, List<J> changes) {
    final canDecide = context.can('client:decide');
    final pendingD = decisions.where((d) => d.s('status') == 'pending_client').toList();
    final pendingC = changes.where((c) => c.s('status') == 'submitted').toList();
    final history = [
      for (final d in decisions.where((d) => d.s('status') != 'pending_client'))
        (
          title: '${d.s('number')} — ${d.s('title')}',
          status: d.s('status'),
          when: d['validated_at'],
          detail: d.has('selected_option') ? 'Option : ${d.s('selected_option')}' : d.s('rejection_reason'),
          hash: d.str('content_hash'),
        ),
      for (final c in changes.where((c) => c.s('status') != 'submitted'))
        (
          title: 'Avenant ${c.s('number')} — ${c.s('title')}',
          status: c.s('status'),
          when: c['client_approved_at'],
          detail: money(c['cost_impact']),
          hash: null,
        ),
    ];
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: TabBar(
              tabs: [
                Tab(
                  child: Badge(
                    isLabelVisible: pendingD.isNotEmpty,
                    label: Text('${pendingD.length}'),
                    child: const Padding(padding: EdgeInsets.only(right: 8), child: Text('Décisions')),
                  ),
                ),
                Tab(
                  child: Badge(
                    isLabelVisible: pendingC.isNotEmpty,
                    label: Text('${pendingC.length}'),
                    child: const Padding(padding: EdgeInsets.only(right: 8), child: Text('Avenants')),
                  ),
                ),
                const Tab(text: 'Historique'),
              ],
            ),
          ),
          if (!canDecide)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AlertBox(tone: Tone.info, message: 'Votre profil permet la consultation ; seul le titulaire du contrat peut valider.'),
            ),
          Expanded(
            child: TabBarView(
              children: [
                RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: pendingD.isEmpty
                      ? ListView(
                          children: const [EmptyView(icon: Icons.check_circle_outline, title: 'Aucune décision en attente')],
                        )
                      : PageList(
                          children: [for (final d in pendingD) _DecisionCard(decision: d, canDecide: canDecide, onDone: _reload)],
                        ),
                ),
                RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: pendingC.isEmpty
                      ? ListView(
                          children: const [EmptyView(icon: Icons.check_circle_outline, title: 'Aucun avenant en attente')],
                        )
                      : PageList(
                          children: [for (final c in pendingC) _ChangeOrderCard(change: c, canDecide: canDecide, onDone: _reload)],
                        ),
                ),
                RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: history.isEmpty
                      ? ListView(children: const [EmptyView(title: 'Aucune validation pour le moment')])
                      : ListView.separated(
                          itemCount: history.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final row = history[i];
                            return ListTile(
                              title: Text(row.title),
                              subtitle: Text(
                                [
                                  if (row.when != null) dateTime(row.when),
                                  if (row.detail.isNotEmpty) row.detail,
                                  if (row.hash != null) 'empreinte ${row.hash!.substring(0, row.hash!.length.clamp(0, 16))}…',
                                ].join(' · '),
                              ),
                              trailing: row.status == 'rejected'
                                  ? const ToneBadge('Refusé', tone: Tone.danger, icon: Icons.cancel_outlined)
                                  : StatusBadge(row.status),
                            );
                          },
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

class _DecisionCard extends StatelessWidget {
  const _DecisionCard({required this.decision, required this.canDecide, required this.onDone});
  final J decision;
  final bool canDecide;
  final VoidCallback onDone;

  Future<void> _validate(BuildContext context) async {
    final d = decision;
    final options = d.list('options');
    final selected = ValueNotifier<String>(options.isEmpty ? '' : _optionValue(options.first));
    final ok = await otpDialog<bool>(
      context,
      title: 'Valider la décision',
      description: d.s('title'),
      channels: kOtpChannels,
      canConfirm: () => options.isEmpty || selected.value.isNotEmpty,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (options.isNotEmpty) ...[
            const Text('Option retenue', style: TextStyle(fontWeight: FontWeight.w600)),
            ValueListenableBuilder<String>(
              valueListenable: selected,
              builder: (_, value, _) => RadioGroup<String>(
                groupValue: value,
                onChanged: (v) => selected.value = v ?? value,
                child: Column(
                  children: [
                    for (final o in options) RadioListTile<String>(contentPadding: EdgeInsets.zero, value: _optionValue(o), title: Text(_optionText(o))),
                  ],
                ),
              ),
            ),
          ],
          AlertBox(
            tone: Tone.info,
            message: 'Impact : ${money(d['price_impact'] ?? 0)} · ${d.i('delay_impact_days')} jour(s). Un avenant est créé automatiquement si nécessaire.',
          ),
        ],
      ),
      request: (channel) => context.api.post('/client/decisions/${d.s('id')}/otp', query: {'channel': channel}),
      confirm: (challenge, code) async {
        await context.api.post(
          '/client/decisions/${d.s('id')}/validate',
          body: {
            'otp_token': challenge.s('otp_token'),
            'code': code,
            'selected_option': selected.value.isEmpty ? null : selected.value,
          },
        );
        return true;
      },
    );
    selected.dispose();
    if (ok == true && context.mounted) {
      context.toast('Décision validée : votre validation est horodatée et figée.', success: true);
      onDone();
    }
  }

  Future<void> _reject(BuildContext context) async {
    final reason = await promptText(
      context,
      title: 'Refuser la décision',
      message: decision.s('title'),
      label: 'Motif du refus',
      required: true,
      minLength: 5,
      confirm: 'Refuser',
      danger: true,
    );
    if (reason == null || !context.mounted) return;
    final ok = await runAction(
      context,
      () => context.api.post('/client/decisions/${decision.s('id')}/reject', body: {'reason': reason}),
      success: 'Refus transmis à votre chef de projet',
    );
    if (ok != null) onDone();
  }

  @override
  Widget build(BuildContext context) {
    final d = decision;
    final theme = Theme.of(context);
    final price = d.d('price_impact');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${d.s('number')} · ${optionLabel(d.s('kind'))}${d.has('version_label') ? ' · version ${d.s('version_label')}' : ''}',
                        style: theme.textTheme.bodySmall,
                      ),
                      Text(d.s('title'), style: theme.textTheme.titleMedium),
                    ],
                  ),
                ),
                ToneBadge(d.has('due_date') ? 'avant le ${date(d['due_date'])}' : 'en attente', tone: Tone.warning, icon: Icons.schedule),
              ],
            ),
            if (d.has('description'))
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(d.s('description'), style: theme.textTheme.bodySmall),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ToneBadge('Impact prix : ${money(d['price_impact'] ?? 0)}', tone: price > 0 ? Tone.warning : (price < 0 ? Tone.success : Tone.neutral)),
                ToneBadge('Impact délai : ${d.i('delay_impact_days')} jour(s)', tone: d.i('delay_impact_days') > 0 ? Tone.warning : Tone.neutral),
              ],
            ),
            for (final o in d.list('options'))
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: theme.colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(10)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        text: _optionText(o),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                        children: [
                          if (o.has('price_impact')) TextSpan(text: ' · ${money(o['price_impact'])}', style: theme.textTheme.bodySmall),
                        ],
                      ),
                    ),
                    if (o.has('description')) Text(o.s('description'), style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            if (canDecide) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _validate(context),
                      icon: const Icon(Icons.verified_user, size: 18),
                      label: const Text('Valider'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(onPressed: () => _reject(context), child: const Text('Refuser')),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChangeOrderCard extends StatelessWidget {
  const _ChangeOrderCard({required this.change, required this.canDecide, required this.onDone});
  final J change;
  final bool canDecide;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final c = change;
    final theme = Theme.of(context);
    final api = context.api;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Avenant ${c.s('number')} · soumis le ${date(c['submitted_at'])}', style: theme.textTheme.bodySmall),
            Text(c.s('title'), style: theme.textTheme.titleMedium),
            if (c.has('description'))
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(c.s('description'), style: theme.textTheme.bodySmall),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ToneBadge('Montant : ${money(c['cost_impact'])}', tone: Tone.warning),
                ToneBadge('Délai : ${c.i('delay_impact_days')} jour(s)'),
                if (c.has('reason')) ToneBadge('Motif : ${optionLabel(c.s('reason'))}', tone: Tone.info),
              ],
            ),
            if (c.list('lines').isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    for (final l in c.list('lines'))
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        child: Row(
                          children: [
                            Expanded(child: Text(l.str('designation') ?? l.s('label'))),
                            Text(
                              l.has('amount')
                                  ? money(l['amount'])
                                  : (l.has('quantity') && l.has('unit_price') ? money(l.d('quantity') * l.d('unit_price')) : ''),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            if (canDecide) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () async {
                        final ok = await otpDialog<bool>(
                          context,
                          title: "Approuver l'avenant",
                          description: '${c.s('number')} — ${money(c['cost_impact'])} · ${c.i('delay_impact_days')} j',
                          request: (_) => api.post('/client/change-orders/${c.s('id')}/otp'),
                          confirm: (challenge, code) async {
                            await api.post(
                              '/client/change-orders/${c.s('id')}/decision',
                              body: {'approve': true, 'otp_token': challenge.s('otp_token'), 'code': code},
                            );
                            return true;
                          },
                          confirmLabel: 'Approuver',
                        );
                        if (ok == true && context.mounted) {
                          context.toast('Avenant approuvé', success: true);
                          onDone();
                        }
                      },
                      icon: const Icon(Icons.draw_outlined, size: 18),
                      label: const Text('Approuver'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final reason = await promptText(
                          context,
                          title: "Refuser l'avenant",
                          message: c.s('title'),
                          label: 'Motif du refus',
                          required: true,
                          minLength: 5,
                          confirm: 'Refuser',
                          danger: true,
                        );
                        if (reason == null || !context.mounted) return;
                        final ok = await runAction(
                          context,
                          () => api.post('/client/change-orders/${c.s('id')}/decision', body: {'approve': false, 'reason': reason}),
                          success: 'Refus transmis',
                        );
                        if (ok != null) onDone();
                      },
                      child: const Text('Refuser'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
