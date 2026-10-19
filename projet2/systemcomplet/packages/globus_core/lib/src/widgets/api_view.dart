import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart' show reportUnexpected;
import '../context.dart';
import 'states.dart';

/// Poignée transmise au constructeur d'écran : rechargement, données courantes, remplacement local.
class ApiHandle {
  ApiHandle._(this._state);
  final _ApiViewState _state;

  Future<void> reload() => _state._load(silent: true);
  dynamic get data => _state._data;
  set data(dynamic value) => _state._replace(value);
  DateTime? get cachedAt => _state._cachedAt;
  bool get stale => _state._cachedAt != null;
}

/// Écran alimenté par une lecture de l'API avec états explicites (chargement, erreur, hors ligne, vide),
/// tirer-pour-rafraîchir et rechargement sur événement temps réel.
class ApiView extends StatefulWidget {
  const ApiView({
    super.key,
    required this.path,
    required this.builder,
    this.query,
    this.offline = true,
    this.refreshOn = const [],
    this.loading,
    this.refreshable = true,
    this.transform,
  });

  final String? path;
  final Map<String, dynamic>? query;
  final Widget Function(BuildContext context, dynamic data, ApiHandle handle) builder;

  /// Lecture consultable hors ligne (cache chiffré de l'appareil).
  final bool offline;

  /// Types d'événements temps réel qui déclenchent un rechargement silencieux.
  final List<String> refreshOn;
  final Widget? loading;
  final bool refreshable;
  final dynamic Function(dynamic data)? transform;

  @override
  State<ApiView> createState() => _ApiViewState();
}

class _ApiViewState extends State<ApiView> {
  dynamic _data;
  Object? _error;
  DateTime? _cachedAt;
  bool _loading = true;
  int _seq = 0;
  late final ApiHandle _handle = ApiHandle._(this);
  final List<VoidCallback> _unsubs = [];

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _subscribe();
  }

  @override
  void didUpdateWidget(ApiView old) {
    super.didUpdateWidget(old);
    if (old.path != widget.path || _queryKey(old.query) != _queryKey(widget.query)) {
      unawaited(_load());
    }
  }

  void _subscribe() {
    if (widget.refreshOn.isEmpty) return;
    final realtime = context.realtimeOrNull;
    if (realtime == null) return;
    for (final type in widget.refreshOn) {
      _unsubs.add(realtime.subscribe(type, (_) => unawaited(_load(silent: true))));
    }
  }

  @override
  void dispose() {
    for (final u in _unsubs) {
      u();
    }
    super.dispose();
  }

  String _queryKey(Map<String, dynamic>? q) => q == null ? '' : (q.entries.map((e) => '${e.key}=${e.value}').toList()..sort()).join('&');

  Future<void> _load({bool silent = false}) async {
    final path = widget.path;
    if (path == null) {
      setState(() => _loading = false);
      return;
    }
    final seq = ++_seq;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final Fetched<dynamic> res = await context.api.fetch(path, query: widget.query, offline: widget.offline);
      if (!mounted || seq != _seq) return;
      setState(() {
        _data = widget.transform != null ? widget.transform!(res.data) : res.data;
        _cachedAt = res.cachedAt;
        _error = null;
        _loading = false;
      });
    } catch (e, st) {
      reportUnexpected(e, st, 'chargement de $path');
      if (!mounted || seq != _seq) return;
      setState(() {
        // Rechargement silencieux en échec : on garde les données affichées.
        if (!silent || _data == null) _error = e;
        _loading = false;
      });
    }
  }

  void _replace(dynamic value) => setState(() => _data = value);

  @override
  Widget build(BuildContext context) {
    if (_loading && _data == null) return widget.loading ?? const LoadingView();
    if (_error != null && _data == null) {
      return LayoutBuilder(
        builder: (context, box) => !box.hasBoundedHeight || !widget.refreshable
            ? ErrorView(error: _error, onRetry: () => _load())
            : RefreshIndicator(
                onRefresh: () => _load(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    SizedBox(
                      height: box.maxHeight,
                      child: ErrorView(error: _error, onRetry: () => _load()),
                    ),
                  ],
                ),
              ),
      );
    }
    final child = widget.builder(context, _data, _handle);
    if (!widget.refreshable) {
      // Bloc inséré dans une page : pas de hauteur imposée.
      return _cachedAt == null
          ? child
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                OfflineBanner(cachedAt: _cachedAt),
                child,
              ],
            );
    }
    final content = _cachedAt == null
        ? child
        : Column(
            children: [
              OfflineBanner(cachedAt: _cachedAt),
              Expanded(child: child),
            ],
          );
    return RefreshIndicator(onRefresh: () => _load(silent: true), child: content);
  }
}
