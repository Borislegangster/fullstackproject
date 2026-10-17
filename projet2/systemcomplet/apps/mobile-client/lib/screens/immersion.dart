import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import '../project.dart';

/// Maquette 3D / BIM : visionneuse fédérée (calques par discipline, coupe) en plein écran, configurations ouvertes,
/// contenus 360° / drone, liens de visite partagés.
class ImmersionScreen extends StatefulWidget {
  const ImmersionScreen({super.key});
  @override
  State<ImmersionScreen> createState() => _ImmersionScreenState();
}

class _ImmersionScreenState extends State<ImmersionScreen> {
  int _shares = 0;

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final id = project.s('id');
        return ApiView(
          path: '/client/projects/$id/immersion',
          builder: (context, data, _) {
            final d = J.of(data);
            final models = d.obj('bim').list('models');
            final configurators = d.list('configurators');
            final contents = d.list('contents');
            return PageList(
              children: [
                const PageHeader(
                  title: 'Maquette 3D',
                  subtitle: 'Explorez votre projet : faites pivoter, zoomez, masquez des disciplines, coupez la maquette.',
                ),
                if (models.isEmpty)
                  const EmptyView(icon: Icons.view_in_ar, title: 'Maquette en préparation', text: 'La maquette 3D sera publiée par votre équipe de conception.')
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => EmbeddedViewerScreen.open(context, title: 'Maquette 3D', path: '/embarque/maquette/$id'),
                      child: Container(
                        height: 200,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [GlobusTokens.brand900, GlobusTokens.brand700],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Stack(
                          children: [
                            const Center(child: Icon(Icons.view_in_ar, size: 84, color: Colors.white24)),
                            Positioned(
                              left: 16,
                              right: 16,
                              bottom: 16,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${models.length} maquette(s) · ${d.obj('bim').list('disciplines').length} discipline(s)',
                                          style: const TextStyle(color: Colors.white70),
                                        ),
                                        const Text(
                                          'Ouvrir la maquette 3D',
                                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.open_in_full, color: GlobusTokens.accent300),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (configurators.isNotEmpty)
                  SectionCard(
                    title: 'Configurer mes finitions',
                    subtitle: "Choisissez vos matériaux et visualisez l'impact sur le prix et le délai.",
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (final c in configurators)
                          ListTile(
                            leading: const Icon(Icons.palette_outlined, color: GlobusColors.accent),
                            title: Text(c.s('name')),
                            subtitle: c.has('lock_date') ? Text("Choix ouverts jusqu'au ${date(c['lock_date'])}") : null,
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (c.b('has_model'))
                                  IconButton(
                                    tooltip: 'Partager',
                                    icon: const Icon(Icons.share_outlined),
                                    onPressed: () async {
                                      await shareVisit(context, projectId: id, modelId: c.s('id'), title: c.s('name'));
                                      setState(() => _shares++);
                                    },
                                  ),
                                const Icon(Icons.chevron_right),
                              ],
                            ),
                            onTap: () => context.push('/espace-client/configurateur/${c.s('id')}'),
                          ),
                      ],
                    ),
                  ),
                if (contents.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () => context.push('/espace-client/live'),
                    icon: const Icon(Icons.threesixty),
                    label: Text('Voir les visites 360°, vidéos et vues drone (${contents.length})'),
                  ),
                MyVisitShares(key: ValueKey(_shares), projectId: id),
              ],
            );
          },
        );
      },
    );
  }
}

/// Crée un lien de visite (360° ou maquette) pour la famille : expiration, PIN, nombre de visites, révocation.
Future<void> shareVisit(BuildContext context, {required String projectId, String? contentId, String? modelId, required String title}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _ShareSheet(projectId: projectId, contentId: contentId, modelId: modelId, title: title),
  );
}

class _ShareSheet extends StatefulWidget {
  const _ShareSheet({required this.projectId, this.contentId, this.modelId, required this.title});
  final String projectId;
  final String? contentId;
  final String? modelId;
  final String title;
  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  int _days = 30;
  final _pin = TextEditingController();
  final _views = TextEditingController();
  final _message = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _url;

  @override
  void dispose() {
    for (final c in [_pin, _views, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _create() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = J.of(
        await context.api.post(
          '/client/projects/${widget.projectId}/visits',
          body: {
            'content_id': widget.contentId,
            'model_id': widget.modelId,
            'days': _days,
            'pin': _pin.text.isEmpty ? null : _pin.text,
            'max_views': int.tryParse(_views.text),
            'message': _message.text.trim().isEmpty ? null : _message.text.trim(),
          },
        ),
      );
      setState(() => _url = res.s('url'));
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pinOk = _pin.text.isEmpty || RegExp(r'^\d{4,8}$').hasMatch(_pin.text);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Partager la visite avec vos proches', style: Theme.of(context).textTheme.titleLarge),
            Text(widget.title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 14),
            if (_url != null) ...[
              AlertBox(
                tone: Tone.success,
                title: 'Lien créé',
                message: "Copiez-le maintenant : il n'est affiché qu'une seule fois.${_pin.text.isNotEmpty ? ' Communiquez le code PIN séparément.' : ''}",
              ),
              const SizedBox(height: 10),
              SelectableText(_url!, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: _url!));
                      if (context.mounted) context.toast('Lien copié');
                    },
                    icon: const Icon(Icons.copy),
                    label: const Text('Copier'),
                  ),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                    onPressed: () => openExternal(context, 'https://wa.me/?text=${Uri.encodeComponent('Visitez notre future maison en 360° : $_url')}'),
                    icon: const Icon(Icons.chat),
                    label: const Text('WhatsApp'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Terminé')),
            ] else ...[
              DropdownButtonFormField<int>(
                initialValue: _days,
                decoration: const InputDecoration(labelText: 'Validité'),
                items: const [
                  DropdownMenuItem(value: 1, child: Text('24 heures')),
                  DropdownMenuItem(value: 7, child: Text('7 jours')),
                  DropdownMenuItem(value: 30, child: Text('30 jours')),
                  DropdownMenuItem(value: 90, child: Text('90 jours')),
                ],
                onChanged: (v) => setState(() => _days = v ?? 30),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _views,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Nombre de visites max.', helperText: 'Vide = illimité pendant la validité'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _pin,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(8)],
                decoration: InputDecoration(
                  labelText: 'Code PIN (facultatif)',
                  helperText: '4 à 8 chiffres, à transmettre séparément',
                  errorText: pinOk ? null : '4 à 8 chiffres',
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _message,
                maxLength: 500,
                minLines: 2,
                maxLines: 3,
                decoration: const InputDecoration(labelText: "Mot d'accueil", hintText: 'Voici notre future maison, à bientôt pour la crémaillère !'),
              ),
              const FootNote('Vos invités voient uniquement ce contenu : aucune information financière ni document du projet.', icon: Icons.shield_outlined),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: AlertBox(tone: Tone.danger, message: _error!),
                ),
              const SizedBox(height: 12),
              BusyButton(label: 'Créer le lien', icon: Icons.link, expand: true, busy: _busy, onPressed: pinOk ? _create : null),
            ],
          ],
        ),
      ),
    );
  }
}

/// Liens de visite partagés (révocables à tout moment).
class MyVisitShares extends StatelessWidget {
  const MyVisitShares({super.key, required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/client/projects/$projectId/visits',
      refreshable: false,
      offline: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, handle) {
        final shares = listOf(data);
        if (shares.isEmpty) return const SizedBox.shrink();
        return SectionCard(
          title: 'Mes liens de visite partagés',
          subtitle: 'Révoquez un lien à tout moment : il cesse immédiatement de fonctionner.',
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final s in shares)
                ListTile(
                  title: Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(s.s('title')),
                      Text(s.s('token_hint'), style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
                      ToneBadge(s.b('active') ? 'Actif' : (s.has('revoked_at') ? 'Révoqué' : 'Expiré'), tone: s.b('active') ? Tone.success : Tone.neutral),
                      if (s.b('has_pin')) const ToneBadge('PIN', tone: Tone.info),
                    ],
                  ),
                  subtitle: Text(
                    '${s.i('views')} visite(s)${s.has('max_views') ? ' / ${s.i('max_views')}' : ''} · expire le ${date(s['expires_at'])}${s.has('last_viewed_at') ? ' · dernière le ${date(s['last_viewed_at'])}' : ''}',
                  ),
                  trailing: s.b('active')
                      ? IconButton(
                          tooltip: 'Révoquer',
                          icon: const Icon(Icons.link_off, color: GlobusColors.danger),
                          onPressed: () async {
                            final ok = await runAction(context, () => context.api.post('/visits/${s.s('id')}/revoke'), success: 'Lien révoqué');
                            if (ok != null) await handle.reload();
                          },
                        )
                      : null,
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Liste des configurations de finitions ouvertes.
class ConfiguratorListScreen extends StatelessWidget {
  const ConfiguratorListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) => ApiView(
        path: '/client/projects/${project.s('id')}/immersion',
        builder: (context, data, _) {
          final list = J.of(data).list('configurators');
          return PageList(
            children: [
              const PageHeader(
                title: 'Configurateur de finitions',
                subtitle: 'Visualisez vos choix de matériaux en 3D avec leur impact immédiat sur le prix et le délai.',
              ),
              if (list.isEmpty)
                const EmptyView(
                  icon: Icons.palette_outlined,
                  title: 'Aucune configuration ouverte',
                  text: 'Votre chef de projet ouvrira le configurateur au moment du choix de vos finitions.',
                ),
              for (final c in list)
                Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(14),
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: GlobusTokens.accent50, borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.palette_outlined, color: GlobusTokens.accent600),
                    ),
                    title: Text(c.s('name'), style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(c.has('lock_date') ? "Choix jusqu'au ${date(c['lock_date'])}" : 'Choix ouverts'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/espace-client/configurateur/${c.s('id')}'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Configurateur 3D de matériaux (§11) : scénarios, choix par zone (aperçu 3D synchronisé), delta prix / délai,
/// variante, comparaison, capture, soumission (puis validation par code dans « Validations »).
class ConfiguratorScreen extends StatefulWidget {
  const ConfiguratorScreen({super.key, required this.modelId});
  final String modelId;
  @override
  State<ConfiguratorScreen> createState() => _ConfiguratorScreenState();
}

class _ConfiguratorScreenState extends State<ConfiguratorScreen> {
  J? _model;
  List<J> _scenarios = [];
  String? _activeId;
  String? _zoneId;
  Object? _error;
  String? _busy;
  final _viewer = EmbeddedWebHandle();
  bool _viewerReady = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final api = context.api;
    try {
      final m = J.of(await api.get('/configurator/models/${widget.modelId}'));
      var rows = listOf(await api.get('/configurator/models/${widget.modelId}/scenarios'));
      if (rows.isEmpty && m.b('choices_open')) {
        try {
          rows = [
            J.of(await api.post('/configurator/models/${widget.modelId}/scenarios', body: {'name': 'Mon scénario'})),
          ];
        } catch (_) {
          // consultation seule
        }
      }
      if (!mounted) return;
      setState(() {
        _model = m;
        _scenarios = rows;
        _activeId = rows.where((s) => s.s('status') == 'draft').firstOrNull?.s('id') ?? rows.firstOrNull?.s('id');
        _zoneId = m.list('zones').firstOrNull?.s('id');
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  J? get _scenario => _scenarios.where((s) => s.s('id') == _activeId).firstOrNull;
  bool get _editable => (_model?.b('choices_open') ?? false) && _scenario?.s('status') == 'draft';

  J? _itemFor(String zoneId) => _scenario?.list('items').where((i) => i.s('zone_id') == zoneId).firstOrNull;

  void _replace(J updated) => setState(() => _scenarios = [for (final s in _scenarios) s.s('id') == updated.s('id') ? updated : s]);

  Future<void> _choose(J zone, J material) async {
    final scenario = _scenario;
    if (scenario == null || !_editable) return;
    setState(() => _busy = 'choice-${material.s('id')}');
    unawaited(_viewer.send({'type': 'material', 'meshes': zone.strings('mesh_names'), 'material': material.raw}));
    try {
      _replace(
        J.of(await context.api.put('/configurator/scenarios/${scenario.s('id')}/choices', body: {'zone_id': zone.s('id'), 'material_id': material.s('id')})),
      );
    } catch (e) {
      if (mounted) context.toastError(e);
      final previous = _itemFor(zone.s('id'))?.objOrNull('material');
      if (previous != null) unawaited(_viewer.send({'type': 'material', 'meshes': zone.strings('mesh_names'), 'material': previous.raw}));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _duplicate() async {
    final scenario = _scenario;
    if (scenario == null) return;
    final name = await promptText(
      context,
      title: 'Créer une variante',
      label: 'Nom de la variante',
      initial: '${scenario.s('name')} (variante)',
      required: true,
      minLength: 2,
      maxLines: 1,
      confirm: 'Créer',
    );
    if (name == null || !mounted) return;
    final copy = await runAction(context, () => context.api.post('/configurator/scenarios/${scenario.s('id')}/duplicate', body: {'name': name}));
    if (copy != null) {
      setState(() {
        _scenarios = [..._scenarios, J.of(copy)];
        _activeId = J.of(copy).s('id');
      });
      unawaited(_viewer.send({'type': 'scenario', 'id': _activeId}));
    }
  }

  Future<void> _compare() async {
    final selected = <String>{for (final s in _scenarios.take(2)) s.s('id')};
    final ids = await showDialog<Set<String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: const Text('Comparer des scénarios'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final s in _scenarios)
                CheckboxListTile(
                  value: selected.contains(s.s('id')),
                  onChanged: (v) => set(() => v == true ? selected.add(s.s('id')) : selected.remove(s.s('id'))),
                  title: Text(s.s('name')),
                  subtitle: Text(optionLabel(s.s('status'))),
                ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
            FilledButton(onPressed: selected.length < 2 ? null : () => Navigator.pop(ctx, selected), child: const Text('Comparer')),
          ],
        ),
      ),
    );
    if (ids == null || !mounted) return;
    final res = await runAction(context, () => context.api.get('/configurator/models/${widget.modelId}/compare', query: {'ids': ids.join(',')}));
    if (res == null || !mounted) return;
    final cmp = J.of(res);
    await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Comparaison')),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: [
                    const DataColumn(label: Text('Zone')),
                    for (final s in cmp.list('scenarios')) DataColumn(label: Text(s.s('name'))),
                  ],
                  rows: [
                    for (final z in cmp.list('zones'))
                      DataRow(
                        cells: [
                          DataCell(Text(z.s('zone'))),
                          for (final s in cmp.list('scenarios'))
                            DataCell(
                              Builder(
                                builder: (_) {
                                  final c = z.obj('choices').obj(s.s('id'));
                                  return Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(c.s('material')),
                                      Text(
                                        '${money(c['line_total'])} (${c.d('delta') > 0 ? '+' : ''}${money(c['delta'])})',
                                        style: const TextStyle(fontSize: 11),
                                      ),
                                    ],
                                  );
                                },
                              ),
                            ),
                        ],
                      ),
                    DataRow(
                      cells: [
                        const DataCell(Text('Total', style: TextStyle(fontWeight: FontWeight.w700))),
                        for (final s in cmp.list('scenarios'))
                          DataCell(
                            Text(
                              '${money(s['total'])}\n${s.d('price_delta') > 0 ? '+' : ''}${money(s['price_delta'])} · ${s.i('delay_delta_days')} j',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _snapshot() async {
    final scenario = _scenario;
    if (scenario == null) return;
    setState(() => _busy = 'snapshot');
    unawaited(_viewer.send({'type': 'snapshot'}));
    // La page répond par un message « snapshot » (voir _onViewerMessage).
  }

  Future<void> _onViewerMessage(J msg) async {
    switch (msg.s('type')) {
      case 'ready':
        setState(() => _viewerReady = true);
        if (_activeId != null) unawaited(_viewer.send({'type': 'scenario', 'id': _activeId}));
      case 'pick':
        final mesh = msg.s('mesh');
        final zone = _model?.list('zones').where((z) => z.strings('mesh_names').any((n) => mesh == n || mesh.startsWith('${n}_'))).firstOrNull;
        if (zone != null) setState(() => _zoneId = zone.s('id'));
      case 'snapshot':
        final scenario = _scenario;
        final data = msg.str('data');
        if (scenario == null || data == null) {
          setState(() => _busy = null);
          if (mounted) context.toast('Capture indisponible', error: true);
          return;
        }
        try {
          final updated = await context.api.upload(
            '/configurator/scenarios/${scenario.s('id')}/snapshot',
            files: [UploadFile(name: '${scenario.s('name')}.png', bytes: base64Decode(data), contentType: 'image/png')],
          );
          _replace(J.of(updated));
          if (mounted) context.toast('Capture enregistrée', success: true);
        } catch (e) {
          if (mounted) context.toastError(e);
        } finally {
          if (mounted) setState(() => _busy = null);
        }
    }
  }

  Future<void> _submit() async {
    final s = _scenario;
    if (s == null) return;
    final ok = await confirmDialog(
      context,
      title: 'Soumettre ce scénario',
      message:
          'Le scénario « ${s.s('name')} » (${money(s['price_delta'])}, ${s.i('delay_delta_days')} j) sera soumis à votre validation sécurisée par code. Il ne sera plus modifiable.',
      confirm: 'Soumettre',
    );
    if (!ok || !mounted) return;
    final res = await runAction(
      context,
      () => context.api.post('/configurator/scenarios/${s.s('id')}/submit'),
      success: 'Scénario soumis : validez-le par code dans la rubrique Validations.',
    );
    if (res != null && mounted) {
      _replace(J.of(res));
      context.go('/espace-client/validations');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_model == null) return _error != null ? ErrorView(error: _error, onRetry: _load) : const LoadingView();
    final m = _model!;
    final scenario = _scenario;
    final zones = m.list('zones');
    final zone = zones.where((z) => z.s('id') == _zoneId).firstOrNull ?? zones.firstOrNull;
    final current = zone == null ? null : _itemFor(zone.s('id'));
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: PageHeader(
            title: m.s('name'),
            subtitle: m.b('choices_open')
                ? (m.has('lock_date') ? "Choix ouverts jusqu'au ${date(m['lock_date'])}" : 'Choix ouverts')
                : 'Les choix sont clôturés',
          ),
        ),
        if (m.has('file_url'))
          SizedBox(
            height: 320,
            child: Stack(
              children: [
                EmbeddedWebView(
                  path: '/embarque/configurateur/${widget.modelId}${_activeId == null ? '' : '?scenario=$_activeId'}',
                  handle: _viewer,
                  onMessage: _onViewerMessage,
                ),
                if (!_viewerReady && embeddedWebSupported) const Positioned(left: 0, right: 0, bottom: 0, child: LinearProgressIndicator()),
              ],
            ),
          )
        else
          Container(height: 120, alignment: Alignment.center, color: GlobusTokens.brand50, child: const Text('Aperçu 3D indisponible pour cette maquette.')),
        if (m.has('file_url'))
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
            child: Text('Touchez une surface de la maquette pour sélectionner la zone correspondante.', style: theme.textTheme.bodySmall),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_scenarios.isNotEmpty)
                DropdownButtonFormField<String>(
                  initialValue: _activeId,
                  decoration: const InputDecoration(labelText: 'Scénario'),
                  items: [for (final s in _scenarios) DropdownMenuItem(value: s.s('id'), child: Text('${s.s('name')} — ${optionLabel(s.s('status'))}'))],
                  onChanged: (v) {
                    setState(() => _activeId = v);
                    unawaited(_viewer.send({'type': 'scenario', 'id': v}));
                  },
                ),
              const SizedBox(height: 8),
              if (scenario != null)
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    OutlinedButton.icon(onPressed: _duplicate, icon: const Icon(Icons.copy, size: 18), label: const Text('Variante')),
                    OutlinedButton.icon(
                      onPressed: _scenarios.length < 2 ? null : _compare,
                      icon: const Icon(Icons.compare_arrows, size: 18),
                      label: const Text('Comparer'),
                    ),
                    if (m.has('file_url') && embeddedWebSupported)
                      OutlinedButton.icon(
                        onPressed: _busy == 'snapshot' || !_viewerReady ? null : _snapshot,
                        icon: const Icon(Icons.photo_camera_outlined, size: 18),
                        label: const Text('Capture'),
                      ),
                    if (_editable)
                      FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: GlobusColors.accent),
                        onPressed: _submit,
                        icon: const Icon(Icons.send, size: 18),
                        label: const Text('Soumettre pour validation'),
                      ),
                  ],
                ),
              const SizedBox(height: 12),
              if (scenario == null)
                const AlertBox(tone: Tone.info, message: 'Aucun scénario : la configuration est en lecture seule.')
              else ...[
                StatGrid(
                  children: [
                    StatTile(label: 'Total de référence', value: money(scenario['base_total'])),
                    StatTile(
                      label: 'Total du scénario',
                      value: money(scenario['scenario_total']),
                      hint: '${scenario.d('price_delta') > 0 ? '+' : ''}${money(scenario['price_delta'])}',
                      tone: scenario.d('price_delta') > 0 ? Tone.warning : (scenario.d('price_delta') < 0 ? Tone.success : Tone.info),
                    ),
                    StatTile(
                      label: 'Impact délai',
                      value: '${scenario.i('delay_delta_days') > 0 ? '+' : ''}${scenario.i('delay_delta_days')} jour(s)',
                      hint: optionLabel(scenario.s('status')),
                      tone: scenario.i('delay_delta_days') > 0 ? Tone.warning : Tone.neutral,
                    ),
                  ],
                ),
                if (!_editable)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: AlertBox(
                      tone: Tone.warning,
                      icon: Icons.lock_outline,
                      message: "Ce scénario n'est plus modifiable${scenario.s('status') != 'draft' ? ' (${optionLabel(scenario.s('status'))})' : ''}.",
                    ),
                  ),
              ],
              const GroupTitle('Zones et matériaux'),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final z in zones)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(z.s('label')),
                          selected: z.s('id') == zone?.s('id'),
                          onSelected: (_) {
                            setState(() => _zoneId = z.s('id'));
                            unawaited(_viewer.send({'type': 'highlight', 'meshes': z.strings('mesh_names')}));
                          },
                        ),
                      ),
                  ],
                ),
              ),
              if (zone != null) ...[
                const SizedBox(height: 8),
                Text(
                  '${zone.has('room') ? '${zone.s('room')} · ' : ''}${number(zone['quantity'], 2)} ${zone.s('unit')}${current != null ? ' · actuel : ${current.objOrNull('material')?.s('name') ?? '—'} (${money(current['line_total'])})' : ''}',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                for (final mat in zone.list('materials'))
                  Builder(
                    builder: (_) {
                      final selected = current?.s('material_id') == mat.s('id') || (current == null && mat.s('id') == zone.s('default_material_id'));
                      final lineTotal = mat.d('unit_price') * zone.d('quantity');
                      final color = _hex(mat.str('color_hex'));
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        color: selected ? theme.colorScheme.primaryContainer : null,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: BorderSide(color: selected ? GlobusTokens.brand400 : theme.colorScheme.outlineVariant),
                        ),
                        child: ListTile(
                          enabled: _editable || selected,
                          onTap: !_editable || _busy == 'choice-${mat.s('id')}' ? null : () => _choose(zone, mat),
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: SizedBox(
                              width: 48,
                              height: 48,
                              child: mat.has('image_url') ? AuthImage(mat.s('image_url')) : ColoredBox(color: color ?? GlobusTokens.line),
                            ),
                          ),
                          title: Row(
                            children: [
                              Flexible(
                                child: Text(mat.s('name'), style: const TextStyle(fontWeight: FontWeight.w600)),
                              ),
                              if (mat.has('tier'))
                                Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: ToneBadge(optionLabel(mat.s('tier')), tone: Tone.accent),
                                ),
                            ],
                          ),
                          subtitle: Text(
                            [
                              '${money(mat['unit_price'])}/${mat.s('unit')}',
                              'total ${money(lineTotal)}',
                              if (mat.has('availability') && mat.s('availability') != 'in_stock') optionLabel(mat.s('availability')),
                              if (mat.i('lead_time_days') > 0) '${mat.i('lead_time_days')} j',
                            ].join(' · '),
                          ),
                          trailing: _busy == 'choice-${mat.s('id')}'
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                              : (selected ? const Icon(Icons.check_circle, color: GlobusColors.primary) : null),
                        ),
                      );
                    },
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  static Color? _hex(String? hex) {
    if (hex == null || !RegExp(r'^#?[0-9a-fA-F]{6}$').hasMatch(hex)) return null;
    return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16));
  }
}

const _liveKinds = <String, (String, IconData)>{
  'live': ('Direct', Icons.sensors),
  'photo_360': ('Photos 360°', Icons.threesixty),
  'video_360': ('Vidéos 360°', Icons.threesixty),
  'virtual_tour': ('Visites virtuelles', Icons.threesixty),
  'drone': ('Drone', Icons.flight),
  'timelapse': ('Time-lapse', Icons.movie_outlined),
};

/// Live, 360° et drone : directs, visites 360° (gyroscope), vidéos drone, comparaisons dans le temps, partage.
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});
  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  String? _kind;
  int _shares = 0;

  static String? _embedUrl(String url) {
    final yt = RegExp(r'(?:youtube\.com/(?:watch\?v=|live/|embed/)|youtu\.be/)([\w-]{6,})').firstMatch(url);
    if (yt != null) return 'https://www.youtube.com/watch?v=${yt.group(1)}';
    final vimeo = RegExp(r'vimeo\.com/(\d+)').firstMatch(url);
    if (vimeo != null) return 'https://vimeo.com/${vimeo.group(1)}';
    return null;
  }

  void _play(BuildContext context, String projectId, J c) {
    final url = c.str('url');
    if (url == null) return;
    final external = _embedUrl(url);
    if (external != null) {
      unawaited(openExternal(context, external));
    } else if (c.s('kind') == 'photo_360' || c.s('kind') == 'video_360') {
      unawaited(EmbeddedViewerScreen.open(context, title: c.s('title'), path: '/embarque/360/$projectId/${c.s('id')}'));
    } else if (c.s('kind') == 'virtual_tour' && url.startsWith('https://')) {
      unawaited(openExternal(context, url));
    } else {
      unawaited(GalleryScreen.open(context, [GalleryItem(url: url, isVideo: true, caption: c.s('title'))]));
    }
  }

  @override
  Widget build(BuildContext context) {
    return WithProject(
      builder: (context, project) {
        final id = project.s('id');
        return ApiView(
          path: '/client/projects/$id/immersion',
          builder: (context, data, _) {
            final contents = J.of(data).list('contents');
            if (contents.isEmpty) {
              return ListView(
                children: const [
                  EmptyView(
                    icon: Icons.threesixty,
                    title: 'Aucun contenu immersif publié',
                    text: 'Directs, visites 360° et survols de drone apparaîtront ici au fil du chantier.',
                  ),
                ],
              );
            }
            final kinds = {for (final c in contents) c.s('kind')}.toList();
            final active = _kind ?? kinds.first;
            final list = contents.where((c) => c.s('kind') == active).toList();
            final groups = <String, List<J>>{};
            for (final c in list) {
              (groups[c.str('comparison_group') ?? c.s('id')] ??= []).add(c);
            }
            return PageList(
              children: [
                const PageHeader(title: 'Live, 360° et drone', subtitle: 'Suivez votre chantier à distance, comme si vous y étiez.'),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final k in kinds)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            avatar: Icon(_liveKinds[k]?.$2 ?? Icons.play_circle_outline, size: 18),
                            label: Text(_liveKinds[k]?.$1 ?? k),
                            selected: k == active,
                            onSelected: (_) => setState(() => _kind = k),
                          ),
                        ),
                    ],
                  ),
                ),
                for (final group in groups.values)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (group.length > 1)
                            const Padding(
                              padding: EdgeInsets.only(bottom: 8),
                              child: Text('Comparaison dans le temps', style: TextStyle(fontWeight: FontWeight.w700)),
                            ),
                          for (final c in group) ...[
                            InkWell(
                              onTap: () => _play(context, id, c),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                height: 160,
                                decoration: BoxDecoration(color: GlobusTokens.brand900, borderRadius: BorderRadius.circular(12)),
                                child: Center(child: Icon(_liveKinds[c.s('kind')]?.$2 ?? Icons.play_circle_fill, color: Colors.white70, size: 56)),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(c.s('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                                ),
                                if (c.s('kind') != 'live')
                                  IconButton(
                                    tooltip: 'Partager',
                                    icon: const Icon(Icons.share_outlined),
                                    onPressed: () async {
                                      await shareVisit(context, projectId: id, contentId: c.s('id'), title: c.s('title'));
                                      setState(() => _shares++);
                                    },
                                  ),
                              ],
                            ),
                            if (c.has('captured_at')) Text(dateLong(c['captured_at']), style: Theme.of(context).textTheme.bodySmall),
                            if (c.has('description')) Text(c.s('description'), style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(height: 10),
                          ],
                        ],
                      ),
                    ),
                  ),
                MyVisitShares(key: ValueKey(_shares), projectId: id),
              ],
            );
          },
        );
      },
    );
  }
}
