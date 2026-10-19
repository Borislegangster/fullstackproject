import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';
import 'package:globus_core/testing.dart';
import 'package:provider/provider.dart';

/// Formulaires générés depuis l'OpenAPI (miroir du SchemaForm web) : jamais de JSON ni d'identifiant à saisir.
void main() {
  group('schémas générés', () {
    test('corps et schémas des points d\'entrée présents (source unique : OpenAPI)', () {
      final body = bodyOf('POST /procurement/requests/{request_id}/decision');
      expect(body?.type, 'json');
      final fields = schemaOf(body!.schema!)!;
      expect(fields.map((f) => f.name), containsAll(['approve', 'comment']));
      expect(fields.firstWhere((f) => f.name == 'approve').kind, 'boolean');
      expect(refForField('project_id')?.path, '/projects');
      expect(refForField('supplier_id')?.path, '/suppliers');
      expect(refForList('assignee_ids')?.path, '/users/directory');
    });

    test('référentiel dépendant : chantier requis avant la tâche', () {
      final tasks = kRefs['tasks']!;
      expect(tasks.resolve({}), isNull);
      expect(tasks.resolve({'project_id': 'p1'})?.path, '/projects/p1/tasks');
      expect(kRefs['sites']!.resolve({'project_id': 'p1'})?.query, {'project_id': 'p1'});
    });

    test('conversion vers le contrat JSON : nombres français, dates, champs vides omis', () {
      const schema = 'LeaveIn';
      final values = emptyValues(schema, {'kind': 'conge'});
      values['start_date'] = DateTime(2026, 11, 2);
      values['end_date'] = DateTime(2026, 11, 6);
      final payload = toPayload(schema, values);
      expect(payload['start_date'], '2026-11-02');
      expect(payload['end_date'], '2026-11-06');
      expect(payload['kind'], 'conge');
      expect(payload['employee_id'], isNull, reason: 'nullable : envoyé à null, comme le web');
      expect(validateValues(schema, {...values, 'start_date': null}, const {}), contains('start_date'));
    });

    test('affichage générique des valeurs (montants, dates, statuts, booléens)', () {
      expect(displayValue('total_amount', '1500000'), money('1500000'));
      expect(displayValue('due_date', '2026-10-30'), '30/10/2026');
      expect(displayValue('status', 'pending_approval'), statusLabel('pending_approval'));
      expect(displayValue('urgent', true), 'Oui');
      expect(displayValue('notes', null), '—');
    });
  });

  testWidgets('formulaire : libellés français, champ obligatoire, choix, envoi au point d\'entrée', (tester) async {
    final fake = FakeApi();
    Map<String, dynamic>? sent;
    fake.on('POST', '/hr/leaves', (r) {
      sent = (r.body! as Map).cast<String, dynamic>();
      return (201, {'id': 'l1'});
    });
    final api = fakeClient(fake);
    Object? result;
    await tester.pumpWidget(
      Provider<ApiClient>.value(
        value: api,
        child: MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: SchemaForm(
                endpoint: 'POST /hr/leaves',
                fixed: const {'start_date': '2026-11-02', 'end_date': '2026-11-06'},
                onSuccess: (r) => result = r,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(fieldLabel('kind')), findsOneWidget);
    expect(find.text(fieldLabel('employee_id')), findsOneWidget, reason: 'identifiant présenté comme un sélecteur (référentiel)');
    expect(find.textContaining('Choisir'), findsWidgets);
    await tester.enterText(find.widgetWithText(TextFormField, fieldLabel('reason')), 'Mariage');
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    expect(sent?['reason'], 'Mariage');
    expect(sent?['kind'], 'conge');
    expect(sent?['start_date'], '2026-11-02');
    expect(result, isNotNull);
  });

  testWidgets('champ conditionnel : motif de perte seulement pour l\'étape « Perdu », alors obligatoire', (tester) async {
    final fake = FakeApi();
    Map<String, dynamic>? sent;
    fake.on('POST', '/crm/opportunities/o1/stage', (r) {
      sent = (r.body! as Map).cast<String, dynamic>();
      return (200, {'id': 'o1'});
    });
    Future<void> pumpForm(String stage) async {
      await tester.pumpWidget(
        Provider<ApiClient>.value(
          value: fakeClient(fake),
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: SchemaForm(
                  key: ValueKey(stage),
                  endpoint: 'POST /crm/opportunities/{opp_id}/stage',
                  params: const {'opp_id': 'o1'},
                  initial: {'stage': stage},
                  fields: {
                    'lost_reason': FieldConfig(
                      label: 'Motif de perte',
                      visibleIf: (v) => v['stage'] == 'lost',
                      requiredIf: (v) => v['stage'] == 'lost',
                    ),
                  },
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    await pumpForm('won');
    expect(find.textContaining('Motif de perte'), findsNothing, reason: 'masqué pour « Gagné »');
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    expect(sent, {'stage': 'won'}, reason: 'motif masqué jamais envoyé');

    sent = null;
    await pumpForm('lost');
    expect(find.text('Motif de perte *'), findsOneWidget, reason: 'affiché et obligatoire pour « Perdu »');
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    expect(sent, isNull);
    expect(find.text('Champ obligatoire'), findsOneWidget);
  });
}
