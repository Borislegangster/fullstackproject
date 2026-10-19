import 'package:flutter/foundation.dart';

import '../format/labels.dart';

/// Erreur normalisée de l'API GLOBUS (`{"error": {code, message, details, correlation_id}}`).
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, {this.details, this.correlationId});

  /// Erreur réseau (serveur injoignable, pas de connexion) : l'interface affiche l'état « hors ligne ».
  ApiException.network([String? message])
    : status = 0,
      code = 'NETWORK',
      message = message ?? 'Connexion au serveur impossible. Vérifiez votre réseau.',
      details = null,
      correlationId = null;

  final int status;
  final String code;
  final String message;
  final Object? details;
  final String? correlationId;

  bool get isNetwork => status == 0;
  bool get isUnauthorized => status == 401;
  bool get isForbidden => status == 403;
  bool get isNotFound => status == 404;

  /// Erreurs de validation champ par champ (422 VALIDATION_ERROR).
  List<FieldError> get fieldErrors {
    final d = details;
    if (d is! List) return const [];
    return d.whereType<Map<dynamic, dynamic>>().where((e) => e.containsKey('field')).map((e) {
      final type = e['type']?.toString();
      final raw = (e['message'] ?? 'valeur invalide').toString().replaceFirst(RegExp(r'^Value error, '), '');
      return FieldError(e['field']?.toString() ?? '', _validationTypes[type] ?? raw, type);
    }).toList();
  }

  /// Message lisible en français pour l'utilisateur.
  String get userMessage {
    final fields = fieldErrors;
    if (fields.isNotEmpty) {
      final first = fields.first;
      final name = first.field.split('.').where((p) => int.tryParse(p) == null).lastOrNull ?? first.field;
      final label = name.isEmpty ? '' : '${fieldLabel(name)} : ';
      return '$message — $label${first.message}${fields.length > 1 ? ' (+${fields.length - 1})' : ''}';
    }
    if (status == 429) return 'Trop de tentatives : patientez quelques instants avant de réessayer.';
    if (status == 403 && code == 'FORBIDDEN') return message.isEmpty ? 'Action non autorisée pour votre profil.' : message;
    return message;
  }

  @override
  String toString() => 'ApiException($status $code: $message)';
}

class FieldError {
  const FieldError(this.field, this.message, [this.type]);
  final String field;
  final String message;
  final String? type;
}

const _validationTypes = <String, String>{
  'missing': 'champ obligatoire',
  'string_too_short': 'valeur trop courte',
  'string_too_long': 'valeur trop longue',
  'string_pattern_mismatch': 'format invalide',
  'greater_than': 'valeur trop petite',
  'greater_than_equal': 'valeur trop petite',
  'less_than': 'valeur trop grande',
  'less_than_equal': 'valeur trop grande',
  'too_short': 'au moins un élément est requis',
  'too_long': "trop d'éléments",
  'value_error': 'valeur invalide',
  'uuid_parsing': 'sélection invalide',
  'uuid_type': 'sélection invalide',
  'date_from_datetime_parsing': 'date invalide',
  'date_parsing': 'date invalide',
  'datetime_parsing': 'date et heure invalides',
  'datetime_from_date_parsing': 'date et heure invalides',
  'decimal_parsing': 'nombre invalide',
  'float_parsing': 'nombre invalide',
  'int_parsing': 'nombre entier attendu',
  'bool_parsing': 'valeur oui/non attendue',
  'literal_error': 'choix invalide',
  'enum': 'choix invalide',
  'extra_forbidden': 'champ non autorisé',
};

/// Message utilisateur pour toute erreur (API, réseau, inattendue).
String errorMessage(Object? error) {
  if (error is ApiException) return error.userMessage;
  if (error is StateError) return error.message;
  if (error is FormatException) return 'Réponse du serveur illisible.';
  return 'Une erreur est survenue';
}

/// Signale une erreur inattendue côté application (hors erreur de l'API : donnée mal typée, bogue d'affichage) :
/// journal de l'application et tests ; l'utilisateur voit un message générique.
void reportUnexpected(Object error, StackTrace stack, String context) {
  if (error is ApiException) return;
  FlutterError.reportError(
    FlutterErrorDetails(exception: error, stack: stack, library: 'globus_core', context: ErrorDescription(context)),
  );
}
