import '../api/json.dart';

/// Utilisateur connecté (`GET /auth/me`).
class Me {
  Me(this.raw);

  final Map<String, dynamic> raw;

  J get _j => J(raw);
  String get id => _j.s('id');
  String get email => _j.s('email');
  String get firstName => _j.s('first_name');
  String get lastName => _j.s('last_name');
  String get fullName => _j.str('full_name') ?? '$firstName $lastName'.trim();
  String? get phone => _j.str('phone');
  String? get whatsapp => _j.str('whatsapp');
  String? get jobTitle => _j.str('job_title');
  String? get trade => _j.str('trade');
  String? get avatarUrl => _j.str('avatar_url');
  bool get mfaEnabled => _j.b('mfa_enabled');
  bool get mfaRequired => _j.b('mfa_required');
  bool get emailVerified => _j.b('email_verified');
  List<String> get roles => _j.strings('roles');
  List<String> get permissions => _j.strings('permissions');
  List<String> get spaces => _j.strings('spaces');
  List<String> get features => _j.strings('features');
  Map<String, dynamic> get preferences => J.of(raw['preferences']).raw;
  J? get organization => _j.objOrNull('organization');

  bool can(String permission) => permissions.contains(permission);
  bool canAll(Iterable<String> perms) => perms.every(permissions.contains);
  bool canAny(Iterable<String> perms) => perms.any(permissions.contains);
  bool hasRole(String role) => roles.contains(role);
  bool hasFeature(String feature) => features.contains(feature);

  /// MFA obligatoire pour ce profil mais pas encore activée : accès limité à « Mon compte ».
  bool get mustEnrollMfa => mfaRequired && !mfaEnabled;
}
