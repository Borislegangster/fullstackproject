import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/api_exception.dart';
import '../api/json.dart';
import '../format/labels.dart';
import '../theme/globus_theme.dart';
import 'primitives.dart';

/// Confirmation simple (action irréversible : signer, payer, supprimer…).
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  String? message,
  String confirm = 'Confirmer',
  bool danger = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: message == null ? null : Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: GlobusColors.danger) : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirm),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Saisie de texte (motif de refus, commentaire…). Renvoie `null` si annulé.
Future<String?> promptText(
  BuildContext context, {
  required String title,
  String? message,
  String label = 'Commentaire',
  String confirm = 'Valider',
  bool required = false,
  int maxLines = 4,
  int? minLength,
  String? initial,
  bool danger = false,
}) {
  return showDialog<String>(
    context: context,
    builder: (ctx) => _PromptDialog(
      title: title,
      message: message,
      label: label,
      confirm: confirm,
      required: required,
      maxLines: maxLines,
      minLength: minLength,
      initial: initial,
      danger: danger,
    ),
  );
}

class _PromptDialog extends StatefulWidget {
  const _PromptDialog({
    required this.title,
    this.message,
    required this.label,
    required this.confirm,
    required this.required,
    required this.maxLines,
    this.minLength,
    this.initial,
    required this.danger,
  });
  final String title;
  final String? message;
  final String label;
  final String confirm;
  final bool required;
  final int maxLines;
  final int? minLength;
  final String? initial;
  final bool danger;

  @override
  State<_PromptDialog> createState() => _PromptDialogState();
}

class _PromptDialogState extends State<_PromptDialog> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  bool get _valid {
    final t = _c.text.trim();
    if (widget.required && t.isEmpty) return false;
    if (widget.minLength != null && t.length < widget.minLength!) return false;
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.message != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(widget.message!)),
          TextField(
            controller: _c,
            autofocus: true,
            maxLines: widget.maxLines,
            minLines: 1,
            decoration: InputDecoration(
              labelText: widget.label,
              helperText: widget.minLength != null ? '${widget.minLength} caractères minimum' : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
        FilledButton(
          style: widget.danger ? FilledButton.styleFrom(backgroundColor: GlobusColors.danger) : null,
          onPressed: _valid ? () => Navigator.pop(context, _c.text.trim()) : null,
          child: Text(widget.confirm),
        ),
      ],
    );
  }
}

/// Canal de réception d'un code à usage unique.
typedef OtpChannel = ({String value, String label});

const kOtpChannels = <OtpChannel>[
  (value: 'email', label: 'Par e-mail'),
  (value: 'sms', label: 'Par SMS'),
  (value: 'whatsapp', label: 'Par WhatsApp'),
];

/// Validation forte par code à usage unique (OTP) : décisions, avenants, échéanciers, offres, séquestre
/// (preuve horodatée). Miroir de components/ui/otp-dialog.tsx.
///
/// [request] envoie le code sur le canal choisi et renvoie le défi (`otp_token`, `sent_to`, `expires_in`) ;
/// [confirm] valide avec le défi et le code saisi. Renvoie le résultat de [confirm] ou `null` si annulé.
Future<T?> otpDialog<T>(
  BuildContext context, {
  required String title,
  String? description,
  Widget? child,
  List<OtpChannel>? channels,
  required Future<Object?> Function(String channel) request,
  required Future<T> Function(J challenge, String code) confirm,
  String confirmLabel = 'Valider',
  bool Function()? canConfirm,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => _OtpDialog<T>(
      title: title,
      description: description,
      extra: child,
      channels: channels,
      request: request,
      confirm: confirm,
      confirmLabel: confirmLabel,
      canConfirm: canConfirm,
    ),
  );
}

class _OtpDialog<T> extends StatefulWidget {
  const _OtpDialog({
    required this.title,
    this.description,
    this.extra,
    this.channels,
    required this.request,
    required this.confirm,
    required this.confirmLabel,
    this.canConfirm,
  });
  final String title;
  final String? description;
  final Widget? extra;
  final List<OtpChannel>? channels;
  final Future<Object?> Function(String channel) request;
  final Future<T> Function(J challenge, String code) confirm;
  final String confirmLabel;
  final bool Function()? canConfirm;

  @override
  State<_OtpDialog<T>> createState() => _OtpDialogState<T>();
}

class _OtpDialogState<T> extends State<_OtpDialog<T>> {
  final _code = TextEditingController();
  late String _channel = widget.channels?.firstOrNull?.value ?? 'email';
  J? _challenge;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await widget.request(_channel);
      setState(() => _challenge = J.of(res));
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final challenge = _challenge;
    if (challenge == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.confirm(challenge, _code.text.trim());
      if (mounted) Navigator.pop(context, result);
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final challenge = _challenge;
    final channels = widget.channels;
    final ok = widget.canConfirm?.call() ?? true;
    return AlertDialog(
      title: Text(widget.title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.description != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(widget.description!)),
            ?widget.extra,
            if (challenge == null && channels != null && channels.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: DropdownButtonFormField<String>(
                  initialValue: _channel,
                  decoration: const InputDecoration(labelText: 'Recevoir le code par'),
                  items: [for (final c in channels) DropdownMenuItem(value: c.value, child: Text(c.label))],
                  onChanged: (v) => setState(() => _channel = v ?? _channel),
                ),
              ),
            const SizedBox(height: 10),
            if (challenge == null)
              const AlertBox(
                tone: Tone.info,
                icon: Icons.verified_user_outlined,
                message: "Votre validation sera horodatée et associée à l'empreinte du contenu validé : elle ne pourra plus être modifiée.",
              )
            else ...[
              Text(
                'Code envoyé${challenge.has('sent_to') ? ' à ${challenge.s('sent_to')}' : ''}. Il expire dans ${((challenge.i('expires_in', 600)) / 60).round()} minutes.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _code,
                autofocus: true,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(8)],
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.w700),
                decoration: const InputDecoration(labelText: 'Code reçu'),
                onChanged: (_) => setState(() {}),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: _busy ? null : _send, child: const Text('Renvoyer le code')),
              ),
            ],
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: AlertBox(tone: Tone.danger, message: _error!),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Annuler')),
        if (challenge == null)
          FilledButton(onPressed: _busy ? null : _send, child: _busy ? const _Spinner() : const Text('Recevoir mon code'))
        else
          FilledButton.icon(
            onPressed: _busy || _code.text.trim().length < 4 || !ok ? null : _submit,
            icon: _busy ? const _Spinner() : const Icon(Icons.verified_user, size: 18),
            label: Text(widget.confirmLabel),
          ),
      ],
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();
  @override
  Widget build(BuildContext context) => const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white));
}

/// Choix dans une liste (feuille du bas). Renvoie la valeur choisie.
Future<T?> pickOption<T>(BuildContext context, {required String title, required List<(T, String)> options, T? selected}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(title, style: Theme.of(ctx).textTheme.titleMedium),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final (value, label) in options)
                    ListTile(
                      title: Text(label),
                      trailing: value == selected ? const Icon(Icons.check, color: GlobusColors.accent) : null,
                      onTap: () => Navigator.pop(ctx, value),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Bouton principal avec état de chargement.
class BusyButton extends StatelessWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.busy = false, this.icon, this.danger = false, this.expand = false});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  final bool danger;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final style = danger ? FilledButton.styleFrom(backgroundColor: GlobusColors.danger) : null;
    final child = busy
        ? const _Spinner()
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
              Flexible(child: Text(label)),
            ],
          );
    final button = FilledButton(style: style, onPressed: busy ? null : onPressed, child: child);
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
