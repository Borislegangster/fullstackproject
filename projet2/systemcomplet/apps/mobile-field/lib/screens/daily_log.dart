import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import '../field_state.dart';
import 'media.dart';

/// Journal de chantier : rapports quotidiens (saisie hors ligne, envoi automatique, conflit si le rapport du jour
/// existe déjà au bureau), soumission au chef de projet, photos du jour.
class DailyLogsScreen extends StatefulWidget {
  const DailyLogsScreen({super.key});
  @override
  State<DailyLogsScreen> createState() => _DailyLogsScreenState();
}

class _DailyLogsScreenState extends State<DailyLogsScreen> {
  final _list = PagedListController();

  Future<void> _edit(J project, [J? log]) async {
    final saved = await Navigator.of(context, rootNavigator: true).push<bool>(
      MaterialPageRoute(
        builder: (_) => DailyLogFormScreen(project: project, log: log),
      ),
    );
    if (saved == true) unawaited(_list.reload());
  }

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => Scaffold(
        floatingActionButton: context.can('site:report')
            ? FloatingActionButton.extended(
                heroTag: 'log-new',
                onPressed: () => _edit(project),
                icon: const Icon(Icons.edit_note),
                label: const Text('Rapport du jour'),
              )
            : null,
        body: PagedListView(
          path: '/daily-logs',
          controller: _list,
          query: {'project_id': project.s('id')},
          padding: const EdgeInsets.only(bottom: 96),
          empty: const EmptyView(
            icon: Icons.menu_book_outlined,
            title: 'Aucun rapport',
            text: 'Le rapport du jour résume travaux, effectifs, météo, incidents et besoins.',
          ),
          itemBuilder: (context, l, _) => ListTile(
            onTap: () => _edit(project, l),
            leading: CircleAvatar(
              backgroundColor: l.b('is_critical') ? GlobusColors.danger.withValues(alpha: 0.12) : GlobusTokens.brand50,
              child: Icon(l.b('is_critical') ? Icons.priority_high : Icons.event_note, color: l.b('is_critical') ? GlobusColors.danger : GlobusColors.primary),
            ),
            title: Text(dayLong(l['log_date'])),
            subtitle: Text(
              [
                if (l.i('workforce_count') > 0) '${l.i('workforce_count')} ouvrier(s)',
                if (l.has('weather')) l.s('weather'),
                if (l.has('activities')) l.s('activities'),
              ].join(' · '),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: StatusBadge(l.s('status')),
          ),
        ),
      ),
    );
  }
}

const _weather = ['Ensoleillé', 'Nuageux', 'Pluie légère', 'Forte pluie', 'Orage', 'Vent fort'];

class DailyLogFormScreen extends StatefulWidget {
  const DailyLogFormScreen({super.key, required this.project, this.log});
  final J project;
  final J? log;
  @override
  State<DailyLogFormScreen> createState() => _DailyLogFormScreenState();
}

class _DailyLogFormScreenState extends State<DailyLogFormScreen> {
  late final J? _log = widget.log;
  late DateTime _date = _log?.date('log_date') ?? DateTime.now();
  late final Map<String, TextEditingController> _c = {
    for (final k in const ['activities', 'issues', 'needs', 'safety_notes', 'deliveries_summary', 'visitors']) k: TextEditingController(text: _log?.s(k) ?? ''),
    'workforce_count': TextEditingController(text: '${_log?.i('workforce_count') ?? 0}'),
    'subcontractor_workforce': TextEditingController(text: '${_log?.i('subcontractor_workforce') ?? 0}'),
    'delay_hours': TextEditingController(text: _log?.str('delay_hours') ?? ''),
    'temperature_c': TextEditingController(text: _log?.str('temperature_c') ?? ''),
  };
  late String? _weatherValue = _log?.str('weather');
  bool _busy = false;

  bool get _locked => _log != null && const ['submitted', 'validated'].contains(_log.s('status'));

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> get _payload {
    String? t(String k) => _c[k]!.text.trim().isEmpty ? null : _c[k]!.text.trim();
    num? n(String k) => num.tryParse(_c[k]!.text.replaceAll(',', '.'));
    return {
      'project_id': widget.project.s('id'),
      'log_date': isoDate(_date),
      'weather': _weatherValue,
      'temperature_c': n('temperature_c'),
      'workforce_count': n('workforce_count')?.toInt() ?? 0,
      'subcontractor_workforce': n('subcontractor_workforce')?.toInt() ?? 0,
      'activities': t('activities'),
      'issues': t('issues'),
      'needs': t('needs'),
      'safety_notes': t('safety_notes'),
      'deliveries_summary': t('deliveries_summary'),
      'visitors': t('visitors'),
      'delay_hours': n('delay_hours'),
    };
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    final queue = context.read<OfflineQueue>();
    final payload = _payload;
    if (_log == null) {
      await queue.enqueueMutation(label: 'Rapport du ${date(isoDate(_date))}', entity: 'daily_log', operation: 'create', payload: payload);
    } else {
      payload.remove('project_id');
      payload.remove('log_date');
      await queue.enqueueMutation(
        label: 'Rapport du ${date(_log['log_date'])} (modification)',
        entity: 'daily_log',
        operation: 'update',
        entityId: _log.s('id'),
        baseVersion: _log.intOrNull('version'),
        payload: payload,
      );
    }
    final report = await queue.sync();
    if (!mounted) return;
    setState(() => _busy = false);
    context.toast(
      report.offline
          ? 'Hors ligne : rapport enregistré sur le téléphone, envoi automatique au retour du réseau.'
          : (report.conflicts > 0 ? 'Un rapport existe déjà pour ce jour : choisissez la version à garder dans « Synchronisation ».' : 'Rapport enregistré'),
      success: !report.offline && report.conflicts == 0,
    );
    Navigator.pop(context, true);
  }

  Future<void> _submit() async {
    final ok = await confirmDialog(
      context,
      title: 'Soumettre le rapport ?',
      message: 'Le chef de projet est prévenu ; le rapport ne sera plus modifiable après validation.',
      confirm: 'Soumettre',
    );
    if (!ok || !mounted) return;
    final res = await runAction(context, () => context.api.post('/daily-logs/${_log!.s('id')}/submit'), success: 'Rapport soumis');
    if (res != null && mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    Widget field(String key, String label, {int lines = 3, TextInputType? type}) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _c[key],
        enabled: !_locked,
        minLines: type == null ? 1 : null,
        maxLines: type == null ? lines : 1,
        keyboardType: type,
        decoration: InputDecoration(labelText: label, helperText: type == null ? 'Astuce : dictez avec le micro du clavier.' : null),
      ),
    );
    return Scaffold(
      appBar: AppBar(title: Text(_log == null ? 'Rapport du jour' : 'Rapport du ${date(_log['log_date'])}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_locked) AlertBox(tone: Tone.info, message: 'Rapport ${statusLabel(_log!.s('status')).toLowerCase()} : consultation seule.'),
          if (_log == null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Date'),
              subtitle: Text(dayLong(isoDate(_date))),
              trailing: const Icon(Icons.edit_calendar),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime.now().subtract(const Duration(days: 30)),
                  lastDate: DateTime.now(),
                );
                if (d != null) setState(() => _date = d);
              },
            ),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _weather.contains(_weatherValue) ? _weatherValue : null,
            decoration: const InputDecoration(labelText: 'Météo'),
            items: [for (final w in _weather) DropdownMenuItem(value: w, child: Text(w))],
            onChanged: _locked ? null : (v) => setState(() => _weatherValue = v),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: field('workforce_count', 'Ouvriers GLOBUS', type: TextInputType.number)),
              const SizedBox(width: 8),
              Expanded(child: field('subcontractor_workforce', 'Sous-traitants', type: TextInputType.number)),
            ],
          ),
          Row(
            children: [
              Expanded(child: field('temperature_c', 'Température (°C)', type: const TextInputType.numberWithOptions(decimal: true))),
              const SizedBox(width: 8),
              Expanded(child: field('delay_hours', 'Heures perdues', type: const TextInputType.numberWithOptions(decimal: true))),
            ],
          ),
          field('activities', 'Travaux réalisés', lines: 6),
          field('issues', 'Difficultés / incidents'),
          field('needs', 'Besoins (matériaux, matériel, main-d\'œuvre)'),
          field('safety_notes', 'Sécurité'),
          field('deliveries_summary', 'Livraisons du jour'),
          field('visitors', 'Visiteurs'),
          if (_log != null)
            SectionCard(
              title: 'Photos du jour',
              trailing: _locked
                  ? null
                  : TextButton.icon(
                      onPressed: () =>
                          captureSiteMedia(context, projectId: widget.project.s('id'), dailyLogId: _log.s('id'), label: 'Rapport du ${date(_log['log_date'])}'),
                      icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                      label: const Text('Ajouter'),
                    ),
              child: SiteMediaStrip(projectId: widget.project.s('id')),
            ),
          const SizedBox(height: 16),
          if (!_locked) BusyButton(label: 'Enregistrer', icon: Icons.save_outlined, expand: true, busy: _busy, onPressed: _save),
          if (_log != null && _log.s('status') == 'draft') ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(onPressed: _submit, icon: const Icon(Icons.send), label: const Text('Soumettre au chef de projet')),
          ],
        ],
      ),
    );
  }
}
