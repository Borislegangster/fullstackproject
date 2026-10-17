import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Chantier courant de l'application terrain : projets accessibles (affectation), mémorisé sur l'appareil,
/// consultable hors ligne.
class FieldProjects extends ChangeNotifier {
  FieldProjects(this.api, this.auth) {
    auth.addListener(_onAuth);
    _onAuth();
  }

  final ApiClient api;
  final AuthController auth;
  static const _key = 'globus.field.project';

  List<J>? projects;
  String? _projectId;
  Object? error;
  String? _loadedFor;

  J? get project => projects?.where((p) => p.s('id') == _projectId).firstOrNull;
  String? get projectId => project?.s('id');

  void _onAuth() {
    final user = auth.user;
    if (user == null) {
      projects = null;
      _projectId = null;
      _loadedFor = null;
      notifyListeners();
      return;
    }
    if (_loadedFor == user.id || !user.spaces.contains('erp')) return;
    _loadedFor = user.id;
    unawaited(load());
  }

  Future<void> load() async {
    try {
      final res = await api.fetch('/projects', query: {'page_size': 100, 'sort': 'name'});
      final list = listOf(res.data).where((p) => !const ['clos', 'annule'].contains(p.s('status'))).toList();
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_key);
      projects = list;
      _projectId = list.where((p) => p.s('id') == stored).firstOrNull?.s('id') ?? list.firstOrNull?.s('id');
      error = null;
    } catch (e) {
      projects ??= const [];
      error = e;
    }
    notifyListeners();
  }

  Future<void> select(String id) async {
    _projectId = id;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, id);
  }

  @override
  void dispose() {
    auth.removeListener(_onAuth);
    super.dispose();
  }
}

/// Synchronisation automatique de la file hors ligne : au démarrage, au retour du réseau, au premier plan, et
/// toutes les 2 minutes tant que des opérations attendent.
class FieldSync with WidgetsBindingObserver {
  FieldSync(this.queue, this.services) {
    WidgetsBinding.instance.addObserver(this);
    services.offline.addListener(_onNetwork);
    services.auth.addListener(_onAuth);
    _timer = Timer.periodic(const Duration(minutes: 2), (_) {
      if (queue.pendingCount > 0) unawaited(queue.sync());
    });
    _onAuth();
  }

  final OfflineQueue queue;
  final GlobusServices services;
  Timer? _timer;

  void _onAuth() {
    if (services.auth.status == AuthStatus.signedIn) unawaited(queue.load().then((_) => queue.sync()));
  }

  void _onNetwork() {
    if (!services.offline.value) unawaited(queue.sync());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(queue.sync());
  }

  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    services.offline.removeListener(_onNetwork);
    services.auth.removeListener(_onAuth);
  }
}

/// Position GPS (pointage, réception, photos géolocalisées) ; `null` si refusée ou indisponible.
Future<Position?> currentPosition(BuildContext context, {bool required = false}) async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) {
      if (required && context.mounted) context.toast('Activez la localisation du téléphone.', error: true);
      return null;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (required && context.mounted) context.toast('Localisation refusée : autorisez-la dans les réglages du téléphone.', error: true);
      return null;
    }
    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
    );
  } catch (_) {
    if (required && context.mounted) context.toast('Position indisponible : réessayez à découvert.', error: true);
    return null;
  }
}

/// Rend `builder(projet)` une fois le chantier courant connu.
class WithSite extends StatelessWidget {
  const WithSite({super.key, required this.builder});
  final Widget Function(BuildContext context, J project) builder;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<FieldProjects>();
    if (state.projects == null) return const LoadingView();
    final p = state.project;
    if (p == null) {
      if (state.error != null) return ErrorView(error: state.error, onRetry: state.load);
      return const EmptyView(
        icon: Icons.engineering_outlined,
        title: 'Aucun chantier affecté',
        text: 'Votre chef de projet vous ajoute à l\'équipe du chantier : il apparaîtra ici automatiquement.',
      );
    }
    return KeyedSubtree(key: ValueKey(p.s('id')), child: builder(context, p));
  }
}

/// Sélecteur de chantier (barre d'application).
class SiteSwitcher extends StatelessWidget {
  const SiteSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<FieldProjects>();
    final queue = context.watch<OfflineQueue>();
    final current = state.project;
    final theme = Theme.of(context);
    final list = state.projects ?? const [];
    return Material(
      color: theme.colorScheme.surface,
      child: InkWell(
        onTap: list.length < 2
            ? null
            : () async {
                final id = await pickOption<String>(
                  context,
                  title: 'Chantier',
                  selected: current?.s('id'),
                  options: [for (final p in list) (p.s('id'), '${p.s('code')} — ${p.s('name')}')],
                );
                if (id != null) await state.select(id);
              },
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: theme.colorScheme.outlineVariant)),
          ),
          child: Row(
            children: [
              const Icon(Icons.engineering_outlined, size: 18, color: GlobusColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  current == null ? 'Aucun chantier' : '${current.s('code')} — ${current.s('name')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              if (queue.syncing)
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              else if (queue.conflictCount + queue.rejectedCount > 0)
                ToneBadge('${queue.conflictCount + queue.rejectedCount} à traiter', tone: Tone.danger, icon: Icons.sync_problem)
              else if (queue.pendingCount > 0)
                ToneBadge('${queue.pendingCount} en attente', tone: Tone.warning, icon: Icons.cloud_upload_outlined)
              else
                const Icon(Icons.cloud_done_outlined, size: 18, color: GlobusColors.success),
              if (list.length > 1) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.unfold_more, size: 18)),
            ],
          ),
        ),
      ),
    );
  }
}
