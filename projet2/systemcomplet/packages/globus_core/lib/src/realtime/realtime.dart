import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../api/api_client.dart';

typedef RealtimeHandler = void Function(Map<String, dynamic> data);

enum RealtimeStatus { connecting, open, closed }

/// Connexion WebSocket authentifiée par ticket court (`/auth/ws-ticket`), reconnexion avec recul exponentiel,
/// salons (conversation:, project:, call:), présence. Miroir de apps/web/src/lib/realtime.tsx.
class Realtime extends ChangeNotifier {
  Realtime(this.api);

  final ApiClient api;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _sub;
  Timer? _retry;
  Timer? _ping;
  int _attempt = 0;
  bool _stopped = true;
  final Map<String, Set<RealtimeHandler>> _handlers = {};
  final Set<String> _rooms = {};

  RealtimeStatus status = RealtimeStatus.closed;
  final Set<String> online = {};

  Future<void> start() async {
    if (!_stopped) return;
    _stopped = false;
    await _connect();
  }

  Future<void> stop() async {
    _stopped = true;
    _retry?.cancel();
    _ping?.cancel();
    await _sub?.cancel();
    await _channel?.sink.close();
    _channel = null;
    _rooms.clear();
    online.clear();
    _setStatus(RealtimeStatus.closed);
  }

  /// Reconnexion immédiate (retour au premier plan, réseau revenu).
  void nudge() {
    if (_stopped || status == RealtimeStatus.open) return;
    _retry?.cancel();
    _attempt = 0;
    unawaited(_connect());
  }

  Future<void> _connect() async {
    if (_stopped) return;
    _setStatus(RealtimeStatus.connecting);
    try {
      final res = (await api.post('/auth/ws-ticket') as Map).cast<String, dynamic>();
      final ticket = res['ticket'] as String;
      var url = res['url'] as String;
      if (!url.startsWith('ws')) {
        final origin = Uri.parse(api.config.origin);
        url = '${origin.scheme == 'https' ? 'wss' : 'ws'}://${origin.authority}$url';
      }
      final uri = Uri.parse('$url?ticket=${Uri.encodeQueryComponent(ticket)}&app=${api.config.app.header}');
      final channel = WebSocketChannel.connect(uri);
      await channel.ready;
      if (_stopped) {
        await channel.sink.close();
        return;
      }
      _channel = channel;
      _attempt = 0;
      _setStatus(RealtimeStatus.open);
      for (final room in _rooms) {
        _raw('join', {'room': room});
      }
      _ping?.cancel();
      _ping = Timer.periodic(const Duration(seconds: 30), (_) => _raw('ping', null));
      _sub = channel.stream.listen(_onMessage, onDone: _onClosed, onError: (Object _) => _onClosed(), cancelOnError: true);
    } catch (_) {
      _onClosed();
    }
  }

  void _onClosed() {
    _ping?.cancel();
    _channel = null;
    _setStatus(RealtimeStatus.closed);
    if (_stopped) return;
    _attempt += 1;
    final delay = min(30000, 1000 * pow(2, min(_attempt, 5)).toInt()) + Random().nextInt(1000);
    _retry?.cancel();
    _retry = Timer(Duration(milliseconds: delay), () => unawaited(_connect()));
  }

  void _onMessage(dynamic raw) {
    Map<String, dynamic> message;
    try {
      message = (jsonDecode(raw as String) as Map).cast<String, dynamic>();
    } catch (_) {
      return;
    }
    final type = message['type']?.toString() ?? '';
    final data = message['data'] is Map ? (message['data'] as Map).cast<String, dynamic>() : <String, dynamic>{};
    if (type == 'ready') {
      online
        ..clear()
        ..addAll(((data['online'] as List?) ?? const []).map((e) => e.toString()));
      notifyListeners();
    } else if (type == 'presence') {
      final uid = data['user_id']?.toString();
      if (uid != null) {
        if (data['status'] == 'offline') {
          online.remove(uid);
        } else {
          online.add(uid);
        }
        notifyListeners();
      }
    }
    for (final h in [...?_handlers[type], ...?_handlers['*']]) {
      try {
        h({...data, '__type': type});
      } catch (e, s) {
        debugPrint('Realtime handler $type : $e\n$s');
      }
    }
  }

  bool _raw(String type, Map<String, dynamic>? data) {
    final ch = _channel;
    if (ch == null) return false;
    ch.sink.add(jsonEncode({'type': type, 'data': ?data}));
    return true;
  }

  bool send(String type, Map<String, dynamic> data) => _raw(type, data);

  VoidCallback subscribe(String type, RealtimeHandler handler) {
    (_handlers[type] ??= <RealtimeHandler>{}).add(handler);
    return () => _handlers[type]?.remove(handler);
  }

  void join(String room) {
    _rooms.add(room);
    _raw('join', {'room': room});
  }

  void leave(String room) {
    _rooms.remove(room);
    _raw('leave', {'room': room});
  }

  bool isOnline(String userId) => online.contains(userId);

  void _setStatus(RealtimeStatus s) {
    if (status == s) return;
    status = s;
    notifyListeners();
  }
}
