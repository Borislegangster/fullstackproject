import 'dart:async';

import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:video_player/video_player.dart';

import '../context.dart';
import '../theme/globus_theme.dart';

/// Image servie par l'API (en-têtes d'authentification), avec états de chargement et d'erreur.
class AuthImage extends StatelessWidget {
  const AuthImage(this.url, {super.key, this.fit = BoxFit.cover, this.width, this.height, this.semanticLabel});
  final String url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final api = context.api;
    return Image.network(
      api.url(url),
      headers: api.mediaHeaders,
      fit: fit,
      width: width,
      height: height,
      semanticLabel: semanticLabel,
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : Container(color: Theme.of(context).colorScheme.surfaceContainerHighest, width: width, height: height),
      errorBuilder: (context, _, _) => Container(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        width: width,
        height: height,
        alignment: Alignment.center,
        child: Icon(Icons.broken_image_outlined, color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    );
  }
}

/// Élément de galerie (photo ou vidéo) avec légende.
class GalleryItem {
  const GalleryItem({required this.url, this.caption, this.isVideo = false, this.subtitle});
  final String url;
  final String? caption;
  final String? subtitle;
  final bool isVideo;
}

/// Visionneuse plein écran (zoom, balayage) des photos et vidéos du chantier.
class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key, required this.items, this.initial = 0});
  final List<GalleryItem> items;
  final int initial;

  static Future<void> open(BuildContext context, List<GalleryItem> items, [int initial = 0]) {
    return Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => GalleryScreen(items: items, initial: initial),
      ),
    );
  }

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  late final PageController _pc = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final api = context.api;
    final item = widget.items[_index];
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_index + 1} / ${widget.items.length}', style: const TextStyle(color: Colors.white)),
      ),
      body: Stack(
        children: [
          PhotoViewGallery.builder(
            pageController: _pc,
            itemCount: widget.items.length,
            onPageChanged: (i) => setState(() => _index = i),
            builder: (context, i) {
              final it = widget.items[i];
              if (it.isVideo) {
                return PhotoViewGalleryPageOptions.customChild(
                  disableGestures: true,
                  child: VideoView(url: it.url),
                );
              }
              return PhotoViewGalleryPageOptions(
                imageProvider: NetworkImage(api.url(it.url), headers: api.mediaHeaders),
                minScale: PhotoViewComputedScale.contained,
                maxScale: PhotoViewComputedScale.covered * 4,
                heroAttributes: PhotoViewHeroAttributes(tag: it.url),
              );
            },
          ),
          if (item.caption != null || item.subtitle != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 28),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [Colors.transparent, Colors.black87], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.caption != null)
                      Text(
                        item.caption!,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    if (item.subtitle != null) Text(item.subtitle!, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Lecteur vidéo (ressource protégée de l'API ou URL publique).
class VideoView extends StatefulWidget {
  const VideoView({super.key, required this.url, this.autoplay = false});
  final String url;
  final bool autoplay;

  @override
  State<VideoView> createState() => _VideoViewState();
}

class _VideoViewState extends State<VideoView> {
  VideoPlayerController? _c;
  Object? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c != null) return;
    final api = context.api;
    final c = VideoPlayerController.networkUrl(Uri.parse(api.url(widget.url)), httpHeaders: api.mediaHeaders);
    _c = c;
    c
        .initialize()
        .then((_) {
          if (!mounted) return;
          setState(() {});
          if (widget.autoplay) unawaited(c.play());
        })
        .catchError((Object e) {
          if (mounted) setState(() => _error = e);
        });
    c.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    unawaited(_c?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c!;
    if (_error != null) {
      return const Center(
        child: Text('Vidéo illisible sur cet appareil.', style: TextStyle(color: Colors.white70)),
      );
    }
    if (!c.value.isInitialized) return const Center(child: CircularProgressIndicator());
    return Center(
      child: AspectRatio(
        aspectRatio: c.value.aspectRatio == 0 ? 16 / 9 : c.value.aspectRatio,
        child: Stack(
          alignment: Alignment.bottomCenter,
          children: [
            VideoPlayer(c),
            GestureDetector(
              onTap: () => c.value.isPlaying ? c.pause() : c.play(),
              child: AnimatedOpacity(
                opacity: c.value.isPlaying ? 0 : 1,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  color: Colors.black26,
                  alignment: Alignment.center,
                  child: const Icon(Icons.play_circle_fill, size: 64, color: Colors.white),
                ),
              ),
            ),
            VideoProgressIndicator(c, allowScrubbing: true, colors: const VideoProgressColors(playedColor: GlobusColors.accent)),
          ],
        ),
      ),
    );
  }
}

/// Vignette carrée cliquable (photo ou vidéo).
class MediaThumb extends StatelessWidget {
  const MediaThumb({super.key, required this.url, this.isVideo = false, this.caption, this.onTap});
  final String url;
  final bool isVideo;
  final String? caption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Material(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (isVideo)
                const ColoredBox(
                  color: GlobusTokens.brand900,
                  child: Icon(Icons.play_circle_outline, color: Colors.white, size: 36),
                )
              else
                Hero(
                  tag: url,
                  child: AuthImage(url, semanticLabel: caption ?? 'Photo du chantier'),
                ),
              if (caption != null)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(6, 10, 6, 4),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(colors: [Colors.transparent, Colors.black54], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                    ),
                    child: Text(
                      caption!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
