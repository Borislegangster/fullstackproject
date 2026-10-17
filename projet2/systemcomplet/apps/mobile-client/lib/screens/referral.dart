import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:globus_core/globus_core.dart';
import 'package:share_plus/share_plus.dart';

const _status = <String, (String, Tone)>{
  'captured': ('Demande reçue', Tone.info),
  'signed': ('Contrat signé — prime en validation', Tone.accent),
  'approved': ('Prime validée', Tone.success),
  'paid': ('Prime versée', Tone.success),
  'rejected': ('Non éligible', Tone.neutral),
};

String _rewardText(J r) {
  final base = r.s('reward_type') == 'fixed' ? money(r['reward_fixed']) : '${number(r['reward_pct'], 1)} % du montant du contrat signé';
  return "$base${r.d('reward_cap') > 0 ? ' (plafond ${money(r['reward_cap'])})' : ''}, pour tout contrat d'au moins ${money(r['min_contract_amount'])}";
}

/// Programme ambassadeurs (I6, module optionnel) : code et lien personnels, partage, primes par Mobile Money.
class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});
  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  bool _terms = false;
  final _momo = TextEditingController();
  String _operator = 'mtn';
  bool _busy = false;

  @override
  void dispose() {
    _momo.dispose();
    super.dispose();
  }

  Widget _operatorField() => DropdownButtonFormField<String>(
    initialValue: _operator,
    decoration: const InputDecoration(labelText: 'Opérateur'),
    items: const [
      DropdownMenuItem(value: 'mtn', child: Text('MTN Mobile Money')),
      DropdownMenuItem(value: 'orange', child: Text('Orange Money')),
    ],
    onChanged: (v) => setState(() => _operator = v ?? 'mtn'),
  );

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/client/referral',
      builder: (context, data, handle) {
        final s = J.of(data);
        if (!s.b('enabled') && !s.b('enrolled')) {
          return ListView(
            children: const [
              EmptyView(
                icon: Icons.card_giftcard,
                title: 'Programme de parrainage non disponible',
                text: "Ce service n'est pas ouvert pour le moment. Vous serez informé dès son ouverture.",
              ),
            ],
          );
        }
        final rules = s.obj('rules');
        final amb = s.objOrNull('ambassador');
        final theme = Theme.of(context);
        return PageList(
          children: [
            const PageHeader(
              title: 'Programme ambassadeurs',
              subtitle: "Recommandez GLOBUS à vos proches : ils bénéficient d'un avantage, vous recevez une prime à la signature de leur contrat.",
            ),
            if (!s.b('enabled'))
              const AlertBox(
                tone: Tone.info,
                message: 'Le programme est fermé : vos recommandations déjà enregistrées restent suivies et les primes dues vous sont versées.',
              ),
            for (final (icon, title, text) in [
              (Icons.groups_outlined, '1. Partagez votre lien', 'Par WhatsApp, SMS ou e-mail. Votre code suit la visite pendant 90 jours.'),
              (Icons.chat_outlined, '2. Votre proche est accompagné', '${rules.s('referee_benefit')}.'),
              (Icons.payments_outlined, '3. Vous êtes récompensé', '${_rewardText(rules)}, versée par Mobile Money.'),
            ])
              Card(
                child: ListTile(
                  leading: Icon(icon, color: GlobusColors.primary),
                  title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(text),
                ),
              ),
            if (amb == null)
              SectionCard(
                title: 'Devenir ambassadeur',
                subtitle: 'Gratuit, sans engagement. Votre code personnel est créé immédiatement.',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _momo,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Numéro Mobile Money pour vos primes (facultatif)',
                        hintText: '6 7X XX XX XX',
                        helperText: 'Modifiable plus tard depuis cette page.',
                      ),
                    ),
                    const SizedBox(height: 10),
                    _operatorField(),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _terms,
                      onChanged: (v) => setState(() => _terms = v ?? false),
                      title: const Text("J'accepte le règlement du programme ambassadeurs"),
                      subtitle: const Text(
                        'Pas de prime pour soi-même ni pour un contact déjà connu de GLOBUS ; prime due à la signature du contrat, validée par la Direction commerciale.',
                      ),
                    ),
                    BusyButton(
                      label: 'Rejoindre le programme',
                      busy: _busy,
                      expand: true,
                      onPressed: !_terms || !s.b('enabled')
                          ? null
                          : () async {
                              setState(() => _busy = true);
                              final ok = await runAction(
                                context,
                                () => context.api.post(
                                  '/client/referral',
                                  body: {
                                    'accept_terms': _terms,
                                    'momo_number': _momo.text.trim().isEmpty ? null : _momo.text.trim(),
                                    'momo_operator': _momo.text.trim().isEmpty ? null : _operator,
                                  },
                                ),
                                success: 'Bienvenue dans le programme ambassadeurs !',
                              );
                              if (mounted) setState(() => _busy = false);
                              if (ok != null) await handle.reload();
                            },
                    ),
                  ],
                ),
              )
            else ...[
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: const LinearGradient(colors: [GlobusTokens.brand700, GlobusTokens.brand600, GlobusTokens.accent500]),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Votre code ambassadeur', style: TextStyle(color: Colors.white70)),
                    Text(
                      amb.s('code'),
                      style: const TextStyle(fontFamily: GlobusFonts.title, color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 5),
                    ),
                    SelectableText(amb.s('share_url'), style: const TextStyle(color: Colors.white)),
                    if (s.b('enabled'))
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            FilledButton.icon(
                              style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: GlobusTokens.brand800),
                              onPressed: () => SharePlus.instance.share(
                                ShareParams(
                                  title: 'GLOBUS ENGINEERING',
                                  text:
                                      'Je recommande GLOBUS ENGINEERING pour construire en toute confiance. ${rules.s('referee_benefit')}. Mon lien : ${amb.s('share_url')}',
                                ),
                              ),
                              icon: const Icon(Icons.share),
                              label: const Text('Partager'),
                            ),
                            FilledButton.icon(
                              style: FilledButton.styleFrom(backgroundColor: Colors.white24),
                              onPressed: () async {
                                await Clipboard.setData(ClipboardData(text: amb.s('share_url')));
                                if (context.mounted) context.toast('Lien copié');
                              },
                              icon: const Icon(Icons.copy),
                              label: const Text('Copier le lien'),
                            ),
                            FilledButton.icon(
                              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                              onPressed: () => openExternal(
                                context,
                                'https://wa.me/?text=${Uri.encodeComponent('Je recommande GLOBUS ENGINEERING : ${amb.s('share_url')}')}',
                              ),
                              icon: const Icon(Icons.chat),
                              label: const Text('WhatsApp'),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              StatGrid(
                children: [
                  StatTile(label: 'Recommandations', value: '${amb.obj('stats').i('referrals')}'),
                  StatTile(label: 'Contrats signés', value: '${amb.obj('stats').i('signed')}', tone: Tone.info),
                  StatTile(label: 'Primes en validation', value: money(amb.obj('stats')['pending']), tone: Tone.warning),
                  StatTile(label: 'Primes versées', value: money(amb.obj('stats')['paid']), tone: Tone.success),
                ],
              ),
              SectionCard(
                icon: Icons.smartphone,
                title: 'Versement des primes',
                subtitle: amb.b('has_payout')
                    ? 'Numéro enregistré : ${amb.s('momo_hint')} (${amb.s('momo_operator') == 'orange' ? 'Orange Money' : 'MTN MoMo'})'
                    : 'Aucun numéro enregistré',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _momo,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: amb.b('has_payout') ? 'Nouveau numéro Mobile Money' : 'Numéro Mobile Money',
                        hintText: '6 7X XX XX XX',
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 10),
                    _operatorField(),
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: _momo.text.replaceAll(RegExp(r'\D'), '').length < 9
                          ? null
                          : () async {
                              final ok = await runAction(
                                context,
                                () => context.api.put('/client/referral/payout', body: {'momo_number': _momo.text.trim(), 'momo_operator': _operator}),
                                success: 'Numéro de versement enregistré. Par sécurité, une prime ne part pas vers un numéro modifié depuis moins de 30 jours sans contrôle.',
                              );
                              if (ok != null) {
                                _momo.clear();
                                await handle.reload();
                              }
                            },
                      child: const Text('Enregistrer'),
                    ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Mes recommandations',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (s.list('referrals').isEmpty)
                      const EmptyView(
                        title: "Aucune recommandation pour l'instant",
                        text: 'Partagez votre lien : chaque demande déposée avec votre code apparaîtra ici.',
                      ),
                    for (final r in s.list('referrals'))
                      ListTile(
                        title: Text(r.s('referee')),
                        subtitle: Text(
                          'Recommandé le ${date(r['created_at'])}${r.has('signed_at') ? ' · contrat signé le ${date(r['signed_at'])}' : ''}${r.has('paid_at') ? ' · prime versée le ${date(r['paid_at'])}' : ''}${r.has('rejection_reason') ? ' · ${r.s('rejection_reason')}' : ''}',
                          style: theme.textTheme.bodySmall,
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (r.d('amount') > 0) Text(money(r['amount']), style: const TextStyle(fontWeight: FontWeight.w700)),
                            ToneBadge(_status[r.s('status')]?.$1 ?? r.s('status'), tone: _status[r.s('status')]?.$2 ?? Tone.neutral),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
