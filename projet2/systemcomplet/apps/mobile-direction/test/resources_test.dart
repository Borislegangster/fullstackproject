import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_direction/screens/modules.dart';
import 'package:globus_direction/screens/reports.dart';

/// Chaque formulaire déclaré correspond à un point d'entrée réel de l'API (schémas générés depuis l'OpenAPI) et ne
/// règle que des champs existants : une faute de frappe ou une évolution de l'API casse ce test, pas l'écran.
void main() {
  final resources = [...allResources, anomalies, sessions];

  test('formulaires de création / modification / actions : points d\'entrée et champs existants', () {
    final problems = <String>[];
    void check(String where, String endpoint, Iterable<String> fields) {
      final body = bodyOf(endpoint);
      if (body == null) {
        problems.add('$where : point d\'entrée inconnu « $endpoint »');
        return;
      }
      final names = (schemaOf(body.schema ?? '') ?? const <FieldDef>[]).map((f) => f.name).toSet();
      for (final f in fields) {
        if (!names.contains(f)) problems.add('$where : champ « $f » absent de ${body.schema}');
      }
    }

    for (final r in resources) {
      final c = r.create;
      if (c != null) check('${r.title} › ${c.label}', c.endpoint, [...c.fields.keys, ...?c.only]);
      final u = r.update;
      if (u != null) check('${r.title} › Modifier', u.endpoint, u.fields.keys);
      for (final a in r.actions) {
        if (a.endpoint != null) {
          final fixed = a.fixed?.call(J({'id': 'x', 'project_id': 'p'})).keys ?? const <String>[];
          check('${r.title} › ${a.label}', a.endpoint!, [...a.fields.keys, ...fixed, ...?a.only]);
        }
      }
    }
    expect(problems, isEmpty, reason: problems.join('\n'));
  });

  test('chaque ressource a un titre et un chemin de liste', () {
    for (final r in resources) {
      expect(r.title, isNotEmpty);
      expect(r.path, startsWith('/'));
    }
  });
}
