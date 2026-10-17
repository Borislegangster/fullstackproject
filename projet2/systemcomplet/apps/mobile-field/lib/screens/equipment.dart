import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import '../field_state.dart';
import 'scanner.dart';

const _incidentKinds = [('breakdown', 'Panne'), ('damage', 'Casse / dégât'), ('theft', 'Vol'), ('accident', 'Accident')];
const _conditions = [('new', 'Neuf'), ('good', 'Bon état'), ('fair', 'État moyen'), ('poor', 'Mauvais état')];

double? _num(String text) => double.tryParse(text.replaceAll(',', '.').replaceAll(' ', '').trim());

/// Matériel et engins présents sur le chantier ; fiche par scan du QR collé sur l'engin.
class EquipmentScreen extends StatelessWidget {
  const EquipmentScreen({super.key});

  Future<void> _scan(BuildContext context) async {
    final code = await scanCode(context, title: 'QR du matériel');
    if (code != null && context.mounted) await EquipmentDetailScreen.open(context, code: code);
  }

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          heroTag: 'eqp-scan',
          onPressed: () => _scan(context),
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scanner'),
        ),
        body: PagedListView(
          path: '/equipment',
          query: {'project_id': project.s('id')},
          padding: const EdgeInsets.only(bottom: 96),
          empty: const EmptyView(icon: Icons.construction_outlined, title: 'Aucun matériel affecté', text: 'Scannez le QR d\'un engin pour ouvrir sa fiche.'),
          itemBuilder: (context, e, _) => ListTile(
            onTap: () => EquipmentDetailScreen.open(context, id: e.s('id')),
            leading: const Icon(Icons.construction_outlined, color: GlobusColors.primary),
            title: Text('${e.s('code')} — ${e.s('name')}'),
            subtitle: Text([optionLabel(e.s('category')), if (e.has('registration')) e.s('registration'), '${number(e['meter_hours'], 1)} h'].join(' · ')),
            trailing: StatusBadge(e.s('status')),
          ),
        ),
      ),
    );
  }
}

/// Fiche matériel : état, compteurs, échéances, affectations ; relevé d'utilisation, panne / casse avec photos,
/// position (si la politique de suivi l'autorise), affectation au chantier et restitution (parc).
class EquipmentDetailScreen extends StatelessWidget {
  const EquipmentDetailScreen({super.key, this.id, this.code, this.routed = false});
  final String? id;
  final String? code;

  /// Page du routeur (barre fournie par le cadre de l'application).
  final bool routed;

  static Future<void> open(BuildContext context, {String? id, String? code}) => Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      builder: (_) => EquipmentDetailScreen(id: id, code: code),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: routed ? null : AppBar(title: const Text('Matériel')),
      body: ApiView(
        path: id != null ? '/equipment/$id' : '/equipment/lookup',
        query: id != null ? null : {'code': code},
        builder: (context, data, handle) {
          final e = J.of(data);
          final eid = e.s('id');
          final project = context.read<FieldProjects>().project;
          final canReport = context.can('equipment:write') || context.can('site:report');
          final canWrite = context.can('equipment:write');
          final soon = DateTime.now().add(const Duration(days: 30));
          final openIncidents = e.list('incidents').where((i) => i.s('status') != 'resolved').toList();
          return PageList(
            children: [
              PageHeader(
                eyebrow: e.s('code'),
                title: e.s('name'),
                subtitle: [optionLabel(e.s('category')), if (e.has('brand')) e.s('brand'), if (e.has('model')) e.s('model')].join(' · '),
                trailing: StatusBadge(e.s('status')),
              ),
              for (final (label, key) in const [('Assurance', 'insurance_until'), ('Contrôle technique', 'inspection_until')])
                if (e.date(key) != null && e.date(key)!.isBefore(soon))
                  AlertBox(tone: e.date(key)!.isBefore(DateTime.now()) ? Tone.danger : Tone.warning, message: '$label : échéance le ${date(e[key])}.'),
              if (openIncidents.isNotEmpty)
                AlertBox(
                  tone: Tone.danger,
                  title: 'Incident en cours',
                  message: openIncidents.map((i) => '${_label(_incidentKinds, i.s('kind'))} · ${dateTime(i['occurred_at'])}').join('\n'),
                ),
              StatGrid(
                children: [
                  StatTile(label: 'Compteur', value: '${number(e['meter_hours'], 1)} h', icon: Icons.timer_outlined),
                  StatTile(label: 'Kilométrage', value: '${number(e['meter_km'])} km', icon: Icons.speed),
                ],
              ),
              SectionCard(
                child: Column(
                  children: [
                    InfoRow('État', _label(_conditions, e.s('condition'))),
                    InfoRow('Immatriculation', e.str('registration')),
                    InfoRow('N° de série', e.str('serial_number')),
                    InfoRow('Propriété', optionLabel(e.s('ownership'))),
                  ],
                ),
              ),
              if (canReport)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: () => _usage(context, e, project, handle),
                      icon: const Icon(Icons.edit_note),
                      label: const Text('Relevé du jour'),
                    ),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(foregroundColor: GlobusColors.danger),
                      onPressed: () => _incident(context, e, project, handle),
                      icon: const Icon(Icons.car_crash_outlined),
                      label: const Text('Panne / casse'),
                    ),
                    if (e.b('location_tracking'))
                      OutlinedButton.icon(
                        onPressed: () async {
                          final pos = await currentPosition(context, required: true);
                          if (pos == null || !context.mounted) return;
                          await runAction(
                            context,
                            () => context.api.post('/equipment/$eid/location', body: {'latitude': pos.latitude, 'longitude': pos.longitude}),
                            success: 'Position transmise',
                          );
                        },
                        icon: const Icon(Icons.my_location),
                        label: const Text('Signaler sa position'),
                      ),
                    if (canWrite && project != null && e.str('current_project_id') != project.s('id'))
                      OutlinedButton.icon(
                        onPressed: () async {
                          await runAction(
                            context,
                            () => context.api.post('/equipment/$eid/assign', body: {'project_id': project.s('id')}),
                            success: 'Affecté au chantier ${project.s('code')}',
                          );
                          await handle.reload();
                        },
                        icon: const Icon(Icons.login),
                        label: const Text('Affecter à ce chantier'),
                      ),
                    if (canWrite && e.has('current_project_id'))
                      OutlinedButton.icon(
                        onPressed: () async {
                          final condition = await pickOption<String>(context, title: 'État au retour', options: _conditions);
                          if (condition == null || !context.mounted) return;
                          await runAction(
                            context,
                            () => context.api.post('/equipment/$eid/return', body: {'condition': condition}),
                            success: 'Matériel restitué',
                          );
                          await handle.reload();
                        },
                        icon: const Icon(Icons.logout),
                        label: const Text('Restituer'),
                      ),
                  ],
                ),
              if (e.list('consumables').isNotEmpty)
                SectionCard(
                  title: 'Consommables',
                  child: Column(
                    children: [
                      for (final c in e.list('consumables')) InfoRow(c.str('name') ?? c.str('label') ?? '—', c.str('reference') ?? c.str('specification')),
                    ],
                  ),
                ),
              if (e.list('maintenance_orders').isNotEmpty)
                SectionCard(
                  title: 'Maintenance',
                  child: Column(
                    children: [
                      for (final o in e.list('maintenance_orders').take(5))
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: Text(o.str('description') ?? optionLabel(o.s('kind'))),
                          subtitle: Text(date(o['scheduled_date'] ?? o['created_at'])),
                          trailing: StatusBadge(o.s('status')),
                        ),
                    ],
                  ),
                ),
              if (e.list('assignments').isNotEmpty)
                SectionCard(
                  title: 'Affectations',
                  child: Column(
                    children: [
                      for (final a in e.list('assignments').take(5))
                        InfoRow(
                          'du ${date(a['start_date'])}${a.has('end_date') ? ' au ${date(a['end_date'])}' : ''}',
                          a.str('notes') ?? statusLabel(a.str('status') ?? 'active'),
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

  Future<void> _usage(BuildContext context, J e, J? project, ApiHandle handle) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _UsageSheet(equipment: e, project: project),
    );
    if (ok == true) await handle.reload();
  }

  Future<void> _incident(BuildContext context, J e, J? project, ApiHandle handle) async {
    final kind = await pickOption<String>(context, title: 'Type d\'incident', options: _incidentKinds);
    if (kind == null || !context.mounted) return;
    final description = await promptText(context, title: _label(_incidentKinds, kind), label: 'Description', required: true);
    if (description == null || !context.mounted) return;
    final files = await pickAttachments(context, imagesOnly: true);
    if (!context.mounted) return;
    await runAction(context, () async {
      final ids = <String>[];
      for (final f in files) {
        ids.add(J.of(await context.api.upload('/qhse/files', files: [f])).s('file_id'));
      }
      if (!context.mounted) return;
      await context.api.post(
        '/equipment/${e.s('id')}/incidents',
        body: {
          'kind': kind,
          'occurred_at': DateTime.now().toUtc().toIso8601String(),
          'severity': kind == 'breakdown' ? 'medium' : 'high',
          'description': description,
          'photo_file_ids': ids,
          'project_id': ?project?.s('id'),
        },
      );
    }, success: 'Incident déclaré : le responsable du parc est alerté');
    await handle.reload();
  }
}

String _label(List<(String, String)> list, String? v) => list.where((e) => e.$1 == v).firstOrNull?.$2 ?? optionLabel(v);

class _UsageSheet extends StatefulWidget {
  const _UsageSheet({required this.equipment, required this.project});
  final J equipment;
  final J? project;
  @override
  State<_UsageSheet> createState() => _UsageSheetState();
}

class _UsageSheetState extends State<_UsageSheet> {
  final _hours = TextEditingController();
  final _km = TextEditingController();
  final _fuel = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_hours, _km, _fuel, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final hours = _hours.text.isEmpty ? 0.0 : _num(_hours.text);
    final km = _km.text.isEmpty ? 0.0 : _num(_km.text);
    final fuel = _fuel.text.isEmpty ? 0.0 : _num(_fuel.text);
    if (hours == null || km == null || fuel == null || hours > 24 || hours < 0 || km < 0 || fuel < 0) {
      context.toast('Valeurs invalides (24 h maximum par jour).', error: true);
      return;
    }
    setState(() => _busy = true);
    final res = await runAction(
      context,
      () => context.api.post(
        '/equipment/${widget.equipment.s('id')}/usage',
        body: {
          'hours': hours,
          'km': km,
          'fuel_liters': fuel,
          'project_id': ?widget.project?.s('id'),
          if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
        },
      ),
      success: 'Relevé enregistré',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (res != null) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          children: [
            Text('Relevé du jour · ${widget.equipment.s('code')}', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              controller: _hours,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Heures de fonctionnement', suffixText: 'h'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _km,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Kilomètres parcourus', suffixText: 'km'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _fuel,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Carburant ajouté', suffixText: 'L'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              decoration: const InputDecoration(labelText: 'Observations'),
            ),
            const SizedBox(height: 16),
            BusyButton(label: 'Enregistrer', icon: Icons.check, busy: _busy, expand: true, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
