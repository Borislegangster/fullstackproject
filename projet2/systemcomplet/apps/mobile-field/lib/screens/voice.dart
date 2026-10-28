import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';

import '../field_state.dart';

/// Rapport vocal IA (§14.1) : micro → enregistrement local → envoi dès que le réseau est là → transcription →
/// reformulation professionnelle → champs extraits → validation humaine → journal de chantier (+ alerte si critique).
class VoiceReportsScreen extends StatefulWidget {
  const VoiceReportsScreen({super.key});
  @override
  State<VoiceReportsScreen> createState() => _VoiceReportsScreenState();
}

class _VoiceReportsScreenState extends State<VoiceReportsScreen> {
  final _list = PagedListController();

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) => Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          heroTag: 'voice-new',
          onPressed: () async {
            final sent = await showModalBottomSheet<bool>(
              context: context,
              isScrollControlled: true,
              isDismissible: false,
              builder: (_) => RecorderSheet(projectId: project.s('id')),
            );
            if (sent == true) unawaited(_list.reload());
          },
          icon: const Icon(Icons.mic),
          label: const Text('Nouveau rapport vocal'),
        ),
        body: PagedListView(
          path: '/ai/voice-reports',
          controller: _list,
          query: {'project_id': project.s('id')},
          refreshOn: const ['notification'],
          padding: const EdgeInsets.only(bottom: 96),
          empty: const EmptyView(
            icon: Icons.mic_none,
            title: 'Aucun rapport vocal',
            text: 'Dictez votre compte rendu : l\'IA le transcrit, le reformule et extrait activités, équipe, quantités, retards et besoins. Vous validez avant publication.',
          ),
          itemBuilder: (context, r, _) => ListTile(
            leading: const CircleAvatar(child: Icon(Icons.graphic_eq)),
            title: Text(dateTime(r['recorded_at'] ?? r['created_at'])),
            subtitle: Text(r.str('reformulated') ?? r.str('transcript') ?? 'Transcription en cours…', maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: StatusBadge(r.s('status')),
            onTap: () async {
              final changed = await Navigator.of(context, rootNavigator: true).push<bool>(MaterialPageRoute(builder: (_) => VoiceReportScreen(report: r)));
              if (changed == true) unawaited(_list.reload());
            },
          ),
        ),
      ),
    );
  }
}

/// Enregistrement : micro, chrono, transcription facultative (dictée clavier), envoi ou mise en file.
class RecorderSheet extends StatefulWidget {
  const RecorderSheet({super.key, required this.projectId});
  final String projectId;
  @override
  State<RecorderSheet> createState() => _RecorderSheetState();
}

class _RecorderSheetState extends State<RecorderSheet> {
  final _recorder = AudioRecorder();
  final _transcript = TextEditingController();
  String? _path;
  bool _recording = false;
  DateTime? _started;
  Duration _elapsed = Duration.zero;
  Timer? _tick;
  bool _busy = false;

  @override
  void dispose() {
    _tick?.cancel();
    unawaited(_recorder.dispose());
    _transcript.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) {
      if (mounted) context.toast('Micro refusé : autorisez-le dans les réglages du téléphone.', error: true);
      return;
    }
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}${Platform.pathSeparator}rapport-${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 44100, bitRate: 96000), path: path);
    setState(() {
      _recording = true;
      _started = DateTime.now();
      _path = null;
    });
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _elapsed = DateTime.now().difference(_started!)));
  }

  Future<void> _stop() async {
    _tick?.cancel();
    final path = await _recorder.stop();
    setState(() {
      _recording = false;
      _path = path;
    });
  }

  Future<void> _send() async {
    final path = _path;
    if (path == null) return;
    setState(() => _busy = true);
    final queue = context.read<OfflineQueue>();
    final op = await queue.enqueueUpload(
      label: 'Rapport vocal du ${dateTime(DateTime.now().toUtc())}',
      path: '/ai/voice-reports',
      sourceFile: path,
      fileName: path.split(Platform.pathSeparator).last,
      fields: {
        'project_id': widget.projectId,
        'recorded_at': _started?.toUtc().toIso8601String(),
        'duration_seconds': _elapsed.inSeconds,
        'transcript': _transcript.text.trim().isEmpty ? null : _transcript.text.trim(),
      },
    );
    final report = await queue.sync();
    if (!mounted) return;
    if (op.status == 'rejected') {
      // Refus du serveur (format, droits…) : le dire clairement, l'envoi reste dans « Synchronisation » (Renvoyer).
      context.toast('Rapport refusé par le serveur : ${op.error ?? 'motif inconnu'}. Voir Synchronisation.', error: true);
    } else {
      context.toast(
        report.offline || op.status == 'pending'
            ? 'Hors ligne : rapport conservé sur le téléphone, envoi automatique au retour du réseau.'
            : 'Rapport envoyé : transcription en cours, le chef de projet est prévenu.',
        success: !report.offline && op.status != 'pending',
      );
    }
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final clock = '${_elapsed.inMinutes.toString().padLeft(2, '0')}:${(_elapsed.inSeconds % 60).toString().padLeft(2, '0')}';
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Rapport vocal', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          const Text('Décrivez les travaux, l\'équipe, les quantités, les retards et vos besoins. Vous relirez avant publication.'),
          const SizedBox(height: 20),
          Center(
            child: GestureDetector(
              onTap: _busy ? null : (_recording ? _stop : _start),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _recording ? GlobusColors.danger : GlobusColors.accent,
                  boxShadow: [if (_recording) BoxShadow(color: GlobusColors.danger.withValues(alpha: 0.4), blurRadius: 24, spreadRadius: 6)],
                ),
                child: Semantics(
                  button: true,
                  label: _recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement",
                  child: Icon(_recording ? Icons.stop : Icons.mic, size: 52, color: Colors.white),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Center(child: Text(_recording ? 'Enregistrement… $clock' : (_path != null ? 'Enregistrement terminé ($clock)' : 'Touchez pour enregistrer'))),
          const SizedBox(height: 16),
          TextField(
            controller: _transcript,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: 'Transcription (facultatif)',
              helperText: 'Laissez vide : la transcription est faite par le serveur. Ou dictez avec le micro du clavier.',
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextButton(onPressed: _busy || _recording ? null : () => Navigator.pop(context, false), child: const Text('Annuler')),
              ),
              Expanded(
                child: BusyButton(label: 'Envoyer', icon: Icons.send, busy: _busy, onPressed: _path == null || _recording ? null : _send),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Relecture : écoute, transcription, reformulation éditable, champs extraits, validation → journal de chantier.
class VoiceReportScreen extends StatefulWidget {
  const VoiceReportScreen({super.key, required this.report});
  final J report;
  @override
  State<VoiceReportScreen> createState() => _VoiceReportScreenState();
}

class _VoiceReportScreenState extends State<VoiceReportScreen> {
  late J _r = widget.report;
  late final _text = TextEditingController(text: _r.str('reformulated') ?? _r.str('transcript') ?? '');
  final _transcript = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _text.dispose();
    _transcript.dispose();
    super.dispose();
  }

  Future<void> _act(Future<dynamic> Function() call, String success) async {
    setState(() => _busy = true);
    final res = await runAction(context, call, success: success);
    if (mounted) setState(() => _busy = false);
    if (res != null && mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final id = _r.s('id');
    final fields = _r.obj('extracted');
    final awaitingTranscript = const ['uploaded', 'failed'].contains(_r.s('status')) && !_r.has('transcript');
    final canValidate = _r.has('transcript') && !const ['validated', 'rejected'].contains(_r.s('status'));
    return Scaffold(
      appBar: AppBar(title: const Text('Rapport vocal')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(child: Text(dateTime(_r['recorded_at'] ?? _r['created_at']), style: Theme.of(context).textTheme.titleMedium)),
              StatusBadge(_r.s('status')),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            // Lecture dans l'application (sans téléchargement ni application externe).
            onPressed: () => GalleryScreen.open(context, [GalleryItem(url: '/ai/voice-reports/$id/audio', caption: 'Rapport vocal', isVideo: true)]),
            icon: const Icon(Icons.play_arrow),
            label: Text("Écouter l'enregistrement${_r.has('duration_seconds') ? ' (${duration(Duration(seconds: _r.i('duration_seconds')))})' : ''}"),
          ),
          if (_r.b('is_critical') || fields.b('critical'))
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: AlertBox(tone: Tone.danger, message: 'Rapport signalé critique : le chef de projet est prévenu dès la validation.'),
            ),
          if (awaitingTranscript) ...[
            const SizedBox(height: 12),
            const AlertBox(tone: Tone.info, message: 'Transcription automatique indisponible : saisissez ou dictez le texte (micro du clavier).'),
            const SizedBox(height: 8),
            TextField(
              controller: _transcript,
              minLines: 3,
              maxLines: 8,
              decoration: const InputDecoration(labelText: 'Transcription'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _transcript.text.trim().length < 3 || _busy
                  ? null
                  : () => _act(
                      () => context.api.post('/ai/voice-reports/$id/transcript', body: {'transcript': _transcript.text.trim()}),
                      'Transcription envoyée',
                    ),
              child: const Text('Envoyer la transcription'),
            ),
          ],
          if (_r.has('transcript')) ...[
            const GroupTitle('Transcription'),
            Text(_r.s('transcript')),
          ],
          if (fields.raw.isNotEmpty) ...[
            const GroupTitle('Informations extraites'),
            for (final e in fields.raw.entries.where((e) => e.value != null && e.value != '' && e.value is! Map))
              InfoRow(fieldLabel(e.key), e.value is List ? (e.value as List).join(', ') : '${e.value}'),
          ],
          if (canValidate) ...[
            const GroupTitle('Texte du journal (modifiable)'),
            TextField(controller: _text, minLines: 4, maxLines: 12),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _act(() => context.api.post('/ai/voice-reports/$id/reject'), 'Rapport écarté'),
                    child: const Text('Écarter'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: BusyButton(
                    label: 'Valider',
                    icon: Icons.check,
                    busy: _busy,
                    onPressed: () => _act(() {
                      final original = _r.str('reformulated') ?? _r.str('transcript');
                      return context.api.post(
                        '/ai/voice-reports/$id/validate',
                        body: {'edited_text': _text.text.trim() != original ? _text.text.trim() : null},
                      );
                    }, 'Rapport validé : ajouté au journal de chantier'),
                  ),
                ),
              ],
            ),
          ],
          if (_r.s('status') == 'validated')
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: AlertBox(tone: Tone.success, message: 'Validé : intégré au journal de chantier.'),
            ),
        ],
      ),
    );
  }

  @override
  void didUpdateWidget(VoiceReportScreen old) {
    super.didUpdateWidget(old);
    _r = widget.report;
  }
}
