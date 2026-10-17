import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../api/json.dart';
import '../../format/format.dart';
import '../../format/labels.dart';
import '../../theme/globus_theme.dart';
import '../../widgets/api_view.dart';
import '../../widgets/media.dart';
import '../../widgets/primitives.dart';

/// Frise des jalons (atteints, à venir, en retard) — miroir de components/client/milestones.tsx.
class MilestoneTimeline extends StatelessWidget {
  const MilestoneTimeline({super.key, required this.items});
  final List<J> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return Text('Aucun jalon publié.', style: Theme.of(context).textTheme.bodySmall);
    final today = isoDate(DateTime.now());
    final theme = Theme.of(context);
    return Column(
      children: [
        for (final (i, m) in items.indexed)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 28,
                  child: Column(
                    children: [
                      Builder(
                        builder: (_) {
                          final done = m.s('status') == 'achieved' || m.has('achieved_at');
                          final late = !done && m.s('due_date').compareTo(today) < 0;
                          return Icon(
                            done ? Icons.check_circle : (late ? Icons.schedule : Icons.radio_button_unchecked),
                            size: 22,
                            color: done ? GlobusColors.success : (late ? GlobusColors.danger : GlobusTokens.brand400),
                          );
                        },
                      ),
                      if (i < items.length - 1) Expanded(child: Container(width: 2, color: GlobusTokens.brand100)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Builder(
                      builder: (_) {
                        final done = m.s('status') == 'achieved' || m.has('achieved_at');
                        final late = !done && m.s('due_date').compareTo(today) < 0;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.s('name'), style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(
                              '${done ? 'Atteint le ${date(m['achieved_at'] ?? m['due_date'])}' : 'Prévu le ${date(m['due_date'])}'}${late ? ' · en retard' : ''} · ${optionLabel(m.s('status'))}',
                              style: theme.textTheme.bodySmall?.copyWith(color: late ? GlobusColors.danger : null),
                            ),
                            if (m.has('payment_pct')) Text('Appel de fonds : ${percent(m['payment_pct'])}', style: theme.textTheme.bodySmall),
                            if (m.has('description'))
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(m.s('description'), style: theme.textTheme.bodySmall),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

const _levels = <String, (String, Color, Tone)>{
  'excellent': ('Excellent', GlobusTokens.success, Tone.success),
  'bon': ('Bon', GlobusTokens.brand500, Tone.info),
  'vigilance': ('Vigilance', GlobusTokens.accent500, Tone.accent),
  'critique': ('Critique', GlobusTokens.danger, Tone.danger),
  'indisponible': ('En cours de calcul', Color(0xFF94A3B8), Tone.info),
};

String trustLevelOf(double? score) {
  if (score == null) return 'indisponible';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'bon';
  if (score >= 50) return 'vigilance';
  return 'critique';
}

/// Jauge semi-circulaire de l'indice de confiance (0 → 100).
class TrustGauge extends StatelessWidget {
  const TrustGauge({super.key, required this.score, required this.level, this.width = 220});
  final double? score;
  final String level;
  final double width;

  @override
  Widget build(BuildContext context) {
    final l = _levels[level] ?? _levels['indisponible']!;
    return Semantics(
      label: 'Indice de confiance ${score == null ? 'indisponible' : score!.round()} sur 100',
      child: SizedBox(
        width: width,
        height: width * 0.6,
        child: CustomPaint(
          painter: _GaugePainter(score: score, color: l.$2),
          child: Align(
            alignment: const Alignment(0, 0.55),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  score == null ? '—' : '${score!.round()}',
                  style: TextStyle(fontFamily: GlobusFonts.title, fontSize: width * 0.17, fontWeight: FontWeight.w800, height: 1),
                ),
                Text(
                  l.$1,
                  style: TextStyle(color: l.$2, fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.score, required this.color});
  final double? score;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.075;
    final r = size.width / 2 - stroke;
    final center = Offset(size.width / 2, size.height - stroke / 2 - 4);
    final rect = Rect.fromCircle(center: center, radius: r);
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..shader = LinearGradient(
        colors: [
          GlobusTokens.danger.withValues(alpha: 0.18),
          GlobusTokens.accent500.withValues(alpha: 0.18),
          GlobusTokens.success.withValues(alpha: 0.18),
        ],
      ).createShader(rect);
    canvas.drawArc(rect, math.pi, math.pi, false, track);
    final value = ((score ?? 0).clamp(0, 100)) / 100;
    if (score != null) {
      final arc = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color;
      canvas.drawArc(rect, math.pi, math.pi * value, false, arc);
    }
    final angle = math.pi * (1 + value);
    final knob = center + Offset(r * math.cos(angle), r * math.sin(angle));
    canvas.drawCircle(knob, stroke * 0.45, Paint()..color = Colors.white);
    canvas.drawCircle(
      knob,
      stroke * 0.45,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4,
    );
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.score != score || old.color != color;
}

class _Sparkline extends CustomPainter {
  _Sparkline(this.points);
  final List<double> points;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final step = size.width / (points.length - 1);
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final p = Offset(i * step, size.height - (points[i] / 100) * size.height);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()..color = GlobusTokens.brand500.withValues(alpha: 0.08));
    canvas.drawPath(
      path,
      Paint()
        ..color = GlobusTokens.brand500
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(_Sparkline old) => old.points != points;
}

/// Indice de confiance d'un chantier (`/client/projects/{id}/trust` ou `/projects/{id}/trust`).
class TrustCard extends StatelessWidget {
  const TrustCard({super.key, required this.path, this.internal = false});
  final String path;
  final bool internal;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: path,
      refreshable: false,
      loading: const SizedBox(height: 180, child: Center(child: CircularProgressIndicator())),
      builder: (context, data, _) {
        final d = J.of(data);
        final score = d.numOrNull('score')?.toDouble();
        final level = d.str('level') ?? trustLevelOf(score);
        final trend = d.numOrNull('trend_7d')?.toDouble();
        final history = d.list('history').map((h) => h.d('score')).toList();
        final theme = Theme.of(context);
        return SectionCard(
          icon: Icons.speed,
          title: 'Indice de confiance',
          subtitle: 'Calculé le ${date(d['as_of'])} à partir des données réelles du chantier',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: TrustGauge(score: score, level: level),
              ),
              if (trend != null)
                Center(
                  child: ToneBadge(
                    '${trend >= 0 ? '+' : ''}${number(trend, 1)} pt sur 7 jours',
                    tone: trend >= 0 ? Tone.success : Tone.danger,
                    icon: trend >= 0 ? Icons.trending_up : Icons.trending_down,
                  ),
                ),
              if (history.length > 1) ...[
                const SizedBox(height: 10),
                SizedBox(height: 44, child: CustomPaint(painter: _Sparkline(history))),
                Center(child: Text('Évolution sur ${history.length} relevés', style: theme.textTheme.bodySmall?.copyWith(fontSize: 11))),
              ],
              const SizedBox(height: 12),
              for (final c in d.list('components')) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          text: c.s('label'),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          children: [
                            TextSpan(text: ' (${c.i('weight')} %)', style: theme.textTheme.bodySmall),
                          ],
                        ),
                      ),
                    ),
                    Text(c.numOrNull('score') == null ? '—' : '${c.d('score').round()}/100', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 6),
                GProgress(
                  value: c.d('score'),
                  tone: c.numOrNull('score') == null ? Tone.info : (_levels[trustLevelOf(c.d('score'))]?.$3 ?? Tone.info),
                ),
                const SizedBox(height: 4),
                if (c.strings('facts').isEmpty)
                  Text('Pas encore assez de données pour ce critère.', style: theme.textTheme.bodySmall)
                else
                  for (final f in c.strings('facts')) Text('• $f', style: theme.textTheme.bodySmall),
                if (internal && c.obj('details').raw.isNotEmpty)
                  Text(
                    c.obj('details').raw.entries.map((e) => '${e.key}=${e.value is num ? number(e.value, 2) : e.value}').join(' · '),
                    style: theme.textTheme.bodySmall?.copyWith(fontFamily: 'monospace', fontSize: 10.5),
                  ),
                const SizedBox(height: 12),
              ],
              FootNote('Méthode publique : ${d.strings('method').join(' · ')}. Un critère sans donnée n\'est pas compté.'),
            ],
          ),
        );
      },
    );
  }
}

/// Time-lapses hebdomadaires (R2) — client : `/client/projects/{id}/timelapses` ; équipe : `/projects/{id}/timelapses`.
class TimelapseGallery extends StatefulWidget {
  const TimelapseGallery({super.key, required this.path, required this.emptyText});
  final String path;
  final String emptyText;

  @override
  State<TimelapseGallery> createState() => _TimelapseGalleryState();
}

class _TimelapseGalleryState extends State<TimelapseGallery> {
  int _current = 0;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: widget.path,
      refreshable: false,
      loading: const SizedBox(height: 120, child: Center(child: CircularProgressIndicator())),
      builder: (context, data, _) {
        final items = listOf(data).where((t) => t.s('status') == 'ready' && t.has('video_url')).toList();
        if (items.isEmpty) {
          return SectionCard(
            icon: Icons.movie_outlined,
            title: 'Pas encore de time-lapse',
            child: Text(widget.emptyText, style: Theme.of(context).textTheme.bodySmall),
          );
        }
        final t = items[_current.clamp(0, items.length - 1)];
        return SectionCard(
          icon: Icons.movie_outlined,
          title: 'Votre chantier en vidéo',
          subtitle: 'Semaine du ${date(t['period_start'])} au ${date(t['period_end'])} · ${t.i('frames')} images · ${number(t['duration_s'])} s',
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: ColoredBox(
                  color: Colors.black,
                  child: VideoView(key: ValueKey(t.s('id')), url: t.s('video_url')),
                ),
              ),
              if (items.length > 1)
                SizedBox(
                  height: 86,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.all(10),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final x = items[i];
                      return InkWell(
                        onTap: () => setState(() => _current = i),
                        child: Container(
                          width: 96,
                          decoration: BoxDecoration(
                            border: Border.all(color: i == _current ? GlobusColors.accent : Colors.transparent, width: 2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            children: [
                              Expanded(child: x.has('poster_url') ? AuthImage(x.s('poster_url'), width: 96) : Container(color: GlobusTokens.line)),
                              Text(date(x['period_start']), style: const TextStyle(fontSize: 10)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Barre double : prévu (repère) et mesuré par l'image.
class PlannedVsObserved extends StatelessWidget {
  const PlannedVsObserved({super.key, required this.planned, required this.observed});
  final double planned;
  final double? observed;

  @override
  Widget build(BuildContext context) {
    final late = observed != null && observed! + 10 < planned;
    return LayoutBuilder(
      builder: (context, box) {
        return SizedBox(
          height: 10,
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(999)),
              ),
              if (observed != null)
                Container(
                  width: box.maxWidth * (observed!.clamp(0, 100) / 100),
                  decoration: BoxDecoration(color: late ? GlobusColors.warning : GlobusColors.success, borderRadius: BorderRadius.circular(999)),
                ),
              Positioned(
                left: box.maxWidth * (planned.clamp(0, 99.5) / 100),
                top: 0,
                bottom: 0,
                child: Container(width: 2, color: GlobusTokens.brand800),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Jumeau numérique (I1) côté client : dernières mesures d'avancement validées et certifiées.
class ClientTwinCard extends StatelessWidget {
  const ClientTwinCard({super.key, required this.projectId, this.onProof});
  final String projectId;
  final void Function(String proofCode)? onProof;

  @override
  Widget build(BuildContext context) {
    return ApiView(
      path: '/client/projects/$projectId/twin',
      refreshable: false,
      loading: const SizedBox.shrink(),
      builder: (context, data, _) {
        final rows = listOf(data);
        if (rows.isEmpty) return const SizedBox.shrink();
        final latest = rows.first;
        return SectionCard(
          icon: Icons.document_scanner_outlined,
          title: "Avancement mesuré par l'image",
          subtitle: 'Mesure du ${dateLong(latest['observed_on'])} : photos du chantier confrontées au planning, puis validées par votre chef de projet.',
          trailing: latest.has('proof_code') && onProof != null
              ? TextButton.icon(
                  onPressed: () => onProof!(latest.s('proof_code')),
                  icon: const Icon(Icons.verified_user_outlined, size: 18),
                  label: const Text('Certifiée'),
                )
              : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (latest.has('overall_observed_pct'))
                Text.rich(
                  TextSpan(
                    text: 'Avancement observé global : ',
                    children: [
                      TextSpan(
                        text: '${number(latest['overall_observed_pct'])} %',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: GlobusTokens.brand700),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              for (final r in latest.list('results')) ...[
                Row(
                  children: [
                    Expanded(child: Text(r.s('title'), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    Text(
                      '${r.numOrNull('observed_pct') == null ? 'non visible' : '${number(r['observed_pct'])} %'} · prévu ${number(r['planned_pct'])} %',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                PlannedVsObserved(planned: r.d('planned_pct'), observed: r.numOrNull('observed_pct')?.toDouble()),
                const SizedBox(height: 10),
              ],
              if (rows.length > 1)
                Text('${rows.length - 1} mesure(s) précédente(s) conservée(s) et certifiée(s).', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        );
      },
    );
  }
}
