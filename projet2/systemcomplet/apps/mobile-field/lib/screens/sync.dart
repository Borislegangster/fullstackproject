import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

/// File hors ligne du téléphone : opérations en attente d'envoi, conflits à arbitrer (ma version / celle du
/// bureau / fusion champ par champ), refus du serveur à lire avant abandon. Rien n'est écrasé en silence.
class SyncScreen extends StatelessWidget {
  const SyncScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final queue = context.watch<OfflineQueue>();
    final offline = context.watch<GlobusServices>().offline;
    final pending = queue.items.where((o) => o.status == 'pending').toList();
    final conflicts = queue.items.where((o) => o.status == 'conflict').toList();
    final rejected = queue.items.where((o) => o.status == 'rejected').toList();
    return PageList(
      children: [
        PageHeader(
          title: 'Synchronisation',
          subtitle: queue.lastSync == null ? 'Aucune synchronisation sur ce téléphone.' : 'Dernier envoi ${relative(queue.lastSync!.toUtc())}.',
          trailing: queue.syncing ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)) : null,
        ),
        ValueListenableBuilder<bool>(
          valueListenable: offline,
          builder: (context, isOffline, _) => isOffline
              ? const AlertBox(
                  tone: Tone.warning,
                  title: 'Hors ligne',
                  message: 'Vos saisies sont conservées chiffrées sur le téléphone et partiront dès le retour du réseau.',
                )
              : const SizedBox.shrink(),
        ),
        StatGrid(
          children: [
            StatTile(label: 'En attente', value: '${pending.length}', icon: Icons.cloud_upload_outlined, tone: pending.isEmpty ? Tone.success : Tone.warning),
            StatTile(
              label: 'À arbitrer',
              value: '${conflicts.length + rejected.length}',
              icon: Icons.sync_problem,
              tone: conflicts.length + rejected.length == 0 ? Tone.success : Tone.danger,
            ),
          ],
        ),
        FilledButton.icon(
          onPressed: queue.syncing
              ? null
              : () async {
                  final r = await queue.sync();
                  if (!context.mounted) return;
                  context.toast(
                    r.offline
                        ? 'Toujours hors ligne : nouvel essai automatique.'
                        : (r.applied > 0 ? '${r.applied} opération(s) envoyée(s)' : 'Tout est à jour'),
                    success: !r.offline,
                  );
                },
          icon: const Icon(Icons.sync),
          label: const Text('Synchroniser maintenant'),
        ),
        if (conflicts.isNotEmpty) ...[
          const GroupTitle('Conflits'),
          for (final op in conflicts) _ConflictCard(op: op),
        ],
        if (rejected.isNotEmpty) ...[
          const GroupTitle('Refusées par le serveur'),
          for (final op in rejected)
            Card(
              child: ListTile(
                leading: const Icon(Icons.block, color: GlobusColors.danger),
                title: Text(op.label),
                subtitle: Text('${op.error ?? 'Refusé'}\nsaisi le ${dateTime(op.createdAt.toUtc())}'),
                isThreeLine: true,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Renvoyer',
                      icon: const Icon(Icons.refresh),
                      onPressed: () async {
                        final report = await queue.retry(op);
                        if (context.mounted) {
                          context.toast(
                            report.rejected > 0 ? 'Toujours refusé : ${op.error ?? 'voir le motif'}' : 'Saisie renvoyée',
                            error: report.rejected > 0,
                            success: report.rejected == 0,
                          );
                        }
                      },
                    ),
                    IconButton(
                      tooltip: 'Abandonner',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        if (await confirmDialog(context, title: 'Abandonner cette saisie ?', message: op.label, confirm: 'Abandonner', danger: true)) {
                          await queue.discard(op);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
        ],
        if (pending.isNotEmpty) ...[
          const GroupTitle('En attente d\'envoi'),
          for (final op in pending)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(op.kind == 'upload' ? Icons.attach_file : Icons.edit_note, color: GlobusColors.warning),
              title: Text(op.label),
              subtitle: Text(
                'saisi le ${dateTime(op.createdAt.toUtc())}${op.attempts > 0 ? ' · ${op.attempts} essai(s)${op.error != null ? ' · ${op.error}' : ''}' : ''}',
              ),
            ),
        ],
        if (queue.items.isEmpty) const EmptyView(icon: Icons.cloud_done_outlined, title: 'Tout est synchronisé'),
        const FootNote('Chaque opération porte un identifiant unique : un renvoi après coupure ne crée jamais de doublon.'),
      ],
    );
  }
}

class _ConflictCard extends StatelessWidget {
  const _ConflictCard({required this.op});
  final PendingOp op;

  @override
  Widget build(BuildContext context) {
    final c = J.of(op.conflict);
    final fields = c.strings('fields');
    final server = c.obj('server_data');
    final mine = J.of(op.payload);
    final queue = context.read<OfflineQueue>();
    Future<void> resolve(String resolution, [Map<String, dynamic>? merged]) => runAction(
      context,
      () => queue.resolve(op, resolution, merged: merged),
      success: resolution == 'server_wins' ? 'Version du bureau conservée' : 'Conflit résolu',
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(op.label, style: const TextStyle(fontWeight: FontWeight.w600)),
            Text(
              'Modifié au bureau pendant que vous étiez hors ligne (saisi le ${dateTime(op.createdAt.toUtc())}).',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            for (final f in fields)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(fieldLabel(f), style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text('Bureau : ${_show(server[f])}'),
                    Text('Moi : ${_show(mine[f])}', style: const TextStyle(color: GlobusColors.primary)),
                  ],
                ),
              ),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                OutlinedButton(onPressed: () => resolve('server_wins'), child: const Text('Garder le bureau')),
                FilledButton(onPressed: () => resolve('client_wins'), child: const Text('Garder ma version')),
                if (fields.length > 1)
                  TextButton(
                    onPressed: () async {
                      final merged = await showModalBottomSheet<Map<String, dynamic>>(
                        context: context,
                        isScrollControlled: true,
                        builder: (_) => _MergeSheet(fields: fields, server: server, mine: mine),
                      );
                      if (merged != null) await resolve('merged', merged);
                    },
                    child: const Text('Fusionner'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _show(Object? v) => switch (v) {
  null || '' => '—',
  final num n => number(n, 2),
  final bool b => b ? 'oui' : 'non',
  _ => '$v',
};

/// Fusion champ par champ : pour chaque champ en conflit, choisir la valeur du bureau ou la mienne.
class _MergeSheet extends StatefulWidget {
  const _MergeSheet({required this.fields, required this.server, required this.mine});
  final List<String> fields;
  final J server;
  final J mine;
  @override
  State<_MergeSheet> createState() => _MergeSheetState();
}

class _MergeSheetState extends State<_MergeSheet> {
  late final Map<String, bool> _useMine = {for (final f in widget.fields) f: true};

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.all(16),
        children: [
          Text('Fusionner', style: Theme.of(context).textTheme.titleLarge),
          for (final f in widget.fields) ...[
            const SizedBox(height: 8),
            Text(fieldLabel(f), style: const TextStyle(fontWeight: FontWeight.w600)),
            RadioGroup<bool>(
              groupValue: _useMine[f],
              onChanged: (v) => setState(() => _useMine[f] = v ?? true),
              child: Column(
                children: [
                  RadioListTile<bool>(dense: true, value: false, title: Text('Bureau : ${_show(widget.server[f])}')),
                  RadioListTile<bool>(dense: true, value: true, title: Text('Moi : ${_show(widget.mine[f])}')),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => Navigator.pop(context, {
              for (final f in widget.fields) f: _useMine[f]! ? widget.mine[f] : widget.server[f],
            }),
            child: const Text('Appliquer la fusion'),
          ),
        ],
      ),
    );
  }
}
