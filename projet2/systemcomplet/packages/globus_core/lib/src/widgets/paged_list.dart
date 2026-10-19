import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_exception.dart' show reportUnexpected;
import '../api/json.dart';
import '../context.dart';
import 'states.dart';

/// Contrôle externe d'une liste paginée (rechargement après action).
class PagedListController {
  _PagedListViewState? _state;
  Future<void> reload() => _state?._reset() ?? Future.value();
  List<J> get items => _state?._items ?? const [];
  void update(J item, J Function(J) change) => _state?._update(item, change);
}

/// Liste paginée côté serveur (format `Page<T>` de l'API : items, total, page, page_size) avec défilement infini,
/// tirer-pour-rafraîchir, états vide / erreur / hors ligne et rechargement sur événement temps réel.
class PagedListView extends StatefulWidget {
  const PagedListView({
    super.key,
    required this.path,
    required this.itemBuilder,
    this.query = const {},
    this.pageSize = 25,
    this.empty,
    this.header,
    this.controller,
    this.refreshOn = const [],
    this.separated = true,
    this.padding = const EdgeInsets.only(bottom: 24),
  });

  final String path;
  final Map<String, dynamic> query;
  final int pageSize;
  final Widget Function(BuildContext context, J item, int index) itemBuilder;
  final Widget? empty;
  final Widget? header;
  final PagedListController? controller;
  final List<String> refreshOn;
  final bool separated;
  final EdgeInsets padding;

  @override
  State<PagedListView> createState() => _PagedListViewState();
}

class _PagedListViewState extends State<PagedListView> {
  final List<J> _items = [];
  int _page = 0;
  int _total = 0;
  bool _loading = false;
  bool _done = false;
  Object? _error;
  DateTime? _cachedAt;
  int _seq = 0;
  final _scroll = ScrollController();
  final List<VoidCallback> _unsubs = [];

  @override
  void initState() {
    super.initState();
    widget.controller?._state = this;
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) unawaited(_more());
    });
    unawaited(_reset());
    final rt = context.realtimeOrNull;
    if (rt != null) {
      for (final t in widget.refreshOn) {
        _unsubs.add(rt.subscribe(t, (_) => unawaited(_reset(silent: true))));
      }
    }
  }

  @override
  void didUpdateWidget(PagedListView old) {
    super.didUpdateWidget(old);
    widget.controller?._state = this;
    if (old.path != widget.path || _key(old.query) != _key(widget.query)) unawaited(_reset());
  }

  String _key(Map<String, dynamic> q) =>
      (q.entries.where((e) => e.value != null && e.value != '').map((e) => '${e.key}=${e.value}').toList()..sort()).join('&');

  @override
  void dispose() {
    for (final u in _unsubs) {
      u();
    }
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reset({bool silent = false}) async {
    _seq++;
    if (!silent) {
      setState(() {
        _items.clear();
        _page = 0;
        _done = false;
        _error = null;
      });
    } else {
      _page = 0;
      _done = false;
    }
    await _more(replace: silent);
  }

  Future<void> _more({bool replace = false}) async {
    if (_loading || _done) return;
    final seq = _seq;
    setState(() => _loading = true);
    try {
      final res = await context.api.fetch(widget.path, query: {...widget.query, 'page': _page + 1, 'page_size': widget.pageSize});
      if (!mounted || seq != _seq) return;
      final data = res.data;
      final page = listOf(data);
      setState(() {
        if (replace) _items.clear();
        _items.addAll(page);
        _page += 1;
        _total = data is Map ? (toNum(data['total'])?.toInt() ?? _items.length) : _items.length;
        _done = data is! Map || page.length < widget.pageSize || _items.length >= _total;
        _cachedAt = res.cachedAt;
        _error = null;
      });
    } catch (e, st) {
      reportUnexpected(e, st, 'liste ${widget.path}');
      if (!mounted || seq != _seq) return;
      setState(() => _error = e);
    } finally {
      if (mounted && seq == _seq) setState(() => _loading = false);
    }
  }

  void _update(J item, J Function(J) change) {
    final i = _items.indexWhere((x) => x['id'] == item['id']);
    if (i >= 0) setState(() => _items[i] = change(_items[i]));
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty && _loading) return const LoadingView();
    if (_items.isEmpty && _error != null) {
      return RefreshIndicator(
        onRefresh: _reset,
        child: ListView(
          children: [
            if (widget.header != null) widget.header!,
            SizedBox(
              height: 420,
              child: ErrorView(error: _error, onRetry: _reset),
            ),
          ],
        ),
      );
    }
    final count = _items.length + (widget.header != null ? 1 : 0) + 1;
    return Column(
      children: [
        if (_cachedAt != null) OfflineBanner(cachedAt: _cachedAt),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => _reset(silent: true),
            child: ListView.builder(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: widget.padding,
              itemCount: count,
              itemBuilder: (context, index) {
                var i = index;
                if (widget.header != null) {
                  if (i == 0) return widget.header!;
                  i -= 1;
                }
                if (i == _items.length) {
                  if (_items.isEmpty) return widget.empty ?? const EmptyView(title: 'Aucun élément');
                  if (_loading) {
                    return const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  if (_error != null) return TextButton(onPressed: _more, child: const Text('Réessayer'));
                  return const SizedBox(height: 8);
                }
                final tile = widget.itemBuilder(context, _items[i], i);
                return widget.separated && i > 0 ? Column(mainAxisSize: MainAxisSize.min, children: [const Divider(height: 1), tile]) : tile;
              },
            ),
          ),
        ),
      ],
    );
  }
}
