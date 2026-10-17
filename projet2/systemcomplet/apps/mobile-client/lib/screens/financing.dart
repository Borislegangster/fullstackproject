import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import '../project.dart';

const _kinds = [
  ('identite', "Pièce d'identité"),
  ('revenus', 'Justificatifs de revenus'),
  ('releves', 'Relevés bancaires (3 mois)'),
  ('titre_foncier', 'Titre foncier / attestation'),
  ('devis', 'Devis ou contrat GLOBUS'),
  ('autre', 'Autre pièce'),
];

const _status = <String, (String, Tone)>{
  'draft': ('Brouillon', Tone.neutral),
  'submitted': ('Transmis', Tone.info),
  'offer': ('Offre reçue', Tone.accent),
  'accepted': ('Offre acceptée', Tone.success),
  'withdrawn': ('Retiré', Tone.neutral),
};

const _partnerStatus = {'sent': 'Envoyé', 'viewed': 'Consulté', 'in_review': "À l'étude", 'offer': 'Offre', 'declined': 'Refus'};

/// Financement (I5) : simulateur, dossier unique, transmission aux établissements partenaires avec consentement,
/// offres et acceptation par code (module optionnel ouvert par l'administration).
class FinancingScreen extends StatefulWidget {
  const FinancingScreen({super.key});
  @override
  State<FinancingScreen> createState() => _FinancingScreenState();
}

class _FinancingScreenState extends State<FinancingScreen> {
  Map<String, dynamic>? _inputs;
  List<J> _offers = const [];
  int _v = 0;

  Future<void> _create() async {
    final inputs = _inputs;
    if (inputs == null) return;
    final project = context.read<ClientProjects>().project;
    final ok = await runAction(
      context,
      () => context.api.post('/client/financing/applications', body: {...inputs, 'project_id': project?.s('id')}),
      success: 'Dossier créé : ajoutez vos pièces puis transmettez-le.',
    );
    if (ok != null) setState(() => _v++);
  }

  @override
  Widget build(BuildContext context) {
    final open = context.auth.user?.hasFeature('financing') ?? false;
    return ApiView(
      key: ValueKey(_v),
      path: '/client/financing',
      builder: (context, data, handle) {
        final apps = listOf(data);
        if (!open && apps.isEmpty) {
          return ListView(
            children: const [
              EmptyView(
                icon: Icons.account_balance_outlined,
                title: 'Financement en ligne non disponible',
                text: "Ce service n'est pas ouvert pour le moment. Votre chargé d'affaires reste à votre disposition pour étudier votre financement.",
              ),
            ],
          );
        }
        return PageList(
          children: [
            const PageHeader(
              title: 'Financement',
              subtitle: 'Simulez, constituez votre dossier une seule fois et transmettez-le en un clic à nos établissements partenaires.',
            ),
            if (!open)
              const AlertBox(
                tone: Tone.warning,
                message: 'Le financement en ligne est fermé : vos dossiers existants restent consultables, aucun nouveau dossier ne peut être créé.',
              ),
            if (open)
              SectionCard(
                title: 'Simulateur',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FinancingSimulator(
                      onChange: (inputs, offers) => setState(() {
                        _inputs = inputs;
                        _offers = offers;
                      }),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
                      onPressed: _inputs == null ? null : _create,
                      icon: const Icon(Icons.note_add_outlined),
                      label: const Text('Créer mon dossier de financement'),
                    ),
                  ],
                ),
              ),
            for (final a in apps) _Dossier(app: a, offers: _offers, onChange: handle.reload),
          ],
        );
      },
    );
  }
}

/// Simulateur de financement : mensualités, endettement, établissements éligibles (`/public/financing/simulate`).
class FinancingSimulator extends StatefulWidget {
  const FinancingSimulator({super.key, this.onChange});
  final void Function(Map<String, dynamic> inputs, List<J> offers)? onChange;
  @override
  State<FinancingSimulator> createState() => _FinancingSimulatorState();
}

class _FinancingSimulatorState extends State<FinancingSimulator> {
  final _amount = TextEditingController(text: '40000000');
  final _down = TextEditingController(text: '10000000');
  final _income = TextEditingController(text: '1200000');
  final _debts = TextEditingController(text: '0');
  final _rate = TextEditingController();
  int _months = 180;
  List<J>? _offers;
  J? _reference;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    for (final c in [_amount, _down, _income, _debts, _rate]) {
      c.dispose();
    }
    super.dispose();
  }

  num _n(TextEditingController c) => num.tryParse(c.text.replaceAll(' ', '').replaceAll(',', '.')) ?? 0;

  Map<String, dynamic> get _inputs => {
    'amount': _n(_amount),
    'down_payment': _n(_down),
    'duration_months': _months,
    'monthly_income': _income.text.trim().isEmpty ? null : _n(_income),
    'other_monthly_debts': _n(_debts),
    'rate': _rate.text.trim().isEmpty ? null : _n(_rate).clamp(0, 30),
  };

  void _schedule() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      final inputs = _inputs;
      try {
        final r = J.of(await context.api.post('/public/financing/simulate', body: inputs));
        if (!mounted) return;
        setState(() {
          _offers = r.list('offers');
          _reference = r.objOrNull('reference');
          _error = null;
        });
        widget.onChange?.call(inputs, _offers!);
      } catch (e) {
        if (mounted) setState(() => _error = errorMessage(e));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final ref = _reference;
    final theme = Theme.of(context);
    Widget field(TextEditingController c, String label, {String? hint, String? help}) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label, hintText: hint, helperText: help),
        onChanged: (_) => _schedule(),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        field(_amount, 'Coût du projet (FCFA)'),
        field(_down, 'Apport personnel (FCFA)'),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: DropdownButtonFormField<int>(
            initialValue: _months,
            decoration: const InputDecoration(labelText: 'Durée'),
            items: [
              for (final m in const [36, 60, 84, 120, 180, 240]) DropdownMenuItem(value: m, child: Text('${m ~/ 12} ans')),
            ],
            onChanged: (v) {
              setState(() => _months = v ?? 180);
              _schedule();
            },
          ),
        ),
        field(_income, 'Revenus nets mensuels (FCFA)'),
        field(_debts, 'Autres mensualités en cours (FCFA)'),
        field(_rate, 'Taux annuel hypothétique (%)', hint: ref?.s('rate'), help: 'Modifiable : comparez avec les taux proposés par votre banque.'),
        Text(
          'Montant à financer : ${money((_n(_amount) - _n(_down)).clamp(0, double.infinity))}. Simulation indicative ; chaque établissement fixe ses conditions.',
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        if (_error != null) AlertBox(tone: Tone.warning, message: _error!),
        if (ref != null)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [GlobusTokens.brand800, GlobusTokens.brand600]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Mensualité estimée à ${number(ref['rate'], 1)} % sur ${_months ~/ 12} ans', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                Text.rich(
                  TextSpan(
                    text: money(ref['monthly']),
                    style: const TextStyle(fontFamily: GlobusFonts.title, fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white),
                    children: const [
                      TextSpan(
                        text: ' / mois',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: Colors.white70),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Intérêts sur la durée : ${money(ref['total_interest'])}${ref.has('debt_ratio_pct') ? " · taux d'endettement ${number(ref['debt_ratio_pct'], 1)} %" : ''}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                if (ref.d('debt_ratio_pct') > 33)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
                    child: const Text(
                      "Au-delà d'environ 33 % d'endettement, les banques demandent souvent plus d'apport ou une durée plus longue.",
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        if (_offers == null)
          const Center(
            child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()),
          )
        else if (_offers!.isEmpty)
          const AlertBox(tone: Tone.info, message: 'Nos établissements partenaires seront bientôt proposés ici.')
        else
          for (final o in _offers!)
            Card(
              color: o.b('eligible') ? null : theme.colorScheme.surfaceContainer,
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.account_balance, size: 18, color: GlobusColors.primary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(o.s('name'), style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        ToneBadge(o.b('eligible') ? 'Éligible' : 'Hors critères', tone: o.b('eligible') ? Tone.success : Tone.neutral),
                      ],
                    ),
                    Text('Taux ${number(o['rate_min'], 1)} – ${number(o['rate_max'], 1)} %', style: theme.textTheme.bodySmall),
                    const SizedBox(height: 4),
                    Text('${money(o['monthly_min'])} – ${money(o['monthly_max'])} / mois', style: theme.textTheme.titleMedium),
                    Text(
                      "${o.has('debt_ratio_pct') ? "Taux d'endettement estimé ${number(o['debt_ratio_pct'], 1)} % · " : ''}Coût total max. ${money(o['total_cost_max'])}",
                      style: theme.textTheme.bodySmall,
                    ),
                    if (o.strings('reasons').isNotEmpty)
                      Text('Critères : ${o.strings('reasons').join(' · ')}', style: const TextStyle(color: GlobusColors.warning, fontSize: 12)),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _Dossier extends StatefulWidget {
  const _Dossier({required this.app, required this.offers, required this.onChange});
  final J app;
  final List<J> offers;
  final Future<void> Function() onChange;
  @override
  State<_Dossier> createState() => _DossierState();
}

class _DossierState extends State<_Dossier> {
  String _kind = 'identite';
  late Set<String> _partners = {
    for (final o in widget.offers)
      if (o.b('eligible')) o.s('partner_id'),
  };
  bool _consent = false;
  bool _uploading = false;

  @override
  void didUpdateWidget(_Dossier old) {
    super.didUpdateWidget(old);
    if (old.offers != widget.offers && _partners.isEmpty) {
      _partners = {
        for (final o in widget.offers)
          if (o.b('eligible')) o.s('partner_id'),
      };
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final id = app.s('id');
    final api = context.api;
    final st = _status[app.s('status')] ?? (app.s('status'), Tone.neutral);
    final theme = Theme.of(context);
    return SectionCard(
      title: 'Dossier ${app.s('number')}',
      trailing: ToneBadge(st.$1, tone: st.$2),
      subtitle:
          '${money(app['amount'])} · apport ${money(app['down_payment'])} · ${number(app.i('duration_months') / 12)} ans${app.has('submitted_at') ? ' · transmis le ${date(app['submitted_at'])}' : ''}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Pièces du dossier', style: TextStyle(fontWeight: FontWeight.w600)),
          if (app.list('documents').isEmpty) Text("Aucune pièce pour l'instant.", style: theme.textTheme.bodySmall),
          for (final d in app.list('documents')) Text('• ${d.str('label') ?? d.s('kind')} — ${d.s('name')}', style: theme.textTheme.bodySmall),
          if (const ['draft', 'submitted'].contains(app.s('status'))) ...[
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Type de pièce'),
              items: [for (final k in _kinds) DropdownMenuItem(value: k.$1, child: Text(k.$2))],
              onChanged: (v) => setState(() => _kind = v ?? 'identite'),
            ),
            const SizedBox(height: 6),
            OutlinedButton.icon(
              onPressed: _uploading
                  ? null
                  : () async {
                      final files = await pickAttachments(context, multiple: false);
                      if (files.isEmpty || !context.mounted) return;
                      setState(() => _uploading = true);
                      final ok = await runAction(
                        context,
                        () => api.upload('/client/financing/applications/$id/documents', files: files, fields: {'kind': _kind}),
                        success: 'Pièce ajoutée',
                      );
                      if (mounted) setState(() => _uploading = false);
                      if (ok != null) await widget.onChange();
                    },
              icon: _uploading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.upload_file),
              label: const Text('Ajouter (PDF, image)'),
            ),
          ],
          if (app.s('status') == 'draft') ...[
            const Divider(height: 24),
            const Text('Établissements destinataires', style: TextStyle(fontWeight: FontWeight.w600)),
            if (widget.offers.isEmpty) Text('Lancez une simulation ci-dessus pour choisir les établissements.', style: theme.textTheme.bodySmall),
            for (final o in widget.offers)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _partners.contains(o.s('partner_id')),
                onChanged: (v) => setState(() => v == true ? _partners.add(o.s('partner_id')) : _partners.remove(o.s('partner_id'))),
                title: Text('${o.s('name')}${o.b('eligible') ? '' : ' (hors critères simulés)'}'),
              ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
              title: const Text(
                "J'autorise GLOBUS ENGINEERING à transmettre mon dossier et mes pièces aux établissements cochés pour l'étude de mon financement.",
              ),
              subtitle: const Text('Accès par lien personnel, valable 30 jours, révocable à tout moment ; pièces filigranées au nom de chaque établissement.'),
            ),
            FilledButton.icon(
              onPressed: !_consent || _partners.isEmpty
                  ? null
                  : () async {
                      final ok = await runAction(
                        context,
                        () => api.post('/client/financing/applications/$id/submit', body: {'partner_ids': _partners.toList(), 'consent': _consent}),
                        success: 'Dossier transmis',
                      );
                      if (ok != null) await widget.onChange();
                    },
              icon: const Icon(Icons.send),
              label: const Text('Transmettre le dossier'),
            ),
          ],
          if (app.list('partners').isNotEmpty) ...[
            const Divider(height: 24),
            for (final p in app.list('partners'))
              Card(
                color: p.has('offer') ? GlobusColors.success.withValues(alpha: 0.07) : null,
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.account_balance, size: 18, color: GlobusColors.primary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(p.s('partner'), style: const TextStyle(fontWeight: FontWeight.w700)),
                          ),
                          ToneBadge(
                            p.b('revoked') ? 'Accès retiré' : (_partnerStatus[p.s('status')] ?? p.s('status')),
                            tone: p.b('revoked')
                                ? Tone.neutral
                                : (p.s('status') == 'offer' ? Tone.success : (p.s('status') == 'declined' ? Tone.danger : Tone.info)),
                          ),
                        ],
                      ),
                      if (p.has('offer')) ...[
                        const SizedBox(height: 6),
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(text: '${money(p.obj('offer')['amount'])} sur ${number(p.obj('offer').d('duration_months') / 12)} ans à '),
                              TextSpan(
                                text: '${p.obj('offer').s('rate')} %',
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                              if (p.obj('offer').has('monthly_payment')) TextSpan(text: ' · ${money(p.obj('offer')['monthly_payment'])} / mois'),
                            ],
                          ),
                        ),
                        if (p.obj('offer').has('conditions')) Text(p.obj('offer').s('conditions'), style: theme.textTheme.bodySmall),
                        if (app.s('status') == 'offer')
                          Align(
                            alignment: Alignment.centerLeft,
                            child: FilledButton.icon(
                              onPressed: () async {
                                final shareId = p.s('share_id');
                                final ok = await otpDialog<bool>(
                                  context,
                                  title: "Accepter l'offre de financement",
                                  description: "Votre acceptation est horodatée et transmise à l'établissement, qui finalise le contrat de prêt avec vous.",
                                  request: (channel) => api.post('/client/financing/applications/$id/offers/$shareId/otp', query: {'channel': channel}),
                                  confirm: (challenge, code) async {
                                    await api.post(
                                      '/client/financing/applications/$id/offers/$shareId/accept',
                                      body: {'otp_token': challenge.s('otp_token'), 'code': code},
                                    );
                                    return true;
                                  },
                                  confirmLabel: "J'accepte l'offre",
                                );
                                if (ok == true) {
                                  if (context.mounted) context.toast('Offre acceptée', success: true);
                                  await widget.onChange();
                                }
                              },
                              icon: const Icon(Icons.handshake_outlined),
                              label: const Text('Accepter cette offre'),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
              ),
          ],
          if (const ['submitted', 'offer'].contains(app.s('status')))
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () async {
                  if (!await confirmDialog(
                    context,
                    title: 'Retirer mon accord ?',
                    message: "Les établissements n'auront plus accès au dossier.",
                    confirm: 'Retirer',
                  )) {
                    return;
                  }
                  if (!context.mounted) return;
                  final ok = await runAction(
                    context,
                    () => api.post('/client/financing/applications/$id/withdraw'),
                    success: "Accord retiré : les établissements n'ont plus accès au dossier.",
                  );
                  if (ok != null) await widget.onChange();
                },
                icon: const Icon(Icons.undo),
                label: const Text('Retirer mon accord'),
              ),
            ),
        ],
      ),
    );
  }
}
