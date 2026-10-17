import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';

import '../../api/json.dart';
import '../../context.dart';
import '../../files/files.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../realtime/realtime.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/api_view.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';
import 'call_controller.dart';

/// Couche globale des appels : sonnerie entrante et écran d'appel en cours (au-dessus de toute l'application).
class CallOverlay extends StatelessWidget {
  const CallOverlay({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final calls = context.watch<CallController?>();
    if (calls == null) return child;
    final notice = calls.takeNotice();
    if (notice != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => context.toast(notice));
    }
    return Stack(
      children: [
        child,
        if (calls.incoming != null && calls.active == null) _IncomingCard(calls: calls),
        if (calls.active != null) calls.expanded ? _ActiveCallScreen(calls: calls) : _MiniCall(calls: calls),
      ],
    );
  }
}

class _IncomingCard extends StatelessWidget {
  const _IncomingCard({required this.calls});
  final CallController calls;

  @override
  Widget build(BuildContext context) {
    final inc = calls.incoming!;
    final video = inc.s('kind') == 'video';
    return Positioned(
      left: 12,
      right: 12,
      top: MediaQuery.of(context).padding.top + 8,
      child: Material(
        color: GlobusTokens.brand900,
        elevation: 12,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Semantics(
            liveRegion: true,
            label: 'Appel entrant',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  video ? 'APPEL VIDÉO ENTRANT' : 'APPEL AUDIO ENTRANT',
                  style: const TextStyle(color: GlobusTokens.brand200, fontSize: 11, letterSpacing: 1.2),
                ),
                const SizedBox(height: 4),
                Text(
                  inc.obj('from').s('name'),
                  style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700),
                ),
                if (inc.has('title')) Text(inc.s('title'), style: const TextStyle(color: GlobusTokens.brand200)),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: GlobusColors.danger),
                        onPressed: calls.decline,
                        icon: const Icon(Icons.call_end),
                        label: const Text('Refuser'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: GlobusColors.success),
                        onPressed: () => calls.join(context, inc.s('call_id'), video: video),
                        icon: Icon(video ? Icons.videocam : Icons.call),
                        label: const Text('Répondre'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ActiveCallScreen extends StatefulWidget {
  const _ActiveCallScreen({required this.calls});
  final CallController calls;
  @override
  State<_ActiveCallScreen> createState() => _ActiveCallScreenState();
}

class _ActiveCallScreenState extends State<_ActiveCallScreen> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final calls = widget.calls;
    final call = calls.active!;
    final me = context.auth.user?.id;
    final participants = call.list('participants');
    final others = participants.where((p) => p.s('user_id') != me).toList();
    final joined = participants.where((p) => p.s('status') == 'joined').length;
    final elapsed = calls.startedAt == null ? Duration.zero : DateTime.now().difference(calls.startedAt!);
    final hasLocalVideo = (calls.localStream?.getVideoTracks().isNotEmpty ?? false) && !calls.cameraOff;
    final remotes = calls.remoteRenderers.entries.toList();
    return Positioned.fill(
      child: Material(
        color: GlobusTokens.brand900,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                child: Row(
                  children: [
                    // Pas d'infobulle ici : la couche d'appel est au-dessus du navigateur (sans Overlay).
                    Semantics(
                      button: true,
                      label: 'Réduire',
                      child: IconButton(
                        onPressed: calls.toggleExpanded,
                        icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            call.str('title') ?? (others.map((o) => o.s('name')).join(', ').isEmpty ? 'Appel' : others.map((o) => o.s('name')).join(', ')),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
                          ),
                          Text(
                            call.s('status') == 'ringing' ? 'Sonnerie…' : _clock(elapsed),
                            style: const TextStyle(color: GlobusTokens.brand200, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Chip(
                      backgroundColor: Colors.white12,
                      side: BorderSide.none,
                      avatar: const Icon(Icons.people_outline, size: 16, color: Colors.white),
                      label: Text('$joined', style: const TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Stack(
                  children: [
                    if (remotes.isEmpty)
                      const Center(
                        child: Text('En attente des participants…', style: TextStyle(color: GlobusTokens.brand200)),
                      )
                    else
                      GridView.count(
                        crossAxisCount: remotes.length > 1 ? 2 : 1,
                        childAspectRatio: remotes.length > 2 ? 0.75 : (remotes.length == 2 ? 0.6 : 0.56),
                        padding: const EdgeInsets.all(4),
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                        children: [
                          for (final r in remotes)
                            _RemoteTile(
                              renderer: r.value,
                              name: participants.where((p) => p.s('user_id') == r.key).firstOrNull?.s('name') ?? '',
                            ),
                        ],
                      ),
                    if (hasLocalVideo || calls.sharing)
                      Positioned(
                        right: 12,
                        bottom: 12,
                        width: 110,
                        height: 150,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: ColoredBox(
                            color: Colors.black,
                            child: RTCVideoView(calls.localRenderer, mirror: true, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                color: Colors.black26,
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                child: Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _CallButton(
                      icon: calls.muted ? Icons.mic_off : Icons.mic,
                      label: calls.muted ? 'Réactiver le micro' : 'Couper le micro',
                      active: calls.muted,
                      onTap: calls.toggleMute,
                    ),
                    _CallButton(
                      icon: hasLocalVideo ? Icons.videocam : Icons.videocam_off,
                      label: 'Caméra',
                      active: !hasLocalVideo,
                      onTap: calls.toggleCamera,
                    ),
                    if (hasLocalVideo) _CallButton(icon: Icons.cameraswitch_outlined, label: 'Changer de caméra', onTap: calls.switchCamera),
                    _CallButton(
                      icon: calls.speaker ? Icons.volume_up : Icons.hearing,
                      label: calls.speaker ? 'Haut-parleur' : 'Écouteur',
                      active: calls.speaker,
                      onTap: calls.toggleSpeaker,
                    ),
                    _CallButton(
                      icon: Icons.screen_share_outlined,
                      label: calls.sharing ? 'Arrêter le partage' : "Partager l'écran",
                      active: calls.sharing,
                      onTap: calls.toggleScreen,
                    ),
                    _CallButton(
                      icon: Icons.fiber_manual_record,
                      label: 'Consentir à l\'enregistrement',
                      active: call.b('recording_allowed'),
                      onTap: () async {
                        try {
                          final all = await calls.giveRecordingConsent();
                          if (context.mounted) {
                            context.toast(
                              all
                                  ? "Tous les participants ont consenti : l'enregistrement peut être lancé par l'organisateur."
                                  : "Consentement enregistré : l'enregistrement n'est possible qu'avec l'accord de tous.",
                            );
                          }
                        } catch (e) {
                          if (context.mounted) context.toastError(e);
                        }
                      },
                    ),
                    _CallButton(icon: Icons.call_end, label: 'Raccrocher', danger: true, onTap: calls.hangUp),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _clock(Duration d) => '${d.inMinutes.toString().padLeft(2, '0')}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}

class _RemoteTile extends StatelessWidget {
  const _RemoteTile({required this.renderer, required this.name});
  final RTCVideoRenderer renderer;
  final String name;

  @override
  Widget build(BuildContext context) {
    final hasVideo = renderer.srcObject?.getVideoTracks().any((t) => t.enabled) ?? false;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: ColoredBox(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // La vue est toujours montée : elle porte aussi la piste audio du participant.
            RTCVideoView(renderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain),
            if (!hasVideo)
              Center(
                child: CircleAvatar(
                  radius: 34,
                  backgroundColor: GlobusTokens.brand600,
                  child: Text(
                    name.isEmpty ? '?' : name[0].toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            Positioned(
              left: 8,
              bottom: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                child: Text(name, style: const TextStyle(color: Colors.white, fontSize: 12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({required this.icon, required this.label, required this.onTap, this.active = false, this.danger = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: InkResponse(
        onTap: onTap,
        radius: 32,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(shape: BoxShape.circle, color: danger ? GlobusColors.danger : (active ? Colors.white : Colors.white24)),
          child: Icon(icon, color: danger ? Colors.white : (active ? GlobusTokens.brand900 : Colors.white)),
        ),
      ),
    );
  }
}

class _MiniCall extends StatelessWidget {
  const _MiniCall({required this.calls});
  final CallController calls;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: 12,
      bottom: MediaQuery.of(context).padding.bottom + 90,
      child: Material(
        color: GlobusTokens.brand900,
        elevation: 10,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: calls.toggleExpanded,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.call, color: GlobusColors.success, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Appel en cours',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: calls.hangUp,
                  child: const Icon(Icons.call_end, color: GlobusColors.danger),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Appels : contacts joignables (audio / vidéo), historique, rejoindre un appel en cours, enregistrements consentis.
class CallsScreen extends StatefulWidget {
  const CallsScreen({super.key, this.openCallId});
  final String? openCallId;
  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> {
  final _q = TextEditingController();
  Timer? _debounce;
  List<J> _contacts = [];
  final int _v = 0;
  bool _joinedInitial = false;

  @override
  void initState() {
    super.initState();
    unawaited(_search());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    try {
      final res = await context.api.get('/contacts', query: {'q': _q.text.trim()});
      if (mounted) setState(() => _contacts = listOf(res));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final calls = context.watch<CallController>();
    final rt = context.watch<Realtime>();
    final me = context.auth.user?.id;
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: const TabBar(
              tabs: [
                Tab(text: 'Historique'),
                Tab(text: 'Contacts'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                ApiView(
                  key: ValueKey('calls$_v${calls.active == null}'),
                  path: '/calls',
                  query: const {'limit': 100},
                  builder: (context, data, _) {
                    final rows = listOf(data);
                    final open = widget.openCallId;
                    if (open != null && !_joinedInitial && calls.active == null) {
                      final target = rows.where((c) => c.s('id') == open && ['ringing', 'active'].contains(c.s('status'))).firstOrNull;
                      if (target != null) {
                        _joinedInitial = true;
                        WidgetsBinding.instance.addPostFrameCallback((_) => calls.join(context, open, video: target.s('kind') == 'video'));
                      }
                    }
                    if (rows.isEmpty) {
                      return ListView(
                        children: const [EmptyView(icon: Icons.call_outlined, title: 'Aucun appel')],
                      );
                    }
                    return ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final c = rows[i];
                        final outgoing = c.s('initiator_id') == me;
                        final names = c.list('participants').where((p) => p.s('user_id') != me).map((p) => p.s('name')).join(', ');
                        final missed = ['missed', 'rejected', 'cancelled'].contains(c.s('status'));
                        final secs = c.intOrNull('duration_seconds');
                        return ListTile(
                          leading: Icon(
                            missed ? Icons.call_missed : (outgoing ? Icons.call_made : Icons.call_received),
                            color: missed ? GlobusColors.danger : GlobusColors.primary,
                          ),
                          title: Text(c.str('title') ?? (names.isEmpty ? 'Appel' : names)),
                          subtitle: Text(
                            '${dateTime(c['started_at'] ?? c['created_at'])} · ${c.s('kind') == 'video' ? 'vidéo' : 'audio'} · ${secs == null || secs == 0 ? '—' : duration(Duration(seconds: secs))}${c.b('had_screen_share') ? ' · écran partagé' : ''}',
                          ),
                          trailing: ['ringing', 'active'].contains(c.s('status')) && calls.active == null
                              ? FilledButton(
                                  onPressed: () => calls.join(context, c.s('id'), video: c.s('kind') == 'video'),
                                  child: const Text('Rejoindre'),
                                )
                              : (c.has('recording_file_id')
                                    ? IconButton(
                                        tooltip: "Écouter l'enregistrement",
                                        icon: const Icon(Icons.play_circle_outline),
                                        onPressed: () => openRemoteFile(context, '/calls/${c.s('id')}/recording'),
                                      )
                                    : ToneBadge(
                                        optionLabel(c.s('status')),
                                        tone: missed ? Tone.danger : (c.s('status') == 'ended' ? Tone.neutral : Tone.info),
                                      )),
                        );
                      },
                    );
                  },
                ),
                Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: TextField(
                        controller: _q,
                        decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher…', isDense: true),
                        onChanged: (_) {
                          _debounce?.cancel();
                          _debounce = Timer(const Duration(milliseconds: 250), () => unawaited(_search()));
                        },
                      ),
                    ),
                    Expanded(
                      child: _contacts.isEmpty
                          ? const EmptyView(title: 'Aucun contact')
                          : ListView.separated(
                              itemCount: _contacts.length,
                              separatorBuilder: (_, _) => const Divider(height: 1),
                              itemBuilder: (context, i) {
                                final c = _contacts[i];
                                return ListTile(
                                  leading: Avatar(name: c.s('name'), size: 40, online: rt.isOnline(c.s('id')) || c.b('online')),
                                  title: Text(c.s('name')),
                                  subtitle: Text([c.str('job_title'), c.str('organization')].whereType<String>().join(' · ')),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        tooltip: 'Appeler ${c.s('name')}',
                                        onPressed: calls.active != null ? null : () => calls.start(context, participantIds: [c.s('id')], kind: CallKind.audio),
                                        icon: const Icon(Icons.call_outlined),
                                      ),
                                      IconButton(
                                        tooltip: 'Appel vidéo avec ${c.s('name')}',
                                        onPressed: calls.active != null ? null : () => calls.start(context, participantIds: [c.s('id')], kind: CallKind.video),
                                        icon: const Icon(Icons.videocam_outlined),
                                      ),
                                    ],
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
        ],
      ),
    );
  }
}
