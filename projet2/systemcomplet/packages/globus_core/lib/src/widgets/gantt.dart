import 'package:flutter/material.dart';

import '../api/json.dart';
import '../format/format.dart';
import '../format/labels.dart';
import '../theme/globus_theme.dart';

/// Ligne de Gantt (tâche ou jalon).
class GanttTask {
  const GanttTask({required this.id, required this.name, this.start, this.end, this.progress = 0, this.status, this.milestone = false});
  final String id;
  final String name;
  final DateTime? start;
  final DateTime? end;
  final double progress;
  final String? status;
  final bool milestone;
}

/// Diagramme de Gantt tactile : colonne des libellés fixe, frise défilante (zoom semaine / mois / trimestre),
/// avancement dans les barres, jalons en losange, repère « aujourd'hui ».
class GanttChart extends StatefulWidget {
  const GanttChart({super.key, required this.tasks, this.onSelect});
  final List<GanttTask> tasks;
  final void Function(GanttTask task)? onSelect;

  @override
  State<GanttChart> createState() => _GanttChartState();
}

class _GanttChartState extends State<GanttChart> {
  static const _zooms = {'Semaine': 28.0, 'Mois': 9.0, 'Trimestre': 3.0};
  String _zoom = 'Mois';
  static const _rowH = 34.0;
  static const _labelW = 130.0;

  @override
  Widget build(BuildContext context) {
    final tasks = widget.tasks;
    if (tasks.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: Text('Aucune tâche planifiée.', style: Theme.of(context).textTheme.bodySmall),
      );
    }
    final theme = Theme.of(context);
    final dayW = _zooms[_zoom]!;
    final dated = tasks.where((t) => t.start != null);
    final today = DateTime.now();
    var min = dated.isEmpty ? today : dated.map((t) => t.start!).reduce((a, b) => a.isBefore(b) ? a : b);
    var max = dated.isEmpty ? today : dated.map((t) => t.end ?? t.start!).reduce((a, b) => a.isAfter(b) ? a : b);
    if (today.isBefore(min)) min = today;
    if (today.isAfter(max)) max = today;
    min = DateTime(min.year, min.month, min.day).subtract(const Duration(days: 7));
    max = max.add(const Duration(days: 14));
    final days = max.difference(min).inDays.clamp(1, 3650);
    double x(DateTime d) => d.difference(min).inHours / 24 * dayW;
    final width = days * dayW;
    final months = <(String, double, double)>[];
    var cursor = DateTime(min.year, min.month);
    while (cursor.isBefore(max)) {
      final next = DateTime(cursor.year, cursor.month + 1);
      final left = x(cursor.isBefore(min) ? min : cursor);
      final right = x(next.isAfter(max) ? max : next);
      months.add(('${monthShort(cursor.month)} ${cursor.year % 100}', left, right - left));
      cursor = next;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: SegmentedButton<String>(
            showSelectedIcon: false,
            style: const ButtonStyle(visualDensity: VisualDensity.compact),
            segments: [
              for (final z in _zooms.keys)
                ButtonSegment(
                  value: z,
                  label: Text(z, style: const TextStyle(fontSize: 12)),
                ),
            ],
            selected: {_zoom},
            onSelectionChanged: (s) => setState(() => _zoom = s.first),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: _labelW,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 26),
                  for (final t in tasks)
                    InkWell(
                      onTap: widget.onSelect == null ? null : () => widget.onSelect!(t),
                      child: SizedBox(
                        height: _rowH,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            t.milestone ? '◆ ${t.name}' : t.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: width,
                  height: 26 + tasks.length * _rowH,
                  child: Stack(
                    children: [
                      for (final m in months)
                        Positioned(
                          left: m.$2,
                          top: 0,
                          width: m.$3,
                          height: 26 + tasks.length * _rowH,
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border(left: BorderSide(color: theme.colorScheme.outlineVariant)),
                            ),
                            padding: const EdgeInsets.only(left: 4, top: 4),
                            alignment: Alignment.topLeft,
                            child: Text(m.$1, style: theme.textTheme.bodySmall?.copyWith(fontSize: 10.5)),
                          ),
                        ),
                      Positioned(
                        left: x(today),
                        top: 20,
                        bottom: 0,
                        child: Container(width: 2, color: GlobusColors.accent.withValues(alpha: 0.7)),
                      ),
                      for (final (i, t) in tasks.indexed)
                        if (t.start != null)
                          t.milestone
                              ? Positioned(
                                  left: x(t.start!) - 8,
                                  top: 26 + i * _rowH + 9,
                                  child: Transform.rotate(
                                    angle: 0.785,
                                    child: Container(width: 14, height: 14, color: t.progress >= 100 ? GlobusColors.success : GlobusColors.warning),
                                  ),
                                )
                              : Positioned(
                                  left: x(t.start!),
                                  top: 26 + i * _rowH + 8,
                                  width: (x(t.end ?? t.start!) - x(t.start!)).clamp(6, width),
                                  height: _rowH - 16,
                                  child: Tooltip(
                                    message:
                                        '${t.name}\n${date(t.start!.toUtc())} → ${date((t.end ?? t.start!).toUtc())} · ${number(t.progress)} % · ${optionLabel(t.status)}',
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(5),
                                      child: Stack(
                                        children: [
                                          Container(color: GlobusColors.tone(statusTone(t.status)).withValues(alpha: 0.25)),
                                          FractionallySizedBox(
                                            widthFactor: (t.progress / 100).clamp(0, 1),
                                            child: Container(color: GlobusColors.tone(statusTone(t.status) == Tone.neutral ? Tone.info : statusTone(t.status))),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

GanttTask ganttTaskFrom(J t, {String nameKey = 'name'}) => GanttTask(
  id: t.s('id'),
  name: t.str(nameKey) ?? t.s('title'),
  start: t.date('start')?.toLocal() ?? t.date('start_planned')?.toLocal(),
  end: t.date('end')?.toLocal() ?? t.date('end_planned')?.toLocal(),
  progress: t.d('progress_pct'),
  status: t.str('status'),
);
