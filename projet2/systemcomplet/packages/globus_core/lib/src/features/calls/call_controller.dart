import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../api/json.dart';
import '../../auth/auth_controller.dart';
import '../../context.dart';
import '../../push/push_service.dart';
import '../../realtime/realtime.dart';

enum CallKind { audio, video }

class _Peer {
  _Peer(this.pc);
  final RTCPeerConnection pc;
  MediaStream? stream;
  bool makingOffer = false;
  bool ignoreOffer = false;
}

/// Appels audio / vidéo WebRTC (maillage pair-à-pair, signalisation WebSocket, TURN à identifiants temporaires),
/// partage d'écran, consentement à l'enregistrement (V4-CALL-17/18/19). Miroir de components/calls/call-provider.tsx.
class CallController extends ChangeNotifier {
  CallController(this.api, this.realtime, this.auth, this.push);

  final ApiClient api;
  final Realtime realtime;
  final AuthController auth;
  final PushService? push;

  J? incoming;
  J? active;
  MediaStream? localStream;
  MediaStream? screenStream;
  final Map<String, _Peer> _peers = {};
  final Map<String, RTCVideoRenderer> remoteRenderers = {};
  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  bool _rendererReady = false;
  List<Map<String, dynamic>> _iceServers = const [];
  bool muted = false;
  bool cameraOff = false;
  bool sharing = false;
  bool speaker = true;
  bool expanded = true;
  DateTime? startedAt;
  final List<VoidCallback> _unsubs = [];
  Timer? _ring;

  /// Méthode native de service au premier plan (partage d'écran Android 10+), fournie par l'application.
  static const _screenChannel = MethodChannel('globus/screen_share');

  String? get _me => auth.user?.id;
  bool get inCall => active != null;

  void attach() {
    detach();
    _unsubs
      ..add(realtime.subscribe('call.incoming', _onIncoming))
      ..add(realtime.subscribe('call.signal', (d) => unawaited(_onSignal(d))))
      ..add(realtime.subscribe('call.participant_joined', _onJoined))
      ..add(realtime.subscribe('call.participant_left', _onLeft))
      ..add(
        realtime.subscribe('call.declined', (d) {
          if (active?.s('id') == d['call_id'] && d['status'] == 'rejected') {
            _notice = 'Appel refusé';
            unawaited(_cleanup());
          }
        }),
      )
      ..add(
        realtime.subscribe('call.ended', (d) {
          if (incoming?.s('call_id') == d['call_id']) _setIncoming(null);
          if (active?.s('id') == d['call_id']) {
            _notice = 'Appel terminé';
            unawaited(_cleanup());
          }
        }),
      )
      ..add(
        realtime.subscribe('call.recording_consent', (d) {
          if (active?.s('id') == d['call_id']) {
            active = J({...active!.raw, 'recording_allowed': d['recording_allowed']});
            notifyListeners();
          }
        }),
      );
  }

  void detach() {
    for (final u in _unsubs) {
      u();
    }
    _unsubs.clear();
  }

  /// Message d'information à afficher (appel refusé, terminé) puis effacé.
  String? _notice;
  String? takeNotice() {
    final n = _notice;
    _notice = null;
    return n;
  }

  // ------------------------------------------------------------------ entrants
  void _onIncoming(Map<String, dynamic> data) {
    if (active != null) {
      unawaited(api.post('/calls/${data['call_id']}/decline').catchError((Object _) => null));
      return;
    }
    _setIncoming(J(data));
    final from = J(data).obj('from').s('name');
    unawaited(
      push?.showLocal(
        id: 7001,
        title: J(data).s('kind') == 'video' ? 'Appel vidéo de $from' : 'Appel audio de $from',
        body: J(data).str('title'),
        link: '/appels/${data['call_id']}',
        urgent: true,
      ),
    );
  }

  void _setIncoming(J? value) {
    incoming = value;
    _ring?.cancel();
    if (value != null) {
      _ring = Timer.periodic(const Duration(seconds: 2), (_) => unawaited(HapticFeedback.heavyImpact()));
      // Sonnerie limitée à 45 s (l'appelant voit « sans réponse »).
      Timer(const Duration(seconds: 45), () {
        if (incoming?.s('call_id') == value.s('call_id')) _setIncoming(null);
      });
    }
    notifyListeners();
  }

  Future<void> decline() async {
    final call = incoming;
    if (call == null) return;
    _setIncoming(null);
    try {
      await api.post('/calls/${call.s('call_id')}/decline');
    } catch (_) {}
  }

  // ------------------------------------------------------------------ démarrage
  Future<void> _prepareMedia(bool video) async {
    final ice = J.of(await api.get('/calls/ice-servers'));
    _iceServers = [for (final s in ice.list('ice_servers')) s.raw];
    if (!_rendererReady) {
      await localRenderer.initialize();
      _rendererReady = true;
    }
    try {
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': {'echoCancellation': true, 'noiseSuppression': true},
        'video': video
            ? {
                'facingMode': 'user',
                'width': {'ideal': 1280},
                'height': {'ideal': 720},
              }
            : false,
      });
      localStream = stream;
      localRenderer.srcObject = stream;
      speaker = video;
      if (!kIsWeb) unawaited(Helper.setSpeakerphoneOn(speaker).catchError((Object _) {}));
    } catch (_) {
      throw StateError('Accès au micro ou à la caméra refusé. Autorisez-le dans les réglages du téléphone.');
    }
  }

  /// Démarre un appel avec les participants (conversation, projet, issue BIM).
  Future<void> start(
    BuildContext context, {
    required List<String> participantIds,
    required CallKind kind,
    String? conversationId,
    String? projectId,
    String? issueId,
    String? title,
  }) async {
    if (active != null) return;
    try {
      await _prepareMedia(kind == CallKind.video);
      final info = J.of(
        await api.post(
          '/calls',
          body: {
            'kind': kind.name,
            'participant_ids': participantIds,
            'conversation_id': conversationId,
            'project_id': projectId,
            'issue_id': issueId,
            'title': title,
          },
        ),
      );
      active = info;
      startedAt = DateTime.now();
      expanded = true;
      notifyListeners();
    } catch (e) {
      await _cleanup();
      if (context.mounted) context.toast('Appel impossible : ${errorMessage(e)}', error: true);
    }
  }

  Future<void> join(BuildContext context, String callId, {bool video = false}) async {
    if (active != null) return;
    try {
      _setIncoming(null);
      await _prepareMedia(video);
      final info = J.of(await api.post('/calls/$callId/join', body: {'video': video}));
      active = info;
      startedAt = DateTime.now();
      expanded = true;
      notifyListeners();
      for (final p in info.list('participants')) {
        if (p.s('user_id') != _me && p.s('status') == 'joined') await _peerFor(info.s('id'), p.s('user_id'));
      }
    } catch (e) {
      await _cleanup();
      if (context.mounted) context.toast("Impossible de rejoindre l'appel : ${errorMessage(e)}", error: true);
    }
  }

  // ------------------------------------------------------------------ signalisation (négociation « parfaite »)
  void _signal(String callId, String to, Map<String, dynamic> payload) => realtime.send('call.signal', {'call_id': callId, 'to': to, 'signal': payload});

  Future<_Peer> _peerFor(String callId, String userId) async {
    final existing = _peers[userId];
    if (existing != null) return existing;
    final pc = await createPeerConnection({'iceServers': _iceServers, 'sdpSemantics': 'unified-plan'});
    final peer = _Peer(pc);
    _peers[userId] = peer;
    final local = localStream;
    if (local != null) {
      for (final t in local.getTracks()) {
        await pc.addTrack(t, local);
      }
    }
    pc.onTrack = (event) async {
      var stream = event.streams.isNotEmpty ? event.streams.first : null;
      if (stream == null) {
        stream = peer.stream ?? await createLocalMediaStream('remote-$userId');
        await stream.addTrack(event.track);
      }
      peer.stream = stream;
      var renderer = remoteRenderers[userId];
      if (renderer == null) {
        renderer = RTCVideoRenderer();
        await renderer.initialize();
        remoteRenderers[userId] = renderer;
      }
      renderer.srcObject = stream;
      notifyListeners();
    };
    pc.onIceCandidate = (c) {
      if (c.candidate != null) _signal(callId, userId, {'candidate': c.toMap()});
    };
    pc.onRenegotiationNeeded = () async {
      try {
        peer.makingOffer = true;
        final offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        _signal(callId, userId, {
          'description': {'type': offer.type, 'sdp': offer.sdp},
        });
      } catch (_) {
        // renégociation ultérieure
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onConnectionState = (state) async {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed) await pc.restartIce();
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) await _dropPeer(userId);
    };
    return peer;
  }

  Future<void> _onSignal(Map<String, dynamic> data) async {
    final call = active;
    final me = _me;
    if (call == null || me == null || call.s('id') != data['call_id']) return;
    final from = data['from'].toString();
    final peer = await _peerFor(call.s('id'), from);
    final polite = me.compareTo(from) > 0;
    final pc = peer.pc;
    final signal = J.of(data['signal']);
    try {
      final desc = signal.objOrNull('description');
      if (desc != null) {
        final type = desc.s('type');
        final state = pc.signalingState;
        final collision = type == 'offer' && (peer.makingOffer || (state != null && state != RTCSignalingState.RTCSignalingStateStable));
        peer.ignoreOffer = !polite && collision;
        if (peer.ignoreOffer) return;
        if (collision && polite) {
          await pc.setLocalDescription(RTCSessionDescription(null, 'rollback'));
        }
        await pc.setRemoteDescription(RTCSessionDescription(desc.s('sdp'), type));
        if (type == 'offer') {
          final answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          _signal(call.s('id'), from, {
            'description': {'type': answer.type, 'sdp': answer.sdp},
          });
        }
      } else {
        final c = signal.objOrNull('candidate');
        if (c != null) {
          try {
            await pc.addCandidate(RTCIceCandidate(c.str('candidate'), c.str('sdpMid'), c.intOrNull('sdpMLineIndex')));
          } catch (e) {
            if (!peer.ignoreOffer) rethrow;
          }
        }
      }
    } catch (_) {
      // négociation reprise au prochain échange
    }
  }

  void _onJoined(Map<String, dynamic> d) {
    final call = active;
    if (call == null || call.s('id') != d['call_id']) return;
    active = J({
      ...call.raw,
      'status': 'active',
      'participants': [
        for (final p in call.list('participants')) p.s('user_id') == d['user_id'].toString() ? {...p.raw, 'status': 'joined'} : p.raw,
      ],
    });
    notifyListeners();
  }

  void _onLeft(Map<String, dynamic> d) {
    final uid = d['user_id'].toString();
    unawaited(_dropPeer(uid));
    final call = active;
    if (call == null || call.s('id') != d['call_id']) return;
    active = J({
      ...call.raw,
      'participants': [
        for (final p in call.list('participants')) p.s('user_id') == uid ? {...p.raw, 'status': 'left'} : p.raw,
      ],
    });
    notifyListeners();
  }

  Future<void> _dropPeer(String userId) async {
    final peer = _peers.remove(userId);
    await peer?.pc.close();
    final r = remoteRenderers.remove(userId);
    if (r != null) {
      r.srcObject = null;
      await r.dispose();
    }
    notifyListeners();
  }

  // ------------------------------------------------------------------ commandes
  Future<void> hangUp() async {
    final call = active;
    if (call == null) return;
    final endForAll = call.s('initiator_id') == _me;
    try {
      await api.post('/calls/${call.s('id')}/${endForAll ? 'end' : 'leave'}');
    } catch (_) {}
    await _cleanup();
  }

  void toggleMute() {
    muted = !muted;
    for (final t in localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = !muted;
    }
    notifyListeners();
  }

  Future<void> toggleCamera() async {
    final stream = localStream;
    if (stream == null) return;
    final tracks = stream.getVideoTracks();
    if (tracks.isNotEmpty) {
      cameraOff = !cameraOff;
      for (final t in tracks) {
        t.enabled = !cameraOff;
      }
      notifyListeners();
      return;
    }
    try {
      final cam = await navigator.mediaDevices.getUserMedia({
        'video': {'facingMode': 'user'},
        'audio': false,
      });
      final track = cam.getVideoTracks().first;
      await stream.addTrack(track);
      for (final p in _peers.values) {
        await p.pc.addTrack(track, stream);
      }
      localRenderer.srcObject = stream;
      cameraOff = false;
      notifyListeners();
    } catch (_) {
      _notice = 'Caméra indisponible';
      notifyListeners();
    }
  }

  Future<void> switchCamera() async {
    final tracks = localStream?.getVideoTracks() ?? const <MediaStreamTrack>[];
    if (tracks.isNotEmpty) await Helper.switchCamera(tracks.first);
  }

  Future<void> toggleSpeaker() async {
    speaker = !speaker;
    if (!kIsWeb) await Helper.setSpeakerphoneOn(speaker);
    notifyListeners();
  }

  /// Partage d'écran : remplace la piste vidéo envoyée (Android : service au premier plan « projection »).
  Future<void> toggleScreen() async {
    final call = active;
    if (call == null) return;
    if (sharing) {
      for (final t in screenStream?.getTracks() ?? <MediaStreamTrack>[]) {
        await t.stop();
      }
      screenStream = null;
      final cam = localStream?.getVideoTracks().firstOrNull;
      for (final p in _peers.values) {
        final senders = await p.pc.getSenders();
        for (final s in senders.where((s) => s.track?.kind == 'video')) {
          await s.replaceTrack(cam);
        }
      }
      sharing = false;
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        try {
          await _screenChannel.invokeMethod<void>('stop');
        } catch (_) {}
      }
      notifyListeners();
      unawaited(api.post('/calls/${call.s('id')}/screen-share', body: {'active': false}).catchError((Object _) => null));
      return;
    }
    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        await _screenChannel.invokeMethod<void>('start');
      }
      final screen = await navigator.mediaDevices.getDisplayMedia({'video': true, 'audio': false});
      screenStream = screen;
      final track = screen.getVideoTracks().first;
      for (final p in _peers.values) {
        final senders = await p.pc.getSenders();
        final video = senders.where((s) => s.track?.kind == 'video').toList();
        if (video.isNotEmpty) {
          await video.first.replaceTrack(track);
        } else {
          await p.pc.addTrack(track, screen);
        }
      }
      sharing = true;
      notifyListeners();
      unawaited(api.post('/calls/${call.s('id')}/screen-share', body: {'active': true}).catchError((Object _) => null));
    } catch (_) {
      _notice = "Partage d'écran indisponible sur cet appareil.";
      notifyListeners();
    }
  }

  /// Consentement à l'enregistrement (l'enregistrement démarre quand tous les participants ont accepté).
  Future<bool> giveRecordingConsent() async {
    final call = active;
    if (call == null) return false;
    final info = J.of(await api.post('/calls/${call.s('id')}/recording/consent', body: {'consent': true}));
    active = J({...call.raw, 'recording_allowed': info.b('recording_allowed')});
    notifyListeners();
    return info.b('recording_allowed');
  }

  void toggleExpanded() {
    expanded = !expanded;
    notifyListeners();
  }

  Future<void> _cleanup() async {
    for (final id in _peers.keys.toList()) {
      await _dropPeer(id);
    }
    for (final t in [...?localStream?.getTracks(), ...?screenStream?.getTracks()]) {
      await t.stop();
    }
    await localStream?.dispose();
    localStream = null;
    screenStream = null;
    if (_rendererReady) localRenderer.srcObject = null;
    if (sharing && !kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      try {
        await _screenChannel.invokeMethod<void>('stop');
      } catch (_) {}
    }
    active = null;
    sharing = false;
    muted = false;
    cameraOff = false;
    startedAt = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    detach();
    _ring?.cancel();
    unawaited(_cleanup());
    if (_rendererReady) unawaited(localRenderer.dispose());
    super.dispose();
  }

  bool _disposed = false;

  /// Les nettoyages asynchrones (fin d'appel) peuvent se terminer après la fermeture de l'application.
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }
}
