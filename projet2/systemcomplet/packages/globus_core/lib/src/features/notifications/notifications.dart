import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_client.dart';
import '../../api/json.dart';
import '../../context.dart';
import '../../format/format.dart';
import '../../realtime/realtime.dart';
import '../../routing/links.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/paged_list.dart';
import '../../widgets/states.dart';
import '../account/account_screen.dart';

/// Compteur de notifications non lues (cloche) et dernière notification reçue en temps réel.
class NotificationCenter extends ChangeNotifier {
  NotificationCenter(this.api, this.realtime);

  final ApiClient api;
  final Realtime realtime;
  int unread = 0;
  VoidCallback? _unsub;

  /// Notification arrivée pendant l'utilisation (bandeau in-app).
  final ValueNotifier<J?> incoming = ValueNotifier(null);

  Future<void> start() async {
    _unsub?.call();
    _unsub = realtime.subscribe('notification', (data) {
      unread += 1;
      incoming.value = J(data);
      notifyListeners();
    });
    await refresh();
  }

  void stop() {
    _unsub?.call();
    _unsub = null;
    unread = 0;
    notifyListeners();
  }

  Future<void> refresh() async {
    try {
      unread = J.of(await api.get('/notifications/unread-count')).i('unread');
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markRead(List<String>? ids) async {
    await api.post('/notifications/read', body: {'ids': ids});
    await refresh();
  }
}

const _categories = <(String, String)>[
  ('projects', 'Projets'),
  ('decisions', 'Décisions'),
  ('finance', 'Finances'),
  ('documents', 'Documents'),
  ('procurement', 'Achats'),
  ('deliveries', 'Livraisons'),
  ('subcontracting', 'Sous-traitance'),
  ('disputes', 'Litiges'),
  ('bim', 'BIM'),
  ('qhse', 'QHSE'),
  ('support', 'SAV'),
  ('chat', 'Messagerie'),
  ('calls', 'Appels'),
  ('security', 'Sécurité'),
  ('system', 'Système'),
];

/// Liste des notifications (filtres lu / catégorie, tout marquer comme lu, ouverture du lien) + préférences.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _list = PagedListController();
  bool _unreadOnly = false;
  String? _category;

  Future<void> _open(J n) async {
    final center = context.read<NotificationCenter>();
    if (!n.has('read_at')) {
      try {
        await center.markRead([n.s('id')]);
      } catch (_) {}
    }
    if (!mounted) return;
    if (n.has('link')) {
      await openAppLink(context, n.str('link'));
    }
    unawaited(_list.reload());
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: const TabBar(
              tabs: [
                Tab(text: 'Mes notifications'),
                Tab(text: 'Préférences'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                Column(
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                      child: Row(
                        children: [
                          FilterChip(label: const Text('Non lues'), selected: _unreadOnly, onSelected: (v) => setState(() => _unreadOnly = v)),
                          const SizedBox(width: 8),
                          ActionChip(
                            avatar: const Icon(Icons.filter_list, size: 18),
                            label: Text(_category == null ? 'Toutes catégories' : _categories.firstWhere((c) => c.$1 == _category).$2),
                            onPressed: () async {
                              final v = await pickOption<String>(
                                context,
                                title: 'Catégorie',
                                selected: _category ?? '',
                                options: [('', 'Toutes catégories'), ..._categories],
                              );
                              if (v != null) setState(() => _category = v.isEmpty ? null : v);
                            },
                          ),
                          const SizedBox(width: 8),
                          ActionChip(
                            avatar: const Icon(Icons.done_all, size: 18),
                            label: const Text('Tout marquer comme lu'),
                            onPressed: () async {
                              await runAction(context, () => context.read<NotificationCenter>().markRead(null));
                              unawaited(_list.reload());
                            },
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: PagedListView(
                        path: '/notifications',
                        controller: _list,
                        refreshOn: const ['notification'],
                        query: {'unread': _unreadOnly ? 'true' : null, 'category': _category},
                        empty: const EmptyView(icon: Icons.notifications_none, title: 'Aucune notification'),
                        itemBuilder: (context, n, _) => NotificationTile(item: n, onTap: () => _open(n)),
                      ),
                    ),
                  ],
                ),
                const NotificationPreferencesView(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class NotificationTile extends StatelessWidget {
  const NotificationTile({super.key, required this.item, this.onTap});
  final J item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final read = item.has('read_at');
    final urgent = item.s('priority') == 'critical' || item.s('priority') == 'high';
    final theme = Theme.of(context);
    return Material(
      color: read ? Colors.transparent : theme.colorScheme.primaryContainer.withValues(alpha: 0.35),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 6),
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: read ? theme.colorScheme.outline : (urgent ? GlobusColors.danger : GlobusColors.accent),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.s('title'), style: TextStyle(fontWeight: read ? FontWeight.w500 : FontWeight.w700)),
                    if (item.has('body'))
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(item.s('body'), style: theme.textTheme.bodySmall),
                      ),
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(relative(item['created_at']), style: theme.textTheme.bodySmall?.copyWith(fontSize: 11)),
                    ),
                  ],
                ),
              ),
              if (item.has('link')) Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cloche de la barre d'application avec pastille du nombre de non lues.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, required this.onOpen});
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<NotificationCenter>().unread;
    return IconButton(
      tooltip: unread > 0 ? '$unread notification(s) non lue(s)' : 'Notifications',
      onPressed: onOpen,
      icon: Badge(
        isLabelVisible: unread > 0,
        label: Text(unread > 99 ? '99+' : '$unread'),
        backgroundColor: GlobusColors.accent,
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
