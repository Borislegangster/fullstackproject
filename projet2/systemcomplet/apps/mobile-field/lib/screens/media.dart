import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:globus_core/globus_core.dart';
import 'package:provider/provider.dart';

import '../field_state.dart';

const mediaStages = [('before', 'Avant'), ('during', 'Pendant'), ('after', 'Après'), ('incident', 'Incident'), ('delivery', 'Livraison')];

/// Prise de photos / vidéos du chantier : envoi immédiat ou mise en file (hors ligne), géolocalisées et horodatées.
Future<void> captureSiteMedia(
  BuildContext context, {
  required String projectId,
  String? taskId,
  String? zoneId,
  String? dailyLogId,
  String stage = 'during',
  String? label,
}) async {
  final files = await pickAttachments(context, imagesOnly: false, allowVideo: true);
  if (files.isEmpty || !context.mounted) return;
  final options = await showModalBottomSheet<(String, String, bool)>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _MediaOptionsSheet(stage: stage, count: files.length),
  );
  if (options == null || !context.mounted) return;
  final position = await currentPosition(context);
  if (!context.mounted) return;
  final queue = context.read<OfflineQueue>();
  for (final f in files) {
    if (kIsWeb || f.path == null) {
      if (!context.mounted) return;
      await runAction(context, () => context.api.upload('/projects/$projectId/media', files: [f]));
      continue;
    }
    await queue.enqueueUpload(
      label: 'Photo « ${options.$2.isEmpty ? (label ?? f.name) : options.$2} »',
      path: '/projects/$projectId/media',
      sourceFile: f.path!,
      fileName: f.name,
      fields: {
        'stage': options.$1,
        'caption': options.$2.isEmpty ? null : options.$2,
        'task_id': taskId,
        'zone_id': zoneId,
        'daily_log_id': dailyLogId,
        'taken_at': DateTime.now().toUtc().toIso8601String(),
        'latitude': position?.latitude,
        'longitude': position?.longitude,
        'publish': options.$3,
      },
    );
  }
  final report = await queue.sync();
  if (context.mounted) {
    context.toast(
      report.offline ? '${files.length} média(s) enregistré(s) sur le téléphone : envoi au retour du réseau.' : '${files.length} média(s) envoyé(s)',
      success: !report.offline,
    );
  }
}

class _MediaOptionsSheet extends StatefulWidget {
  const _MediaOptionsSheet({required this.stage, required this.count});
  final String stage;
  final int count;
  @override
  State<_MediaOptionsSheet> createState() => _MediaOptionsSheetState();
}

class _MediaOptionsSheetState extends State<_MediaOptionsSheet> {
  late String _stage = widget.stage;
  final _caption = TextEditingController();
  bool _publish = false;

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canPublish = context.can('projects:publish_client');
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.count} média(s) à envoyer', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            children: [
              for (final s in mediaStages) ChoiceChip(label: Text(s.$2), selected: _stage == s.$1, onSelected: (_) => setState(() => _stage = s.$1)),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _caption,
            maxLength: 300,
            decoration: const InputDecoration(labelText: 'Légende (facultatif)'),
          ),
          if (canPublish)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _publish,
              onChanged: (v) => setState(() => _publish = v),
              title: const Text('Publier au client'),
              subtitle: const Text('Visible dans son espace (chantier, tableau de bord).'),
            ),
          const SizedBox(height: 8),
          FilledButton(onPressed: () => Navigator.pop(context, (_stage, _caption.text.trim(), _publish)), child: const Text('Envoyer')),
        ],
      ),
    );
  }
}

/// Bande de photos d'une tâche / d'une zone (galerie plein écran).
class SiteMediaStrip extends StatelessWidget {
  const SiteMediaStrip({super.key, required this.projectId, this.taskId, this.zoneId});
  final String projectId;
  final String? taskId;
  final String? zoneId;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/projects/$projectId/media',
      query: {'task_id': taskId, 'zone_id': zoneId, 'page_size': 30},
      refreshable: false,
      loading: const LinearProgressIndicator(),
      builder: (context, data, _) {
        final media = listOf(data);
        if (media.isEmpty) return Text('Aucune photo pour le moment.', style: Theme.of(context).textTheme.bodySmall);
        final gallery = [for (final m in media) _item(m)];
        return SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: media.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) => SizedBox(
              width: 96,
              child: MediaThumb(
                url: _url(media[i]),
                isVideo: media[i].s('media_type') == 'video',
                caption: optionLabel(media[i].s('stage')),
                onTap: () => GalleryScreen.open(context, gallery, i),
              ),
            ),
          ),
        );
      },
    );
  }
}

String _url(J m) => m.obj('file').str('url') ?? '/site-media/${m.s('id')}/file';

GalleryItem _item(J m) => GalleryItem(
  url: _url(m),
  isVideo: m.s('media_type') == 'video',
  caption: m.str('caption') ?? optionLabel(m.s('stage')),
  subtitle: [dateTime(m['taken_at'] ?? m['created_at']), if (m.b('published_to_client')) 'publiée au client'].join(' · '),
);

/// Photos et vidéos du chantier : journal visuel par étape, ajout (hors ligne), publication au client.
class PhotosScreen extends StatefulWidget {
  const PhotosScreen({super.key});
  @override
  State<PhotosScreen> createState() => _PhotosScreenState();
}

class _PhotosScreenState extends State<PhotosScreen> {
  String? _stage;
  final _list = PagedListController();

  @override
  Widget build(BuildContext context) {
    return WithSite(
      builder: (context, project) {
        final id = project.s('id');
        return Scaffold(
          floatingActionButton: context.can('site:report')
              ? FloatingActionButton.extended(
                  heroTag: 'photo-new',
                  onPressed: () async {
                    await captureSiteMedia(context, projectId: id, stage: _stage ?? 'during');
                    unawaited(_list.reload());
                  },
                  icon: const Icon(Icons.add_a_photo_outlined),
                  label: const Text('Photo / vidéo'),
                )
              : null,
          body: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                child: Row(
                  children: [
                    ChoiceChip(label: const Text('Toutes'), selected: _stage == null, onSelected: (_) => setState(() => _stage = null)),
                    for (final s in mediaStages)
                      Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: ChoiceChip(label: Text(s.$2), selected: _stage == s.$1, onSelected: (_) => setState(() => _stage = s.$1)),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: PagedListView(
                  path: '/projects/$id/media',
                  controller: _list,
                  pageSize: 30,
                  separated: false,
                  query: {'stage': _stage},
                  empty: const EmptyView(
                    icon: Icons.photo_library_outlined,
                    title: 'Aucune photo',
                    text: 'Les photos et vidéos du chantier, datées et géolocalisées, apparaissent ici.',
                  ),
                  itemBuilder: (context, m, i) => ListTile(
                    leading: SizedBox(
                      width: 64,
                      height: 64,
                      child: MediaThumb(url: _url(m), isVideo: m.s('media_type') == 'video', onTap: () => GalleryScreen.open(context, [_item(m)])),
                    ),
                    title: Text(m.str('caption') ?? optionLabel(m.s('stage'))),
                    subtitle: Text(_item(m).subtitle ?? ''),
                    trailing: m.b('published_to_client') ? const Icon(Icons.visibility_outlined, color: GlobusColors.success) : null,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
