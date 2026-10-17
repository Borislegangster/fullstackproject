import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'api/api_exception.dart';
import 'auth/auth_controller.dart';
import 'auth/me.dart';
import 'config.dart';
import 'realtime/realtime.dart';
import 'theme/globus_theme.dart';

/// Accès aux services de l'application depuis un widget.
extension GlobusContext on BuildContext {
  ApiClient get api => read<ApiClient>();
  AuthController get auth => read<AuthController>();
  GlobusConfig get config => read<ApiClient>().config;
  Realtime get realtime => read<Realtime>();
  Realtime? get realtimeOrNull {
    try {
      return read<Realtime>();
    } catch (_) {
      return null;
    }
  }

  /// Utilisateur connecté (lecture simple, sans abonnement).
  Me get me => read<AuthController>().user!;
  bool can(String permission) => read<AuthController>().can(permission);

  void toast(String message, {bool error = false, bool success = false}) {
    final messenger = ScaffoldMessenger.maybeOf(this);
    if (messenger == null) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(error ? Icons.error_outline : (success ? Icons.check_circle_outline : Icons.info_outline), color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text(message)),
            ],
          ),
          backgroundColor: error ? GlobusColors.danger : (success ? GlobusColors.success : GlobusTokens.brand800),
          duration: Duration(seconds: error ? 6 : 3),
        ),
      );
  }

  void toastError(Object error) => toast(errorMessage(error), error: true);
}

/// Exécute une action avec retour visuel (succès / erreur) ; renvoie le résultat ou `null` en cas d'échec.
Future<T?> runAction<T>(BuildContext context, Future<T> Function() action, {String? success}) async {
  try {
    final result = await action();
    if (success != null && context.mounted) context.toast(success, success: true);
    return result;
  } catch (e) {
    if (context.mounted) context.toastError(e);
    return null;
  }
}
