import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';

import '../project.dart';

/// Mon bâtiment (I2) : carnet d'entretien (rappels), équipements et notices, garanties, passeport du bâtiment
/// certifié, demande d'intervention.
class BuildingScreen extends StatelessWidget {
  const BuildingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final id = project.s('id');
        return ApiView(
          path: '/client/projects/$id/building',
          builder: (context, data, handle) {
            final b = J.of(data);
            final names = {for (final e in b.list('equipment')) e.s('id'): e.s('name')};
            final theme = Theme.of(context);
            return PageList(
              children: [
                const PageHeader(
                  title: 'Mon bâtiment',
                  subtitle: "Équipements, notices, garanties et carnet d'entretien : gardez votre bâtiment en parfait état, avec des rappels au bon moment.",
                ),
                OutlinedButton.icon(
                  onPressed: () => openRemoteFile(context, '/projects/$id/building-passport.pdf', filename: 'passeport-batiment-${project.s('code')}.pdf'),
                  icon: const Icon(Icons.download),
                  label: const Text('Passeport du bâtiment (certifié)'),
                ),
                SectionCard(
                  icon: Icons.event_available,
                  title: "Carnet d'entretien",
                  subtitle: 'Rappels 14 jours et la veille de chaque échéance.',
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      if (b.list('tasks').isEmpty)
                        const EmptyView(title: 'Aucun entretien programmé', text: 'Votre carnet se remplit à la livraison, équipement par équipement.'),
                      for (final t in b.list('tasks'))
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(t.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                                  if (t.b('overdue')) const ToneBadge('En retard', tone: Tone.danger),
                                  if (t.s('status') == 'booked') const ToneBadge('Intervention planifiée', tone: Tone.info),
                                ],
                              ),
                              Text(
                                '${t.has('equipment_id') ? '${names[t.s('equipment_id')] ?? 'Équipement'} · ' : ''}avant le ${date(t['due_on'])} · ${t.s('performer') == 'client' ? 'à faire vous-même' : 'par un technicien'}',
                                style: theme.textTheme.bodySmall,
                              ),
                              if (t.s('status') == 'planned')
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: Wrap(
                                    spacing: 6,
                                    children: [
                                      if (t.s('performer') == 'client')
                                        OutlinedButton.icon(
                                          onPressed: () async {
                                            final ok = await runAction(
                                              context,
                                              () => context.api.post('/maintenance-tasks/${t.s('id')}/complete', body: <String, dynamic>{}),
                                              success: 'Entretien noté : la prochaine échéance est programmée.',
                                            );
                                            if (ok != null) await handle.reload();
                                          },
                                          icon: const Icon(Icons.check, size: 18),
                                          label: const Text("C'est fait"),
                                        ),
                                      FilledButton.icon(
                                        onPressed: () async {
                                          final note = await promptText(
                                            context,
                                            title: 'Planifier une intervention',
                                            message: t.s('title'),
                                            label: 'Précisions (disponibilités, accès…)',
                                            confirm: 'Envoyer la demande',
                                          );
                                          if (note == null || !context.mounted) return;
                                          final res = await runAction(
                                            context,
                                            () => context.api.post('/maintenance-tasks/${t.s('id')}/book', body: {'note': note.isEmpty ? null : note}),
                                          );
                                          if (res != null && context.mounted) {
                                            context.toast('Demande ${J.of(res).s('ticket_number')} créée : notre SAV vous propose un créneau.', success: true);
                                            await handle.reload();
                                          }
                                        },
                                        icon: const Icon(Icons.build_outlined, size: 18),
                                        label: const Text('Planifier une intervention'),
                                      ),
                                    ],
                                  ),
                                ),
                              const Divider(),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                SectionCard(
                  title: 'Équipements installés',
                  child: Column(
                    children: [
                      if (b.list('equipment').isEmpty)
                        const EmptyView(
                          icon: Icons.inventory_2_outlined,
                          title: 'Inventaire en préparation',
                          text: 'La liste des équipements et leurs notices vous sont remises à la livraison.',
                        ),
                      for (final e in b.list('equipment'))
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: theme.colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(14)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                optionLabel(e.s('category')).toUpperCase(),
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: GlobusTokens.accent600, letterSpacing: 0.8),
                              ),
                              Text(e.s('name'), style: const TextStyle(fontWeight: FontWeight.w700)),
                              Text(
                                '${[e.str('brand'), e.str('model')].whereType<String>().join(' ').ifEmptyDash}${e.has('location') ? ' · ${e.s('location')}' : ''}',
                                style: theme.textTheme.bodySmall,
                              ),
                              Text(
                                "${e.has('warranty_until') ? "Garantie jusqu'au ${date(e['warranty_until'])}" : 'Garantie : voir contrat'}${e.objOrNull('next_task') != null ? ' · prochain entretien le ${date(e.obj('next_task')['due_on'])}' : ''}",
                                style: theme.textTheme.bodySmall,
                              ),
                              if (e.has('manual_url'))
                                TextButton.icon(
                                  onPressed: () => openRemoteFile(context, e.s('manual_url')),
                                  icon: const Icon(Icons.menu_book_outlined, size: 18),
                                  label: const Text('Notice'),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                SectionCard(
                  icon: Icons.verified_user_outlined,
                  title: 'Garanties',
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      if (b.list('warranties').isEmpty) const ListTile(title: Text('Les garanties démarrent à la réception des travaux.')),
                      for (final w in b.list('warranties'))
                        ListTile(
                          title: Text(optionLabel(w.s('kind'))),
                          subtitle: Text("jusqu'au ${date(w['end_date'])}${w.has('insurer') ? ' · ${w.s('insurer')}' : ''}"),
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

extension on String {
  String get ifEmptyDash => isEmpty ? '—' : this;
}

const _measures = <(String, String, IconData, String)>[
  ('roof_insulation', 'Isolation de la toiture', Icons.roofing, 'Moins de chaleur sous le toit'),
  ('shading', 'Protections solaires', Icons.beach_access_outlined, 'Brise-soleil, débords de toiture'),
  ('double_glazing', 'Double vitrage', Icons.window_outlined, 'Fraîcheur et silence'),
  ('inverter_ac', 'Climatisation inverter', Icons.ac_unit, "Jusqu'à 30 % de moins"),
  ('led', 'Éclairage LED', Icons.lightbulb_outline, 'Rentabilisé en quelques mois'),
  ('solar', 'Panneaux solaires', Icons.solar_power_outlined, 'Produisez votre électricité'),
  ('battery', 'Batterie', Icons.battery_charging_full, 'Autonomie pendant les délestages'),
];

/// Énergie & confort (I3) : simulateur (facture, confort, autonomie), études enregistrées, intégration au projet.
class EnergyScreen extends StatelessWidget {
  const EnergyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final id = project.s('id');
        return ApiView(
          path: '/client/projects/$id/energy',
          builder: (context, data, handle) {
            final d = J.of(data);
            return PageList(
              children: [
                const PageHeader(
                  title: 'Énergie & confort',
                  subtitle:
                      'Simulez isolation, protections solaires, climatisation inverter, solaire et batterie sur votre projet : facture, confort, autonomie.',
                ),
                EnergySimulator(projectId: id, defaults: d.obj('defaults'), onSaved: handle.reload),
                if (d.list('studies').isNotEmpty)
                  SectionCard(
                    title: 'Mes études',
                    subtitle: '« Intégrer à mon projet » : votre chef de projet vous adresse l\'avenant chiffré à valider.',
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (final s in d.list('studies'))
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(s.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                                    ),
                                    ToneBadge(s.s('status') == 'draft' ? 'Brouillon' : 'Demandée', tone: s.s('status') == 'draft' ? Tone.neutral : Tone.accent),
                                  ],
                                ),
                                Text(
                                  '${date(s['created_at'])} · ${money(s.obj('results').obj('before')['bill_month'])} → ${money(s.obj('results').obj('after')['bill_month'])} / mois · investissement ${money(s.obj('results')['investment'])}${s.obj('results').has('payback_years') ? ' · retour ${number(s.obj('results')['payback_years'], 1)} ans' : ''}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                if (s.s('status') == 'draft')
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: FilledButton.icon(
                                      onPressed: () async {
                                        final ok = await runAction(
                                          context,
                                          () => context.api.post('/client/energy/studies/${s.s('id')}/request'),
                                          success: 'Demande transmise à votre chef de projet',
                                        );
                                        if (ok != null) await handle.reload();
                                      },
                                      icon: const Icon(Icons.send, size: 18),
                                      label: const Text('Intégrer à mon projet'),
                                    ),
                                  ),
                              ],
                            ),
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

class EnergySimulator extends StatefulWidget {
  const EnergySimulator({super.key, required this.projectId, required this.defaults, required this.onSaved});
  final String projectId;
  final J defaults;
  final Future<void> Function() onSaved;
  @override
  State<EnergySimulator> createState() => _EnergySimulatorState();
}

class _EnergySimulatorState extends State<EnergySimulator> {
  late final Map<String, dynamic> _in = {
    'surface_m2': 150,
    'levels': 1,
    'standing': 'standard',
    'occupants': 4,
    'ac_units': 3,
    'ac_hours_per_day': 8,
    'region': 'littoral',
    ...widget.defaults.raw,
    'measures': <String>['roof_insulation', 'solar'],
  };
  J? _result;
  String? _error;
  Timer? _debounce;
  final _title = TextEditingController(text: 'Mon étude énergie & confort');
  final Map<String, TextEditingController> _c = {};

  @override
  void initState() {
    super.initState();
    for (final k in const ['surface_m2', 'levels', 'occupants', 'ac_units', 'ac_hours_per_day', 'solar_kwp', 'battery_kwh']) {
      _c[k] = TextEditingController(text: _in[k]?.toString() ?? '');
    }
    _schedule();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _title.dispose();
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _schedule() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final r = J.of(await context.api.post('/public/energy/simulate', body: _in));
        if (mounted) {
          setState(() {
            _result = r;
            _error = null;
          });
        }
      } catch (e) {
        if (mounted) setState(() => _error = errorMessage(e));
      }
    });
  }

  void _setNum(String key, String text, {num min = 0, num? max, bool nullable = false}) {
    final v = num.tryParse(text.replaceAll(',', '.'));
    if (v == null) {
      if (nullable) _in[key] = null;
    } else {
      var n = v < min ? min : v;
      if (max != null && n > max) n = max;
      _in[key] = n;
    }
    _schedule();
  }

  List<String> get _measuresOn => (_in['measures'] as List).cast<String>();

  @override
  Widget build(BuildContext context) {
    final r = _result;
    final theme = Theme.of(context);
    Widget numField(String key, String label, {num min = 0, num? max, bool nullable = false, String? help}) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: _c[key],
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label, helperText: help),
        onChanged: (t) => _setNum(key, t, min: min, max: max, nullable: nullable),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionCard(
          title: 'Votre projet',
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: numField('surface_m2', 'Surface (m²)', min: 20)),
                  const SizedBox(width: 8),
                  Expanded(child: numField('levels', 'Niveaux', min: 1, max: 30)),
                ],
              ),
              Row(
                children: [
                  Expanded(child: numField('occupants', 'Occupants', min: 1)),
                  const SizedBox(width: 8),
                  Expanded(child: numField('ac_units', 'Climatiseurs')),
                ],
              ),
              numField('ac_hours_per_day', 'Heures de clim / jour', max: 24),
              DropdownButtonFormField<String>(
                initialValue: _in['region'] as String?,
                decoration: const InputDecoration(labelText: 'Région'),
                items: const [
                  DropdownMenuItem(value: 'littoral', child: Text('Littoral (Douala, Kribi…)')),
                  DropdownMenuItem(value: 'centre', child: Text('Centre / Sud / Est')),
                  DropdownMenuItem(value: 'ouest', child: Text('Ouest / Nord-Ouest')),
                  DropdownMenuItem(value: 'nord', child: Text('Grand Nord')),
                ],
                onChanged: (v) {
                  _in['region'] = v;
                  _schedule();
                },
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _in['standing'] as String?,
                decoration: const InputDecoration(labelText: 'Standing'),
                items: const [
                  DropdownMenuItem(value: 'standard', child: Text('Standard')),
                  DropdownMenuItem(value: 'confort', child: Text('Confort')),
                  DropdownMenuItem(value: 'premium', child: Text('Premium')),
                ],
                onChanged: (v) {
                  _in['standing'] = v;
                  _schedule();
                },
              ),
            ],
          ),
        ),
        const GroupTitle('Mesures à étudier'),
        for (final m in _measures)
          Card(
            margin: const EdgeInsets.only(bottom: 6),
            color: _measuresOn.contains(m.$1) ? GlobusTokens.accent50 : null,
            child: CheckboxListTile(
              value: _measuresOn.contains(m.$1),
              onChanged: (v) {
                setState(() {
                  final list = [..._measuresOn];
                  v == true ? list.add(m.$1) : list.remove(m.$1);
                  _in['measures'] = list;
                });
                _schedule();
              },
              secondary: Icon(m.$3, color: _measuresOn.contains(m.$1) ? GlobusColors.accent : GlobusColors.primary),
              title: Text(m.$2, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(m.$4),
            ),
          ),
        if (_measuresOn.contains('solar')) ...[
          const SizedBox(height: 6),
          numField('solar_kwp', 'Puissance solaire (kWc)', min: 0.5, nullable: true, help: 'Vide = dimensionnement automatique'),
          if (_measuresOn.contains('battery')) numField('battery_kwh', 'Batterie (kWh)', min: 1, nullable: true),
        ],
        const SizedBox(height: 10),
        if (_error != null) AlertBox(tone: Tone.danger, message: _error!),
        if (r == null)
          const Center(
            child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()),
          )
        else ...[
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: GlobusTokens.brand900, borderRadius: BorderRadius.circular(24)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Facture d'électricité estimée", style: TextStyle(color: GlobusTokens.brand100)),
                const SizedBox(height: 4),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.end,
                  spacing: 12,
                  children: [
                    Text(
                      money(r.obj('before')['bill_month']),
                      style: const TextStyle(color: Colors.white54, decoration: TextDecoration.lineThrough, fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    Text.rich(
                      TextSpan(
                        text: money(r.obj('after')['bill_month']),
                        style: const TextStyle(fontFamily: GlobusFonts.title, color: GlobusTokens.accent300, fontSize: 30, fontWeight: FontWeight.w800),
                        children: const [
                          TextSpan(
                            text: ' / mois',
                            style: TextStyle(fontSize: 13, color: GlobusTokens.brand100, fontWeight: FontWeight.w400),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (label, value) in [
                      ('Économie / an', money(r['savings_year'])),
                      ('Investissement', money(r['investment'])),
                      ('Retour', r.has('payback_years') ? '${number(r['payback_years'], 1)} ans' : '—'),
                      ('Gain sur 20 ans', money(r['savings_20_years'])),
                    ])
                      Container(
                        width: 140,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(label, style: const TextStyle(color: GlobusTokens.brand200, fontSize: 11.5)),
                            Text(
                              value,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: StatTile(
                  label: 'évitées / an',
                  value: '${number(r.d('co2_avoided_kg_year') / 1000, 1)} t CO₂',
                  icon: Icons.eco_outlined,
                  tone: Tone.success,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: StatTile(
                  label: "ressentis à l'intérieur",
                  value: '−${number(r['comfort_gain_degrees'], 1)} °C',
                  icon: Icons.thermostat,
                  tone: Tone.info,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: StatTile(
                  label: "d'autonomie en délestage",
                  value: r.d('autonomy_hours') > 0 ? '${number(r['autonomy_hours'], 1)} h' : '—',
                  icon: Icons.battery_charging_full,
                  tone: Tone.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (r.list('measures').isNotEmpty)
            Card(
              child: Column(
                children: [
                  for (final m in r.list('measures'))
                    ListTile(
                      title: Text(m.s('label')),
                      subtitle: Text(m.s('detail')),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '−${money(m['saving_year'])} / an',
                            style: const TextStyle(color: GlobusColors.success, fontWeight: FontWeight.w700, fontSize: 12.5),
                          ),
                          Text(
                            '${money(m['cost'])} · retour ${m.has('payback_years') ? '${number(m['payback_years'], 1)} ans' : '—'}',
                            style: theme.textTheme.bodySmall?.copyWith(fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          Text(r.s('disclaimer'), style: theme.textTheme.bodySmall),
          const SizedBox(height: 12),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(labelText: "Nom de l'étude"),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () async {
                    final ok = await runAction(
                      context,
                      () => context.api.post('/client/projects/${widget.projectId}/energy/studies', body: {'title': _title.text.trim(), 'simulation': _in}),
                      success: 'Étude enregistrée',
                    );
                    if (ok != null) await widget.onSaved();
                  },
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Enregistrer'),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
