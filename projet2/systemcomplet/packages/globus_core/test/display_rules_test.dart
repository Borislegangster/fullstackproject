import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';

void main() {
  group('affichage des valeurs (fiches génériques)', () {
    test('dates ISO formatées quel que soit le nom du champ', () {
      expect(displayValue('deadline', '2026-10-18T19:12:39.687916+00:00'), isNot(contains('T')));
      expect(displayValue('period_start', '2026-09-30'), '30/09/2026');
      expect(displayValue('eta', '2026-10-19T20:12:38+00:00'), matches(RegExp(r'^\d{2}/\d{2}/2026 \d{2}:\d{2}$')));
    });

    test('montants, pourcentages et nombres', () {
      expect(displayValue('budget_min', '180000000.00'), contains('FCFA'));
      expect(displayValue('total_estimated', '1800000.00'), contains('FCFA'));
      expect(displayValue('penalty_per_day', '50000.00'), contains('FCFA'));
      expect(displayValue('advance_recovered', '2805000.00'), contains('FCFA'));
      expect(displayValue('probability', 20), contains('%'));
      expect(displayValue('total_score', '87.50'), isNot(contains('FCFA')));
      expect(displayValue('quantity_ordered', '12.500'), isNot(contains('FCFA')));
    });

    test('codes d\'énumération traduits, même sans « _ »', () {
      expect(displayValue('stage', 'qualification'), 'Qualification');
      expect(displayValue('doc_type', 'rapport'), 'Rapport');
      expect(displayValue('status', 'ordered'), 'Commandé');
      expect(displayValue('application', 'mobile-direction'), 'Application direction');
    });

    test('libellés de champs français (plus de « Won le » / « Created le »)', () {
      expect(fieldLabel('won_at'), 'Gagné le');
      expect(fieldLabel('created_at'), 'Créé le');
      expect(fieldLabel('updated_at'), 'Modifié le');
      expect(fieldLabel('user'), 'Utilisateur');
    });

    test('champs techniques jamais affichés', () {
      for (final key in ['id', 'project_id', 'checksum_sha256', 'idempotency_key', 'user_agent', 'ip', 'portal_token_hash']) {
        expect(isHiddenField(key), isTrue, reason: key);
      }
      expect(isHiddenField('title'), isFalse);
    });

    test('version de document sans doublon de préfixe', () {
      expect(versionLabel('V1.0'), 'V1.0');
      expect(versionLabel('2'), 'v2');
    });
  });

  group('liens vers des écrans absents de l\'application', () {
    final pages = [
      AppPage('/erp/crm/opportunites', 'Opportunités', (_, _) => const SizedBox()),
      AppPage('/erp/sav/:id', 'Ticket', (_, _) => const SizedBox()),
    ];

    test('lien connu conservé, sinon rubrique parente', () {
      expect(closestRoute(pages, '/erp/sav/12', '/erp'), '/erp/sav/12');
      expect(closestRoute(pages, '/erp/crm/opportunites/123', '/erp'), '/erp/crm/opportunites');
      expect(closestRoute(pages, '/erp/inconnu/1', '/erp'), isNull);
    });
  });
}
