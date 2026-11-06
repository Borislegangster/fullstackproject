import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/api_exception.dart';
import '../../api/json.dart';
import '../../context.dart';
import '../../files/files.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/api_view.dart';
import '../../widgets/dialogs.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Signature manuscrite des documents émis (devis, contrats, factures, reçus, rapports…) : tracé au doigt ou au
/// stylet, validé électroniquement par un code à usage unique. Miroir de components/signatures/sign-document.tsx.

const _ink = Color(0xFF10205F);

/// Tracés de la zone de signature (points en coordonnées du cadre).
class SignaturePadController extends ChangeNotifier {
  final List<List<Offset>> _strokes = [];
  Size _size = Size.zero;

  bool get isEmpty => _strokes.isEmpty;
  List<List<Offset>> get strokes => List.unmodifiable(_strokes);

  void _start(Offset p) {
    _strokes.add([p]);
    notifyListeners();
  }

  void _extend(Offset p) {
    if (_strokes.isEmpty) return;
    _strokes.last.add(p);
    notifyListeners();
  }

  void undo() {
    if (_strokes.isNotEmpty) _strokes.removeLast();
    notifyListeners();
  }

  void clear() {
    _strokes.clear();
    notifyListeners();
  }

  /// PNG transparent recadré sur la signature, en data URL (`data:image/png;base64,…`) ; null si vide.
  Future<String?> toDataUrl({double scale = 3}) async {
    final points = _strokes.expand((s) => s).toList();
    if (points.isEmpty || _size == Size.zero) return null;
    const pad = 8.0;
    final minX = math.max(0.0, points.map((p) => p.dx).reduce(math.min) - pad);
    final minY = math.max(0.0, points.map((p) => p.dy).reduce(math.min) - pad);
    final maxX = points.map((p) => p.dx).reduce(math.max) + pad;
    final maxY = points.map((p) => p.dy).reduce(math.max) + pad;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder)
      ..scale(scale)
      ..translate(-minX, -minY);
    _SignaturePainter.paintStrokes(canvas, _strokes);
    final width = math.max(1, ((maxX - minX) * scale).round());
    final height = math.max(1, ((maxY - minY) * scale).round());
    final image = await recorder.endRecording().toImage(width, height);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) return null;
    return 'data:image/png;base64,${base64Encode(bytes.buffer.asUint8List())}';
  }
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter(this.controller) : super(repaint: controller);
  final SignaturePadController controller;

  static void paintStrokes(Canvas canvas, List<List<Offset>> strokes) {
    final pen = Paint()
      ..color = _ink
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8;
    for (final s in strokes) {
      if (s.length == 1) {
        canvas.drawCircle(s.first, 1.8, Paint()..color = _ink);
        continue;
      }
      // courbe passant par les milieux : tracé lissé, comme au stylo
      final path = Path()..moveTo(s.first.dx, s.first.dy);
      for (var i = 1; i < s.length; i++) {
        final a = s[i - 1];
        final b = s[i];
        path.quadraticBezierTo(a.dx, a.dy, (a.dx + b.dx) / 2, (a.dy + b.dy) / 2);
      }
      path.lineTo(s.last.dx, s.last.dy);
      canvas.drawPath(path, pen);
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    controller._size = size;
    final guide = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 1;
    canvas.drawLine(Offset(20, size.height - 34), Offset(size.width - 20, size.height - 34), guide);
    paintStrokes(canvas, controller._strokes);
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}

/// Zone de signature : dessiner au doigt ou au stylet ; « Annuler le trait », « Effacer ».
class SignaturePad extends StatelessWidget {
  const SignaturePad({super.key, required this.controller, this.height = 200});
  final SignaturePadController controller;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: height,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: GlobusColors.primary.withValues(alpha: 0.35), width: 1.5),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      // le geste de signature ne fait pas défiler l'écran
                      onPanStart: (d) => controller._start(d.localPosition),
                      onPanUpdate: (d) => controller._extend(d.localPosition),
                      child: CustomPaint(painter: _SignaturePainter(controller)),
                    ),
                  ),
                  if (controller.isEmpty)
                    const Positioned(
                      left: 0,
                      right: 0,
                      bottom: 10,
                      child: IgnorePointer(
                        child: Text(
                          'Signez ici avec le doigt ou un stylet',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: controller.isEmpty ? null : controller.undo,
                icon: const Icon(Icons.undo, size: 18),
                label: const Text('Annuler le trait'),
              ),
              TextButton.icon(onPressed: controller.isEmpty ? null : controller.clear, icon: const Icon(Icons.clear, size: 18), label: const Text('Effacer')),
            ],
          ),
        ],
      ),
    );
  }
}

/// Fenêtre « Signer le document » : relire le PDF, dessiner sa signature, consentir et valider par code.
/// [party] : `company` (au nom de GLOBUS ENGINEERING, sur le cachet) ou `client`. Renvoie l'état mis à jour.
Future<J?> signDocument(BuildContext context, {required J doc, required String party}) {
  return Navigator.of(context).push<J>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _SignScreen(doc: doc, party: party),
    ),
  );
}

class _SignScreen extends StatefulWidget {
  const _SignScreen({required this.doc, required this.party});
  final J doc;
  final String party;

  @override
  State<_SignScreen> createState() => _SignScreenState();
}

class _SignScreenState extends State<_SignScreen> {
  final _pad = SignaturePadController();
  final _code = TextEditingController();
  String _channel = 'email';
  bool _agreed = false;
  bool _remember = false;
  bool _useSaved = false;
  String? _saved;
  J? _challenge;
  bool _busy = false;
  String? _error;

  String get _base => '/signatures/${widget.doc.s('kind')}/${widget.doc.s('entity_id')}';

  @override
  void initState() {
    super.initState();
    _pad.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final saved = J.of(await context.api.get('/signatures/me/saved'));
        if (mounted) setState(() => _saved = saved.str('image'));
      } catch (_) {
        // pas de signature mémorisée : dessin seulement
      }
    });
  }

  @override
  void dispose() {
    _pad.dispose();
    _code.dispose();
    super.dispose();
  }

  bool get _ready => (_useSaved ? _saved != null : !_pad.isEmpty) && _agreed;

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await context.api.post('$_base/otp', body: {'party': widget.party, 'channel': _channel});
      setState(() => _challenge = J.of(res));
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sign() async {
    final challenge = _challenge;
    if (challenge == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = context.api;
    try {
      final image = _useSaved ? _saved : await _pad.toDataUrl();
      if (image == null) throw const FormatException('Dessinez votre signature avant de valider.');
      final res = await api.post(
        '$_base/sign',
        body: {
          'party': widget.party,
          'image': image,
          'otp_token': challenge.s('otp_token'),
          'code': _code.text.trim(),
          'consent': true,
          'remember': _remember && !_useSaved,
        },
      );
      if (!mounted) return;
      context.toast('Document signé : signature apposée et validée.', success: true);
      Navigator.pop(context, J.of(res));
    } on FormatException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final doc = widget.doc;
    final challenge = _challenge;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Signer le document')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('${doc.s('kind_label')} ${doc.s('reference')}', style: theme.textTheme.titleMedium),
          if (doc.has('title')) Text(doc.s('title'), style: theme.textTheme.bodySmall),
          const SizedBox(height: 10),
          AlertBox(
            tone: Tone.info,
            message: widget.party == 'company'
                ? 'Votre signature est apposée sur le cachet de l\'entreprise, dans le bloc « GLOBUS ENGINEERING » du document.'
                : 'Votre signature est apposée dans votre bloc de signature du document.',
            action: TextButton.icon(
              onPressed: () => openRemoteFile(context, '$_base/pdf', filename: '${doc.s('reference')}.pdf'),
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
              label: const Text('Relire le document'),
            ),
          ),
          const SizedBox(height: 16),
          Text('1. Votre signature manuscrite', style: theme.textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_saved != null)
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(label: const Text('Utiliser ma signature enregistrée'), selected: _useSaved, onSelected: (_) => setState(() => _useSaved = true)),
                ChoiceChip(label: const Text('Dessiner une nouvelle signature'), selected: !_useSaved, onSelected: (_) => setState(() => _useSaved = false)),
              ],
            ),
          const SizedBox(height: 8),
          if (_useSaved && _saved != null)
            Container(
              height: 150,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: Image.memory(base64Decode(_saved!.split(',').last), height: 120, fit: BoxFit.contain),
            )
          else ...[
            SignaturePad(controller: _pad),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _remember,
              onChanged: (v) => setState(() => _remember = v ?? false),
              title: const Text('Mémoriser ma signature'),
              subtitle: const Text('Proposée pour les prochains documents ; toujours validée par un code.'),
            ),
          ],
          const SizedBox(height: 8),
          Text('2. Validation électronique', style: theme.textTheme.titleSmall),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _agreed,
            onChanged: (v) => setState(() => _agreed = v ?? false),
            title: const Text("J'approuve et je signe"),
            subtitle: Text(doc.s('consent')),
          ),
          if (challenge == null) ...[
            DropdownButtonFormField<String>(
              initialValue: _channel,
              decoration: const InputDecoration(labelText: 'Recevoir le code par'),
              items: [for (final c in kOtpChannels) DropdownMenuItem(value: c.value, child: Text(c.label))],
              onChanged: (v) => setState(() => _channel = v ?? _channel),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _busy || !_ready ? null : _send,
              icon: const Icon(Icons.mail_outline, size: 18),
              label: const Text('Recevoir mon code'),
            ),
          ] else ...[
            Text('Code envoyé${challenge.has('sent_to') ? ' à ${challenge.s('sent_to')}' : ''} ; il expire dans 10 minutes.', style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            TextField(
              controller: _code,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.w700),
              decoration: const InputDecoration(labelText: 'Code reçu'),
              onChanged: (_) => setState(() {}),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: _busy ? null : _send, child: const Text('Renvoyer le code')),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: _busy || _code.text.trim().length < 6 || !_ready ? null : _sign,
                  icon: const Icon(Icons.draw_outlined, size: 18),
                  label: const Text('Signer le document'),
                ),
              ],
            ),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: AlertBox(tone: Tone.danger, message: _error!),
            ),
          if (_busy) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
        ],
      ),
    );
  }
}

/// État de la signature d'une partie (« Signé », « À signer », « À signer de nouveau »).
class PartyBadge extends StatelessWidget {
  const PartyBadge(this.party, {super.key});
  final J party;

  @override
  Widget build(BuildContext context) {
    if (party.b('signed')) return const ToneBadge('Signé', tone: Tone.success, icon: Icons.check_circle_outline);
    if (party.b('stale')) return const ToneBadge('À signer de nouveau', tone: Tone.warning, icon: Icons.warning_amber_rounded);
    return const ToneBadge('À signer', tone: Tone.neutral, icon: Icons.schedule);
  }
}

/// Documents à signer : côté client (`/signatures/mine` : devis et contrats) ou côté entreprise
/// (`/signatures/documents` : tout document émis, signature de l'entreprise + cachet).
class SignaturesScreen extends StatelessWidget {
  const SignaturesScreen({super.key, required this.company});
  final bool company;

  String get _party => company ? 'company' : 'client';

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: company ? '/signatures/documents' : '/signatures/mine',
      query: company ? const {'state': 'to_sign', 'page_size': 100} : null,
      offline: false,
      builder: (context, data, handle) {
        final docs = listOf(data);
        if (docs.isEmpty) {
          return EmptyView(
            icon: Icons.draw_outlined,
            title: company ? 'Aucun document à signer' : 'Aucun document à signer',
            text: company
                ? 'Les devis, contrats, factures, reçus et rapports émis apparaissent ici tant que l\'entreprise ne les a pas signés.'
                : 'Vos devis et contrats apparaîtront ici dès que GLOBUS ENGINEERING vous les adressera.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: docs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) => _DocCard(doc: docs[i], party: _party, onSigned: handle.reload),
        );
      },
    );
  }
}

class _DocCard extends StatelessWidget {
  const _DocCard({required this.doc, required this.party, required this.onSigned});
  final J doc;
  final String party;
  final Future<void> Function() onSigned;

  J? get _mine => doc.list('parties').where((p) => p.s('party') == party).firstOrNull;

  Future<void> _sign(BuildContext context) async {
    try {
      // état complet (texte du consentement, droits) avant d'ouvrir la fenêtre de signature
      final full = J.of(await context.api.get('/signatures/${doc.s('kind')}/${doc.s('entity_id')}'));
      if (!context.mounted) return;
      final res = await signDocument(context, doc: full, party: party);
      if (res != null) await onSigned();
    } catch (e) {
      if (context.mounted) context.toastError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mine = _mine;
    final theme = Theme.of(context);
    final canSign =
        mine != null && !mine.b('signed') && !mine.has('blocked') && (party == 'company' ? context.can('signatures:company') : context.can('client:decide'));
    return SectionCard(
      title: '${doc.s('kind_label')} ${doc.s('reference')}',
      subtitle: [
        if (doc.has('title')) doc.s('title'),
        if (doc.has('party_name')) doc.s('party_name'),
        if (doc.has('amount')) money(doc['amount']),
      ].join(' · '),
      trailing: mine != null ? PartyBadge(mine) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final p in doc.list('parties'))
            Text(
              '${p.s('label')} : ${p.b('signed') ? 'signé par ${p.s('signer_name')} le ${dateTime(p['signed_at'])}' : (p.str('blocked') ?? 'en attente')}',
              style: theme.textTheme.bodySmall,
            ),
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => openRemoteFile(context, '/signatures/${doc.s('kind')}/${doc.s('entity_id')}/pdf', filename: '${doc.s('reference')}.pdf'),
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                label: const Text('PDF'),
              ),
              if (canSign) FilledButton.icon(onPressed: () => _sign(context), icon: const Icon(Icons.draw_outlined, size: 18), label: const Text('Signer')),
            ],
          ),
        ],
      ),
    );
  }
}
