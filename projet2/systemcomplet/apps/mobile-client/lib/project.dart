import 'dart:async';

import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Projet courant de l'espace client (sélecteur multi-projets, mémorisé sur l'appareil, consultable hors ligne).
class ClientProjects extends ChangeNotifier {
  ClientProjects(this.api, this.auth) {
    auth.addListener(_onAuth);
    _onAuth();
  }

  final ApiClient api;
  final AuthController auth;
  static const _key = 'globus.client.project';

  List<J>? projects;
  String? _projectId;
  Object? error;
  String? _loadedFor;

  J? get project => projects?.where((p) => p.s('id') == _projectId).firstOrNull;

  void _onAuth() {
    final user = auth.user;
    if (user == null) {
      projects = null;
      _projectId = null;
      _loadedFor = null;
      notifyListeners();
      return;
    }
    if (_loadedFor == user.id || !user.spaces.contains('client')) return;
    _loadedFor = user.id;
    unawaited(load());
  }

  Future<void> load() async {
    try {
      final res = await api.fetch('/client/projects');
      final list = listOf(res.data);
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

/// Sélecteur de projet (barre d'application) : affiché si le client a plusieurs projets.
class ProjectSwitcher extends StatelessWidget {
  const ProjectSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<ClientProjects>();
    final list = state.projects ?? const [];
    final current = state.project;
    if (current == null) return const SizedBox(height: 44);
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      child: InkWell(
        onTap: list.length < 2
            ? null
            : () async {
                final id = await pickOption<String>(
                  context,
                  title: 'Projet',
                  selected: current.s('id'),
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
              const Icon(Icons.apartment, size: 18, color: GlobusColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${current.s('code')} — ${current.s('name')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              if (list.length > 1) const Icon(Icons.unfold_more, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rend `builder(projet)` une fois le projet courant connu, avec états vides explicites.
class WithProject extends StatelessWidget {
  const WithProject({super.key, required this.builder});
  final Widget Function(BuildContext context, J project) builder;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<ClientProjects>();
    if (state.projects == null) return const LoadingView();
    final p = state.project;
    if (p == null) {
      if (state.error != null) return ErrorView(error: state.error, onRetry: state.load);
      return const EmptyView(
        icon: Icons.apartment,
        title: 'Aucun projet rattaché à votre compte',
        text: 'Dès la signature de votre contrat, votre chef de projet ouvre votre espace projet : suivi du chantier, finances, documents et décisions.',
      );
    }
    return KeyedSubtree(key: ValueKey(p.s('id')), child: builder(context, p));
  }
}

/// Devise affichée (FCFA pour XAF).
String cur(J finance) => currencyLabel(finance.str('currency'));
