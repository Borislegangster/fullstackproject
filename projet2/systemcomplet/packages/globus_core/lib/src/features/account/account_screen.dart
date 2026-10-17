import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/json.dart';
import '../../auth/auth_controller.dart';
import '../../context.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../push/push_service.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/api_view.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/primitives.dart';
import 'password_rules.dart';

/// « Mon compte » commun aux applications : profil, sécurité (MFA, mot de passe), sessions et appareils,
/// préférences de notification, confiance et confidentialité (client). Miroir de components/account/account-view.tsx.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, this.withPrivacy = false, this.initialTab = 0, this.mfaRequired = false});
  final bool withPrivacy;
  final int initialTab;
  final bool mfaRequired;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final required = mfaRequired || (user?.mfaRequired ?? false);
    final tabs = <(String, Widget)>[
      ('Profil', const _ProfileTab()),
      ('Sécurité', _SecurityTab(required: required)),
      ('Sessions et appareils', const _SessionsTab()),
      ('Notifications', const NotificationPreferencesView()),
      if (withPrivacy) ('Confiance', const _PrivacyTab()),
    ];
    return DefaultTabController(
      length: tabs.length,
      initialIndex: initialTab.clamp(0, tabs.length - 1),
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [for (final t in tabs) Tab(text: t.$1)],
            ),
          ),
          Expanded(child: TabBarView(children: [for (final t in tabs) t.$2])),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ profil
class _ProfileTab extends StatefulWidget {
  const _ProfileTab();
  @override
  State<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<_ProfileTab> {
  late final Map<String, TextEditingController> _c;
  String _timezone = 'Africa/Douala';
  bool _busy = false;

  static const _zones = [
    'Africa/Douala',
    'Europe/Paris',
    'Europe/Brussels',
    'America/New_York',
    'America/Toronto',
    'Africa/Abidjan',
    'Africa/Lagos',
    'Europe/London',
  ];

  @override
  void initState() {
    super.initState();
    final u = context.auth.user!;
    _c = {
      'first_name': TextEditingController(text: u.firstName),
      'last_name': TextEditingController(text: u.lastName),
      'phone': TextEditingController(text: u.phone ?? ''),
      'whatsapp': TextEditingController(text: u.whatsapp ?? ''),
      'job_title': TextEditingController(text: u.jobTitle ?? ''),
    };
    _timezone = J(u.raw).str('timezone') ?? 'Africa/Douala';
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    String? v(String k) => _c[k]!.text.trim().isEmpty ? null : _c[k]!.text.trim();
    final res = await runAction(
      context,
      () => context.api.patch(
        '/auth/me',
        body: {
          'first_name': _c['first_name']!.text.trim(),
          'last_name': _c['last_name']!.text.trim(),
          'phone': v('phone'),
          'whatsapp': v('whatsapp'),
          'job_title': v('job_title'),
          'locale': 'fr',
          'timezone': _timezone,
        },
      ),
      success: 'Profil enregistré',
    );
    if (res is Map && mounted) context.auth.replaceUser(res.cast<String, dynamic>());
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final u = context.watch<AuthController>().user!;
    Widget field(String key, String label, {TextInputType? type}) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _c[key],
        keyboardType: type,
        decoration: InputDecoration(labelText: label),
        onChanged: (_) => setState(() {}),
      ),
    );
    return PageList(
      children: [
        SectionCard(
          title: 'Informations personnelles',
          subtitle: u.email,
          child: Column(
            children: [
              field('first_name', 'Prénom *'),
              field('last_name', 'Nom *'),
              field('phone', 'Téléphone', type: TextInputType.phone),
              field('whatsapp', 'WhatsApp', type: TextInputType.phone),
              field('job_title', 'Fonction'),
              DropdownButtonFormField<String>(
                initialValue: _zones.contains(_timezone) ? _timezone : _zones.first,
                decoration: const InputDecoration(labelText: 'Fuseau horaire'),
                items: [for (final z in _zones) DropdownMenuItem(value: z, child: Text(z))],
                onChanged: (v) => setState(() => _timezone = v ?? _timezone),
              ),
              const SizedBox(height: 16),
              BusyButton(
                label: 'Enregistrer',
                expand: true,
                busy: _busy,
                onPressed: _c['first_name']!.text.trim().isEmpty || _c['last_name']!.text.trim().isEmpty ? null : _save,
              ),
            ],
          ),
        ),
        SectionCard(
          title: 'Déconnexion',
          child: OutlinedButton.icon(
            onPressed: () async {
              if (await confirmDialog(
                context,
                title: 'Se déconnecter ?',
                message: 'Les données enregistrées sur cet appareil seront effacées.',
                confirm: 'Se déconnecter',
              )) {
                if (context.mounted) await context.auth.logout();
              }
            },
            icon: const Icon(Icons.logout),
            label: const Text('Se déconnecter de cet appareil'),
          ),
        ),
      ],
    );
  }
}

// ------------------------------------------------------------------------------------------------ sécurité
class _SecurityTab extends StatelessWidget {
  const _SecurityTab({required this.required});
  final bool required;

  @override
  Widget build(BuildContext context) => PageList(
    children: [
      MfaCard(required: required),
      const _PasswordCard(),
    ],
  );
}

class MfaCard extends StatefulWidget {
  const MfaCard({super.key, required this.required});
  final bool required;
  @override
  State<MfaCard> createState() => _MfaCardState();
}

class _MfaCardState extends State<MfaCard> {
  int _reload = 0;
  bool _busy = false;

  Future<void> _refresh() async {
    await context.auth.reload();
    if (mounted) setState(() => _reload++);
  }

  Future<void> _startTotp() async {
    setState(() => _busy = true);
    final setup = await runAction(context, () => context.api.post('/auth/mfa/totp/setup'));
    if (mounted) setState(() => _busy = false);
    if (setup is! Map || !mounted) return;
    final codes = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _TotpSetupSheet(setup: J.of(setup)),
    );
    await _refresh();
    if (codes != null && mounted) await showRecoveryCodes(context, codes);
  }

  Future<void> _regen() async {
    final code = await promptText(
      context,
      title: 'Régénérer les codes de secours',
      label: "Code de votre application d'authentification",
      confirm: 'Régénérer',
      required: true,
      maxLines: 1,
      minLength: 6,
    );
    if (code == null || !mounted) return;
    final res = await runAction(context, () => context.api.post('/auth/mfa/recovery-codes', body: {'code': code}));
    if (res is Map && mounted) await showRecoveryCodes(context, J.of(res).strings('codes'));
  }

  Future<void> _disable() async {
    final result = await showDialog<(String, String)>(context: context, builder: (_) => const _DisableMfaDialog());
    if (result == null || !mounted) return;
    await runAction(
      context,
      () => context.api.post('/auth/mfa/disable', body: {'password': result.$1, 'code': result.$2}),
      success: 'Double authentification désactivée',
    );
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user!;
    return SectionCard(
      title: 'Double authentification (MFA)',
      subtitle: "Application d'authentification (TOTP) et codes de secours.",
      trailing: user.mfaEnabled
          ? const ToneBadge('Activée', tone: Tone.success)
          : ToneBadge(widget.required ? 'Obligatoire' : 'Désactivée', tone: widget.required ? Tone.danger : Tone.warning),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.required && !user.mfaEnabled)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: AlertBox(
                tone: Tone.danger,
                message: "Votre profil exige la double authentification : activez-la pour accéder à l'ensemble des fonctions.",
              ),
            ),
          ApiView(
            key: ValueKey(_reload),
            path: '/auth/mfa/factors',
            offline: false,
            refreshable: false,
            loading: const LinearProgressIndicator(),
            builder: (context, data, handle) {
              final factors = listOf(data);
              final hasTotp = factors.any((f) => f.s('type') == 'totp');
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final f in factors)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(f.s('type') == 'webauthn' ? Icons.fingerprint : Icons.smartphone),
                      title: Text(f.str('name') ?? (f.s('type') == 'totp' ? "Application d'authentification" : 'Clé de sécurité')),
                      subtitle: Text(
                        'Ajoutée le ${dateTime(f['created_at'])} · dernier usage ${f.has('last_used_at') ? relative(f['last_used_at']) : 'jamais'}',
                      ),
                      trailing: IconButton(
                        tooltip: 'Supprimer ce facteur',
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () async {
                          if (!await confirmDialog(context, title: 'Supprimer ce facteur ?', danger: true, confirm: 'Supprimer')) return;
                          if (!context.mounted) return;
                          await runAction(context, () => context.api.delete('/auth/mfa/factors/${f.s('id')}'));
                          await _refresh();
                        },
                      ),
                    ),
                  if (factors.any((f) => f.s('type') == 'webauthn'))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text("Les clés de sécurité s'ajoutent depuis le site web (navigateur compatible).", style: Theme.of(context).textTheme.bodySmall),
                    ),
                  const SizedBox(height: 8),
                  if (!hasTotp)
                    BusyButton(label: "Configurer une application d'authentification", icon: Icons.smartphone, busy: _busy, onPressed: _startTotp)
                  else
                    OutlinedButton.icon(onPressed: _regen, icon: const Icon(Icons.key), label: const Text('Régénérer les codes de secours')),
                  if (user.mfaEnabled && !widget.required) TextButton(onPressed: _disable, child: const Text('Désactiver le MFA')),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _TotpSetupSheet extends StatefulWidget {
  const _TotpSetupSheet({required this.setup});
  final J setup;
  @override
  State<_TotpSetupSheet> createState() => _TotpSetupSheetState();
}

class _TotpSetupSheetState extends State<_TotpSetupSheet> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final qr = widget.setup.str('qr_data_url');
    final secret = widget.setup.s('secret');
    final uri = widget.setup.str('otpauth_uri');
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text("Configurer l'application d'authentification", style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text(
              "Sur ce téléphone : touchez « Ouvrir l'application d'authentification » (Google Authenticator, Microsoft Authenticator, FreeOTP…). "
              'Depuis un autre appareil : scannez le QR code. Saisissez ensuite le code à 6 chiffres affiché.',
            ),
            const SizedBox(height: 12),
            if (uri != null)
              OutlinedButton.icon(
                onPressed: () async {
                  final ok = await launchUrl(Uri.parse(uri), mode: LaunchMode.externalApplication);
                  if (!ok && context.mounted) {
                    context.toast("Aucune application d'authentification trouvée : installez-en une ou utilisez la clé manuelle.", error: true);
                  }
                },
                icon: const Icon(Icons.open_in_new),
                label: const Text("Ouvrir l'application d'authentification"),
              ),
            if (qr != null && qr.contains(','))
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(8),
                    child: Image.memory(base64Decode(qr.split(',').last), width: 180, height: 180, semanticLabel: "QR code d'activation"),
                  ),
                ),
              ),
            Row(
              children: [
                Expanded(child: SelectableText('Clé manuelle : $secret', style: Theme.of(context).textTheme.bodySmall)),
                IconButton(
                  tooltip: 'Copier la clé',
                  icon: const Icon(Icons.copy),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: secret));
                    if (context.mounted) context.toast('Clé copiée');
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.w700),
              decoration: const InputDecoration(labelText: 'Code à 6 chiffres'),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
            const SizedBox(height: 16),
            BusyButton(
              label: 'Activer',
              expand: true,
              busy: _busy,
              onPressed: _code.text.length != 6
                  ? null
                  : () async {
                      setState(() {
                        _busy = true;
                        _error = null;
                      });
                      try {
                        final res = await context.api.post('/auth/mfa/totp/confirm', body: {'code': _code.text});
                        if (context.mounted) Navigator.pop(context, J.of(res).strings('codes'));
                      } catch (e) {
                        setState(() => _error = 'Code refusé : vérifiez l\'heure du téléphone et réessayez.');
                      } finally {
                        if (mounted) setState(() => _busy = false);
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }
}

/// Affiche les codes de secours (une seule fois) avec copie dans le presse-papiers.
Future<void> showRecoveryCodes(BuildContext context, List<String> codes) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      title: const Text('Vos codes de secours'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text("Chaque code ne sert qu'une fois. Conservez-les hors ligne en lieu sûr : ils ne seront plus affichés."),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in codes)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: Theme.of(ctx).colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(8)),
                  child: Text(
                    c,
                    style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton.icon(
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: 'Codes de secours GLOBUS ENGINEERING\n${codes.join('\n')}\n'));
            if (ctx.mounted) ctx.toast('Codes copiés');
          },
          icon: const Icon(Icons.copy),
          label: const Text('Copier'),
        ),
        FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text("J'ai conservé mes codes")),
      ],
    ),
  );
}

class _DisableMfaDialog extends StatefulWidget {
  const _DisableMfaDialog();
  @override
  State<_DisableMfaDialog> createState() => _DisableMfaDialogState();
}

class _DisableMfaDialogState extends State<_DisableMfaDialog> {
  final _pwd = TextEditingController();
  final _code = TextEditingController();

  @override
  void dispose() {
    _pwd.dispose();
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Désactiver la double authentification'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AlertBox(tone: Tone.warning, message: 'Votre compte sera moins protégé.'),
          const SizedBox(height: 12),
          TextField(
            controller: _pwd,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Mot de passe'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            decoration: const InputDecoration(labelText: 'Code TOTP ou code de secours'),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: GlobusColors.danger),
          onPressed: _pwd.text.isEmpty || _code.text.trim().length < 6 ? null : () => Navigator.pop(context, (_pwd.text, _code.text.trim())),
          child: const Text('Désactiver'),
        ),
      ],
    );
  }
}

class _PasswordCard extends StatefulWidget {
  const _PasswordCard();
  @override
  State<_PasswordCard> createState() => _PasswordCardState();
}

class _PasswordCardState extends State<_PasswordCard> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final invalid = _current.text.isEmpty || passwordIssues(_next.text).isNotEmpty || _next.text != _confirm.text;
    return SectionCard(
      title: 'Mot de passe',
      subtitle: 'Le changement de mot de passe ferme vos autres sessions.',
      child: Column(
        children: [
          TextField(
            controller: _current,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: 'Mot de passe actuel'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _next,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(labelText: 'Nouveau mot de passe'),
            onChanged: (_) => setState(() {}),
          ),
          if (_next.text.isNotEmpty) PasswordStrength(password: _next.text),
          const SizedBox(height: 12),
          TextField(
            controller: _confirm,
            obscureText: true,
            decoration: InputDecoration(
              labelText: 'Confirmation',
              errorText: _confirm.text.isNotEmpty && _confirm.text != _next.text ? 'Différent du nouveau mot de passe' : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          BusyButton(
            label: 'Modifier le mot de passe',
            expand: true,
            busy: _busy,
            onPressed: invalid
                ? null
                : () async {
                    setState(() => _busy = true);
                    final ok = await runAction(
                      context,
                      () async {
                        await context.api.post('/auth/password/change', body: {'current_password': _current.text, 'new_password': _next.text});
                        return true;
                      },
                      success: 'Mot de passe modifié',
                    );
                    if (!mounted) return;
                    if (ok == true) {
                      _current.clear();
                      _next.clear();
                      _confirm.clear();
                    }
                    setState(() => _busy = false);
                  },
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ sessions
class _SessionsTab extends StatefulWidget {
  const _SessionsTab();
  @override
  State<_SessionsTab> createState() => _SessionsTabState();
}

class _SessionsTabState extends State<_SessionsTab> {
  int _v = 0;
  void _bump() => setState(() => _v++);

  @override
  Widget build(BuildContext context) {
    final api = context.api;
    return PageList(
      children: [
        SectionCard(
          title: 'Sessions actives',
          trailing: TextButton.icon(
            onPressed: () async {
              if (!await confirmDialog(context, title: 'Fermer les autres sessions', message: 'Tous vos autres appareils seront déconnectés.')) return;
              if (!context.mounted) return;
              final res = await runAction(context, () => api.post('/auth/sessions/revoke-others'));
              if (res != null && context.mounted) context.toast('${J.of(res).i('revoked')} session(s) fermée(s)', success: true);
              _bump();
            },
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Fermer les autres'),
          ),
          padding: EdgeInsets.zero,
          child: ApiView(
            key: ValueKey('s$_v'),
            path: '/auth/sessions',
            offline: false,
            refreshable: false,
            loading: const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
            builder: (context, data, _) => Column(
              children: [
                for (final s in listOf(data))
                  ListTile(
                    leading: Icon(_appIcon(s.str('application'))),
                    title: Row(
                      children: [
                        Flexible(child: Text(_appName(s.str('application')))),
                        if (s.b('current'))
                          const Padding(
                            padding: EdgeInsets.only(left: 6),
                            child: ToneBadge('Session actuelle', tone: Tone.success),
                          ),
                      ],
                    ),
                    subtitle: Text(
                      '${s.str('ip') ?? 'IP inconnue'} · ouverte ${relative(s['created_at'])} · MFA ${s.has('mfa_verified_at') ? 'vérifié' : 'non vérifié'}\n${s.s('user_agent')}',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    isThreeLine: true,
                    trailing: s.b('current')
                        ? null
                        : TextButton(
                            onPressed: () async {
                              await runAction(context, () => api.delete('/auth/sessions/${s.s('id')}'));
                              _bump();
                            },
                            child: const Text('Révoquer'),
                          ),
                  ),
              ],
            ),
          ),
        ),
        SectionCard(
          title: 'Appareils',
          subtitle: "Un appareil de confiance n'exige pas le second facteur pendant 30 jours (sauf profils sensibles).",
          padding: EdgeInsets.zero,
          child: ApiView(
            key: ValueKey('d$_v'),
            path: '/auth/devices',
            offline: false,
            refreshable: false,
            loading: const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
            builder: (context, data, _) => Column(
              children: [
                for (final d in listOf(data))
                  ListTile(
                    title: Text(d.str('name') ?? 'Appareil'),
                    subtitle: Text(
                      [
                        if (d.b('trusted')) "De confiance jusqu'au ${dateTime(d['trusted_until'])}",
                        'Vu ${d.has('last_seen_at') ? relative(d['last_seen_at']) : '—'}',
                      ].join(' · '),
                    ),
                    trailing: PopupMenuButton<String>(
                      tooltip: 'Actions',
                      onSelected: (action) async {
                        if (action == 'trust') {
                          await runAction(context, () => api.patch('/auth/devices/${d.s('id')}', body: {'trusted': !d.b('trusted')}));
                        } else {
                          await runAction(context, () => api.delete('/auth/devices/${d.s('id')}'));
                        }
                        _bump();
                      },
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'trust', child: Text(d.b('trusted') ? 'Retirer la confiance' : 'Faire confiance')),
                        const PopupMenuItem(value: 'revoke', child: Text('Révoquer')),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        SectionCard(
          title: 'Historique de sécurité',
          padding: EdgeInsets.zero,
          child: ApiView(
            key: ValueKey('h$_v'),
            path: '/auth/login-history',
            offline: false,
            refreshable: false,
            loading: const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
            builder: (context, data, _) => Column(
              children: [
                for (final h in listOf(data))
                  ListTile(
                    dense: true,
                    title: Row(
                      children: [
                        Flexible(child: Text(optionLabel(h.s('action')))),
                        const SizedBox(width: 6),
                        ToneBadge(optionLabel(h.s('result')), tone: h.s('result') == 'success' ? Tone.success : Tone.danger),
                      ],
                    ),
                    subtitle: Text('${dateTime(h['at'])} · ${h.s('ip')} · ${_appName(h.str('application'))}'),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static IconData _appIcon(String? app) => switch (app) {
    'mobile-client' || 'mobile-field' || 'mobile-direction' => Icons.smartphone,
    'desktop' => Icons.desktop_windows_outlined,
    _ => Icons.language,
  };

  static String _appName(String? app) => switch (app) {
    'mobile-client' => 'Application mobile client',
    'mobile-field' => 'Application terrain',
    'mobile-direction' => 'Application direction',
    'desktop' => 'ERP bureau',
    null || '' => 'Site web',
    'web' => 'Site web',
    _ => app,
  };
}

// ------------------------------------------------------------------------------------------------ notifications
const kNotificationCategoryLabels = <String, String>{
  'crm': 'Commercial',
  'projects': 'Projets et chantiers',
  'procurement': 'Achats',
  'deliveries': 'Livraisons',
  'finance': 'Finances et paiements',
  'subcontracting': 'Sous-traitance',
  'disputes': 'Litiges',
  'documents': 'Documents',
  'bim': 'BIM',
  'decisions': 'Décisions à valider',
  'qhse': 'QHSE',
  'support': 'SAV',
  'calls': 'Appels',
  'chat': 'Messagerie',
  'digest': 'Résumé hebdomadaire',
  'inventory': 'Stocks',
  'equipment': 'Matériel',
  'tranquillite': 'Dossier Tranquillité',
  'security': 'Sécurité',
  'system': 'Système',
  'general': 'Général',
};

const kNotificationChannelLabels = <String, String>{'in_app': 'Application', 'push': 'Push', 'email': 'E-mail', 'whatsapp': 'WhatsApp', 'sms': 'SMS'};

/// Préférences de notification : canaux par catégorie, push sur cet appareil.
class NotificationPreferencesView extends StatelessWidget {
  const NotificationPreferencesView({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/notifications/preferences',
      offline: false,
      builder: (context, data, handle) {
        final prefs = J.of(data);
        final channels = prefs.strings('channels');
        final mandatory = prefs.strings('mandatory');
        final matrix = prefs.obj('matrix');
        return PageList(
          children: [
            const _PushCard(),
            SectionCard(
              title: 'Préférences de notification',
              subtitle: "Choisissez les canaux par type d'information. Les alertes de sécurité restent actives.",
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                children: [
                  for (final cat in prefs.strings('categories'))
                    ExpansionTile(
                      title: Text(kNotificationCategoryLabels[cat] ?? optionLabel(cat)),
                      subtitle: Text(
                        channels.where((ch) => matrix.obj(cat).b(ch)).map((ch) => kNotificationChannelLabels[ch] ?? ch).join(', ').ifEmpty('Aucun canal'),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      children: [
                        for (final ch in channels)
                          SwitchListTile(
                            dense: true,
                            title: Text(kNotificationChannelLabels[ch] ?? ch),
                            value: matrix.obj(cat).b(ch),
                            onChanged: (mandatory.contains(cat) || cat == 'system') && ch == 'in_app'
                                ? null
                                : (enabled) async {
                                    final updated = await runAction(
                                      context,
                                      () => context.api.put(
                                        '/notifications/preferences',
                                        body: {
                                          'items': [
                                            {'category': cat, 'channel': ch, 'enabled': enabled},
                                          ],
                                        },
                                      ),
                                    );
                                    if (updated != null) handle.data = updated;
                                  },
                          ),
                      ],
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

extension on String {
  String ifEmpty(String other) => isEmpty ? other : this;
}

class _PushCard extends StatelessWidget {
  const _PushCard();

  @override
  Widget build(BuildContext context) {
    final push = context.watch<PushService?>();
    if (push == null) return const SizedBox.shrink();
    final state = push.state;
    return SectionCard(
      title: 'Notifications push sur ce téléphone',
      icon: Icons.notifications_active_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(switch (state) {
            PushState.enabled => 'Activées : vous êtes prévenu même application fermée (appels, décisions, paiements…).',
            PushState.disabled => 'Désactivées sur cet appareil.',
            PushState.denied => "Refusées dans les réglages du téléphone : autorisez les notifications de l'application.",
            PushState.unavailable =>
              "Non disponibles sur cet appareil ou cette version : vous recevez vos notifications dans l'application, par e-mail ou WhatsApp.",
          }),
          const SizedBox(height: 10),
          if (state == PushState.enabled) ...[
            OutlinedButton(
              onPressed: () => runAction(context, () => push.test(), success: 'Notification de test envoyée'),
              child: const Text('Envoyer une notification de test'),
            ),
            TextButton(onPressed: () => push.disable(), child: const Text('Désactiver sur ce téléphone')),
          ] else if (state != PushState.unavailable)
            FilledButton.icon(
              onPressed: () async {
                final res = await push.enable();
                if (res == PushState.denied && context.mounted) context.toast('Notifications refusées par le téléphone', error: true);
              },
              icon: const Icon(Icons.notifications_active),
              label: const Text('Activer le push'),
            ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------ confiance (client)
class _PrivacyTab extends StatelessWidget {
  const _PrivacyTab();

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/client/trust',
      builder: (context, data, _) {
        final t = J.of(data);
        final validations = t.list('my_validations');
        final consents = t.list('consents');
        return PageList(
          children: [
            SectionCard(
              title: 'Centre de confiance',
              subtitle: 'Sécurité de votre compte et traçabilité de vos validations.',
              child: StatGrid(
                children: [
                  StatTile(
                    label: 'Double authentification',
                    value: t.b('mfa_enabled') ? 'Activée' : 'Désactivée',
                    tone: t.b('mfa_enabled') ? Tone.success : Tone.warning,
                  ),
                  StatTile(label: 'Sessions actives', value: '${t.i('active_sessions')}'),
                  StatTile(label: 'Validations signées', value: '${validations.length}'),
                ],
              ),
            ),
            SectionCard(
              title: 'Journal de mes validations',
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final v in validations)
                    ListTile(
                      title: Text(v.s('title')),
                      subtitle: Text(
                        '${dateTime(v['validated_at'])} · ${optionLabel(v.s('status'))}${v.has('content_hash') ? ' · empreinte ${v.s('content_hash').substring(0, v.s('content_hash').length.clamp(0, 16))}…' : ''}',
                      ),
                    ),
                  if (validations.isEmpty) const ListTile(title: Text('Aucune validation.')),
                ],
              ),
            ),
            SectionCard(
              title: 'Mes consentements',
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final c in consents)
                    ListTile(
                      title: Text(c.obj('purposes').raw.entries.where((e) => e.value == true).map((e) => optionLabel(e.key)).join(', ').ifEmpty('—')),
                      subtitle: Text(
                        '${dateTime(c['created_at'])} · politique v${c.s('policy_version')} · ${c.s('source')}${c.has('withdrawn_at') ? ' · retiré le ${dateTime(c['withdrawn_at'])}' : ''}',
                      ),
                    ),
                  if (consents.isEmpty) const ListTile(title: Text('Aucun consentement enregistré.')),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Accès direct à l'onglet Sécurité lorsque le MFA est obligatoire.
void openMfaEnrollment(BuildContext context) => unawaited(
  Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      builder: (_) => Scaffold(
        appBar: AppBar(title: const Text('Mon compte')),
        body: const AccountScreen(initialTab: 1, mfaRequired: true),
      ),
    ),
  ),
);
