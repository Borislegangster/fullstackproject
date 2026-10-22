import '../api/json.dart';
import '../format/labels.dart';
import '../generated/schemas.g.dart';
import '../widgets/ref_picker.dart';

/// Référentiel nommé (miroir de REFS dans apps/web/src/lib/refs.ts) : chemin, filtres dépendant d'autres champs
/// du formulaire (`project_id`…), libellés.
class NamedRef {
  const NamedRef(this.path, this.label, {this.sublabel, this.dependsOn = const [], this.query = const {}, this.searchable = true});
  final String path;
  final String Function(J row) label;
  final String? Function(J row)? sublabel;
  final List<String> dependsOn;
  final Map<String, dynamic> query;
  final bool searchable;

  /// Source résolue avec les valeurs du formulaire ; `null` tant qu'une dépendance (ex. projet) manque.
  RefSource? resolve(Map<String, dynamic> values) {
    var p = path;
    final q = <String, dynamic>{...query};
    for (final dep in dependsOn) {
      final v = values[dep];
      if (v == null || v.toString().isEmpty) return null;
      if (p.contains('{$dep}')) {
        p = p.replaceAll('{$dep}', Uri.encodeComponent(v.toString()));
      } else {
        q[dep] = v;
      }
    }
    return RefSource(path: p, label: label, sublabel: sublabel, query: q, searchable: searchable);
  }
}

String _name(J r) => r.str('name') ?? r.str('title') ?? r.str('label') ?? r.str('full_name') ?? r.str('code') ?? r.str('number') ?? r.s('id');
String _person(J r) {
  final full = r.str('full_name') ?? [r.str('first_name'), r.str('last_name')].whereType<String>().join(' ');
  return full.trim().isEmpty ? (r.str('email') ?? r.s('id')) : full;
}

String _codeName(J r) => '${r.has('code') ? '${r.s('code')} — ' : ''}${r.s('name')}';

final Map<String, NamedRef> kRefs = {
  'projects': NamedRef('/projects', _codeName, sublabel: (r) => r.str('city')),
  'sites': NamedRef('/sites', _codeName, dependsOn: ['project_id']),
  'lots': NamedRef('/lots', (r) => '${r.s('code')} — ${r.s('name')}', dependsOn: ['project_id']),
  'phases': NamedRef('/phases', _name, dependsOn: ['project_id']),
  'milestones': NamedRef('/milestones', _name, dependsOn: ['project_id']),
  'tasks': NamedRef('/projects/{project_id}/tasks', (r) => '${r.has('wbs_code') ? '${r.s('wbs_code')} ' : ''}${r.s('title')}', dependsOn: ['project_id']),
  'zones': NamedRef('/projects/{project_id}/bim/zones', (r) => '${r.s('code')} — ${r.s('name')}', dependsOn: ['project_id'], searchable: false),
  'suppliers': NamedRef('/suppliers', (r) => r.str('trade_name') ?? r.s('legal_name'), sublabel: (r) => r.str('city')),
  'subcontractors': NamedRef(
    '/subcontractors',
    (r) => r.str('trade_name') ?? r.s('legal_name'),
    sublabel: (r) => r.strings('trades').map(optionLabel).join(', '),
  ),
  'stockItems': NamedRef('/stock-items', (r) => '${r.s('sku')} — ${r.s('name')}', sublabel: (r) => r.str('unit')),
  'supplierProducts': NamedRef('/supplier-products', (r) => '${r.str('reference') ?? ''} ${r.s('name')}'.trim(), sublabel: (r) => r.str('unit')),
  'warehouses': NamedRef('/warehouses', (r) => '${r.s('code')} — ${r.s('name')}'),
  'locations': NamedRef('/stock-locations', (r) => '${r.s('code')}${r.has('label') ? ' — ${r.s('label')}' : ''}', dependsOn: ['warehouse_id']),
  'employees': NamedRef('/hr/employees', (r) => '${r.s('first_name')} ${r.s('last_name')}', sublabel: (r) => r.str('job_title')),
  'teams': NamedRef('/teams', _name, searchable: false),
  'users': NamedRef('/users/directory', _person, sublabel: (r) => r.str('job_title') ?? r.str('email'), searchable: false),
  'organizations': NamedRef('/organizations', _name, sublabel: (r) => optionLabel(r.str('kind'))),
  'clientOrganizations': NamedRef('/organizations', _name, query: {'kind': 'client'}),
  'supplierOrganizations': NamedRef('/organizations', _name, sublabel: (r) => r.str('city'), query: {'kind': 'supplier'}),
  'subcontractorOrganizations': NamedRef('/organizations', _name, sublabel: (r) => r.str('city'), query: {'kind': 'subcontractor'}),
  'contacts': NamedRef('/crm/contacts', _person, sublabel: (r) => r.str('email')),
  'opportunities': NamedRef('/crm/opportunities', (r) => '${r.str('number') ?? ''} ${r.s('title')}'.trim()),
  'leads': NamedRef('/crm/leads', (r) => '${r.str('number') ?? ''} ${[r.str('first_name'), r.str('last_name')].whereType<String>().join(' ')}'.trim()),
  'equipment': NamedRef('/equipment', (r) => '${r.s('code')} — ${r.s('name')}'),
  'goodsReceipts': NamedRef('/goods-receipts', (r) => r.s('number'), sublabel: (r) => r.str('po_number'), dependsOn: ['supplier_id']),
  'purchaseOrders': NamedRef('/procurement/orders', (r) => '${r.s('number')}${r.has('supplier_name') ? ' — ${r.s('supplier_name')}' : ''}'),
  'subcontracts': NamedRef('/subcontracts', (r) => '${r.s('number')} — ${r.s('title')}'),
  'bankAccounts': NamedRef('/bank-accounts', (r) => '${r.s('name')}${r.has('bank_name') ? ' (${r.s('bank_name')})' : ''}'),
  'universes': NamedRef('/cms/universes', _name),
  'folders': NamedRef('/document-folders', (r) => r.str('path') ?? r.s('name'), dependsOn: ['project_id']),
  'ppeItems': NamedRef('/qhse/ppe-items', (r) => '${r.s('name')}${r.has('size') ? ' (${r.s('size')})' : ''}'),
  'inspectionTemplates': NamedRef('/qhse/inspection-templates', _name, sublabel: (r) => optionLabel(r.str('category'))),
  'maintenancePlans': NamedRef('/maintenance-plans', _name, dependsOn: ['equipment_id']),
  'materialCategories': NamedRef('/configurator/material-categories', _name),
  'materials': NamedRef('/configurator/materials', _name, sublabel: (r) => optionLabel(r.str('tier'))),
  'blogCategories': NamedRef('/cms/blog-categories', _name),
  'blogAuthors': NamedRef('/cms/blog-authors', _name),
  'faqCategories': NamedRef('/cms/faq-categories', _name),
  'helpCategories': NamedRef('/cms/help-categories', _name),
  'testimonials': NamedRef('/cms/testimonials', (r) => r.s('author_name')),
  'portfolioProjects': NamedRef('/cms/projects', (r) => r.s('title')),
  'offers': NamedRef('/cms/offers', _name),
  'faqItems': NamedRef('/cms/faq-items', (r) => r.s('question')),
  'tenders': NamedRef('/tenders', (r) => '${r.s('number')} — ${r.s('title')}'),
  'clashRules': NamedRef('/bim/clash-rules', _name),
  'slaPolicies': NamedRef('/crm/sla-policies', _name),
  'pettyCashFunds': NamedRef('/petty-cash-funds', _name),
  'supplierInvoices': NamedRef('/supplier-invoices', (r) => '${r.s('number')} — ${r.str('supplier_reference') ?? ''}'),
  'clientInvoices': NamedRef('/client-invoices', (r) => '${r.s('number')} — ${r.str('title') ?? ''}'),
  'workSchedules': NamedRef('/hr/work-schedules', _name),
  'roles': NamedRef('/roles', (r) => '${r.s('name')} (${r.s('code')})', searchable: false),
  'segments': NamedRef('/newsletter/segments', _name),
  'emailTemplates': NamedRef('/newsletter/templates', _name, searchable: false),
};

/// Référentiel par défaut d'un champ (`project_id` → projets…) ou d'une liste (`assignee_ids` → utilisateurs).
NamedRef? refForField(String name) => kRefs[kFieldRefs[name]];
NamedRef? refForList(String name) => kRefs[kListRefs[name]];
