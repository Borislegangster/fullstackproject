import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import '../project.dart';

/// Pièce à régler (appel de fonds ou facture).
class PayTarget {
  const PayTarget({required this.type, required this.id, required this.label, required this.remaining});
  final String type;
  final String id;
  final String label;
  final double remaining;
}

/// Finances : budget, échéanciers, séquestre, appels de fonds, factures, paiements et reçus, paiement en ligne réel
/// (Mobile Money MTN / Orange, carte selon les moyens activés).
class FinancesScreen extends StatefulWidget {
  const FinancesScreen({super.key});
  @override
  State<FinancesScreen> createState() => _FinancesScreenState();
}

class _FinancesScreenState extends State<FinancesScreen> {
  int _v = 0;
  void _refresh() => setState(() => _v++);

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final projectId = project.s('id');
        // Échéanciers d'abord : ils masquent « Échelonner » sur les pièces déjà échelonnées.
        return ApiView(
          key: ValueKey('plans$_v'),
          path: '/client/payment-plans',
          refreshable: false,
          transform: (data) => listOf(data).where((p) => p.s('project_id') == projectId).toList(),
          builder: (context, plans, _) => _PlansScope(
            plans: plans as List<J>,
            child: _financesView(context, projectId),
          ),
        );
      },
    );
  }

  Widget _financesView(BuildContext context, String projectId) {
    return Builder(
      builder: (context) {
        return ApiView(
          key: ValueKey('fin$_v'),
          path: '/client/projects/$projectId/finances',
          refreshOn: const ['notification'],
          builder: (context, data, handle) {
            final d = J.of(data);
            final s = d.obj('summary');
            final c = cur(s);
            final contract = s.d('contract_amount');
            final canPay = context.can('client:pay');
            final methods = d.list('payment_methods');
            Future<void> pay(PayTarget t) async {
              await showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => PaySheet(target: t, methods: methods, currency: c),
              );
              _refresh();
            }

            Future<void> schedule(PayTarget t) async {
              final ok = await showModalBottomSheet<bool>(
                context: context,
                isScrollControlled: true,
                builder: (_) => PlanRequestSheet(target: t, currency: c),
              );
              if (ok == true) _refresh();
            }

            return PageList(
              children: [
                const PageHeader(title: 'Finances', subtitle: 'Budget, appels de fonds, factures, paiements et reçus.'),
                StatGrid(
                  children: [
                    StatTile(label: 'Montant du contrat (avenants non inclus)', value: money(contract, c)),
                    StatTile(label: 'Avenants approuvés', value: money(s['approved_changes'], c), hint: 'Facturés séparément du contrat'),
                    StatTile(label: 'Appelé', value: money(s['called'], c), hint: 'Reste à appeler ${money(s['remaining_to_call'], c)}'),
                    StatTile(label: 'Payé', value: money(s['paid'], c), tone: Tone.success),
                    StatTile(
                      label: 'À régler',
                      value: money(s['due'], c),
                      tone: s.i('overdue_count') > 0 ? Tone.danger : Tone.warning,
                      hint: s.i('overdue_count') > 0 ? '${s.i('overdue_count')} appel(s) en retard' : null,
                    ),
                  ],
                ),
                if (contract > 0)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Expanded(child: Text('Part du contrat réglée (avenants non inclus)')),
                              Text(percent(s.d('paid') / contract * 100), style: const TextStyle(fontWeight: FontWeight.w700)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          GProgress(value: s.d('paid') / contract * 100, tone: Tone.success),
                        ],
                      ),
                    ),
                  ),
                _MyPaymentPlans(onChange: _refresh),
                EscrowPanel(projectId: projectId, currency: c, onChange: _refresh),
                SectionCard(
                  title: 'Appels de fonds',
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      if (d.list('funds_calls').isEmpty) const ListTile(title: Text('Aucun appel de fonds émis.')),
                      for (final fc in d.list('funds_calls'))
                        Builder(
                          builder: (context) {
                            final remaining = fc.d('amount') - fc.d('amount_paid');
                            final payable = canPay && remaining > 0 && const ['issued', 'partially_paid', 'overdue'].contains(fc.s('status'));
                            final target = PayTarget(type: 'funds_call', id: fc.s('id'), label: '${fc.s('number')} — ${fc.s('label')}', remaining: remaining);
                            return _PieceTile(
                              icon: Icons.request_quote_outlined,
                              title: '${fc.s('number')} — ${fc.s('label')}',
                              subtitle: 'Échéance ${date(fc['due_date'])} · ${money(fc['amount'], c)} · payé ${money(fc['amount_paid'], c)}',
                              status: fc.s('status'),
                              actions: [
                                if (payable) ...[
                                  _PlanButton(targetId: fc.s('id'), onTap: () => schedule(target)),
                                  FilledButton(
                                    style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
                                    onPressed: () => pay(target),
                                    child: const Text('Payer'),
                                  ),
                                ],
                              ],
                            );
                          },
                        ),
                    ],
                  ),
                ),
                SectionCard(
                  title: 'Factures',
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      if (d.list('invoices').isEmpty) const ListTile(title: Text('Aucune facture.')),
                      for (final i in d.list('invoices'))
                        Builder(
                          builder: (context) {
                            final remaining = i.d('total') - i.d('amount_paid');
                            final payable = canPay && remaining > 0 && const ['issued', 'sent', 'partially_paid', 'overdue'].contains(i.s('status'));
                            final target = PayTarget(type: 'client_invoice', id: i.s('id'), label: 'Facture ${i.s('number')}', remaining: remaining);
                            return _PieceTile(
                              icon: Icons.description_outlined,
                              title: '${i.s('number')}${i.has('title') ? ' — ${i.s('title')}' : ''}',
                              subtitle:
                                  '${_invoiceCategories[i.s('kind')] ?? 'Facture'} · ${money(i['total'], c)} · émise le ${date(i['issue_date'])} · échéance ${date(i['due_date'])}',
                              status: i.s('status'),
                              actions: [
                                if (i.has('pdf_url'))
                                  IconButton(
                                    tooltip: 'Télécharger la facture',
                                    onPressed: () => openRemoteFile(context, i.s('pdf_url'), filename: 'facture-${i.s('number')}.pdf'),
                                    icon: const Icon(Icons.download_outlined),
                                  ),
                                if (payable) ...[
                                  _PlanButton(targetId: i.s('id'), onTap: () => schedule(target)),
                                  OutlinedButton(onPressed: () => pay(target), child: const Text('Payer')),
                                ],
                              ],
                            );
                          },
                        ),
                    ],
                  ),
                ),
                if (d.list('credit_notes').isNotEmpty)
                  SectionCard(
                    title: "Factures d'avoir",
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (final n in d.list('credit_notes'))
                          _PieceTile(
                            icon: Icons.assignment_return_outlined,
                            title: '${n.s('number')} — avoir sur la facture ${n.str('invoice_number') ?? '—'}',
                            subtitle: '− ${money(n['amount'], c)} · le ${date(n['issue_date'])} · ${n.s('reason')}',
                            status: 'issued',
                            actions: [
                              IconButton(
                                tooltip: "Télécharger la facture d'avoir",
                                onPressed: () => openRemoteFile(context, n.s('pdf_url'), filename: 'avoir-${n.s('number')}.pdf'),
                                icon: const Icon(Icons.download_outlined),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                SectionCard(
                  title: 'Paiements et reçus',
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      if (d.list('payments').isEmpty) const ListTile(title: Text('Aucun paiement.')),
                      for (final p in d.list('payments'))
                        _PieceTile(
                          icon: Icons.receipt_long_outlined,
                          title: p.s('number'),
                          subtitle: '${money(p['amount'], c)} · ${optionLabel(p.str('method'))} · ${date(p['paid_at'])}',
                          status: p.s('status'),
                          actions: [
                            if (p.has('receipt_url'))
                              TextButton.icon(
                                onPressed: () => openRemoteFile(context, p.s('receipt_url'), filename: 'recu-${p.s('number')}.pdf'),
                                icon: const Icon(Icons.download_outlined, size: 18),
                                label: const Text('Reçu'),
                              ),
                          ],
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

/// Bouton « Échelonner » masqué si un échéancier est déjà ouvert pour la pièce.
class _PlanButton extends StatelessWidget {
  const _PlanButton({required this.targetId, required this.onTap});
  final String targetId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final plans = _PlansScope.of(context);
    final open = plans.any((p) => p.s('target_id') == targetId && const ['requested', 'proposed', 'active'].contains(p.s('status')));
    if (open) return const SizedBox.shrink();
    return TextButton(onPressed: onTap, child: const Text('Échelonner'));
  }
}

/// Catégories des factures définitives remises au client.
const _invoiceCategories = {
  'invoice': 'Facture',
  'deposit': "Facture d'acompte",
  'progress': "Facture d'appel de fonds",
  'final': 'Facture de solde',
  'studies': "Facture d'études",
};

class _PieceTile extends StatelessWidget {
  const _PieceTile({required this.icon, required this.title, required this.subtitle, required this.status, this.actions = const []});
  final IconData icon;
  final String title;
  final String subtitle;
  final String status;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: GlobusColors.primary, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              StatusBadge(status),
            ],
          ),
          if (actions.isNotEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: actions),
            ),
        ],
      ),
    );
  }
}

/// Échéanciers du projet (partagés avec les boutons « Échelonner »).
class _PlansScope extends InheritedWidget {
  const _PlansScope({required this.plans, required super.child});
  final List<J> plans;

  static List<J> of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_PlansScope>()?.plans ?? const [];

  @override
  bool updateShouldNotify(_PlansScope old) => old.plans != plans;
}

const _planStatus = <String, (String, Tone)>{
  'requested': ("Demande à l'étude", Tone.info),
  'proposed': ('À accepter', Tone.accent),
  'active': ('En cours', Tone.success),
  'completed': ('Soldé', Tone.success),
  'defaulted': ('Échéance manquée', Tone.danger),
  'rejected': ('Non retenu', Tone.neutral),
  'cancelled': ('Annulé', Tone.neutral),
};

/// Mes échéanciers : suivi des échéances et acceptation d'une proposition par code à usage unique.
class _MyPaymentPlans extends StatelessWidget {
  const _MyPaymentPlans({required this.onChange});
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final plans = _PlansScope.of(context);
    if (plans.isEmpty) return const SizedBox.shrink();
    return SectionCard(
      title: 'Mes échéanciers',
      subtitle: 'Rappels automatiques avant chaque échéance, avec lien de paiement en un clic.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final p in plans) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${p.s('number')} · ${p.s('target_number')} — ${p.s('target_label')} · ${money(p['total_amount'], currencyLabel(p.str('currency')))}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                ToneBadge(_planStatus[p.s('status')]?.$1 ?? p.s('status'), tone: _planStatus[p.s('status')]?.$2 ?? Tone.neutral),
              ],
            ),
            const SizedBox(height: 8),
            InstallmentList(items: p.list('installments'), currency: currencyLabel(p.str('currency'))),
            if (p.has('decision_note')) Text('Note du service comptable : ${p.s('decision_note')}', style: Theme.of(context).textTheme.bodySmall),
            if (p.s('status') == 'proposed')
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
                  onPressed: () async {
                    final ok = await otpDialog<bool>(
                      context,
                      title: "Accepter l'échéancier",
                      description:
                          "En validant, vous vous engagez à régler les ${p.list('installments').length} échéances de l'échéancier ${p.s('number')}. Votre acceptation est horodatée (code à usage unique).",
                      channels: kOtpChannels,
                      request: (channel) => context.api.post('/client/payment-plans/${p.s('id')}/otp', query: {'channel': channel}),
                      confirm: (challenge, code) async {
                        await context.api.post('/client/payment-plans/${p.s('id')}/accept', body: {'otp_token': challenge.s('otp_token'), 'code': code});
                        return true;
                      },
                      confirmLabel: "J'accepte l'échéancier",
                    );
                    if (ok == true && context.mounted) {
                      context.toast("Échéancier accepté : les relances sont remplacées par les rappels d'échéance.", success: true);
                      onChange();
                    }
                  },
                  child: const Text('Accepter par code'),
                ),
              ),
            const Divider(height: 24),
          ],
        ],
      ),
    );
  }
}

class InstallmentList extends StatelessWidget {
  const InstallmentList({super.key, required this.items, required this.currency});
  final List<J> items;
  final String currency;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final i in items)
          Container(
            width: 150,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: i.s('status') == 'paid'
                  ? GlobusColors.success.withValues(alpha: 0.08)
                  : (i.s('status') == 'late' ? GlobusColors.danger.withValues(alpha: 0.08) : Theme.of(context).colorScheme.surface),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Échéance ${i.i('index')}', style: Theme.of(context).textTheme.bodySmall)),
                    Icon(
                      i.s('status') == 'paid' ? Icons.check_circle : (i.s('status') == 'late' ? Icons.schedule : Icons.event),
                      size: 16,
                      color: i.s('status') == 'paid' ? GlobusColors.success : (i.s('status') == 'late' ? GlobusColors.danger : GlobusColors.primary),
                    ),
                  ],
                ),
                Text(money(i['amount'], currency), style: const TextStyle(fontWeight: FontWeight.w800)),
                Text(
                  'le ${date(i['due_date'])}${i.has('remaining') && i.s('status') != 'paid' && i.d('remaining') < i.d('amount') ? ' · reste ${money(i['remaining'], currency)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Paiement en ligne réel : choix du moyen (Mobile Money / carte), numéro à débiter, montant (partiel possible).
class PaySheet extends StatefulWidget {
  const PaySheet({super.key, required this.target, required this.methods, required this.currency});
  final PayTarget target;
  final List<J> methods;
  final String currency;

  @override
  State<PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<PaySheet> {
  int _choice = 0;
  final _amount = TextEditingController();
  // Initialisé à l'ouverture (et non à la première lecture) : la fermeture sans saisie ne relit jamais le contexte.
  late final TextEditingController _phone;
  final _key = newKey();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _phone = TextEditingController(text: context.auth.user?.phone ?? '');
  }

  @override
  void dispose() {
    _amount.dispose();
    _phone.dispose();
    super.dispose();
  }

  double get _value {
    final v = double.tryParse(_amount.text.replaceAll(' ', '').replaceAll(',', '.'));
    return v ?? widget.target.remaining;
  }

  Future<void> _pay() async {
    final m = widget.methods[_choice];
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final needsPhone = m.b('requires_phone');
      final res = J.of(
        await context.api.post(
          '/client/checkout',
          idempotent: '$_key-${m.s('provider')}-${m.s('method')}-$_value-${needsPhone ? _phone.text : ''}',
          body: {
            'target_type': widget.target.type,
            'target_id': widget.target.id,
            'provider': m.s('provider'),
            'method': m.s('method'),
            'amount': _value < widget.target.remaining ? _value : null,
            'payer_phone': needsPhone ? _phone.text.trim() : null,
          },
        ),
      );
      if (!mounted) return;
      final tx = res.s('transaction_id');
      final checkout = Uri.parse(context.config.absolute(res.s('checkout_url')));
      final origin = Uri.parse(context.config.origin);
      final internal = checkout.host == origin.host && checkout.path.startsWith('/espace-client/');
      // La feuille se ferme : la suite utilise le routeur et le contexte du navigateur, qui lui survivent.
      final router = GoRouter.of(context);
      final navigator = Navigator.of(context);
      final outer = navigator.context;
      navigator.pop();
      if (!internal && outer.mounted) await openExternal(outer, checkout.toString());
      await router.push('/espace-client/finances/paiement/$tx');
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final methods = widget.methods;
    final selected = methods.isEmpty ? null : methods[_choice];
    final phoneOk = selected == null || !selected.b('requires_phone') || _phone.text.replaceAll(RegExp(r'\D'), '').length >= 9;
    final v = _value;
    final valid = methods.isNotEmpty && v > 0 && v <= widget.target.remaining && phoneOk;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Paiement en ligne', style: Theme.of(context).textTheme.titleLarge),
            Text(widget.target.label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 14),
            if (methods.isEmpty)
              const AlertBox(tone: Tone.warning, message: "Aucun moyen de paiement en ligne n'est activé. Contactez votre chargé d'affaires.")
            else
              RadioGroup<int>(
                groupValue: _choice,
                onChanged: (v) => setState(() => _choice = v ?? 0),
                child: Column(
                  children: [
                    for (final (i, m) in methods.indexed)
                      Card(
                        color: _choice == i ? Theme.of(context).colorScheme.primaryContainer : null,
                        margin: const EdgeInsets.only(bottom: 8),
                        child: RadioListTile<int>(
                          value: i,
                          secondary: Icon(
                            m.s('method') == 'card' ? Icons.credit_card : Icons.smartphone,
                            color: m.s('method') == 'card' ? GlobusColors.primary : GlobusColors.accent,
                          ),
                          title: Text(m.s('label'), style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(m.s('flow') == 'push' ? 'Validation sur votre téléphone' : "Page sécurisée de l'opérateur"),
                        ),
                      ),
                  ],
                ),
              ),
            if (selected?.b('requires_phone') == true) ...[
              const SizedBox(height: 6),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Numéro Mobile Money à débiter',
                  hintText: '6 7X XX XX XX',
                  helperText: 'Vous recevrez une demande de paiement à valider avec votre code secret.',
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Montant',
                hintText: number(widget.target.remaining),
                helperText: 'Reste à régler : ${money(widget.target.remaining, widget.currency)} — paiement partiel possible.',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            const FootNote(
              "Paiement réel sécurisé par l'opérateur (MTN, Orange ou banque) ; une seule opération est créée même en cas de double appui.",
              icon: Icons.lock_outline,
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
                onPressed: valid && !_busy ? _pay : null,
                icon: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.lock),
                label: Text('Payer ${money(v, widget.currency)}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Demande d'échelonnement (validation par le service comptable, acceptation ensuite par code).
class PlanRequestSheet extends StatefulWidget {
  const PlanRequestSheet({super.key, required this.target, required this.currency});
  final PayTarget target;
  final String currency;
  @override
  State<PlanRequestSheet> createState() => _PlanRequestSheetState();
}

class _PlanRequestSheetState extends State<PlanRequestSheet> {
  int _count = 3;
  final _reason = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Demander un échéancier', style: Theme.of(context).textTheme.titleLarge),
          Text('${widget.target.label} — reste à régler ${money(widget.target.remaining, widget.currency)}', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 14),
          DropdownButtonFormField<int>(
            initialValue: _count,
            decoration: const InputDecoration(
              labelText: "Nombre d'échéances",
              helperText: "Une première échéance d'au moins 25 %, puis des échéances mensuelles.",
            ),
            items: [
              for (final n in const [2, 3, 4]) DropdownMenuItem(value: n, child: Text('$n échéances')),
            ],
            onChanged: (v) => setState(() => _count = v ?? 3),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Votre situation (facultatif)', hintText: "Ex. décalage de versement de salaire, attente d'un prêt…"),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          const SizedBox(height: 14),
          BusyButton(
            label: 'Envoyer la demande',
            icon: Icons.call_split,
            expand: true,
            busy: _busy,
            onPressed: () async {
              setState(() {
                _busy = true;
                _error = null;
              });
              try {
                await context.api.post(
                  '/client/payment-plans',
                  body: {
                    'target_type': widget.target.type,
                    'target_id': widget.target.id,
                    'count': _count,
                    'reason': _reason.text.trim().isEmpty ? null : _reason.text.trim(),
                  },
                );
                if (!context.mounted) return;
                context.toast(
                  "Demande envoyée : notre service comptable vous répond rapidement ; vous accepterez ensuite l'échéancier par code.",
                  success: true,
                );
                Navigator.pop(context, true);
              } catch (e) {
                setState(() => _error = errorMessage(e));
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
        ],
      ),
    );
  }
}

const _escrowStatus = <String, (String, Tone)>{
  'awaiting_payment': ('En attente du versement', Tone.neutral),
  'held': ('Fonds sécurisés', Tone.info),
  'release_requested': ('Libération demandée', Tone.warning),
  'approved': ('Validée par le client', Tone.accent),
  'disputed': ('Contestée', Tone.danger),
  'released': ('Libérée', Tone.success),
  'refunded': ('Restituée', Tone.neutral),
};

/// Séquestre par jalon (R1) : fonds détenus par le partenaire, libérés sur preuve et accord du client (OTP).
class EscrowPanel extends StatelessWidget {
  const EscrowPanel({super.key, required this.projectId, required this.currency, this.onChange});
  final String projectId;
  final String currency;
  final VoidCallback? onChange;

  void _verify(BuildContext context, String code) => unawaited(openExternal(context, '${context.config.origin}/verification/$code'));

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/client/projects/$projectId/escrow',
      refreshable: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, handle) {
        final d = J.of(data);
        final account = d.objOrNull('account');
        if (account == null) return const SizedBox.shrink();
        final partner = account.s('partner_name');
        final active = account.s('status') == 'active';
        return SectionCard(
          icon: Icons.lock_outline,
          title: 'Séquestre par jalon',
          subtitle: active
              ? "Vos versements sont détenus par $partner et ne sont libérés qu'à l'atteinte prouvée de chaque jalon, avec votre accord."
              : 'Dès son activation, vos versements seront détenus par $partner et libérés jalon par jalon, sur preuve et avec votre accord.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!active)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AlertBox(
                    tone: Tone.warning,
                    title: 'Séquestre en cours de mise en place',
                    message:
                        "La convention avec $partner est en cours de signature : tant qu'elle n'est pas active, vos versements suivent le circuit habituel. Nous vous informons dès l'activation.",
                  ),
                ),
              StatGrid(
                children: [
                  StatTile(label: 'Fonds sécurisés', value: money(account['balance_held'], currency)),
                  StatTile(label: "Libérés à l'entreprise", value: money(account['balance_released'], currency), tone: Tone.success),
                  StatTile(label: 'Restitués', value: money(account['balance_refunded'], currency)),
                ],
              ),
              const SizedBox(height: 12),
              if (d.list('items').isEmpty) Text("Aucun appel de fonds placé sous séquestre pour l'instant.", style: Theme.of(context).textTheme.bodySmall),
              for (final item in d.list('items')) ...[
                const Divider(height: 20),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text.rich(
                            TextSpan(
                              text: item.objOrNull('milestone')?.s('name') ?? 'Jalon',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                              children: [
                                TextSpan(text: ' · ${item.s('number')}', style: Theme.of(context).textTheme.bodySmall),
                              ],
                            ),
                          ),
                          Text(
                            '${item.objOrNull('funds_call') != null ? '${item.obj('funds_call').s('number')} — ${item.obj('funds_call').s('label')} · ' : ''}${money(item['held_amount'], currency)} sécurisés sur ${money(item['amount'], currency)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    ToneBadge(_escrowStatus[item.s('status')]?.$1 ?? item.s('status'), tone: _escrowStatus[item.s('status')]?.$2 ?? Tone.neutral),
                  ],
                ),
                if (item.objOrNull('evidence')?.has('pv_title') ?? false)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(10)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("Preuves de l'atteinte du jalon", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                        Row(
                          children: [
                            Expanded(child: Text('PV : ${item.obj('evidence').s('pv_title')}', style: const TextStyle(fontSize: 12.5))),
                            if (item.obj('evidence').has('pv_proof_code'))
                              TextButton(onPressed: () => _verify(context, item.obj('evidence').s('pv_proof_code')), child: const Text('vérifier')),
                          ],
                        ),
                        for (final p in item.obj('evidence').list('photo_proofs'))
                          Row(
                            children: [
                              Expanded(child: Text('Photos certifiées ${p.s('number')} (${p.i('photos')})', style: const TextStyle(fontSize: 12.5))),
                              TextButton(onPressed: () => _verify(context, p.s('code')), child: const Text('vérifier')),
                            ],
                          ),
                      ],
                    ),
                  ),
                if (item.s('status') == 'release_requested') ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      FilledButton.icon(
                        onPressed: () async {
                          final ok = await otpDialog<bool>(
                            context,
                            title: 'Valider la libération des fonds',
                            description:
                                "Vous confirmez l'atteinte du jalon « ${item.objOrNull('milestone')?.s('name') ?? ''} » : ${money(item['held_amount'], currency)} seront libérés après double validation interne.",
                            request: (channel) => context.api.post('/client/escrow/items/${item.s('id')}/otp', query: {'channel': channel}),
                            confirm: (challenge, code) async {
                              await context.api.post(
                                '/client/escrow/items/${item.s('id')}/approve',
                                body: {'otp_token': challenge.s('otp_token'), 'code': code},
                              );
                              return true;
                            },
                            confirmLabel: 'Je valide',
                          );
                          if (ok == true && context.mounted) {
                            context.toast('Libération validée', success: true);
                            await handle.reload();
                            onChange?.call();
                          }
                        },
                        icon: const Icon(Icons.verified, size: 18),
                        label: const Text('Valider la libération'),
                      ),
                      TextButton.icon(
                        onPressed: () async {
                          final reason = await promptText(
                            context,
                            title: 'Contester la demande de libération',
                            message: "Les fonds restent bloqués chez $partner jusqu'à la médiation de la Direction.",
                            label: 'Motif (15 caractères minimum)',
                            required: true,
                            minLength: 15,
                            confirm: 'Contester',
                            danger: true,
                          );
                          if (reason == null || !context.mounted) return;
                          final ok = await runAction(
                            context,
                            () => context.api.post('/client/escrow/items/${item.s('id')}/dispute', body: {'reason': reason}),
                            success: 'Contestation enregistrée : la Direction organise une médiation ; les fonds restent bloqués.',
                          );
                          if (ok != null) {
                            await handle.reload();
                            onChange?.call();
                          }
                        },
                        icon: const Icon(Icons.report_outlined, size: 18),
                        label: const Text('Contester'),
                      ),
                      Text(
                        'Demandée le ${date(item['requested_at'])} · délai de réponse ${account.i('review_days')} jours (aucune libération sans votre accord)',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ],
                if (item.s('status') == 'disputed' && item.has('dispute_reason'))
                  Text('Votre contestation : ${item.s('dispute_reason')}', style: const TextStyle(color: GlobusColors.danger, fontSize: 12.5)),
                if (item.obj('client_decision').s('decision') == 'approved' && !item.has('released_at'))
                  Text(
                    'Validée par ${item.obj('client_decision').s('by')} le ${dateTime(item.obj('client_decision')['at'])} · virement en cours de double validation',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                if (item.has('released_at'))
                  Text('Libérés le ${dateTime(item['released_at'])}', style: const TextStyle(color: GlobusColors.success, fontSize: 12.5)),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Suivi du paiement (retour de l'opérateur ou validation Mobile Money) : statut confirmé côté serveur (webhook signé).
class PaymentStatusScreen extends StatefulWidget {
  const PaymentStatusScreen({super.key, required this.transactionId});
  final String transactionId;
  @override
  State<PaymentStatusScreen> createState() => _PaymentStatusScreenState();
}

class _PaymentStatusScreenState extends State<PaymentStatusScreen> {
  static const _final = {'succeeded', 'failed', 'cancelled', 'expired'};
  J? _tx;
  String? _receipt;
  Object? _error;
  int _tries = 0;
  Timer? _timer;
  bool _stopped = false;

  @override
  void initState() {
    super.initState();
    unawaited(_poll(0));
  }

  @override
  void dispose() {
    _stopped = true;
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll(int attempt) async {
    try {
      final res = J.of(await context.api.get('/payments/transactions/${widget.transactionId}'));
      if (_stopped || !mounted) return;
      setState(() {
        _tx = res;
        _tries = attempt;
        _error = null;
      });
      if (_final.contains(res.s('status')) || attempt > 90) {
        if (res.s('status') == 'succeeded' && res.has('payment_id')) {
          try {
            final detail = J.of(await context.api.get('/client/payments/${res.s('payment_id')}'));
            if (mounted) setState(() => _receipt = detail.str('receipt_url'));
          } catch (_) {}
        }
        return;
      }
      _timer = Timer(Duration(milliseconds: (2500 + attempt * 250).clamp(2500, 6000)), () => unawaited(_poll(attempt + 1)));
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
      // Réseau instable : nouvel essai, le statut reste confirmé côté serveur.
      _timer = Timer(const Duration(seconds: 6), () => unawaited(_poll(attempt + 1)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final tx = _tx;
    if (tx == null) return _error != null ? ErrorView(error: _error, onRetry: () => _poll(_tries)) : const LoadingView();
    final c = currencyLabel(tx.str('currency'));
    final done = tx.s('status') == 'succeeded';
    final failed = const ['failed', 'cancelled', 'expired'].contains(tx.s('status'));
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Icon(
          done ? Icons.check_circle : (failed ? Icons.cancel : Icons.schedule),
          size: 72,
          color: done ? GlobusColors.success : (failed ? GlobusColors.danger : GlobusColors.warning),
        ),
        const SizedBox(height: 14),
        Text(
          done
              ? 'Paiement confirmé'
              : failed
              ? 'Paiement non abouti'
              : (tx.s('flow') == 'push' ? 'Validez le paiement sur votre téléphone' : 'Paiement en cours de confirmation'),
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall,
        ),
        const SizedBox(height: 6),
        Text('${money(tx['amount'], c)}${tx.has('payment_number') ? ' · ${tx.s('payment_number')}' : ''}', textAlign: TextAlign.center),
        if (failed && tx.has('failure_reason'))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              tx.s('failure_reason'),
              textAlign: TextAlign.center,
              style: const TextStyle(color: GlobusColors.danger),
            ),
          ),
        if (!done && !failed && tx.has('instructions'))
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: AlertBox(tone: Tone.info, message: tx.s('instructions')),
          ),
        if (!done && !failed)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              children: [
                const LinearProgressIndicator(),
                const SizedBox(height: 6),
                Text("Confirmation par l'opérateur… (${_tries + 1})", style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        const SizedBox(height: 24),
        if (_receipt != null)
          FilledButton.icon(
            onPressed: () => openRemoteFile(context, _receipt!, filename: 'recu-${tx.s('payment_number')}.pdf'),
            icon: const Icon(Icons.download),
            label: const Text('Télécharger le reçu'),
          ),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: () => context.go('/espace-client/finances'), child: const Text('Retour aux finances')),
      ],
    );
  }
}
