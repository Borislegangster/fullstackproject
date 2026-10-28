import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

import '../project.dart';

/// Digital Project Passport (§6.1) : identité, contrat et avenants, budget et paiements, planning, versions de plans,
/// décisions, livraisons et dépenses, partenaires, garanties, SAV, journal des validations.
class PassportScreen extends StatelessWidget {
  const PassportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/passport',
        builder: (context, data, _) {
          final d = J.of(data);
          final id = d.obj('identity');
          final f = d.obj('finance');
          final c = cur(f);
          final contract = d.objOrNull('contract');
          final theme = Theme.of(context);
          return PageList(
            children: [
              PageHeader(eyebrow: 'Digital Project Passport', title: id.s('name'), subtitle: "Toute l'information fiable de votre projet, en un seul lieu."),
              SectionCard(
                title: 'Identité du projet',
                child: Column(
                  children: [
                    InfoRow('Référence', id.s('code')),
                    InfoRow(
                      'Statut',
                      null,
                      valueWidget: Align(
                        alignment: Alignment.centerLeft,
                        child: StatusBadge(id.s('status'), label: optionLabel(id.s('status'))),
                      ),
                    ),
                    InfoRow('Univers', optionLabel(id.str('universe'))),
                    InfoRow('Type', optionLabel(id.str('type'))),
                    InfoRow('Adresse', [id.str('address'), id.str('city')].whereType<String>().join(', ')),
                    InfoRow('Surface / niveaux', '${id.has('surface_m2') ? '${number(id['surface_m2'])} m²' : '—'} · ${id.str('levels') ?? '—'} niveau(x)'),
                  ],
                ),
              ),
              SectionCard(
                title: 'Contrat et avenants',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (contract == null)
                      Text('Contrat non encore rattaché.', style: theme.textTheme.bodySmall)
                    else ...[
                      InfoRow('Contrat', '${contract.s('number')} — ${contract.s('title')}'),
                      InfoRow('Signé le', date(contract['signed_at'])),
                      InfoRow('Montant du contrat (avenants non inclus)', money(contract['amount'], c)),
                      InfoRow('Avenants approuvés (à part)', money(f['approved_changes'], c)),
                      InfoRow('Total contrat et avenants', money(f['total_with_changes'], c)),
                    ],
                    for (final co in d.list('change_orders'))
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${co.s('number')} — ${co.s('title')}'),
                        subtitle: Text('${money(co['cost_impact'], c)} · ${co.i('delay_impact_days')} j'),
                        trailing: StatusBadge(co.s('status')),
                      ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Budget et paiements',
                child: Column(
                  children: [
                    InfoRow('Appelé', money(f['called'], c)),
                    InfoRow('Payé', money(f['paid'], c)),
                    InfoRow('Reste dû', money(f['due'], c)),
                    InfoRow('Paiements', '${d.list('payments').length}'),
                    const Divider(),
                    for (final p in d.list('payments'))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(child: Text('${p.s('number')} · ${optionLabel(p.str('method'))}')),
                            Text('${money(p['amount'], c)} · ${date(p['paid_at'])}', style: theme.textTheme.bodySmall),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Planning et jalons',
                subtitle: 'Du ${date(d.obj('planning')['start_planned'])} au ${date(d.obj('planning')['end_planned'])}',
                child: MilestoneTimeline(items: d.obj('planning').list('milestones')),
              ),
              SectionCard(
                title: 'Versions de plans',
                subtitle: 'Une version obsolète est remplacée dès la publication de la suivante.',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (d.list('plans').isEmpty) Text('Aucun plan publié.', style: theme.textTheme.bodySmall),
                    for (final plan in d.list('plans'))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(plan.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                for (final v in plan.list('versions'))
                                  ToneBadge(
                                    '${v.s('label')} · ${v.s('status') == 'published' ? 'en vigueur' : 'obsolète le ${date(v['obsolete_at'])}'}',
                                    tone: v.s('status') == 'published' ? Tone.success : Tone.neutral,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Décisions client',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (d.list('decisions').isEmpty) const ListTile(title: Text('Aucune décision.')),
                    for (final dec in d.list('decisions'))
                      ListTile(
                        title: Text('${dec.s('number')} — ${dec.s('title')}'),
                        subtitle: Text(
                          [
                            if (dec.has('selected_option')) 'Option : ${dec.s('selected_option')}',
                            if (dec.has('price_impact')) money(dec['price_impact'], c),
                            if (dec.i('delay_impact_days') != 0) '${dec.i('delay_impact_days')} j',
                            if (dec.has('validated_at')) 'validée le ${dateTime(dec['validated_at'])} (${optionLabel(dec.str('validation_method'))})',
                          ].join(' · '),
                        ),
                        trailing: StatusBadge(dec.s('status')),
                      ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Livraisons et dépenses publiées',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (d.list('deliveries_and_expenses').isEmpty) const ListTile(title: Text('Aucune dépense publiée.')),
                    for (final e in d.list('deliveries_and_expenses'))
                      ListTile(
                        dense: true,
                        title: Text(e.s('label')),
                        subtitle: Text('${optionLabel(e.s('category'))} · ${date(e['date'])}'),
                        trailing: Text(money(e['amount'], c), style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                  ],
                ),
              ),
              SectionCard(
                title: 'Partenaires, garanties et SAV',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (d.list('subcontractors').isEmpty)
                      Text('Les intervenants sont communiqués par votre chef de projet.', style: theme.textTheme.bodySmall)
                    else
                      for (final s in d.list('subcontractors'))
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: s.s('name'),
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                TextSpan(text: ' — ${s.s('scope')} '),
                                TextSpan(text: '(${s.strings('trades').map(optionLabel).join(', ')})', style: theme.textTheme.bodySmall),
                              ],
                            ),
                          ),
                        ),
                    const SizedBox(height: 8),
                    for (final w in d.list('warranties'))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: optionLabel(w.s('kind')),
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              TextSpan(text: ' : du ${date(w['start_date'])} au ${date(w['end_date'])}${w.has('insurer') ? ' · ${w.s('insurer')}' : ''}'),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    Text('SAV : ${d.obj('after_sales').i('tickets')} demande(s), dont ${d.obj('after_sales').i('open')} en cours.'),
                  ],
                ),
              ),
              SectionCard(
                title: 'Journal des validations',
                subtitle: 'Décisions irrévocables : qui, quand, comment, empreinte du contenu validé.',
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (d.list('validation_journal').isEmpty) const ListTile(title: Text('Aucune validation enregistrée.')),
                    for (final v in d.list('validation_journal'))
                      ListTile(
                        leading: const Icon(Icons.verified_user, color: GlobusColors.success),
                        title: Text(v.s('what')),
                        subtitle: Text(
                          '${dateTime(v['when'])} · ${optionLabel(v.str('how'))}${v.has('hash') ? ' · ${v.s('hash').substring(0, v.s('hash').length.clamp(0, 20))}…' : ''}',
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
