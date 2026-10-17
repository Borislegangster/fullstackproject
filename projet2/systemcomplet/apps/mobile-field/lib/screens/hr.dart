import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import '../field_state.dart';
import 'scanner.dart';

const _leaveKinds = [('conge', 'Congé payé'), ('maladie', 'Maladie'), ('sans_solde', 'Sans solde'), ('autre', 'Autre motif')];

bool _today(J row) => isoDate(DateTime.now()) == row.s('work_date');

/// Auto-pointage par QR du chantier (géolocalisation obligatoire, envoi différé hors ligne, rejouable sans
/// doublon) ; pour l'encadrement : pointage des badges et présences du jour à valider.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key, this.siteCode});

  /// Code lu par le scanner universel : déclenche directement l'auto-pointage.
  final String? siteCode;
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _me = GlobalKey<_MyAttendanceState>();

  @override
  void initState() {
    super.initState();
    final code = widget.siteCode;
    if (code != null) WidgetsBinding.instance.addPostFrameCallback((_) => _me.currentState?.selfScan(code));
  }

  @override
  Widget build(BuildContext context) {
    final lead = context.can('hr:write') || context.can('site:report');
    final self = context.can('attendance:self');
    if (!lead) return _MyAttendance(key: _me);
    return DefaultTabController(
      length: self ? 2 : 1,
      child: Column(
        children: [
          TabBar(
            tabs: [
              if (self) const Tab(text: 'Mon pointage'),
              const Tab(text: 'Équipe du jour'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                if (self) _MyAttendance(key: _me),
                const _TeamAttendance(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MyAttendance extends StatefulWidget {
  const _MyAttendance({super.key});
  @override
  State<_MyAttendance> createState() => _MyAttendanceState();
}

class _MyAttendanceState extends State<_MyAttendance> {
  final _view = GlobalKey();
  ApiHandle? _handle;
  bool _busy = false;

  Future<void> selfScan([String? scanned]) async {
    final code = scanned ?? await scanCode(context, title: 'QR du chantier');
    if (code == null || !mounted) return;
    final action = await pickOption<String>(context, title: 'Pointage', options: const [('in', 'Arrivée'), ('out', 'Départ')]);
    if (action == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final position = await currentPosition(context, required: true);
      if (position == null || !mounted) return;
      final queue = context.read<OfflineQueue>();
      await queue.enqueueRequest(
        label: 'Auto-pointage (${action == 'in' ? 'arrivée' : 'départ'})',
        path: '/hr/attendance/self',
        body: {
          'site_code': code,
          'action': action,
          'at': DateTime.now().toUtc().toIso8601String(),
          'latitude': position.latitude,
          'longitude': position.longitude,
        },
      );
      final report = await queue.sync();
      if (!mounted) return;
      if (report.offline) {
        context.toast('Pointage enregistré sur le téléphone (heure et position conservées) : envoi au retour du réseau.');
      } else if (report.rejected > 0) {
        final op = queue.items.where((o) => o.status == 'rejected' && o.path == '/hr/attendance/self').lastOrNull;
        context.toast(op?.error ?? 'Pointage refusé', error: true);
        if (op != null) await queue.discard(op);
      } else {
        context.toast(action == 'in' ? 'Arrivée enregistrée' : 'Départ enregistré', success: true);
      }
      await _handle?.reload();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ApiView(
      key: _view,
      path: '/hr/me',
      builder: (context, data, handle) {
        _handle = handle;
        final me = J.of(data);
        if (me.objOrNull('employee') == null) {
          return const EmptyView(
            icon: Icons.badge_outlined,
            title: 'Aucune fiche employé',
            text: 'Votre compte n\'est pas encore rattaché à une fiche du personnel : contactez les ressources humaines.',
          );
        }
        final rows = me.list('attendance');
        final today = rows.where(_today).firstOrNull;
        return PageList(
          children: [
            SectionCard(
              title: 'Aujourd\'hui',
              icon: Icons.today_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  InfoRow('Arrivée', today == null || !today.has('check_in') ? null : time(today['check_in'])),
                  InfoRow('Départ', today == null || !today.has('check_out') ? null : time(today['check_out'])),
                  if (today != null && today['inside_geofence'] == false)
                    const AlertBox(tone: Tone.warning, message: 'Pointage hors du périmètre du chantier : il sera vérifié par votre responsable.'),
                  const SizedBox(height: 12),
                  BusyButton(label: 'Scanner le QR du chantier', icon: Icons.qr_code_scanner, busy: _busy, expand: true, onPressed: selfScan),
                ],
              ),
            ),
            Consumer<OfflineQueue>(
              builder: (context, queue, _) {
                final pending = queue.items.where((o) => o.path == '/hr/attendance/self' && o.status == 'pending').toList();
                if (pending.isEmpty) return const SizedBox.shrink();
                return AlertBox(
                  tone: Tone.info,
                  title: 'En attente d\'envoi',
                  message: pending.map((o) => '${o.label} · ${dateTime(o.payload['at'])}').join('\n'),
                );
              },
            ),
            SectionCard(
              title: 'Mes 31 derniers jours',
              child: Column(
                children: [
                  if (rows.isEmpty) const Text('Aucun pointage.'),
                  for (final a in rows)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(dayLong(a['work_date'])),
                      subtitle: Text(
                        [
                          if (a.has('check_in')) '${time(a['check_in'])} → ${a.has('check_out') ? time(a['check_out']) : '…'}',
                          if (toDouble(a['hours_worked']) > 0) '${number(a['hours_worked'], 1)} h',
                          if (toDouble(a['overtime_hours']) > 0) 'dont ${number(a['overtime_hours'], 1)} h sup.',
                        ].join(' · '),
                      ),
                      trailing: StatusBadge(a.s('status')),
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

class _TeamAttendance extends StatefulWidget {
  const _TeamAttendance();
  @override
  State<_TeamAttendance> createState() => _TeamAttendanceState();
}

class _TeamAttendanceState extends State<_TeamAttendance> {
  final _list = PagedListController();

  Future<void> _badge() async {
    final code = await scanCode(context, title: 'Badge de l\'ouvrier');
    if (code == null || !mounted) return;
    await recordBadgeScan(context, code);
    unawaited(_list.reload());
  }

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) {
        final today = isoDate(DateTime.now());
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            heroTag: 'badge-scan',
            onPressed: _badge,
            icon: const Icon(Icons.badge_outlined),
            label: const Text('Scanner un badge'),
          ),
          body: PagedListView(
            path: '/hr/attendance',
            controller: _list,
            query: {'project_id': project.s('id'), 'start': today, 'end': today, 'page_size': 100},
            padding: const EdgeInsets.only(bottom: 96),
            empty: const EmptyView(
              icon: Icons.groups_outlined,
              title: 'Aucun pointage aujourd\'hui',
              text: 'Scannez le badge de chaque ouvrier à l\'arrivée et au départ (fonctionne hors ligne).',
            ),
            itemBuilder: (context, a, _) => ListTile(
              leading: Avatar(name: a.s('employee')),
              title: Text(a.s('employee')),
              subtitle: Text(
                [
                  if (a.has('matricule')) a.s('matricule'),
                  if (a.has('check_in')) '${time(a['check_in'])} → ${a.has('check_out') ? time(a['check_out']) : '…'}',
                  if (a['inside_geofence'] == false) 'hors périmètre',
                ].join(' · '),
              ),
              trailing: a.has('validated_at')
                  ? const Icon(Icons.verified, color: GlobusColors.success)
                  : TextButton(
                      onPressed: () async {
                        final ok = await runAction(context, () => context.api.post('/hr/attendance/${a.s('id')}/validate'), success: 'Pointage validé');
                        if (ok != null) unawaited(_list.reload());
                      },
                      child: const Text('Valider'),
                    ),
            ),
          ),
        );
      },
    );
  }
}

/// Mon espace salarié : fiche, pointages, congés (demande), bulletins de paie (téléchargement filigrané).
class MySpaceScreen extends StatelessWidget {
  const MySpaceScreen({super.key});

  Future<void> _leave(BuildContext context, ApiHandle handle) async {
    final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => const _LeaveSheet());
    if (ok == true) await handle.reload();
  }

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/hr/me',
      builder: (context, data, handle) {
        final me = J.of(data);
        final e = me.objOrNull('employee');
        if (e == null) {
          return const EmptyView(
            icon: Icons.badge_outlined,
            title: 'Aucune fiche employé',
            text: 'Votre compte n\'est pas encore rattaché à une fiche du personnel : contactez les ressources humaines.',
          );
        }
        final month = me.list('attendance').where((a) => (a.str('work_date') ?? '').startsWith(isoDate(DateTime.now()).substring(0, 7)));
        final hours = month.fold<double>(0, (t, a) => t + toDouble(a['hours_worked']));
        return PageList(
          children: [
            PageHeader(
              title: e.s('full_name'),
              subtitle: [if (e.has('job_title')) e.s('job_title'), if (e.has('matricule')) 'matricule ${e.s('matricule')}'].join(' · '),
            ),
            StatGrid(
              children: [
                StatTile(label: 'Jours pointés ce mois', value: '${month.length}', icon: Icons.event_available_outlined),
                StatTile(label: 'Heures ce mois', value: '${number(hours, 1)} h', icon: Icons.schedule_outlined),
              ],
            ),
            SectionCard(
              title: 'Ma fiche',
              child: Column(
                children: [
                  InfoRow('Métier', e.has('trade') ? optionLabel(e.s('trade')) : null),
                  InfoRow('Contrat', e.has('contract_type') ? optionLabel(e.s('contract_type')) : null),
                  InfoRow('Date d\'entrée', e.has('hire_date') ? date(e['hire_date']) : null),
                  InfoRow('Téléphone', e.str('phone')),
                ],
              ),
            ),
            SectionCard(
              title: 'Mes congés',
              trailing: TextButton.icon(onPressed: () => _leave(context, handle), icon: const Icon(Icons.add), label: const Text('Demander')),
              child: Column(
                children: [
                  if (me.list('leaves').isEmpty) const Text('Aucune demande.'),
                  for (final l in me.list('leaves'))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text('${_leaveKinds.where((k) => k.$1 == l.s('kind')).firstOrNull?.$2 ?? optionLabel(l.s('kind'))} · ${number(l['days'], 1)} j'),
                      subtitle: Text('du ${date(l['start_date'])} au ${date(l['end_date'])}'),
                      trailing: StatusBadge(l.s('status')),
                    ),
                ],
              ),
            ),
            SectionCard(
              title: 'Mes bulletins de paie',
              child: Column(
                children: [
                  if (me.list('payslips').isEmpty) const Text('Aucun bulletin disponible.'),
                  for (final p in me.list('payslips'))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.picture_as_pdf_outlined, color: GlobusColors.danger),
                      title: Text(p.s('title')),
                      subtitle: Text('publié le ${date(p['created_at'])}'),
                      trailing: const Icon(Icons.download_outlined),
                      onTap: () => openRemoteFile(context, '/hr/documents/${p.s('id')}/file'),
                    ),
                ],
              ),
            ),
            const FootNote('Chaque ouverture d\'un document RH est journalisée et le fichier porte votre nom en filigrane.'),
          ],
        );
      },
    );
  }
}

class _LeaveSheet extends StatefulWidget {
  const _LeaveSheet();
  @override
  State<_LeaveSheet> createState() => _LeaveSheetState();
}

class _LeaveSheetState extends State<_LeaveSheet> {
  String _kind = 'conge';
  DateTimeRange? _range;
  final _reason = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final now = DateTime.now();
    final r = await showDateRangePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
      initialDateRange: _range,
    );
    if (r != null) setState(() => _range = r);
  }

  Future<void> _submit() async {
    final r = _range;
    if (r == null) return;
    setState(() => _busy = true);
    final res = await runAction(
      context,
      () => context.api.post(
        '/hr/leaves',
        body: {
          'kind': _kind,
          'start_date': isoDate(r.start),
          'end_date': isoDate(r.end),
          if (_reason.text.trim().isNotEmpty) 'reason': _reason.text.trim(),
        },
      ),
      success: 'Demande envoyée à votre responsable',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (res != null) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final r = _range;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          children: [
            Text('Demande de congé', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Type'),
              items: [for (final k in _leaveKinds) DropdownMenuItem(value: k.$1, child: Text(k.$2))],
              onChanged: (v) => setState(() => _kind = v ?? 'conge'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pick,
              icon: const Icon(Icons.date_range_outlined),
              label: Text(r == null ? 'Choisir les dates' : 'du ${date(r.start)} au ${date(r.end)}'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _reason,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Motif (facultatif)'),
            ),
            const SizedBox(height: 16),
            BusyButton(label: 'Envoyer la demande', icon: Icons.send_outlined, busy: _busy, expand: true, onPressed: r == null ? null : _submit),
          ],
        ),
      ),
    );
  }
}
