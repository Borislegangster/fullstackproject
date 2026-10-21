import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';

import '../app.dart';

/// Libellé court d'une ligne : numéro + intitulé (titre, nom, raison sociale, objet…).
String rowTitle(J r) {
  final label = r.str('title') ?? r.str('subject') ?? r.str('name') ?? r.str('trade_name') ?? r.str('legal_name') ?? r.str('full_name') ?? r.str('label');
  final number = r.str('number') ?? r.str('code');
  if (number != null && label != null) return '$number — $label';
  return number ?? label ?? '—';
}

String? _project(J r) => r.objOrNull('project')?.str('code') ?? r.str('project_code');
String? _supplier(J r) => r.objOrNull('supplier')?.str('legal_name') ?? r.str('supplier_name') ?? r.str('supplier');

List<(String, String)> _opts(List<String> values) => [for (final v in values) (v, statusLabel(v))];

/// Ouvre un PDF / fichier de l'API (bon de commande, facture, rapport…).
ResourceAction pdfAction(String label, String Function(J row) path, {bool Function(J row)? when}) =>
    ResourceAction(label: label, icon: Icons.picture_as_pdf_outlined, when: when, run: (context, row) => openRemoteFile(context, path(row)));

// ============================================================================================ achats
final purchaseRequests = ResourceConfig(
  title: "Demandes d'achat",
  path: '/procurement/requests',
  icon: Icons.shopping_cart_outlined,
  itemTitle: (r) => '${r.s('number')} · ${optionLabel(r.str('category'))}',
  itemSubtitle: (r) => [if (r.has('needed_by')) 'pour le ${date(r['needed_by'])}', if (r.s('urgency') != 'normal') optionLabel(r.str('urgency'))].join(' · '),
  itemTrailing: (r) => r.has('total_estimated') ? money(r['total_estimated']) : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled'])),
  ],
  detailPath: (r) => '/procurement/requests/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /procurement/requests', label: 'Nouvelle demande', perms: ['procurement:request'], idempotent: true),
  detailExtra: (context, r, reload) => Column(
    children: [
      LinesTable(
        title: 'Lignes',
        rows: r.list('lines'),
        label: (l) => l.s('description'),
        subtitle: (l) => '${number(l['quantity'], 2)} ${l.s('unit')}',
        value: (l) => l.has('estimated_unit_price') ? money(toDouble(l['estimated_unit_price']) * toDouble(l['quantity'])) : '',
      ),
      LinesTable(
        title: 'Circuit de validation',
        rows: r.list('approvals'),
        label: (a) => 'Niveau ${a.i('level')} · ${optionLabel(a.str('approver_role'))}',
        subtitle: (a) => [if (a.has('decided_at')) dateTime(a['decided_at']), if (a.has('comment')) a.s('comment')].join(' · '),
        value: (a) => statusLabel(a.s('status')),
      ),
    ],
  ),
  actions: [
    ResourceAction(
      label: 'Approuver',
      endpoint: 'POST /procurement/requests/{request_id}/decision',
      fixed: (r) => {'approve': true},
      perms: const ['procurement:approve'],
      when: (r) => r.s('status') == 'submitted',
      success: 'Demande approuvée',
    ),
    ResourceAction(
      label: 'Refuser',
      danger: true,
      endpoint: 'POST /procurement/requests/{request_id}/decision',
      fixed: (r) => {'approve': false},
      fields: const {'comment': FieldConfig(label: 'Motif du refus')},
      perms: const ['procurement:approve'],
      when: (r) => r.s('status') == 'submitted',
      success: 'Demande refusée',
    ),
    ResourceAction(
      label: 'Soumettre',
      path: (r) => '/procurement/requests/${r.s('id')}/submit',
      when: (r) => r.s('status') == 'draft',
      perms: const ['procurement:request'],
    ),
    ResourceAction(
      label: 'Annuler',
      danger: true,
      endpoint: 'POST /procurement/requests/{request_id}/cancel',
      fixed: (r) => {'approve': false},
      when: (r) => const ['draft', 'submitted', 'approved'].contains(r.s('status')),
      perms: const ['procurement:request'],
    ),
  ],
);

final purchaseOrders = ResourceConfig(
  title: 'Bons de commande',
  path: '/procurement/orders',
  icon: Icons.receipt_long_outlined,
  itemTitle: (r) => '${r.s('number')} · ${_supplier(r) ?? ''}',
  itemSubtitle: (r) => [?_project(r), if (r.has('expected_date')) 'livraison ${date(r['expected_date'])}', if (r.b('urgent')) 'urgent'].join(' · '),
  itemTrailing: (r) => money(r['total']),
  filters: [
    ResourceFilter(
      'status',
      'Statut',
      _opts([
        'draft',
        'pending_approval',
        'approved',
        'sent',
        'confirmed',
        'refused',
        'countered',
        'shipped',
        'partially_received',
        'received',
        'invoiced',
        'closed',
        'cancelled',
      ]),
    ),
  ],
  detailPath: (r) => '/procurement/orders/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /procurement/orders', label: 'Commande directe', perms: ['procurement:order'], idempotent: true),
  detailExtra: (context, r, reload) => LinesTable(
    title: 'Lignes',
    rows: r.list('lines'),
    label: (l) => l.s('description'),
    subtitle: (l) => '${number(l['quantity'], 2)} ${l.s('unit')} × ${money(l['unit_price'])}',
    value: (l) => money(toDouble(l['quantity']) * toDouble(l['unit_price'])),
  ),
  actions: [
    ResourceAction(
      label: 'Approuver',
      path: (r) => '/procurement/orders/${r.s('id')}/approve',
      perms: const ['procurement:approve'],
      when: (r) => r.s('status') == 'pending_approval',
      success: 'Commande approuvée',
    ),
    ResourceAction(
      label: 'Envoyer au fournisseur',
      path: (r) => '/procurement/orders/${r.s('id')}/send',
      perms: const ['procurement:order'],
      when: (r) => r.s('status') == 'approved',
      success: 'Commande envoyée',
      icon: Icons.send_outlined,
    ),
    ResourceAction(
      label: 'Clôturer',
      endpoint: 'POST /procurement/orders/{order_id}/close',
      perms: const ['procurement:order'],
      when: (r) => const ['received', 'partially_received'].contains(r.s('status')),
    ),
    ResourceAction(
      label: 'Annuler',
      danger: true,
      endpoint: 'POST /procurement/orders/{order_id}/cancel',
      perms: const ['procurement:order'],
      when: (r) => const ['draft', 'pending_approval', 'approved', 'sent'].contains(r.s('status')),
    ),
    pdfAction('Bon de commande (PDF)', (r) => '/procurement/orders/${r.s('id')}/pdf'),
  ],
);

final suppliers = ResourceConfig(
  title: 'Fournisseurs',
  path: '/suppliers',
  icon: Icons.storefront_outlined,
  itemTitle: (r) => r.str('trade_name') ?? r.s('legal_name'),
  itemSubtitle: (r) => [if (r.has('city')) r.s('city'), r.strings('categories').map(optionLabel).join(', ')].where((s) => s.isNotEmpty).join(' · '),
  itemTrailing: (r) => r.has('quality_score') ? '${number(r['quality_score'])}/100' : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['active', 'pending', 'suspended', 'blacklisted'])),
  ],
  detailPath: (r) => '/suppliers/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /suppliers', label: 'Nouveau fournisseur', perms: ['suppliers:write']),
  update: const ResourceCreate(endpoint: 'PATCH /suppliers/{supplier_id}', perms: ['suppliers:write']),
  actions: [
    ResourceAction(label: 'Changer le statut', endpoint: 'POST /suppliers/{supplier_id}/status', perms: const ['suppliers:write']),
    ResourceAction(label: 'Évaluer', endpoint: 'POST /suppliers/{supplier_id}/ratings', perms: const ['suppliers:write'], icon: Icons.star_outline),
  ],
);

// ============================================================================================ sous-traitance
final subcontractors = ResourceConfig(
  title: 'Sous-traitants',
  path: '/subcontractors',
  icon: Icons.handshake_outlined,
  itemTitle: (r) => r.str('trade_name') ?? r.s('legal_name'),
  itemSubtitle: (r) => r.strings('trades').map(optionLabel).join(', '),
  itemTrailing: (r) => r.has('score') ? '${number(r['score'])}/100' : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['prospect', 'qualified', 'approved', 'suspended', 'blacklisted'])),
  ],
  detailPath: (r) => '/subcontractors/${r.s('id')}',
  create: ResourceCreate(
    endpoint: 'POST /subcontractors',
    label: 'Nouveau sous-traitant',
    perms: const ['subcontracting:write'],
    fields: {'trades': FieldConfig(label: 'Corps de métier', options: subcontractingTradeOptions())},
  ),
  update: ResourceCreate(
    endpoint: 'PATCH /subcontractors/{subcontractor_id}',
    perms: const ['subcontracting:write'],
    fields: {'trades': FieldConfig(label: 'Corps de métier', options: subcontractingTradeOptions())},
  ),
  actions: [
    ResourceAction(label: 'Changer le statut', endpoint: 'POST /subcontractors/{subcontractor_id}/status', perms: const ['subcontracting:write']),
    ResourceAction(
      label: 'Évaluer',
      endpoint: 'POST /subcontractors/{subcontractor_id}/ratings',
      perms: const ['subcontracting:write'],
      icon: Icons.star_outline,
    ),
  ],
);

final subcontracts = ResourceConfig(
  title: 'Marchés de sous-traitance',
  path: '/subcontracts',
  icon: Icons.assignment_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?r.str('subcontractor_name'), ?_project(r)].join(' · '),
  itemTrailing: (r) => r.has('amount') ? money(r['amount']) : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'sent', 'signed', 'mobilized', 'in_progress', 'completed', 'closed', 'terminated'])),
  ],
  detailPath: (r) => '/subcontracts/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Envoyer pour signature',
      path: (r) => '/subcontracts/${r.s('id')}/send',
      perms: const ['subcontracting:write'],
      when: (r) => r.s('status') == 'draft',
    ),
    ResourceAction(
      label: 'Libérer la retenue de garantie',
      endpoint: 'POST /subcontracts/{contract_id}/retention/release',
      perms: const ['subcontracting:validate'],
    ),
    ResourceAction(label: 'Résilier', danger: true, endpoint: 'POST /subcontracts/{contract_id}/terminate', perms: const ['subcontracting:validate']),
    pdfAction('Marché (PDF)', (r) => '/subcontracts/${r.s('id')}/pdf'),
  ],
);

final situations = ResourceConfig(
  title: 'Situations de travaux',
  path: '/situations',
  icon: Icons.fact_check_outlined,
  itemTitle: (r) => '${r.s('number')} · ${r.str('subcontractor_name') ?? r.str('subcontract_number') ?? ''}',
  itemSubtitle: (r) => [if (r.has('period_end')) 'au ${date(r['period_end'])}', if (r.has('progress_pct')) '${number(r['progress_pct'], 1)}$nbsp%'].join(' · '),
  itemTrailing: (r) => r.has('amount_due') ? money(r['amount_due']) : (r.has('amount') ? money(r['amount']) : null),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['submitted', 'field_checked', 'validated', 'rejected', 'invoiced', 'paid', 'disputed'])),
  ],
  detailPath: (r) => '/situations/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Valider',
      endpoint: 'POST /situations/{situation_id}/validate',
      perms: const ['subcontracting:validate'],
      when: (r) => r.s('status') == 'field_checked',
      success: 'Situation validée',
    ),
    ResourceAction(
      label: 'Refuser',
      danger: true,
      endpoint: 'POST /situations/{situation_id}/reject',
      perms: const ['subcontracting:validate'],
      when: (r) => const ['submitted', 'field_checked'].contains(r.s('status')),
    ),
    ResourceAction(
      label: 'Dérogation',
      endpoint: 'POST /situations/{situation_id}/derogation',
      perms: const ['subcontracting:derogate'],
      when: (r) => const ['submitted', 'field_checked'].contains(r.s('status')),
    ),
  ],
);

final disputes = ResourceConfig(
  title: 'Litiges',
  path: '/disputes',
  icon: Icons.gavel_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [optionLabel(r.str('party_type')), ?r.str('party_name'), if (r.has('amount_claimed')) money(r['amount_claimed'])].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['OUVERT', 'EN_ANALYSE', 'EN_NEGOCIATION', 'DECISION', 'ESCALADE', 'RESOLU'])),
  ],
  detailPath: (r) => '/disputes/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /disputes', label: 'Nouveau litige', perms: ['disputes:write']),
  detailExtra: (context, r, reload) => LinesTable(
    title: 'Chronologie',
    rows: r.list('events'),
    label: (e) => e.str('note') ?? e.str('body') ?? optionLabel(e.str('kind')),
    subtitle: (e) => dateTime(e['created_at']),
  ),
  actions: [
    ResourceAction(
      label: 'Ajouter un événement',
      endpoint: 'POST /disputes/{dispute_id}/events',
      perms: const ['disputes:write'],
      icon: Icons.add_comment_outlined,
    ),
    ResourceAction(label: 'Changer d\'étape', endpoint: 'POST /disputes/{dispute_id}/transition', perms: const ['disputes:write']),
    ResourceAction(label: 'Décision', endpoint: 'POST /disputes/{dispute_id}/decision', perms: const ['disputes:decide']),
    ResourceAction(
      label: 'Résoudre',
      endpoint: 'POST /disputes/{dispute_id}/resolve',
      perms: const ['disputes:decide'],
      when: (r) => r.s('status') != 'RESOLU',
    ),
  ],
);

final tenders = ResourceConfig(
  title: 'Consultations',
  path: '/tenders',
  icon: Icons.campaign_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?_project(r), if (r.has('deadline')) 'remise ${dateTime(r['deadline'])}'].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'published', 'closed', 'awarded', 'cancelled'])),
  ],
  detailPath: (r) => '/tenders/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Publier',
      path: (r) => '/tenders/${r.s('id')}/publish',
      perms: const ['subcontracting:write'],
      when: (r) => r.s('status') == 'draft',
    ),
    ResourceAction(
      label: 'Clôturer les offres',
      path: (r) => '/tenders/${r.s('id')}/close',
      perms: const ['subcontracting:write'],
      when: (r) => r.s('status') == 'published',
    ),
    ResourceAction(
      label: 'Attribuer',
      endpoint: 'POST /tenders/{tender_id}/award',
      perms: const ['subcontracting:award'],
      when: (r) => r.s('status') == 'closed',
    ),
    ResourceAction(label: 'Annuler', danger: true, endpoint: 'POST /tenders/{tender_id}/cancel', perms: const ['subcontracting:write']),
  ],
);

// ============================================================================================ finance
final payments = ResourceConfig(
  title: 'Paiements',
  path: '/payments',
  icon: Icons.payments_outlined,
  itemTitle: (r) => '${r.s('number')} · ${r.str('counterparty_label') ?? optionLabel(r.str('counterparty_type'))}',
  itemSubtitle: (r) => [r.s('direction') == 'in' ? 'Encaissement' : 'Décaissement', optionLabel(r.str('method')), dateTime(r['created_at'])].join(' · '),
  itemTrailing: (r) => money(r['amount'], r.str('currency')),
  filters: [
    const ResourceFilter('direction', 'Sens', [('in', 'Encaissements'), ('out', 'Décaissements')]),
    ResourceFilter('status', 'Statut', _opts(['awaiting_approval', 'pending', 'processing', 'succeeded', 'failed', 'cancelled'])),
  ],
  detailPath: (r) => '/payments/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /payments/outgoing', label: 'Paiement sortant', perms: ['finance:write'], idempotent: true),
  actions: [
    ResourceAction(
      label: 'Approuver',
      endpoint: 'POST /payments/{payment_id}/approve',
      perms: const ['finance:approve'],
      when: (r) => r.s('status') == 'awaiting_approval',
      fields: const {'override_reason': FieldConfig(label: 'Motif de dérogation (si contrôle bloquant)')},
      success: 'Paiement approuvé',
    ),
    ResourceAction(
      label: 'Exécuter',
      endpoint: 'POST /payments/{payment_id}/execute',
      perms: const ['finance:pay'],
      when: (r) => r.s('status') == 'pending' && r.s('direction') == 'out' && r.has('approved_at'),
      idempotent: true,
      icon: Icons.send_outlined,
    ),
    ResourceAction(
      label: 'Actualiser le statut',
      path: (r) => '/payments/${r.s('id')}/refresh',
      when: (r) => r.s('status') == 'processing',
      icon: Icons.refresh,
    ),
    pdfAction('Reçu', (r) => '/payments/${r.s('id')}/receipt', when: (r) => r.s('status') == 'succeeded' && r.s('direction') == 'in'),
  ],
);

final clientInvoices = ResourceConfig(
  title: 'Factures clients',
  path: '/client-invoices',
  icon: Icons.request_quote_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?_project(r), if (r.has('due_date')) 'échéance ${date(r['due_date'])}'].join(' · '),
  itemTrailing: (r) => money(r['total_ttc'] ?? r['total']),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'validated', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'])),
  ],
  detailPath: (r) => '/client-invoices/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Valider',
      path: (r) => '/client-invoices/${r.s('id')}/validate',
      perms: const ['billing:validate'],
      when: (r) => r.s('status') == 'draft',
    ),
    ResourceAction(
      label: 'Envoyer',
      path: (r) => '/client-invoices/${r.s('id')}/send',
      perms: const ['billing:write'],
      when: (r) => r.s('status') == 'validated',
      icon: Icons.send_outlined,
    ),
    ResourceAction(
      label: 'Relancer',
      path: (r) => '/client-invoices/${r.s('id')}/remind',
      perms: const ['billing:write'],
      when: (r) => const ['sent', 'partially_paid', 'overdue'].contains(r.s('status')),
      icon: Icons.notifications_active_outlined,
    ),
    ResourceAction(label: 'Avoir', endpoint: 'POST /client-invoices/{invoice_id}/credit-notes', perms: const ['billing:validate']),
    ResourceAction(label: 'Annuler', danger: true, endpoint: 'POST /client-invoices/{invoice_id}/cancel', perms: const ['billing:validate']),
    pdfAction('Facture (PDF)', (r) => '/client-invoices/${r.s('id')}/pdf'),
  ],
);

final supplierInvoices = ResourceConfig(
  title: 'Factures fournisseurs',
  path: '/supplier-invoices',
  icon: Icons.receipt_outlined,
  itemTitle: (r) => '${r.s('number')} · ${_supplier(r) ?? r.str('supplier_reference') ?? ''}',
  itemSubtitle: (r) => [if (r.has('due_date')) 'échéance ${date(r['due_date'])}', if (r.b('has_exceptions')) 'écart de rapprochement'].join(' · '),
  itemTrailing: (r) => money(r['total_ttc'] ?? r['total']),
  filters: [
    ResourceFilter(
      'status',
      'Statut',
      _opts(['received', 'matched', 'exception', 'validated', 'approved_for_payment', 'partially_paid', 'paid', 'disputed', 'rejected']),
    ),
  ],
  detailPath: (r) => '/supplier-invoices/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Rapprocher (BC / réception)',
      path: (r) => '/supplier-invoices/${r.s('id')}/match',
      perms: const ['billing:write'],
      when: (r) => const ['received', 'exception'].contains(r.s('status')),
    ),
    ResourceAction(
      label: 'Valider',
      path: (r) => '/supplier-invoices/${r.s('id')}/validate',
      perms: const ['billing:validate'],
      when: (r) => r.s('status') == 'matched',
    ),
    ResourceAction(
      label: 'Traiter l\'écart',
      endpoint: 'POST /supplier-invoices/{invoice_id}/resolve',
      perms: const ['billing:validate'],
      when: (r) => r.s('status') == 'exception',
    ),
    pdfAction('Pièce', (r) => '/supplier-invoices/${r.s('id')}/file'),
  ],
);

final fundsCalls = ResourceConfig(
  title: 'Appels de fonds',
  path: '/funds-calls',
  icon: Icons.call_made_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?_project(r), if (r.has('due_date')) 'échéance ${date(r['due_date'])}'].join(' · '),
  itemTrailing: (r) => money(r['amount_ttc'] ?? r['amount']),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'])),
  ],
  create: const ResourceCreate(endpoint: 'POST /funds-calls', label: 'Nouvel appel', perms: ['billing:write']),
  actions: [
    ResourceAction(label: 'Émettre', endpoint: 'POST /funds-calls/{call_id}/issue', perms: const ['billing:validate'], when: (r) => r.s('status') == 'draft'),
  ],
);

final paymentPlans = ResourceConfig(
  title: 'Échéanciers clients',
  path: '/payment-plans',
  icon: Icons.splitscreen_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?_project(r), if (r.has('installments_count')) '${r.i('installments_count')} échéances'].join(' · '),
  itemTrailing: (r) => r.has('total_amount') ? money(r['total_amount']) : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['requested', 'proposed', 'active', 'completed', 'defaulted', 'rejected', 'cancelled'])),
  ],
  actions: [
    ResourceAction(
      label: 'Proposer au client',
      endpoint: 'POST /payment-plans/{plan_id}/propose',
      perms: const ['billing:write'],
      when: (r) => r.s('status') == 'requested',
    ),
    ResourceAction(
      label: 'Refuser',
      danger: true,
      endpoint: 'POST /payment-plans/{plan_id}/reject',
      perms: const ['billing:write'],
      when: (r) => r.s('status') == 'requested',
    ),
  ],
);

final financingApplications = ResourceConfig(
  title: 'Dossiers de financement',
  path: '/financing/applications',
  icon: Icons.savings_outlined,
  search: false,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?r.str('partner_name'), if (r.has('amount')) money(r['amount'])].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'submitted', 'offer', 'accepted', 'withdrawn', 'declined'])),
  ],
);

// ============================================================================================ commercial
final leads = ResourceConfig(
  title: 'Leads',
  path: '/crm/leads',
  icon: Icons.person_search_outlined,
  itemTitle: (r) => [r.str('first_name'), r.str('last_name')].whereType<String>().join(' ').ifEmpty(r.s('company', '—')),
  itemSubtitle: (r) => [optionLabel(r.str('source')), optionLabel(r.str('universe')), if (r.has('budget_max')) 'budget ${money(r['budget_max'])}'].join(' · '),
  itemTrailing: (r) => r.has('temperature') ? optionLabel(r.str('temperature')) : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['new', 'contacted', 'qualified', 'nurturing', 'unqualified', 'converted', 'lost'])),
    const ResourceFilter('temperature', 'Chaleur', [('hot', 'Chaud'), ('warm', 'Tiède'), ('cold', 'Froid')]),
  ],
  detailPath: (r) => '/crm/leads/${r.s('id')}',
  create: ResourceCreate(
    endpoint: 'POST /crm/leads',
    label: 'Nouveau lead',
    perms: const ['crm:write'],
    order: const ['first_name', 'last_name', 'company', 'phone', 'email', 'whatsapp', 'source', 'universe', 'city', 'country'],
    fields: {
      'source': FieldConfig(
        label: 'Source',
        options: _opts(const ['phone', 'whatsapp', 'email', 'salon', 'referral', 'walk_in', 'social', 'website', 'other']),
      ),
      'universe': FieldConfig(label: 'Univers', options: _opts(const ['HOME', 'BUSINESS', 'PREMIUM', 'DIASPORA', 'ENGINEERING'])),
      'timeline': FieldConfig(label: 'Échéance du projet', options: _opts(const ['immediate', '3_months', '6_months', '12_months', 'undetermined'])),
      'urgency': FieldConfig(label: 'Urgence', options: _opts(const ['normal', 'urgent'])),
      'preferred_channel': FieldConfig(label: 'Canal préféré', options: _opts(const ['phone', 'whatsapp', 'email'])),
      'message': const FieldConfig(label: 'Besoin exprimé', multiline: true),
    },
  ),
  update: const ResourceCreate(endpoint: 'PATCH /crm/leads/{lead_id}', perms: ['crm:write']),
  actions: [
    ResourceAction(
      label: 'Convertir en opportunité',
      endpoint: 'POST /crm/leads/{lead_id}/convert',
      perms: const ['crm:write'],
      when: (r) => !const ['converted', 'lost', 'unqualified'].contains(r.s('status')),
    ),
    ResourceAction(
      label: 'Planifier une action',
      endpoint: 'POST /crm/activities',
      fixed: (r) => {'lead_id': r.s('id')},
      perms: const ['crm:write'],
      icon: Icons.event_available_outlined,
    ),
  ],
);

final opportunities = ResourceConfig(
  title: 'Opportunités',
  path: '/crm/opportunities',
  icon: Icons.trending_up,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [optionLabel(r.str('stage')), if (r.has('expected_close_date')) 'signature ${date(r['expected_close_date'])}'].join(' · '),
  itemTrailing: (r) => r.has('amount') ? money(r['amount']) : null,
  itemBadge: (r) => r.str('stage'),
  detailPath: (r) => '/crm/opportunities/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /crm/opportunities', label: 'Nouvelle opportunité', perms: ['crm:write']),
  update: const ResourceCreate(endpoint: 'PATCH /crm/opportunities/{item_id}', perms: ['crm:write']),
  actions: [
    ResourceAction(
      label: 'Changer d\'étape',
      endpoint: 'POST /crm/opportunities/{opp_id}/stage',
      perms: const ['crm:write'],
      initial: (r) => {'stage': r.str('stage')},
      fields: {
        'stage': FieldConfig(label: 'Étape', options: _opts(const ['qualification', 'discovery', 'proposal', 'negotiation', 'won', 'lost'])),
        'lost_reason': FieldConfig(
          label: 'Motif de perte',
          multiline: true,
          visibleIf: (v) => v['stage'] == 'lost',
          requiredIf: (v) => v['stage'] == 'lost',
        ),
      },
    ),
  ],
);

final quotes = ResourceConfig(
  title: 'Devis',
  path: '/crm/quotes',
  icon: Icons.description_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?r.str('client_name'), if (r.has('valid_until')) 'valable jusqu\'au ${date(r['valid_until'])}'].join(' · '),
  itemTrailing: (r) => money(r['total_ttc'] ?? r['total']),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'])),
  ],
  detailPath: (r) => '/crm/quotes/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Envoyer au client',
      path: (r) => '/crm/quotes/${r.s('id')}/send',
      perms: const ['crm:write'],
      when: (r) => r.s('status') == 'draft',
      icon: Icons.send_outlined,
    ),
    ResourceAction(
      label: 'Réviser',
      path: (r) => '/crm/quotes/${r.s('id')}/revise',
      perms: const ['crm:write'],
      when: (r) => const ['sent', 'viewed', 'rejected'].contains(r.s('status')),
    ),
    ResourceAction(
      label: 'Générer le contrat',
      path: (r) => '/crm/quotes/${r.s('id')}/contract',
      perms: const ['crm:write'],
      when: (r) => r.s('status') == 'accepted',
    ),
    ResourceAction(
      label: 'Marquer refusé',
      danger: true,
      endpoint: 'POST /crm/quotes/{quote_id}/reject',
      perms: const ['crm:write'],
      when: (r) => const ['sent', 'viewed'].contains(r.s('status')),
    ),
    pdfAction('Devis (PDF)', (r) => '/crm/quotes/${r.s('id')}/pdf'),
  ],
);

final contracts = ResourceConfig(
  title: 'Contrats',
  path: '/crm/contracts',
  icon: Icons.history_edu_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [?r.str('client_name'), if (r.has('signed_at')) 'signé le ${date(r['signed_at'])}'].join(' · '),
  itemTrailing: (r) => r.has('amount') ? money(r['amount']) : null,
  filters: [
    ResourceFilter('status', 'Statut', _opts(['draft', 'sent', 'signed', 'active', 'completed', 'cancelled'])),
  ],
  detailPath: (r) => '/crm/contracts/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Créer le projet',
      endpoint: 'POST /crm/contracts/{contract_id}/project',
      perms: const ['projects:write'],
      when: (r) => r.s('status') == 'signed' && !r.has('project_id'),
    ),
    pdfAction('Preuve de signature', (r) => '/crm/contracts/${r.s('id')}/evidence', when: (r) => r.has('signed_at')),
  ],
);

final contacts = ResourceConfig(
  title: 'Contacts',
  path: '/crm/contacts',
  icon: Icons.contacts_outlined,
  itemTitle: (r) => [r.str('first_name'), r.str('last_name')].whereType<String>().join(' ').ifEmpty(r.s('email', '—')),
  itemSubtitle: (r) => [?r.str('company'), ?r.str('phone'), ?r.str('email')].join(' · '),
  itemBadge: (_) => null,
  detailPath: (r) => '/crm/contacts/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /crm/contacts', label: 'Nouveau contact', perms: ['crm:write']),
  update: const ResourceCreate(endpoint: 'PATCH /crm/contacts/{item_id}', perms: ['crm:write']),
);

final tickets = ResourceConfig(
  title: 'SAV',
  path: '/support/tickets',
  icon: Icons.support_agent,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [optionLabel(r.str('category')), statusLabel(r.str('priority') ?? 'normal'), if (r.b('sla_breached')) 'hors délai'].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['open', 'in_progress', 'waiting_client', 'resolved', 'closed'])),
  ],
  open: (context, r) => context.push('$base/sav/${r.s('id')}'),
);

// ============================================================================================ RH et QHSE
final employees = ResourceConfig(
  title: 'Personnel',
  path: '/hr/employees',
  icon: Icons.badge_outlined,
  itemTitle: (r) => '${r.s('first_name')} ${r.s('last_name')}',
  itemSubtitle: (r) => [?r.str('matricule'), ?r.str('job_title'), if (r.has('trade')) optionLabel(r.str('trade'))].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['active', 'suspended', 'left'])),
  ],
  detailPath: (r) => '/hr/employees/${r.s('id')}',
  create: ResourceCreate(
    endpoint: 'POST /hr/employees',
    label: 'Nouvel employé',
    perms: const ['hr:write'],
    fields: {'trade': FieldConfig(label: 'Métier', options: tradeOptions())},
  ),
  update: ResourceCreate(
    endpoint: 'PATCH /hr/employees/{employee_id}',
    perms: const ['hr:write'],
    fields: {'trade': FieldConfig(label: 'Métier', options: tradeOptions())},
  ),
  actions: [
    ResourceAction(
      label: 'Fin de contrat',
      danger: true,
      endpoint: 'POST /hr/employees/{employee_id}/terminate',
      perms: const ['hr:write'],
      when: (r) => r.s('status') == 'active',
    ),
  ],
);

final leaves = ResourceConfig(
  title: 'Congés',
  path: '/hr/leaves',
  icon: Icons.beach_access_outlined,
  search: false,
  itemTitle: (r) => '${r.str('employee_name') ?? 'Demande'} · ${optionLabel(r.str('kind'))}',
  itemSubtitle: (r) => 'du ${date(r['start_date'])} au ${date(r['end_date'])} · ${number(r['days'], 1)} j',
  filters: [
    ResourceFilter('status', 'Statut', _opts(['pending', 'approved', 'rejected', 'cancelled'])),
  ],
  actions: [
    ResourceAction(
      label: 'Accepter',
      path: (r) => '/hr/leaves/${r.s('id')}/decision',
      body: (r, _) => {'approve': true},
      perms: const ['hr:write'],
      when: (r) => r.s('status') == 'pending',
      success: 'Congé accepté',
    ),
    ResourceAction(
      label: 'Refuser',
      danger: true,
      path: (r) => '/hr/leaves/${r.s('id')}/decision',
      body: (r, _) => {'approve': false},
      perms: const ['hr:write'],
      when: (r) => r.s('status') == 'pending',
      success: 'Congé refusé',
    ),
  ],
);

final payrollRuns = ResourceConfig(
  title: 'Paie',
  path: '/hr/payroll-runs',
  icon: Icons.account_balance_wallet_outlined,
  search: false,
  itemTitle: (r) => 'Paie ${r.s('period')}',
  itemSubtitle: (r) => [if (r.has('employees_count')) '${r.i('employees_count')} salariés', if (r.has('total_net')) 'net ${money(r['total_net'])}'].join(' · '),
  detailPath: (r) => '/hr/payroll-runs/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /hr/payroll-runs', label: 'Nouvelle paie', perms: ['hr:payroll']),
  detailExtra: (context, r, reload) => LinesTable(
    title: 'Bulletins',
    rows: r.list('items'),
    label: (i) => '${i.s('employee')} (${i.s('matricule')})',
    value: (i) => money(i['net_pay'] ?? i['net']),
  ),
  actions: [
    ResourceAction(label: 'Calculer', path: (r) => '/hr/payroll-runs/${r.s('id')}/compute', perms: const ['hr:payroll'], when: (r) => r.s('status') == 'draft'),
    ResourceAction(
      label: 'Valider',
      path: (r) => '/hr/payroll-runs/${r.s('id')}/validate',
      perms: const ['hr:payroll'],
      when: (r) => r.s('status') == 'computed',
    ),
    ResourceAction(
      label: 'Marquer payée',
      endpoint: 'POST /hr/payroll-runs/{run_id}/paid',
      perms: const ['hr:payroll'],
      when: (r) => r.s('status') == 'validated',
    ),
  ],
);

final incidents = ResourceConfig(
  title: 'Incidents QHSE',
  path: '/qhse/incidents',
  icon: Icons.health_and_safety_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => [optionLabel(r.str('kind')), 'gravité ${optionLabel(r.str('severity')).toLowerCase()}', dateTime(r['occurred_at'])].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['declared', 'investigating', 'action_plan', 'closed'])),
    const ResourceFilter('severity', 'Gravité', [('critical', 'Critique'), ('high', 'Élevée'), ('medium', 'Moyenne'), ('low', 'Faible')]),
  ],
  detailPath: (r) => '/qhse/incidents/${r.s('id')}',
  detailExtra: (context, r, reload) => LinesTable(
    title: 'Actions correctives',
    rows: r.list('actions'),
    label: (a) => a.s('title'),
    subtitle: (a) => 'échéance ${date(a['due_date'])}',
    value: (a) => statusLabel(a.s('status')),
  ),
  actions: [
    ResourceAction(
      label: 'Action corrective',
      endpoint: 'POST /qhse/actions',
      fixed: (r) => {'source_type': 'incident', 'source_id': r.s('id'), 'project_id': r.s('project_id')},
      perms: const ['qhse:write'],
      when: (r) => r.s('status') != 'closed',
      icon: Icons.assignment_add,
    ),
    ResourceAction(label: 'Clôturer', path: (r) => '/qhse/incidents/${r.s('id')}/close', perms: const ['qhse:write'], when: (r) => r.s('status') != 'closed'),
    ResourceAction(
      label: 'Informer le client',
      endpoint: 'POST /qhse/incidents/{incident_id}/publish-client',
      perms: const ['projects:publish_client'],
      when: (r) => !r.b('published_to_client'),
      icon: Icons.campaign_outlined,
    ),
  ],
);

final qhseActions = ResourceConfig(
  title: 'Actions correctives',
  path: '/qhse/actions',
  icon: Icons.assignment_turned_in_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) => 'échéance ${date(r['due_date'])}',
  filters: [
    ResourceFilter('status', 'Statut', _opts(['open', 'in_progress', 'done', 'verified', 'cancelled'])),
  ],
  detailPath: (r) => '/qhse/actions/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Vérifier (efficace)',
      path: (r) => '/qhse/actions/${r.s('id')}/verify',
      body: (r, comment) => {'accept': true, 'comment': comment},
      reasonLabel: 'Commentaire',
      reasonRequired: false,
      perms: const ['qhse:write'],
      when: (r) => r.s('status') == 'done',
    ),
    ResourceAction(
      label: 'Rouvrir',
      danger: true,
      path: (r) => '/qhse/actions/${r.s('id')}/verify',
      body: (r, comment) => {'accept': false, 'comment': comment},
      reasonLabel: 'Motif',
      perms: const ['qhse:write'],
      when: (r) => r.s('status') == 'done',
    ),
  ],
);

// ============================================================================================ logistique, GED
final deliveries = ResourceConfig(
  title: 'Livraisons',
  path: '/deliveries',
  icon: Icons.local_shipping_outlined,
  itemTitle: (r) => '${r.s('number')} · ${r.str('supplier') ?? ''}',
  itemSubtitle: (r) => [if (r.has('po_number')) 'BC ${r.s('po_number')}', if (r.has('eta')) dateTime(r['eta'])].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['announced', 'in_transit', 'arrived', 'received', 'cancelled'])),
  ],
  detailPath: (r) => '/deliveries/${r.s('id')}',
  detailExtra: (context, r, reload) => LinesTable(
    title: 'Lignes',
    rows: r.list('lines'),
    label: (l) => l.s('description'),
    value: (l) => '${number(l['received'], 2)} / ${number(l['quantity'], 2)} ${l.s('unit')}',
  ),
);

final stock = ResourceConfig(
  title: 'Stocks',
  path: '/stock-items',
  icon: Icons.inventory_2_outlined,
  // La fiche (niveaux par entrepôt) imbrique l'article dans « item ».
  itemTitle: (r) => '${(r.objOrNull('item') ?? r).s('sku')} — ${(r.objOrNull('item') ?? r).s('name')}',
  itemSubtitle: (r) => [?(r.objOrNull('item') ?? r).str('category'), (r.objOrNull('item') ?? r).s('unit')].join(' · '),
  itemBadge: (_) => null,
  detailPath: (r) => '/stock-items/${r.s('id')}/levels',
  detailFields: [
    DetailField('on_hand', 'En stock', (r) => number(r['on_hand'], 2)),
    DetailField('available', 'Disponible', (r) => number(r['available'], 2)),
  ],
  detailExtra: (context, r, reload) => LinesTable(
    title: 'Par entrepôt',
    rows: r.list('levels'),
    label: (l) => l.s('warehouse'),
    subtitle: (l) => [if (l.has('location')) l.s('location'), if (l.has('batch')) 'lot ${l.s('batch')}'].join(' · '),
    value: (l) => number(l['quantity'], 2),
  ),
);

final equipment = ResourceConfig(
  title: 'Matériel',
  path: '/equipment',
  icon: Icons.construction_outlined,
  itemTitle: (r) => '${r.s('code')} — ${r.s('name')}',
  itemSubtitle: (r) => [optionLabel(r.str('category')), '${number(r['meter_hours'], 1)} h'].join(' · '),
  filters: [
    ResourceFilter('status', 'Statut', _opts(['available', 'assigned', 'maintenance', 'broken', 'retired'])),
  ],
  detailPath: (r) => '/equipment/${r.s('id')}',
);

final documents = ResourceConfig(
  title: 'GED',
  path: '/documents',
  icon: Icons.folder_open_outlined,
  itemTitle: rowTitle,
  itemSubtitle: (r) =>
      [optionLabel(r.str('doc_type')), if (r.objOrNull('current_version') != null) versionLabel(r.obj('current_version').s('label'))].join(' · '),
  itemBadge: (r) => r.objOrNull('current_version')?.str('status'),
  filters: [
    ResourceFilter('status', 'Version', _opts(['draft', 'in_review', 'validated', 'published', 'obsolete'])),
  ],
  detailPath: (r) => '/documents/${r.s('id')}',
  actions: [
    ResourceAction(
      label: 'Ouvrir',
      icon: Icons.open_in_new,
      when: (r) => r.objOrNull('current_version') != null,
      run: (context, r) => openRemoteFile(context, '/document-versions/${r.obj('current_version').s('id')}/download'),
    ),
    ResourceAction(
      label: 'Faire avancer la version',
      run: (context, r) async {
        final v = r.objOrNull('current_version');
        if (v == null) return;
        final res = await showSchemaForm(
          context,
          title: 'Version ${v.s('label')}',
          endpoint: 'POST /document-versions/{version_id}/transition',
          params: {'version_id': v.s('id')},
          submitLabel: 'Appliquer',
        );
        if (res != null && context.mounted) context.toast('Version mise à jour', success: true);
      },
      anyPerms: const ['documents:approve', 'documents:publish'],
      when: (r) => const ['draft', 'in_review', 'correction', 'validated'].contains(r.objOrNull('current_version')?.str('status')),
    ),
  ],
);

// ============================================================================================ administration
final users = ResourceConfig(
  title: 'Utilisateurs',
  path: '/users',
  icon: Icons.manage_accounts_outlined,
  itemTitle: (r) => r.str('full_name') ?? r.s('email'),
  itemSubtitle: (r) => [r.s('email'), r.strings('roles').map(optionLabel).join(', ')].join(' · '),
  itemBadge: (r) => r.b('is_active', true) ? (r.b('locked') ? 'locked' : 'active') : 'inactive',
  filters: const [
    ResourceFilter('active', 'État', [('true', 'Actifs'), ('false', 'Désactivés')]),
  ],
  detailPath: (r) => '/users/${r.s('id')}',
  create: const ResourceCreate(endpoint: 'POST /users', label: 'Nouvel utilisateur', perms: ['users:write']),
  update: const ResourceCreate(endpoint: 'PATCH /users/{user_id}', perms: ['users:write']),
  actions: [
    // Compte jamais activé (lien expiré ou perdu) : nouveau lien, les anciens liens sont annulés.
    ResourceAction(
      label: "Renvoyer l'invitation",
      icon: Icons.send_outlined,
      perms: const ['users:write'],
      when: (r) => r.b('is_active', true) && r['activated'] == false,
      run: (context, r) async {
        final res = await showSchemaForm(
          context,
          title: "Renvoyer l'invitation",
          endpoint: 'POST /users/{user_id}/invitation',
          params: {'user_id': r.s('id')},
          submitLabel: 'Renvoyer',
        );
        if (res != null && context.mounted) context.toast('Invitation renvoyée : nouveau lien valable 7 jours', success: true);
      },
    ),
    ResourceAction(
      label: 'Déverrouiller',
      path: (r) => '/users/${r.s('id')}/unlock',
      perms: const ['users:write'],
      when: (r) => r.b('locked'),
      icon: Icons.lock_open,
    ),
    ResourceAction(
      label: 'Déconnecter partout',
      danger: true,
      path: (r) => '/users/${r.s('id')}/revoke-sessions',
      perms: const ['users:write'],
      confirm: 'Toutes les sessions et appareils de cet utilisateur seront déconnectés.',
      icon: Icons.logout,
    ),
    ResourceAction(
      label: 'Réinitialiser la double authentification',
      danger: true,
      path: (r) => '/users/${r.s('id')}/reset-mfa',
      reasonLabel: 'Motif (vérification d\'identité effectuée)',
      perms: const ['users:write'],
      icon: Icons.phonelink_lock_outlined,
    ),
  ],
);

final auditLog = ResourceConfig(
  title: "Journal d'audit",
  path: '/admin/audit',
  icon: Icons.manage_search,
  itemTitle: (r) => '${optionLabel(r.str('module'))} · ${r.s('action')}',
  itemSubtitle: (r) => [
    ?r.str('actor_label') ?? r.str('actor_email'),
    dateTime(r['created_at'] ?? r['occurred_at']),
    if (r.has('resource_type')) optionLabel(r.str('resource_type')),
  ].join(' · '),
  itemBadge: (r) => r.str('criticality'),
  search: false,
  filters: const [
    ResourceFilter('family', 'Famille', [('security', 'Sécurité'), ('business', 'Métier'), ('data', 'Données'), ('system', 'Système')]),
    ResourceFilter('criticality', 'Criticité', [('CRITICAL', 'Critique'), ('HIGH', 'Haute'), ('MEDIUM', 'Moyenne'), ('LOW', 'Basse')]),
  ],
);

extension on String {
  String ifEmpty(String other) => trim().isEmpty ? other : this;
}

/// Toutes les ressources déclarées (contrôle automatique des points d'entrée par les tests).
final allResources = <ResourceConfig>[
  purchaseRequests,
  purchaseOrders,
  suppliers,
  subcontractors,
  subcontracts,
  situations,
  disputes,
  tenders,
  payments,
  clientInvoices,
  supplierInvoices,
  fundsCalls,
  paymentPlans,
  financingApplications,
  leads,
  opportunities,
  quotes,
  contracts,
  contacts,
  tickets,
  employees,
  leaves,
  payrollRuns,
  incidents,
  qhseActions,
  deliveries,
  stock,
  equipment,
  documents,
  users,
  auditLog,
];
