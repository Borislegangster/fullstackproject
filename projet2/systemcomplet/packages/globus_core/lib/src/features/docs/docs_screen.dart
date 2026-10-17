import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/json.dart';
import '../../context.dart';
import '../../format/labels.dart';
import '../../routing/links.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/api_view.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Centre de documentation : sommaire, recherche et pages filtrés par l'API selon les droits de l'utilisateur
/// (miroir de components/docs/docs-center.tsx). Les liens vers un écran ouvrent l'écran de l'application.
class DocsScreen extends StatefulWidget {
  const DocsScreen({super.key, required this.space, this.docId, this.route});

  /// Espace documenté par défaut : client / erp / extranet.
  final String space;
  final String? docId;

  /// Aide contextuelle : chemin de l'écran à documenter.
  final String? route;

  @override
  State<DocsScreen> createState() => _DocsScreenState();
}

class _DocsScreenState extends State<DocsScreen> {
  late String _space = widget.space;
  final _q = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void initState() {
    super.initState();
    final route = widget.route;
    if (route != null && widget.docId == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          final r = J.of(await context.api.get('/documentation/route', query: {'path': route}));
          if (mounted) await _openDoc(r.s('id'), replace: true);
        } catch (_) {}
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  Future<void> _openDoc(String id, {bool replace = false}) {
    final route = MaterialPageRoute<void>(
      builder: (_) => DocPageScreen(docId: id, space: widget.space),
    );
    return replace ? Navigator.of(context, rootNavigator: true).pushReplacement(route) : Navigator.of(context, rootNavigator: true).push(route);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.docId != null) return DocPageView(docId: widget.docId!, space: widget.space);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            controller: _q,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: "Rechercher dans l'aide…", isDense: true),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () => setState(() => _query = v.trim()));
            },
          ),
        ),
        Expanded(
          child: _query.length >= 2
              ? ApiView(
                  key: ValueKey(_query),
                  path: '/documentation/search',
                  query: {'q': _query},
                  offline: false,
                  builder: (context, data, _) {
                    final hits = listOf(data);
                    return ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Text(
                          '${hits.length} résultat(s) pour « $_query » dans les pages auxquelles vous avez accès',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 8),
                        for (final h in hits)
                          Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              onTap: () => _openDoc(h.s('id')),
                              title: Text(h.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${h.s('section')}${h.has('heading') ? ' › ${h.s('heading')}' : ''}', style: Theme.of(context).textTheme.bodySmall),
                                  Text(h.s('snippet'), maxLines: 2, overflow: TextOverflow.ellipsis),
                                ],
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                )
              : ApiView(
                  path: '/documentation',
                  builder: (context, data, _) {
                    final d = J.of(data);
                    final spaces = d.list('spaces');
                    final items = d.list('items').where((x) => x.s('space') == _space).toList();
                    final sections = <String, List<J>>{};
                    for (final it in items) {
                      (sections[it.s('section')] ??= []).add(it);
                    }
                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                      children: [
                        if (spaces.length > 1)
                          Wrap(
                            spacing: 6,
                            children: [
                              for (final s in spaces)
                                ChoiceChip(label: Text(s.s('label')), selected: _space == s.s('key'), onSelected: (_) => setState(() => _space = s.s('key'))),
                            ],
                          ),
                        if (items.isEmpty) const EmptyView(icon: Icons.menu_book_outlined, title: 'Aucune page pour votre profil'),
                        for (final entry in sections.entries) ...[
                          GroupTitle(entry.key),
                          Card(
                            child: Column(
                              children: [
                                for (final (i, it) in entry.value.indexed) ...[
                                  if (i > 0) const Divider(height: 1),
                                  ListTile(
                                    title: Text(it.s('title')),
                                    subtitle: it.has('summary') ? Text(it.s('summary'), maxLines: 2, overflow: TextOverflow.ellipsis) : null,
                                    trailing: const Icon(Icons.chevron_right),
                                    onTap: () => _openDoc(it.s('id')),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ],
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class DocPageScreen extends StatelessWidget {
  const DocPageScreen({super.key, required this.docId, required this.space});
  final String docId;
  final String space;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Aide')),
    body: DocPageView(docId: docId, space: space),
  );
}

class DocPageView extends StatelessWidget {
  const DocPageView({super.key, required this.docId, required this.space});
  final String docId;
  final String space;

  @override
  Widget build(BuildContext context) {
    final base = context.read<AppLinks>().base;
    return ApiView(
      path: '/documentation/${Uri.encodeComponent(docId)}',
      builder: (context, data, _) {
        final d = J.of(data);
        final theme = Theme.of(context);
        final route = d.str('route');
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            Text('${d.s('space_label')} › ${d.s('section')}', style: theme.textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(d.s('title'), style: theme.textTheme.headlineSmall),
            const SizedBox(height: 6),
            Text(d.s('summary'), style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            if (route != null && (route == base || route.startsWith('$base/')))
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.icon(
                    onPressed: () => openAppLink(context, route),
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text("Ouvrir l'écran"),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            DocBlocks(blocks: d.list('blocks'), base: base, space: space),
            if (d.list('related').isNotEmpty) ...[
              const GroupTitle('Voir aussi'),
              for (final r in d.list('related'))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.article_outlined),
                  title: Text(r.s('title')),
                  onTap: () => Navigator.of(context, rootNavigator: true).push(
                    MaterialPageRoute<void>(
                      builder: (_) => DocPageScreen(docId: r.s('id'), space: space),
                    ),
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

/// Rendu natif des blocs de documentation (titres, paragraphes, listes, tableaux, encadrés).
class DocBlocks extends StatelessWidget {
  const DocBlocks({super.key, required this.blocks, required this.base, required this.space});
  final List<J> blocks;
  final String base;
  final String space;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final children = <Widget>[];
    for (final b in blocks) {
      switch (b.s('type')) {
        case 'h2':
          children.add(
            Padding(
              padding: const EdgeInsets.only(top: 18, bottom: 6),
              child: Text(b.s('text'), style: theme.textTheme.titleLarge),
            ),
          );
        case 'h3':
          children.add(
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              child: Text(b.s('text'), style: theme.textTheme.titleSmall),
            ),
          );
        case 'p':
          children.add(
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _Inline(spans: _spans(b['spans']), base: base, space: space),
            ),
          );
        case 'ul' || 'ol':
          final items = (b['items'] as List? ?? const []);
          children.add(
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (i, item) in items.indexed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 24,
                            child: Text(
                              b.s('type') == 'ol' ? '${i + 1}.' : '•',
                              style: TextStyle(fontWeight: FontWeight.w700, color: b.s('type') == 'ol' ? GlobusColors.primary : GlobusColors.accent),
                            ),
                          ),
                          Expanded(
                            child: _Inline(spans: _spans(item), base: base, space: space),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          );
        case 'table':
          final rows = (b['rows'] as List? ?? const []);
          children.add(
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowHeight: 40,
                  dataRowMinHeight: 40,
                  dataRowMaxHeight: double.infinity,
                  columns: [
                    for (final cell in (rows.isEmpty ? const [] : rows.first as List))
                      DataColumn(
                        label: _Inline(spans: _spans(cell), base: base, space: space, bold: true),
                      ),
                  ],
                  rows: [
                    for (final row in rows.skip(1))
                      DataRow(
                        cells: [
                          for (final cell in row as List)
                            DataCell(
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 260),
                                child: _Inline(spans: _spans(cell), base: base, space: space),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          );
        case 'note' || 'tip' || 'warning':
          final (tone, label) = switch (b.s('type')) {
            'tip' => (Tone.success, 'Astuce'),
            'warning' => (Tone.warning, 'Attention'),
            _ => (Tone.info, 'À savoir'),
          };
          children.add(
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: AlertBox(tone: tone, title: label, message: _plain(_spans(b['spans']))),
            ),
          );
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }

  static List<J> _spans(Object? v) => v is List ? v.map(J.of).toList() : const [];
  static String _plain(List<J> spans) => spans.map((s) => s.s('v')).join();
}

class _Inline extends StatelessWidget {
  const _Inline({required this.spans, required this.base, required this.space, this.bold = false});
  final List<J> spans;
  final String base;
  final String space;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final link = TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600, decoration: TextDecoration.underline);
    return Text.rich(
      TextSpan(
        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: bold ? FontWeight.w600 : null),
        children: [
          for (final s in spans)
            switch (s.s('t')) {
              'b' => TextSpan(
                text: s.s('v'),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              'code' => TextSpan(
                text: s.s('v'),
                style: TextStyle(fontFamily: 'monospace', backgroundColor: theme.colorScheme.surfaceContainer),
              ),
              'doc' => TextSpan(
                text: s.s('v'),
                style: link,
                recognizer: TapGestureRecognizer()
                  ..onTap = () => Navigator.of(context, rootNavigator: true).push(
                    MaterialPageRoute<void>(
                      builder: (_) => DocPageScreen(docId: s.s('id'), space: space),
                    ),
                  ),
              ),
              'route' =>
                (s.s('href') == base || s.s('href').startsWith('$base/'))
                    ? TextSpan(text: s.s('v'), style: link, recognizer: TapGestureRecognizer()..onTap = () => openAppLink(context, s.s('href')))
                    : TextSpan(
                        text: s.s('v'),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
              'ext' => TextSpan(
                text: s.s('v'),
                style: link,
                recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse(s.s('href')), mode: LaunchMode.externalApplication),
              ),
              _ => TextSpan(text: s.s('v')),
            },
        ],
      ),
    );
  }
}
