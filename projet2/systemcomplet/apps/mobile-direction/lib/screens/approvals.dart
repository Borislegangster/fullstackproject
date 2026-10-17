import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'modules.dart';

/// Un onglet de validation : visible selon les droits, liste filtrée sur ce qui attend une décision.
class _Tab {
  const _Tab(this.key, this.label, this.config, {this.perms = const [], this.anyPerms = const []});
  final String key;
  final String label;
  final ResourceConfig config;
  final List<String> perms;
  final List<String> anyPerms;
}

/// Demandes d'achat en attente de MON niveau de validation (circuit multi-niveaux du serveur).
final _pendingRequests = ResourceConfig(
  title: "Demandes d'achat à approuver",
  path: '/procurement/approvals/pending',
  icon: Icons.shopping_cart_outlined,
  search: false,
  itemTitle: (r) => '${r.obj('request').s('number')} · ${optionLabel(r.obj('request').str('category'))}',
  itemSubtitle: (r) => [
    'niveau ${r.obj('approval').i('level')}',
    if (r.obj('request').has('needed_by')) 'pour le ${date(r.obj('request')['needed_by'])}',
    if (r.obj('request').s('urgency') != 'normal') optionLabel(r.obj('request').str('urgency')),
  ].join(' · '),
  itemTrailing: (r) => r.obj('request').has('total_estimated') ? money(r.obj('request')['total_estimated']) : null,
  itemBadge: (r) => r.obj('approval').str('status'),
  open: (context, r) => openResource(context, purchaseRequests, r.obj('request')),
  emptyText: 'Aucune demande en attente de votre validation',
);

final _tabs = <_Tab>[
  _Tab('achats', 'Achats', _pendingRequests, perms: const ['procurement:approve']),
  _Tab(
    'commandes',
    'Commandes',
    purchaseOrders.copyWith(
      title: 'Commandes à approuver',
      query: {'status': 'pending_approval'},
      filters: const [],
      keepCreate: false,
      emptyText: 'Aucune commande à approuver',
    ),
    perms: const ['procurement:approve'],
  ),
  _Tab(
    'paiements',
    'Paiements',
    payments.copyWith(
      title: 'Paiements à approuver',
      query: {'status': 'awaiting_approval'},
      filters: const [],
      keepCreate: false,
      emptyText: 'Aucun paiement à approuver',
    ),
    perms: const ['finance:approve'],
  ),
  _Tab(
    'situations',
    'Situations',
    situations.copyWith(title: 'Situations à valider', query: {'status': 'field_checked'}, filters: const [], emptyText: 'Aucune situation à valider'),
    perms: const ['subcontracting:validate'],
  ),
  _Tab(
    'factures',
    'Factures',
    supplierInvoices.copyWith(title: 'Factures en anomalie', query: {'status': 'exception'}, filters: const [], emptyText: 'Aucune facture en anomalie'),
    perms: const ['billing:validate'],
  ),
  _Tab(
    'conges',
    'Congés',
    leaves.copyWith(title: 'Congés à décider', query: {'status': 'pending'}, filters: const [], emptyText: 'Aucune demande de congé'),
    perms: const ['hr:write'],
  ),
  _Tab(
    'documents',
    'Documents',
    documents.copyWith(title: 'Documents en revue', query: {'status': 'in_review'}, filters: const [], emptyText: 'Aucun document en revue'),
    anyPerms: const ['documents:approve', 'documents:publish'],
  ),
  _Tab(
    'actions',
    'Actions QHSE',
    qhseActions.copyWith(title: 'Actions à vérifier', query: {'status': 'done'}, filters: const [], emptyText: 'Aucune action à vérifier'),
    perms: const ['qhse:write'],
  ),
  _Tab('decisions', 'Décisions client', _clientDecisions, perms: const ['projects:read']),
];

/// Décisions soumises aux clients et toujours sans réponse (suivi ; la décision appartient au client).
final _clientDecisions = ResourceConfig(
  title: 'Décisions client en attente',
  path: '/decisions',
  query: const {'status': 'pending_client'},
  icon: Icons.how_to_vote_outlined,
  itemTitle: (r) => r.s('title'),
  itemSubtitle: (r) => [
    if (r.has('due_date')) 'réponse attendue le ${date(r['due_date'])}',
    if (toDouble(r['price_impact']) != 0) 'impact ${money(r['price_impact'])}',
    if (r.i('delay_impact_days') != 0) '${r.i('delay_impact_days')} j',
  ].join(' · '),
  emptyText: 'Aucune décision client en attente',
);

/// Validations de la direction : tout ce qui attend une décision, au même endroit (miroir des approbations du web).
class ApprovalsScreen extends StatelessWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final tabs = _tabs.where((t) => user != null && (t.perms.isEmpty || user.canAll(t.perms)) && (t.anyPerms.isEmpty || user.canAny(t.anyPerms))).toList();
    if (tabs.isEmpty) return const EmptyView(icon: Icons.task_alt, title: 'Aucune validation pour votre profil');
    final wanted = GoRouterState.of(context).uri.queryParameters['onglet'];
    final initial = tabs.indexWhere((t) => t.key == wanted);
    return DefaultTabController(
      length: tabs.length,
      initialIndex: initial < 0 ? 0 : initial,
      child: Column(
        children: [
          TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [for (final t in tabs) Tab(text: t.label)],
          ),
          Expanded(
            child: TabBarView(children: [for (final t in tabs) ResourceListScreen(config: t.config)]),
          ),
        ],
      ),
    );
  }
}
