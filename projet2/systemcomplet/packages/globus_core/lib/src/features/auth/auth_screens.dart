import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/json.dart';
import '../../auth/auth_controller.dart';
import '../../brand/brand.dart';
import '../../config.dart';
import '../../context.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/primitives.dart';
import '../account/password_rules.dart';

/// Cadre commun des écrans d'authentification (icône de la plateforme, carte centrée).
class AuthFrame extends StatelessWidget {
  const AuthFrame({super.key, required this.child, this.showBack = false});
  final Widget child;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final app = context.read<GlobusConfig>().app;
    return Scaffold(
      backgroundColor: GlobusTokens.brand900,
      appBar: showBack ? AppBar(backgroundColor: Colors.transparent, foregroundColor: Colors.white) : null,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                children: [
                  const BrandIcon(size: 72),
                  const SizedBox(height: 10),
                  Text(
                    app.displayName,
                    style: const TextStyle(fontFamily: GlobusFonts.title, fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                  const Text('Concevoir. Calculer. Construire. Contrôler.', style: TextStyle(color: GlobusTokens.brand200, fontSize: 12.5)),
                  const SizedBox(height: 22),
                  Card(
                    child: Padding(padding: const EdgeInsets.all(20), child: child),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Connexion : identifiants puis double authentification (application TOTP ou code de secours).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _show = false;
  bool _remember = true;
  bool _trust = false;
  bool _busy = false;
  String? _error;
  String? _mfaToken;
  List<String> _methods = const [];
  bool _recovery = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final step = await context.auth.login(_email.text, _password.text, remember: _remember);
      if (step.needsMfa) {
        setState(() {
          _mfaToken = step.mfaToken;
          _methods = step.methods;
          _recovery = !step.methods.contains('totp');
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.status == 401 ? 'Identifiants incorrects.' : e.userMessage);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final code = _code.text.trim();
      await context.auth.verifyMfa(_mfaToken!, code: _recovery ? null : code, recoveryCode: _recovery ? code : null, trustDevice: _trust);
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notice = context.watch<AuthController>().notice;
    if (_mfaToken != null) {
      final onlyKey = _methods.isNotEmpty && !_methods.contains('totp') && _methods.contains('webauthn');
      return AuthFrame(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.verified_user_outlined, color: GlobusColors.primary, size: 28),
                const SizedBox(width: 10),
                Expanded(child: Text('Vérification en deux étapes', style: Theme.of(context).textTheme.titleLarge)),
              ],
            ),
            const SizedBox(height: 6),
            const Text('Confirmez votre identité pour accéder à votre espace.'),
            const SizedBox(height: 16),
            if (onlyKey)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: AlertBox(
                  tone: Tone.info,
                  message: "Votre compte est protégé par une clé de sécurité : utilisez un code de secours, ou ajoutez l'application d'authentification depuis le site web.",
                ),
              ),
            TextField(
              controller: _code,
              autofocus: true,
              keyboardType: _recovery ? TextInputType.text : TextInputType.number,
              inputFormatters: _recovery ? null : [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: _recovery ? 18 : 26, letterSpacing: _recovery ? 2 : 10, fontWeight: FontWeight.w700),
              decoration: InputDecoration(
                labelText: _recovery ? 'Code de secours' : "Code de l'application d'authentification",
                hintText: _recovery ? 'xxxx-xxxx' : null,
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _verify(),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _trust,
              onChanged: (v) => setState(() => _trust = v ?? false),
              title: const Text('Faire confiance à cet appareil pendant 30 jours'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            BusyButton(
              label: 'Vérifier',
              expand: true,
              busy: _busy,
              onPressed: (_recovery ? _code.text.trim().length >= 6 : _code.text.length == 6) ? _verify : null,
            ),
            TextButton.icon(
              onPressed: () => setState(() {
                _recovery = !_recovery;
                _code.clear();
              }),
              icon: const Icon(Icons.key),
              label: Text(_recovery ? "Utiliser le code de l'application" : 'Utiliser un code de secours'),
            ),
            TextButton(onPressed: () => setState(() => _mfaToken = null), child: const Text('Retour')),
          ],
        ),
      );
    }
    return AuthFrame(
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Connexion', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text(_subtitle(context.read<GlobusConfig>().app), style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 18),
            if (notice != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AlertBox(tone: Tone.warning, message: notice),
              ),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.username, AutofillHints.email],
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Adresse e-mail', prefixIcon: Icon(Icons.alternate_email)),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: !_show,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _email.text.isNotEmpty && _password.text.isNotEmpty ? _submit() : null,
              decoration: InputDecoration(
                labelText: 'Mot de passe',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  tooltip: _show ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
                  icon: Icon(_show ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _show = !_show),
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            Row(
              children: [
                Expanded(
                  child: CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _remember,
                    onChanged: (v) => setState(() => _remember = v ?? true),
                    title: const Text('Rester connecté'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                ),
              ],
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            BusyButton(label: 'Se connecter', expand: true, busy: _busy, onPressed: _email.text.isEmpty || _password.text.isEmpty ? null : _submit),
            const SizedBox(height: 6),
            TextButton(onPressed: () => context.push('/mot-de-passe-oublie'), child: const Text('Mot de passe oublié ?')),
            const Divider(height: 24),
            Text(
              'Accès sur invitation : votre lien d\'activation vous est envoyé par e-mail ou WhatsApp par votre interlocuteur GLOBUS.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            TextButton(onPressed: () => context.push('/activation'), child: const Text("J'ai reçu un lien d'activation")),
          ],
        ),
      ),
    );
  }

  static String _subtitle(GlobusApp app) => switch (app) {
    GlobusApp.client => 'Votre espace client : chantier, finances, documents et décisions.',
    GlobusApp.field => 'Application terrain du personnel GLOBUS ENGINEERING.',
    GlobusApp.direction => 'Pilotage, validations et supervision à distance.',
  };
}

/// Mot de passe oublié : envoi d'un lien de réinitialisation par e-mail.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AuthFrame(
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Mot de passe oublié', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          const Text('Saisissez votre e-mail : si un compte existe, vous recevrez un lien de réinitialisation valable une heure.'),
          const SizedBox(height: 16),
          if (_sent)
            const AlertBox(
              tone: Tone.success,
              message: 'Si un compte correspond à cette adresse, un e-mail vient de vous être envoyé. Ouvrez le lien sur ce téléphone pour choisir un nouveau mot de passe.',
            )
          else ...[
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Adresse e-mail'),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            const SizedBox(height: 16),
            BusyButton(
              label: 'Envoyer le lien',
              expand: true,
              busy: _busy,
              onPressed: _email.text.trim().isEmpty
                  ? null
                  : () async {
                      setState(() {
                        _busy = true;
                        _error = null;
                      });
                      try {
                        await context.api.post('/auth/password/forgot', body: {'email': _email.text.trim()});
                        setState(() => _sent = true);
                      } catch (e) {
                        setState(() => _error = errorMessage(e));
                      } finally {
                        if (mounted) setState(() => _busy = false);
                      }
                    },
            ),
          ],
          TextButton(onPressed: () => context.go('/connexion'), child: const Text('Retour à la connexion')),
        ],
      ),
    );
  }
}

/// Nouveau mot de passe depuis le lien reçu par e-mail (lien d'application ou jeton collé).
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.token});
  final String? token;
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final token = widget.token ?? '';
    final invalid = passwordIssues(_password.text).isNotEmpty || _password.text != _confirm.text;
    return AuthFrame(
      showBack: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Nouveau mot de passe', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          if (token.isEmpty)
            const AlertBox(tone: Tone.danger, message: 'Lien de réinitialisation incomplet : ouvrez le lien reçu par e-mail sur ce téléphone.')
          else if (_done) ...[
            const AlertBox(tone: Tone.success, message: 'Votre mot de passe a été modifié. Toutes vos autres sessions ont été fermées.'),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => context.go('/connexion'), child: const Text('Se connecter')),
          ] else ...[
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Nouveau mot de passe'),
              onChanged: (_) => setState(() {}),
            ),
            PasswordStrength(password: _password.text),
            const SizedBox(height: 12),
            TextField(
              controller: _confirm,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Confirmer',
                errorText: _confirm.text.isNotEmpty && _confirm.text != _password.text ? 'Les mots de passe ne correspondent pas' : null,
              ),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            const SizedBox(height: 16),
            BusyButton(
              label: 'Enregistrer',
              expand: true,
              busy: _busy,
              onPressed: invalid
                  ? null
                  : () async {
                      setState(() {
                        _busy = true;
                        _error = null;
                      });
                      try {
                        await context.api.post('/auth/password/reset', body: {'token': token, 'new_password': _password.text});
                        setState(() => _done = true);
                      } catch (e) {
                        setState(() => _error = errorMessage(e));
                      } finally {
                        if (mounted) setState(() => _busy = false);
                      }
                    },
            ),
          ],
        ],
      ),
    );
  }
}

/// Activation d'un accès créé par GLOBUS : lien personnel à usage unique → mot de passe → double authentification.
class ActivationScreen extends StatefulWidget {
  const ActivationScreen({super.key, this.token});
  final String? token;
  @override
  State<ActivationScreen> createState() => _ActivationScreenState();
}

class _ActivationScreenState extends State<ActivationScreen> {
  late String? _token = widget.token;
  final _link = TextEditingController();
  J? _invitation;
  Object? _loadError;
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (_token != null) unawaited(_loadInvitation());
  }

  @override
  void dispose() {
    for (final c in [_link, _first, _last, _phone, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadInvitation() async {
    try {
      final info = J.of(await context.api.get('/auth/invitations/${Uri.encodeComponent(_token!)}'));
      setState(() {
        _invitation = info;
        _first.text = info.s('first_name');
        _last.text = info.s('last_name');
      });
    } catch (e) {
      setState(() => _loadError = e);
    }
  }

  /// Accepte un lien complet (…/activation?invitation=…) ou le seul jeton.
  void _useLink() {
    final raw = _link.text.trim();
    final uri = Uri.tryParse(raw);
    final token = uri?.queryParameters['invitation'] ?? (raw.contains('/') ? null : raw);
    if (token == null || token.length < 10) {
      setState(() => _error = "Lien d'activation non reconnu.");
      return;
    }
    setState(() {
      _token = token;
      _error = null;
      _loadError = null;
    });
    unawaited(_loadInvitation());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_token == null) {
      return AuthFrame(
        showBack: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Accès sur invitation', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              "Les comptes GLOBUS sont ouverts par nos équipes : votre lien d'activation personnel vous est envoyé par e-mail ou WhatsApp. "
              'Ouvrez-le sur ce téléphone, ou collez-le ci-dessous.',
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _link,
              decoration: const InputDecoration(labelText: "Lien d'activation"),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            const SizedBox(height: 12),
            FilledButton(onPressed: _link.text.trim().isEmpty ? null : _useLink, child: const Text('Continuer')),
            TextButton(onPressed: () => context.go('/connexion'), child: const Text("J'ai déjà activé mon accès : me connecter")),
          ],
        ),
      );
    }
    if (_loadError != null) {
      return AuthFrame(
        showBack: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AlertBox(tone: Tone.danger, title: "Lien d'activation indisponible", message: errorMessage(_loadError)),
            const SizedBox(height: 10),
            const Text('Ce lien a peut-être déjà été utilisé ou a expiré : demandez un nouvel envoi à votre interlocuteur GLOBUS.'),
          ],
        ),
      );
    }
    if (_invitation == null) return const AuthFrame(child: Center(child: CircularProgressIndicator()));
    final issues = passwordIssues(_password.text);
    final mismatch = _confirm.text.isNotEmpty && _confirm.text != _password.text;
    return AuthFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Activer votre accès', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('Identifiant : ${_invitation!.s('email')} · lien valable jusqu\'au ${date(_invitation!['expires_at'])}.', style: theme.textTheme.bodySmall),
          const SizedBox(height: 14),
          TextField(
            controller: _first,
            decoration: const InputDecoration(labelText: 'Prénom'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _last,
            decoration: const InputDecoration(labelText: 'Nom'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Téléphone (WhatsApp)'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Choisissez votre mot de passe *'),
            onChanged: (_) => setState(() {}),
          ),
          PasswordStrength(password: _password.text),
          const SizedBox(height: 10),
          TextField(
            controller: _confirm,
            obscureText: true,
            decoration: InputDecoration(labelText: 'Confirmez le mot de passe *', errorText: mismatch ? 'Les mots de passe ne correspondent pas' : null),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          const AlertBox(
            tone: Tone.info,
            message: "À l'étape suivante, vous activerez la double authentification : elle protège vos documents, paiements et décisions.",
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          const SizedBox(height: 14),
          BusyButton(
            label: 'Activer et continuer',
            expand: true,
            busy: _busy,
            onPressed: issues.isNotEmpty || mismatch || _confirm.text.isEmpty
                ? null
                : () async {
                    setState(() {
                      _busy = true;
                      _error = null;
                    });
                    try {
                      await context.auth.acceptInvitation(
                        token: _token!,
                        password: _password.text,
                        firstName: _first.text,
                        lastName: _last.text,
                        phone: _phone.text,
                      );
                    } catch (e) {
                      setState(() => _error = errorMessage(e));
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  },
          ),
        ],
      ),
    );
  }
}

/// Compte connecté sans accès à cette application (ex. compte client dans l'application terrain).
class NoAccessScreen extends StatelessWidget {
  const NoAccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.read<GlobusConfig>().app;
    return AuthFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.lock_outline, size: 40, color: GlobusColors.warning),
          const SizedBox(height: 10),
          Text('Accès non autorisé à ${app.displayName}', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            switch (app) {
              GlobusApp.client => "Ce compte n'est pas un compte client. Utilisez l'application GLOBUS Terrain ou GLOBUS Direction.",
              GlobusApp.field => "Ce compte n'appartient pas au personnel GLOBUS ENGINEERING. Les clients utilisent l'application GLOBUS Client.",
              GlobusApp.direction => 'Cette application est réservée à la direction et aux responsables (droits de supervision requis).',
            },
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => context.auth.logout(), child: const Text('Changer de compte')),
        ],
      ),
    );
  }
}

/// Démarrage (restauration de la session).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: GlobusTokens.brand900,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandIcon(size: 84),
            SizedBox(height: 20),
            SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}
