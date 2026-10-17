import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../context.dart';

/// Téléchargement contrôlé d'un document de l'API puis ouverture avec l'application adaptée (PDF, image, tableur…).
Future<void> openRemoteFile(BuildContext context, String path, {String? filename, Map<String, dynamic>? query}) async {
  final api = context.api;
  final progress = ValueNotifier<double?>(null);
  var closed = false;
  unawaited(
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        content: ValueListenableBuilder<double?>(
          valueListenable: progress,
          builder: (_, value, _) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LinearProgressIndicator(value: value),
              const SizedBox(height: 12),
              Text(value == null ? 'Téléchargement…' : 'Téléchargement… ${(value * 100).round()} %'),
            ],
          ),
        ),
      ),
    ).whenComplete(() => closed = true),
  );
  try {
    if (kIsWeb) {
      await launchUrl(Uri.parse(api.url(path)));
      return;
    }
    final file = await api.download(
      path,
      filename: filename,
      query: query,
      onProgress: (r, t) {
        if (t > 0) progress.value = r / t;
      },
    );
    if (context.mounted && !closed) Navigator.of(context, rootNavigator: true).pop();
    closed = true;
    final result = await OpenFilex.open(file.path);
    if (result.type != ResultType.done && context.mounted) {
      context.toast(
        result.type == ResultType.noAppToOpen
            ? 'Aucune application installée pour ouvrir ce fichier (${file.path.split('.').last.toUpperCase()}).'
            : 'Ouverture impossible : ${result.message}',
        error: true,
      );
    }
  } catch (e) {
    if (context.mounted && !closed) Navigator.of(context, rootNavigator: true).pop();
    if (context.mounted) context.toastError(e);
  }
}

/// Ouvre une adresse externe (paiement, partage, site) dans le navigateur du téléphone.
Future<void> openExternal(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) context.toast("Impossible d'ouvrir le lien.", error: true);
}

enum PickSource { camera, gallery, files, video }

/// Choix de fichiers à joindre : appareil photo, galerie, fichiers du téléphone.
Future<List<UploadFile>> pickAttachments(
  BuildContext context, {
  bool imagesOnly = false,
  bool allowVideo = false,
  bool multiple = true,
  String field = 'file',
}) async {
  final source = await showModalBottomSheet<PickSource>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!kIsWeb)
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Prendre une photo'),
              onTap: () => Navigator.pop(ctx, PickSource.camera),
            ),
          if (!kIsWeb && allowVideo)
            ListTile(leading: const Icon(Icons.videocam_outlined), title: const Text('Filmer une vidéo'), onTap: () => Navigator.pop(ctx, PickSource.video)),
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Galerie'), onTap: () => Navigator.pop(ctx, PickSource.gallery)),
          if (!imagesOnly) ListTile(leading: const Icon(Icons.attach_file), title: const Text('Fichiers'), onTap: () => Navigator.pop(ctx, PickSource.files)),
        ],
      ),
    ),
  );
  if (source == null) return const [];
  final picker = ImagePicker();
  switch (source) {
    case PickSource.camera:
      final x = await picker.pickImage(source: ImageSource.camera, imageQuality: 85, maxWidth: 2560);
      return x == null ? const [] : [await _fromXFile(x, field)];
    case PickSource.video:
      final x = await picker.pickVideo(source: ImageSource.camera, maxDuration: const Duration(minutes: 3));
      return x == null ? const [] : [await _fromXFile(x, field)];
    case PickSource.gallery:
      if (allowVideo) {
        final list = multiple ? await picker.pickMultipleMedia(imageQuality: 85) : [?await picker.pickMedia(imageQuality: 85)];
        return [for (final x in list) await _fromXFile(x, field)];
      }
      final list = multiple
          ? await picker.pickMultiImage(imageQuality: 85, maxWidth: 2560)
          : [?await picker.pickImage(source: ImageSource.gallery, imageQuality: 85)];
      return [for (final x in list) await _fromXFile(x, field)];
    case PickSource.files:
      final files = await FilePicker.pickFiles(type: imagesOnly ? FileType.image : FileType.any);
      final out = <UploadFile>[];
      for (final f in multiple ? files : files.take(1)) {
        out.add(
          f.path != null && !kIsWeb
              ? UploadFile(name: f.name, path: f.path, field: field)
              : UploadFile(name: f.name, bytes: await f.readAsBytes(), field: field),
        );
      }
      return out;
  }
}

Future<UploadFile> _fromXFile(XFile x, String field) async {
  if (kIsWeb) return UploadFile(name: x.name, bytes: await x.readAsBytes(), field: field, contentType: x.mimeType);
  return UploadFile(name: x.name, path: x.path, field: field, contentType: x.mimeType);
}
