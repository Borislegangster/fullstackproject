import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/json.dart';
import '../../context.dart';
import '../../files/files.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/primitives.dart';
import '../../widgets/ref_picker.dart';
import '../../widgets/states.dart';
import '../calls/call_controller.dart';

const kAgendaKinds = ['meeting', 'appointment', 'site_visit', 'bim_meeting', 'call', 'milestone', 'reminder'];

/// Couleurs des types d'événements (identiques au web).
const kAgendaKindColors = <String, Color>{
  'meeting': GlobusTokens.brand500,
  'appointment': GlobusTokens.accent500,
  'site_visit': GlobusTokens.success,
  'bim_meeting': Color(0xFF9333EA),
  'call': Color(0xFF0891B2),
  'milestone': GlobusTokens.warning,
  'reminder': Color(0xFF64748B),
};

Color agendaColor(String kind) => kAgendaKindColors[kind] ?? GlobusTokens.brand500;

DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);
DateTime _monday(DateTime d) => _day(d).subtract(Duration(days: d.weekday - 1));

/// Agenda partagé : mois / liste, invitations, réponses, visio, export iCalendar, création (selon droits) ;
/// `canRequest` : demande de rendez-vous du client (créneau confirmé ou déplacé par l'équipe du projet).
class AgendaScreen extends StatefulWidget {
  const AgendaScreen({super.key, this.projectId, this.canCreate = true, this.canRequest = false, this.openEventId});
  final String? projectId;
  final bool canCreate;
  final bool canRequest;
  final String? openEventId;

  @override
  State<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends State<AgendaScreen> {
  bool _list = false;
  DateTime _cursor = _day(DateTime.now());
  DateTime _selected = _day(DateTime.now());
  List<J>? _events;
  Object? _error;
  DateTime? _cachedAt;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    final open = widget.openEventId;
    if (open != null) WidgetsBinding.instance.addPostFrameCallback((_) => _openEvent(open));
  }

  @override
  void didUpdateWidget(AgendaScreen old) {
    super.didUpdateWidget(old);
    if (old.projectId != widget.projectId) unawaited(_load());
  }

  (DateTime, DateTime) get _range {
    if (_list) return (_day(_cursor), _day(_cursor).add(const Duration(days: 60)));
    final first = DateTime(_cursor.year, _cursor.month, 1);
    final s = _monday(first);
    return (s, s.add(const Duration(days: 42)));
  }

  Future<void> _load() async {
    final (start, end) = _range;
    try {
      final res = await context.api.fetch(
        '/agenda/events',
        query: {
          'start': start.toUtc().toIso8601String(),
          'end': end.toUtc().toIso8601String(),
          'project_id': widget.projectId,
        },
      );
      if (!mounted) return;
      setState(() {
        _events = listOf(res.data);
        _cachedAt = res.cachedAt;
        _error = null;
      });
    } catch (e, st) {
      reportUnexpected(e, st, 'agenda');
      if (mounted) setState(() => _error = e);
    }
  }

  List<J> _on(DateTime d) {
    final next = d.add(const Duration(days: 1));
    return (_events ?? []).where((e) {
      if (e.s('status') == 'cancelled') return false;
      final s = e.date('starts_at')?.toLocal();
      final en = e.date('ends_at')?.toLocal();
      return s != null && en != null && s.isBefore(next) && en.isAfter(d);
    }).toList();
  }

  void _shift(int n) {
    setState(() {
      _cursor = _list ? _cursor.add(Duration(days: 30 * n)) : DateTime(_cursor.year, _cursor.month + n, 1);
    });
    unawaited(_load());
  }

  Future<void> _request() async {
    final created = await Navigator.of(context, rootNavigator: true).push<J>(
      MaterialPageRoute(
        builder: (_) => AppointmentRequestScreen(projectId: widget.projectId!, day: _selected),
      ),
    );
    if (created == null || !mounted) return;
    final start = created.date('starts_at')?.toLocal();
    if (start != null) {
      setState(() {
        _cursor = _day(start);
        _selected = _day(start);
      });
    }
    await _load();
    if (mounted) unawaited(_openEvent(created.s('id')));
  }

  Future<void> _openEvent(String id) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.85,
        child: EventSheet(eventId: id, onChanged: _load),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canCreate = widget.canCreate && context.can('agenda:write');
    final canRequest = !canCreate && widget.canRequest && widget.projectId != null;
    final label = _list ? 'À partir du ${date(_cursor)}' : '${monthLong(_cursor.month)} ${_cursor.year}';
    return Scaffold(
      floatingActionButton: canRequest
          ? FloatingActionButton.extended(
              heroTag: 'agenda-request',
              onPressed: _request,
              icon: const Icon(Icons.event_available),
              label: const Text('Demander un rendez-vous'),
            )
          : canCreate
          ? FloatingActionButton.extended(
              heroTag: 'agenda-new',
              onPressed: () async {
                final created = await Navigator.of(context, rootNavigator: true).push<J>(
                  MaterialPageRoute(
                    builder: (_) => EventFormScreen(projectId: widget.projectId, day: _selected),
                  ),
                );
                if (created != null) unawaited(_load());
              },
              icon: const Icon(Icons.add),
              label: const Text('Nouvel événement'),
            )
          : null,
      body: Column(
        children: [
          if (_cachedAt != null) OfflineBanner(cachedAt: _cachedAt),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
            child: Row(
              children: [
                IconButton(tooltip: 'Précédent', onPressed: () => _shift(-1), icon: const Icon(Icons.chevron_left)),
                Expanded(
                  child: Text(label[0].toUpperCase() + label.substring(1), textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
                ),
                IconButton(tooltip: 'Suivant', onPressed: () => _shift(1), icon: const Icon(Icons.chevron_right)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Flexible(
                  child: TextButton(
                    onPressed: () {
                      setState(() {
                        _cursor = _day(DateTime.now());
                        _selected = _cursor;
                      });
                      unawaited(_load());
                    },
                    child: const Text("Aujourd'hui", overflow: TextOverflow.ellipsis),
                  ),
                ),
                const Spacer(),
                SegmentedButton<bool>(
                  // Sans coche ni marges larges : la barre tient sur les petits écrans (360 px).
                  showSelectedIcon: false,
                  style: const ButtonStyle(visualDensity: VisualDensity.compact),
                  segments: const [
                    ButtonSegment(value: false, label: Text('Mois')),
                    ButtonSegment(value: true, label: Text('Liste')),
                  ],
                  selected: {_list},
                  onSelectionChanged: (s) {
                    setState(() => _list = s.first);
                    unawaited(_load());
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: _events == null
                ? (_error != null ? ErrorView(error: _error, onRetry: _load) : const LoadingView())
                : RefreshIndicator(onRefresh: _load, child: _list ? _listView() : _monthView()),
          ),
        ],
      ),
    );
  }

  Widget _eventTile(J e) {
    return ListTile(
      onTap: () => _openEvent(e.s('id')),
      leading: Container(
        width: 5,
        height: 40,
        decoration: BoxDecoration(color: agendaColor(e.s('kind')), borderRadius: BorderRadius.circular(4)),
      ),
      title: Text(e.s('title')),
      subtitle: Text(
        [
          e.b('all_day') ? 'Journée entière' : '${time(e['starts_at'])} → ${time(e['ends_at'])}',
          optionLabel(e.s('kind')),
          if (e.has('location')) e.s('location'),
        ].join(' · '),
      ),
      trailing: StatusBadge(e.s('status')),
    );
  }

  Widget _listView() {
    final list = _events!;
    if (list.isEmpty) {
      return ListView(
        children: const [EmptyView(icon: Icons.event_busy, title: 'Aucun événement sur la période')],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: list.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (_, i) {
        final e = list[i];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (i == 0 || date(list[i - 1]['starts_at']) != date(e['starts_at']))
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(dayLong(e['starts_at']), style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            _eventTile(e),
          ],
        );
      },
    );
  }

  Widget _monthView() {
    final theme = Theme.of(context);
    final (start, _) = _range;
    final today = _day(DateTime.now());
    final dayEvents = _on(_selected);
    return ListView(
      padding: const EdgeInsets.only(bottom: 96),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            children: [
              Row(
                children: [
                  for (final w in const ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'])
                    Expanded(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Text(w, style: theme.textTheme.bodySmall),
                        ),
                      ),
                    ),
                ],
              ),
              for (var w = 0; w < 6; w++)
                Row(
                  children: [
                    for (var d = 0; d < 7; d++)
                      Expanded(
                        child: Builder(
                          builder: (context) {
                            final day = start.add(Duration(days: w * 7 + d));
                            final inMonth = day.month == _cursor.month;
                            final evs = _on(day);
                            final selected = day == _selected;
                            return InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () => setState(() => _selected = day),
                              child: Container(
                                height: 48,
                                margin: const EdgeInsets.all(1.5),
                                decoration: BoxDecoration(
                                  color: selected ? GlobusTokens.brand500 : (day == today ? theme.colorScheme.primaryContainer : null),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      '${day.day}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        color: selected
                                            ? Colors.white
                                            : (inMonth ? theme.colorScheme.onSurface : theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5)),
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        for (final e in evs.take(3))
                                          Container(
                                            width: 5,
                                            height: 5,
                                            margin: const EdgeInsets.symmetric(horizontal: 1),
                                            decoration: BoxDecoration(shape: BoxShape.circle, color: selected ? Colors.white : agendaColor(e.s('kind'))),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: Text(dayLong(_selected), style: theme.textTheme.titleSmall),
        ),
        if (dayEvents.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Aucun événement ce jour.')),
        for (final e in dayEvents) _eventTile(e),
      ],
    );
  }
}

/// Détail d'un événement : réponse à l'invitation, visio, export .ics, déplacement / annulation (organisateur).
class EventSheet extends StatefulWidget {
  const EventSheet({super.key, required this.eventId, this.onChanged});
  final String eventId;
  final VoidCallback? onChanged;
  @override
  State<EventSheet> createState() => _EventSheetState();
}

class _EventSheetState extends State<EventSheet> {
  J? _e;
  Object? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final res = await context.api.get('/agenda/events/${widget.eventId}');
      if (mounted) setState(() => _e = J.of(res));
    } catch (e, st) {
      reportUnexpected(e, st, "événement de l'agenda");
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _apply(Future<dynamic> Function() call, {String? success}) async {
    final res = await runAction(context, call, success: success);
    if (res != null && mounted) {
      setState(() => _e = J.of(res));
      widget.onChanged?.call();
    }
  }

  Future<void> _move() async {
    final e = _e!;
    final start = e.date('starts_at')!.toLocal();
    final end = e.date('ends_at')!.toLocal();
    final newStart = await pickDateTime(context, start);
    if (newStart == null || !mounted) return;
    final newEnd = await pickDateTime(context, newStart.add(end.difference(start)));
    if (newEnd == null || !mounted) return;
    final location = await promptText(context, title: 'Lieu', label: 'Lieu', initial: e.str('location'), confirm: 'Enregistrer', maxLines: 1);
    if (!mounted) return;
    await _apply(
      () => context.api.patch(
        '/agenda/events/${widget.eventId}',
        body: {
          'starts_at': newStart.toUtc().toIso8601String(),
          'ends_at': newEnd.toUtc().toIso8601String(),
          'location': (location ?? e.str('location'))?.trim().isEmpty == true ? null : (location ?? e.str('location')),
        },
      ),
      success: 'Événement déplacé : les participants sont prévenus',
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_e == null) return _error != null ? ErrorView(error: _error, onRetry: _load) : const LoadingView();
    final e = _e!;
    final me = context.auth.user?.id;
    final attendees = e.list('attendees');
    final mine = attendees.where((a) => a.s('user_id') == me).firstOrNull;
    final organizer = e.s('organizer_id') == me || context.can('agenda:write');
    final cancelled = e.s('status') == 'cancelled';
    final calls = context.read<CallController?>();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      children: [
        Text(e.s('title'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            ToneBadge(optionLabel(e.s('kind')), icon: Icons.circle),
            StatusBadge(e.s('status')),
            if (e.has('rrule')) const ToneBadge('Récurrent'),
            if (e.b('client_visible')) const ToneBadge('Visible client', tone: Tone.info),
          ],
        ),
        const SizedBox(height: 12),
        Text(e.b('all_day') ? 'Journée du ${date(e['starts_at'])}' : '${dateTime(e['starts_at'])} → ${time(e['ends_at'])}'),
        if (e.has('location'))
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(
              children: [
                const Icon(Icons.place_outlined, size: 16),
                const SizedBox(width: 4),
                Expanded(child: Text(e.s('location'))),
              ],
            ),
          ),
        if (e.has('description')) Padding(padding: const EdgeInsets.only(top: 10), child: Text(e.s('description'))),
        if (e.s('status') == 'tentative')
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: context.can('agenda:write')
                ? AlertBox(
                    tone: Tone.warning,
                    title: 'Demande de rendez-vous en attente',
                    message: 'Confirmez le créneau, ou déplacez-le pour en proposer un autre (le demandeur est prévenu).',
                    action: FilledButton.icon(
                      onPressed: () => _apply(
                        () => context.api.post('/agenda/events/${widget.eventId}/confirm'),
                        success: 'Rendez-vous confirmé : le demandeur est prévenu',
                      ),
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Confirmer le rendez-vous'),
                    ),
                  )
                : const AlertBox(tone: Tone.info, message: "En attente de confirmation par l'équipe du projet : vous serez prévenu."),
          ),
        const GroupTitle('Participants'),
        for (final a in attendees)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                Expanded(child: Text(a.str('name') ?? a.s('external_email'))),
                StatusBadge(a.s('response'), label: optionLabel(a.s('response'))),
              ],
            ),
          ),
        const SizedBox(height: 12),
        if (mine != null && !cancelled)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (r, label) in const [('accepted', "J'accepte"), ('tentative', 'Peut-être'), ('declined', 'Je décline')])
                mine.s('response') == r
                    ? FilledButton(onPressed: null, child: Text(label))
                    : OutlinedButton(
                        onPressed: () => _apply(() => context.api.post('/agenda/events/${widget.eventId}/respond', body: {'response': r})),
                        child: Text(label),
                      ),
            ],
          ),
        const SizedBox(height: 8),
        if (e.has('call_id') && !cancelled && calls != null)
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
            onPressed: () {
              Navigator.pop(context);
              unawaited(calls.join(context, e.s('call_id'), video: true));
            },
            icon: const Icon(Icons.videocam),
            label: const Text('Rejoindre la visio'),
          ),
        OutlinedButton.icon(
          onPressed: () => openRemoteFile(context, '/agenda/events/${widget.eventId}/ics', filename: 'evenement.ics'),
          icon: const Icon(Icons.event_available),
          label: const Text('Ajouter à mon calendrier (.ics)'),
        ),
        if (organizer && !cancelled) ...[
          const Divider(height: 28),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(onPressed: _move, child: const Text('Déplacer')),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextButton(
                  onPressed: () async {
                    if (await confirmDialog(
                          context,
                          title: "Annuler l'événement ?",
                          message: 'Les participants sont prévenus.',
                          danger: true,
                          confirm: "Annuler l'événement",
                        ) &&
                        context.mounted) {
                      await _apply(() => context.api.patch('/agenda/events/${widget.eventId}', body: {'status': 'cancelled'}), success: 'Événement annulé');
                    }
                  },
                  child: const Text("Annuler l'événement", style: TextStyle(color: GlobusColors.danger)),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Sélection date + heure (sélecteurs natifs en français).
Future<DateTime?> pickDateTime(BuildContext context, DateTime initial, {bool withTime = true}) async {
  final d = await showDatePicker(context: context, initialDate: initial, firstDate: DateTime(2020), lastDate: DateTime(2100));
  if (d == null || !context.mounted) return null;
  if (!withTime) return d;
  final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
  if (t == null) return null;
  return DateTime(d.year, d.month, d.day, t.hour, t.minute);
}

/// Demande de rendez-vous du client (miroir du web) : objet, type, créneau souhaité, durée, lieu, message.
class AppointmentRequestScreen extends StatefulWidget {
  const AppointmentRequestScreen({super.key, required this.projectId, required this.day});
  final String projectId;
  final DateTime day;
  @override
  State<AppointmentRequestScreen> createState() => _AppointmentRequestScreenState();
}

const kRequestKinds = [('appointment', 'Rendez-vous (bureau GLOBUS)'), ('site_visit', 'Visite de chantier'), ('call', 'Appel ou visio')];

class _AppointmentRequestScreenState extends State<AppointmentRequestScreen> {
  final _subject = TextEditingController();
  final _location = TextEditingController();
  final _message = TextEditingController();
  String _kind = 'appointment';
  int _duration = 60;
  late DateTime _start = _firstSlot();
  bool _busy = false;
  String? _error;

  DateTime _firstSlot() {
    final tomorrow = _day(DateTime.now()).add(const Duration(days: 1));
    final day = widget.day.isAfter(tomorrow) ? widget.day : tomorrow;
    return DateTime(day.year, day.month, day.day, 10);
  }

  @override
  void dispose() {
    for (final c in [_subject, _location, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await context.api.post(
        '/agenda/requests',
        body: {
          'project_id': widget.projectId,
          'kind': _kind,
          'subject': _subject.text.trim(),
          'starts_at': _start.toUtc().toIso8601String(),
          'duration_minutes': _duration,
          'location': _location.text.trim().isEmpty ? null : _location.text.trim(),
          'message': _message.text.trim().isEmpty ? null : _message.text.trim(),
        },
      );
      if (!mounted) return;
      context.toast("Demande envoyée : l'équipe du projet vous confirme le créneau.");
      Navigator.pop(context, J.of(res));
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final future = _start.isAfter(DateTime.now());
    final valid = _subject.text.trim().length >= 2 && future;
    return Scaffold(
      appBar: AppBar(title: const Text('Demander un rendez-vous')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AlertBox(
            tone: Tone.info,
            message:
                "Proposez un créneau : votre chef de projet le confirme ou vous en propose un autre. Vous êtes prévenu par e-mail et dans l'application.",
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _subject,
            maxLength: 200,
            decoration: const InputDecoration(labelText: 'Objet *', hintText: "Ex. Point sur l'avancement, choix des finitions"),
            onChanged: (_) => setState(() {}),
          ),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _kind,
            decoration: const InputDecoration(labelText: 'Type'),
            items: [for (final (k, label) in kRequestKinds) DropdownMenuItem(value: k, child: Text(label))],
            onChanged: (v) => setState(() => _kind = v ?? 'appointment'),
          ),
          const SizedBox(height: 4),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Date et heure souhaitées *'),
            subtitle: Text(dateTime(_start.toUtc()), style: TextStyle(color: future ? null : GlobusColors.danger)),
            trailing: const Icon(Icons.edit_calendar),
            onTap: () async {
              final d = await pickDateTime(context, _start);
              if (d != null) setState(() => _start = d);
            },
          ),
          DropdownButtonFormField<int>(
            isExpanded: true,
            initialValue: _duration,
            decoration: const InputDecoration(labelText: 'Durée'),
            items: const [
              DropdownMenuItem(value: 30, child: Text('30 minutes')),
              DropdownMenuItem(value: 60, child: Text('1 heure')),
              DropdownMenuItem(value: 90, child: Text('1 h 30')),
              DropdownMenuItem(value: 120, child: Text('2 heures')),
            ],
            onChanged: (v) => setState(() => _duration = v ?? 60),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _location,
            maxLength: 300,
            decoration: const InputDecoration(labelText: 'Lieu', hintText: 'Chantier, bureau, visio…'),
          ),
          TextField(
            controller: _message,
            minLines: 3,
            maxLines: 6,
            maxLength: 2000,
            decoration: const InputDecoration(labelText: 'Message', hintText: 'Ce que vous souhaitez voir ou aborder'),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          const SizedBox(height: 16),
          BusyButton(label: 'Envoyer la demande', expand: true, busy: _busy, onPressed: valid ? _save : null),
        ],
      ),
    );
  }
}

/// Création d'un événement (droit agenda:write).
class EventFormScreen extends StatefulWidget {
  const EventFormScreen({super.key, this.projectId, required this.day});
  final String? projectId;
  final DateTime day;
  @override
  State<EventFormScreen> createState() => _EventFormScreenState();
}

class _EventFormScreenState extends State<EventFormScreen> {
  final _title = TextEditingController();
  final _location = TextEditingController();
  final _description = TextEditingController();
  final _external = TextEditingController();
  String _kind = 'meeting';
  late DateTime _start = DateTime(widget.day.year, widget.day.month, widget.day.day, 9);
  late DateTime _end = _start.add(const Duration(hours: 1));
  bool _allDay = false;
  bool _video = false;
  bool _clientVisible = false;
  String _rrule = '';
  J? _project;
  final List<J> _attendees = [];
  final Set<int> _reminders = {30};
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_title, _location, _description, _external]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final emails = _external.text.split(RegExp(r'[,;\s]+')).map((e) => e.trim()).where((e) => e.contains('@')).toList();
      final res = await context.api.post(
        '/agenda/events',
        body: {
          'title': _title.text.trim(),
          'kind': _kind,
          'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
          'starts_at': _start.toUtc().toIso8601String(),
          'ends_at': _end.toUtc().toIso8601String(),
          'all_day': _allDay,
          'location': _location.text.trim().isEmpty ? null : _location.text.trim(),
          'project_id': _project?.s('id') ?? widget.projectId,
          'rrule': _rrule.isEmpty ? null : _rrule,
          'client_visible': _clientVisible,
          'with_video_call': _video,
          'reminders': _reminders.toList()..sort(),
          'attendee_ids': [for (final a in _attendees) a.s('id')],
          'external': [
            for (final e in emails) {'email': e},
          ],
        },
      );
      if (mounted) Navigator.pop(context, J.of(res));
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final valid = _title.text.trim().length >= 2 && _end.isAfter(_start);
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvel événement')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Titre *'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _kind,
            decoration: const InputDecoration(labelText: 'Type'),
            items: [for (final k in kAgendaKinds) DropdownMenuItem(value: k, child: Text(optionLabel(k)))],
            onChanged: (v) => setState(() => _kind = v ?? 'meeting'),
          ),
          const SizedBox(height: 12),
          if (widget.projectId == null) ...[
            RefField(label: 'Projet', source: Refs.projects, value: _project, onChanged: (v) => setState(() => _project = v)),
            const SizedBox(height: 12),
          ],
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Début *'),
            subtitle: Text(dateTime(_start.toUtc())),
            trailing: const Icon(Icons.edit_calendar),
            onTap: () async {
              final d = await pickDateTime(context, _start, withTime: !_allDay);
              if (d != null) {
                setState(() {
                  final dur = _end.difference(_start);
                  _start = d;
                  _end = d.add(dur);
                });
              }
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Fin *'),
            subtitle: Text(dateTime(_end.toUtc()), style: TextStyle(color: _end.isAfter(_start) ? null : GlobusColors.danger)),
            trailing: const Icon(Icons.edit_calendar),
            onTap: () async {
              final d = await pickDateTime(context, _end, withTime: !_allDay);
              if (d != null) setState(() => _end = d);
            },
          ),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Journée entière'), value: _allDay, onChanged: (v) => setState(() => _allDay = v)),
          TextField(
            controller: _location,
            decoration: const InputDecoration(labelText: 'Lieu', hintText: 'Base vie, bureau, visio…'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _rrule,
            decoration: const InputDecoration(labelText: 'Récurrence'),
            items: const [
              DropdownMenuItem(value: '', child: Text('Aucune')),
              DropdownMenuItem(value: 'FREQ=DAILY', child: Text('Tous les jours')),
              DropdownMenuItem(value: 'FREQ=WEEKLY', child: Text('Toutes les semaines')),
              DropdownMenuItem(value: 'FREQ=MONTHLY', child: Text('Tous les mois')),
            ],
            onChanged: (v) => setState(() => _rrule = v ?? ''),
          ),
          const GroupTitle('Participants'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final a in _attendees) InputChip(label: Text(Refs.users.label(a)), onDeleted: () => setState(() => _attendees.remove(a))),
              ActionChip(
                avatar: const Icon(Icons.person_add_alt, size: 18),
                label: const Text('Ajouter'),
                onPressed: () async {
                  final u = await pickRef(context, Refs.users, title: 'Participant');
                  if (u != null && !_attendees.any((x) => x.s('id') == u.s('id'))) setState(() => _attendees.add(u));
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _external,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Invités externes (e-mails séparés par des virgules)'),
          ),
          const GroupTitle('Rappels'),
          Wrap(
            spacing: 6,
            children: [
              for (final m in const [10, 30, 60, 1440])
                FilterChip(
                  label: Text(m >= 1440 ? '1 jour avant' : (m >= 60 ? '1 h avant' : '$m min avant')),
                  selected: _reminders.contains(m),
                  onSelected: (v) => setState(() => v ? _reminders.add(m) : _reminders.remove(m)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            minLines: 3,
            maxLines: 6,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Créer la visioconférence'),
            value: _video,
            onChanged: (v) => setState(() => _video = v),
          ),
          if ((_project != null || widget.projectId != null) && context.can('projects:publish_client'))
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Visible par le client'),
              value: _clientVisible,
              onChanged: (v) => setState(() => _clientVisible = v),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          const SizedBox(height: 16),
          BusyButton(label: "Créer l'événement", expand: true, busy: _busy, onPressed: valid ? _save : null),
        ],
      ),
    );
  }
}
