import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../app.dart';
import '../field_state.dart';

const _ocrKinds = [('delivery_note', 'Bon de livraison'), ('invoice', 'Facture fournisseur'), ('document', 'Autre document')];

/// Lecture assistée (IA) d'un bon de livraison ou d'une facture photographié : données extraites à vérifier
/// (jamais appliquées sans validation humaine), puis réception du bon de commande reconnu.
class OcrScreen extends StatefulWidget {
  const OcrScreen({super.key});
  @override
  State<OcrScreen> createState() => _OcrScreenState();
}

class _OcrScreenState extends State<OcrScreen> {
  String _kind = 'delivery_note';
  J? _job;
  bool _busy = false;

  Future<void> _capture() async {
    final files = await pickAttachments(context, multiple: false);
    if (files.isEmpty || !mounted) return;
    setState(() => _busy = true);
    final projectId = context.read<FieldProjects>().projectId;
    final res = await runAction(
      context,
      () => context.api.upload('/ai/ocr', files: files, fields: {'kind': _kind, 'project_id': ?projectId}),
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (res != null) _job = J.of(res);
    });
  }

  Future<void> _decide(bool accepted) async {
    final job = _job;
    if (job == null) return;
    final res = await runAction(
      context,
      () => context.api.post('/ai/ocr/${job.s('id')}/validate', body: {'accepted': accepted}),
      success: accepted ? 'Lecture validée' : 'Lecture rejetée',
    );
    if (res != null && mounted) setState(() => _job = J.of(res));
  }

  @override
  Widget build(BuildContext context) {
    final job = _job;
    final x = job?.obj('extracted');
    final confidence = toDouble(job?['confidence']);
    return PageList(
      children: [
        const PageHeader(title: 'Lecture de document', subtitle: 'Photographiez la pièce : l\'IA propose les données, vous vérifiez.'),
        SegmentedButton<String>(
          segments: [for (final k in _ocrKinds) ButtonSegment(value: k.$1, label: Text(k.$2))],
          selected: {_kind},
          showSelectedIcon: false,
          onSelectionChanged: (v) => setState(() => _kind = v.first),
        ),
        BusyButton(
          label: job == null ? 'Photographier la pièce' : 'Lire une autre pièce',
          icon: Icons.document_scanner_outlined,
          busy: _busy,
          expand: true,
          onPressed: _capture,
        ),
        if (job != null && x != null) ...[
          AlertBox(
            tone: confidence >= 0.8 ? Tone.success : (confidence >= 0.5 ? Tone.warning : Tone.danger),
            title: 'Confiance ${percent(confidence * 100)}',
            message: confidence >= 0.8 ? 'Lecture fiable : vérifiez tout de même chaque valeur.' : 'Lecture incertaine : contrôlez la pièce ligne à ligne.',
          ),
          SectionCard(
            title: 'Données lues',
            trailing: StatusBadge(job.s('status')),
            child: Column(
              children: [
                InfoRow('Fournisseur', x.str('supplier_name')),
                InfoRow('Référence', x.str('reference')),
                InfoRow('Date', x.str('date')),
                InfoRow('Bon de commande', x.str('po_number')),
                if (toDouble(x['total']) > 0) InfoRow('Total TTC', money(x['total'])),
              ],
            ),
          ),
          if (x.list('lines').isNotEmpty)
            SectionCard(
              title: 'Lignes',
              child: Column(
                children: [
                  for (final l in x.list('lines'))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(l.str('description') ?? '—'),
                      trailing: Text('${number(l['quantity'], 2)} ${l.str('unit') ?? ''}'),
                    ),
                ],
              ),
            ),
          if (job.s('status') == 'processed')
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(onPressed: () => _decide(false), child: const Text('Rejeter')),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(onPressed: () => _decide(true), child: const Text('Valider la lecture')),
                ),
              ],
            ),
          if (x.has('po_number') && context.can('deliveries:receive'))
            FilledButton.icon(
              onPressed: () => context.push('$base/livraisons/receptions/nouvelle', extra: x.s('po_number')),
              icon: const Icon(Icons.inventory_outlined),
              label: Text('Réceptionner ${x.s('po_number')}'),
            ),
        ],
      ],
    );
  }
}
