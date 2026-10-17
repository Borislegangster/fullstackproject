import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../field_state.dart';

const _planTypes = <(String?, String)>[
  ('plan', 'Plans'),
  ('technique', 'Technique'),
  ('note_calcul', 'Notes de calcul'),
  ('cctp', 'CCTP'),
  ('qhse', 'QHSE'),
  ('pv', 'Procès-verbaux'),
  (null, 'Tous'),
];

/// Plans 2D / 3D autorisés : version en vigueur seulement, alerte « plan périmé » sur les versions téléchargées
/// sur ce téléphone (V4-GED-29), maquette fédérée en plein écran.
class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});
  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  String? _type = 'plan';
  String _q = '';
  static const _key = 'globus.field.downloaded_versions';

  Future<void> _open(J doc) async {
    // Terrain : uniquement la version publiée (jamais un brouillon ou une version en revue).
    final version = doc.objOrNull('published_version');
    if (version == null) return;
    final prefs = await SharedPreferences.getInstance();
    final known = prefs.getStringList(_key) ?? <String>[];
    if (!known.contains(version.s('id'))) await prefs.setStringList(_key, [...known, version.s('id')].take(300).toList());
    if (!mounted) return;
    await openRemoteFile(context, '/document-versions/${version.s('id')}/download');
  }

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) {
        final id = project.s('id');
        return Column(
          children: [
            _ObsoleteAlert(projectId: id),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Rechercher', isDense: true),
                      onSubmitted: (v) => setState(() => _q = v.trim()),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: () => EmbeddedViewerScreen.open(context, title: 'Maquette 3D', path: '/embarque/maquette/$id?source=erp'),
                    icon: const Icon(Icons.view_in_ar),
                    label: const Text('3D'),
                  ),
                ],
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Row(
                children: [
                  for (final t in _planTypes)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(label: Text(t.$2), selected: _type == t.$1, onSelected: (_) => setState(() => _type = t.$1)),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PagedListView(
                path: '/documents',
                query: {'project_id': id, 'doc_type': _type, 'q': _q},
                empty: const EmptyView(
                  icon: Icons.map_outlined,
                  title: 'Aucun document',
                  text: 'Seules les versions publiées et autorisées pour votre profil apparaissent.',
                ),
                itemBuilder: (context, d, _) {
                  final v = d.objOrNull('published_version');
                  return ListTile(
                    leading: const Icon(Icons.description_outlined, color: GlobusColors.primary),
                    title: Text(d.s('title')),
                    subtitle: Text(
                      [
                        if (v != null) 'Version ${v.s('label')}',
                        if (d.has('discipline')) optionLabel(d.s('discipline')),
                        if (v != null && v.has('published_at')) 'publiée le ${date(v['published_at'])}',
                      ].join(' · '),
                    ),
                    trailing: v == null ? const ToneBadge('En validation', tone: Tone.warning) : const Icon(Icons.download_outlined),
                    onTap: v == null ? null : () => _open(d),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Bandeau « plan périmé » : versions téléchargées sur ce téléphone remplacées depuis (pull de synchronisation).
class _ObsoleteAlert extends StatefulWidget {
  const _ObsoleteAlert({required this.projectId});
  final String projectId;
  @override
  State<_ObsoleteAlert> createState() => _ObsoleteAlertState();
}

class _ObsoleteAlertState extends State<_ObsoleteAlert> {
  List<J> _obsolete = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_check());
  }

  Future<void> _check() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final known = (prefs.getStringList(_PlansScreenState._key) ?? const <String>[]).toSet();
      if (known.isEmpty || !mounted) return;
      final since = DateTime.now().subtract(const Duration(days: 90)).toUtc().toIso8601String();
      final res = J.of(await context.api.get('/sync/pull', query: {'project_ids': widget.projectId, 'since': since}));
      final obsolete = res.list('documents').where((d) => d.s('status') == 'obsolete' && known.contains(d.s('version_id'))).toList();
      if (mounted) setState(() => _obsolete = obsolete);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_obsolete.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      child: AlertBox(
        tone: Tone.danger,
        title: 'Plan périmé',
        message: [
          for (final d in _obsolete)
            '« ${d.s('title')} » ${d.s('label')} remplacé le ${date(d['obsolete_at'])} : ouvrez la version en vigueur avant d\'exécuter.',
        ].join('\n'),
      ),
    );
  }
}
