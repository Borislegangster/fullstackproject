import 'package:flutter_test/flutter_test.dart';
import 'package:globus_core/globus_core.dart';

void main() {
  group('formats français (Douala, UTC+1)', () {
    test('nombres et montants FCFA', () {
      expect(number(1234567), _n('1 234 567'));
      expect(number('9876543.21'), _n('9 876 543'));
      expect(number(1234.5, 2), _n('1 234,5'));
      expect(number(-0.5, 1), '-0,5');
      expect(number(null), '—');
      expect(money('40000000'), _n('40 000 000 FCFA'));
      expect(money(1500, 'XAF'), _n('1 500 FCFA'));
      expect(money(12, 'EUR'), _n('12 EUR'));
      expect(percent(33.33, 1), _n('33,3 %'));
    });

    test('dates et heures (instants UTC affichés à Douala)', () {
      expect(date('2026-10-16'), '16/10/2026');
      expect(dateTime('2026-10-16T22:30:00Z'), '16/10/2026 23:30');
      expect(dateTime('2026-10-16T23:30:00+00:00'), '17/10/2026 00:30');
      expect(dateLong('2026-08-01'), '1 août 2026');
      expect(dayLong('2026-10-16'), 'vendredi 16 octobre');
      expect(date(null), '—');
      expect(isoDate(DateTime(2026, 3, 5)), '2026-03-05');
    });

    test('relatif, tailles, initiales, durées', () {
      final now = DateTime.utc(2026, 10, 16, 12);
      expect(relative('2026-10-16T11:59:30Z', now: now), "à l'instant");
      expect(relative('2026-10-16T11:55:00Z', now: now), 'il y a 5 minutes');
      expect(relative('2026-10-16T09:00:00Z', now: now), 'il y a 3 heures');
      expect(relative('2026-10-15T09:00:00Z', now: now), 'hier');
      expect(relative('2026-10-18T13:00:00Z', now: now), 'dans 2 jours');
      expect(fileSize(512), '512 o');
      expect(fileSize(2048), '2 Ko');
      expect(fileSize(5 * 1024 * 1024), '5,0 Mo');
      expect(initials('Awa Ngono Mbarga'), 'AN');
      expect(initials(null), '?');
      expect(duration(const Duration(minutes: 3, seconds: 20)), '3 min 20 s');
    });
  });

  group('libellés partagés avec le web', () {
    test('valeurs, statuts et tons', () {
      expect(statusLabel('pending_approval'), 'À approuver');
      expect(statusTone('paid'), Tone.success);
      expect(statusTone('overdue'), Tone.danger);
      expect(statusTone('pending'), Tone.warning);
      expect(statusTone('in_progress'), Tone.info);
      expect(statusTone('inconnu'), Tone.neutral);
      expect(optionLabel('XAF'), 'FCFA (XAF)');
      expect(optionLabel('valeur_inconnue'), 'valeur inconnue');
      expect(optionLabel(null), '—');
      expect(fieldLabel('subject'), isNot('subject'));
    });

    test('métiers des personnes : référentiel complet en français', () {
      final options = personTradeOptions();
      expect(options.map((o) => o.value), containsAll(['maconnerie', 'electricite', 'manoeuvre', 'conduite_engins']));
      expect(options.every((o) => o.label != o.value.replaceAll('_', ' ') || o.value.length < 4), isTrue);
    });
  });

  group('règles de mot de passe (alignées sur le serveur)', () {
    test('12 caractères, minuscule, majuscule, chiffre, spécial', () {
      expect(passwordIssues('court'), contains('12 caractères minimum'));
      expect(passwordIssues('globusengineering2026!'), ['une majuscule']);
      expect(passwordIssues('Globus!Test2026'), isEmpty);
    });
  });

  group('liens des notifications', () {
    const links = AppLinks(base: '/espace-client', isKnown: _known);
    test('chemins d’espace, liens génériques, liens externes refusés', () {
      expect(links.resolve('/espace-client/sav/42', 'https://globus.test'), '/espace-client/sav/42');
      expect(links.resolve('/messagerie/c-1', 'https://globus.test'), '/espace-client/messagerie?c=c-1');
      expect(links.resolve('/appels/k-9', 'https://globus.test'), '/espace-client/appels?call=k-9');
      expect(links.resolve('/agenda/e-3', 'https://globus.test'), '/espace-client/agenda?event=e-3');
      expect(links.resolve('/notifications', 'https://globus.test'), '/espace-client/notifications');
      expect(links.resolve('https://globus.test/espace-client/finances', 'https://globus.test'), '/espace-client/finances');
      expect(links.resolve('https://phishing.example/espace-client', 'https://globus.test'), isNull);
      expect(links.resolve(null, 'https://globus.test'), isNull);
    });
  });

  group('configuration', () {
    test('HTTPS obligatoire hors poste de développement', () {
      expect(const GlobusConfig(app: GlobusApp.client, apiUrl: '').problem, contains('GLOBUS_API_URL'));
      expect(const GlobusConfig(app: GlobusApp.client, apiUrl: 'http://globus.example.com').problem, contains('HTTPS'));
      expect(const GlobusConfig(app: GlobusApp.client, apiUrl: 'https://globus.example.com/').problem, isNull);
      expect(const GlobusConfig(app: GlobusApp.client, apiUrl: 'https://globus.example.com/').apiBase, 'https://globus.example.com/api/v1');
    });
  });
}

bool _known(String path) => true;

/// Espaces insécables des formats français.
String _n(String s) => s.replaceAll(' ', nbsp);
