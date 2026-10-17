import '../generated/schemas.g.dart';

/// Champ d'un corps de requête de l'API (généré depuis l'OpenAPI, miroir de apps/web/src/generated/schemas.ts).
class FieldDef {
  const FieldDef(
    this.name,
    this.kind, {
    this.required = false,
    this.nullable = false,
    this.options,
    this.ref,
    this.itemKind,
    this.itemOptions,
    this.maxLength,
    this.minLength,
    this.min,
    this.max,
    this.maxItems,
    this.minItems,
    this.defaultValue,
    this.help,
  });

  final String name;

  /// string · text · number · integer · boolean · date · datetime · time · uuid · enum · email · list · objects ·
  /// object · json · file · files
  final String kind;
  final bool required;
  final bool nullable;
  final List<String>? options;

  /// Schéma des sous-objets (lignes « objects » / objet « object »).
  final String? ref;
  final String? itemKind;
  final List<String>? itemOptions;
  final int? maxLength;
  final int? minLength;
  final num? min;
  final num? max;
  final int? maxItems;
  final int? minItems;
  final Object? defaultValue;
  final String? help;
}

/// Corps attendu par un point d'entrée (« POST /chemin/{param} ») : JSON ou multipart, et son schéma.
({String type, String? schema})? bodyOf(String endpoint) => kBodies[endpoint];

List<FieldDef>? schemaOf(String name) => kSchemas[name];
