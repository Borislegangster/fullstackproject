/**
 * CollaborationCanvas — SVG overlay that sits on top of the Forge viewer.
 *
 * Responsibilities:
 *   - Mirror every participant's cursor in real time (colored by role).
 *   - Render the active session annotations grouped by layer.
 *   - Capture drawing input (freehand path) when the user picks the pencil tool.
 *   - Throttle outgoing CURSOR_MOVE packets to ~20 Hz via useCollaboration.
 *
 * The overlay never blocks the underlying viewer's mouse interactions unless
 * the user is in "drawing" mode.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type {
  AnnotationItem,
  CollaborationApi,
  CursorState,
} from '../../hooks/useCollaboration';

export type DrawingTool = 'none' | 'pencil' | 'rectangle' | 'arrow';

export const LAYER_COLORS: Record<string, string> = {
  architecture: '#3b82f6',  // blue
  structure: '#f97316',     // orange
  electricite: '#fbbf24',   // yellow
  plomberie: '#06b6d4',     // cyan
  decisions: '#10b981',     // green
  general: '#6b7280',        // gray
};

interface Props {
  collab: CollaborationApi;
  /** Currently picked layer (the new annotations land in this layer). */
  activeLayer: string;
  /** Active drawing tool. 'none' = pointer mode (no overlay capture). */
  tool: DrawingTool;
  /** Layers currently visible (toggle in toolbar). */
  visibleLayers: Set<string>;
  /** Optional callback when the user is in PRESENTER mode and is *not* the presenter. */
  onPresenterLocked?: () => void;
}

interface DraftPath {
  points: { x: number; y: number }[];
}

export function CollaborationCanvas({
  collab,
  activeLayer,
  tool,
  visibleLayers,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<DraftPath | null>(null);

  // Compute SVG-relative (normalised 0..1) coordinates from a pointer event.
  const toLocal = useCallback((evt: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) / rect.width,
      y: (evt.clientY - rect.top) / rect.height,
    };
  }, []);

  // Cursor broadcast — always on
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const { x, y } = toLocal(e);
    collab.sendCursor(x, y);

    if (tool !== 'none' && draft) {
      setDraft({ points: [...draft.points, { x, y }] });
    }
  }, [collab, toLocal, tool, draft]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (tool === 'none') return;
    const { x, y } = toLocal(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // Optimistic lock hint — tell peers we're about to annotate here.
    collab.sendIntent(activeLayer, x, y);
    setDraft({ points: [{ x, y }] });
  }, [tool, toLocal, collab, activeLayer]);

  // Non-blocking conflict: a peer is annotating the SAME layer near our start point.
  const conflict = useMemo(() => {
    if (!draft || draft.points.length === 0) return null;
    const p0 = draft.points[0];
    for (const it of Object.values(collab.intents)) {
      if (it.layer !== activeLayer) continue;
      if (Math.hypot(it.x - p0.x, it.y - p0.y) < 0.08) return it;
    }
    return null;
  }, [draft, collab.intents, activeLayer]);

  const handlePointerUp = useCallback(() => {
    if (!draft || draft.points.length < 2) {
      setDraft(null);
      return;
    }
    collab.addAnnotation(activeLayer, {
      tool,
      points: draft.points,
      stroke: LAYER_COLORS[activeLayer] || LAYER_COLORS.general,
    });
    setDraft(null);
  }, [draft, collab, activeLayer, tool]);

  // Group annotations by layer (visible ones only)
  const visibleAnnotations = useMemo<AnnotationItem[]>(
    () => collab.annotations.filter((a) => visibleLayers.has(a.layer)),
    [collab.annotations, visibleLayers]
  );

  return (
    <>
    {conflict && (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
        ⚠ {conflict.sender_name} annote déjà cette zone ({conflict.layer})
      </div>
    )}
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{
        pointerEvents: tool === 'none' ? 'none' : 'auto',
        cursor: tool === 'none' ? 'default' : 'crosshair',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Annotations layer */}
      <g>
        {visibleAnnotations.map((ann) => (
          <AnnotationShape key={ann.id} annotation={ann} />
        ))}
      </g>

      {/* Draft in progress */}
      {draft && draft.points.length > 1 && (
        <polyline
          fill="none"
          stroke={LAYER_COLORS[activeLayer] || '#000'}
          strokeWidth={0.003}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={draft.points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
      )}

      {/* Draw-intent halos (optimistic lock hints) */}
      <g style={{ pointerEvents: 'none' }}>
        {Object.values(collab.intents).map((it) => (
          <circle
            key={`intent-${it.sender_id}`}
            cx={it.x}
            cy={it.y}
            r={0.018}
            fill="none"
            stroke={it.color}
            strokeWidth={0.0025}
            opacity={0.6}>
            <animate attributeName="r" values="0.01;0.024;0.01" dur="1.2s" repeatCount="indefinite" />
          </circle>
        ))}
      </g>

      {/* Live cursors — pointerEvents none so they don't interfere */}
      <g style={{ pointerEvents: 'none' }}>
        {Object.values(collab.cursors).map((c: CursorState) => (
          <CursorMarker key={c.sender_id} cursor={c} />
        ))}
      </g>
    </svg>
    </>
  );
}

function AnnotationShape({ annotation }: { annotation: AnnotationItem }) {
  const data = annotation.svg_data || {};
  const stroke = data.stroke || annotation.color || LAYER_COLORS[annotation.layer] || '#000';
  const opacity = annotation.is_validated ? 1 : 0.85;
  const dashArray = annotation.is_validated ? undefined : '0.008,0.005';

  if (Array.isArray(data.points) && data.points.length > 1) {
    return (
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={0.003}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray}
        opacity={opacity}
        points={data.points.map((p: any) => `${p.x},${p.y}`).join(' ')}
      />
    );
  }
  return null;
}

function CursorMarker({ cursor }: { cursor: CursorState }) {
  // 12px radius — but we work in normalised viewport, so use a small dot + label
  return (
    <g transform={`translate(${cursor.x}, ${cursor.y})`}>
      <circle r={0.006} fill={cursor.color} opacity={0.9} />
      <text
        x={0.01}
        y={0.005}
        fontSize={0.012}
        fill={cursor.color}
        style={{ pointerEvents: 'none', userSelect: 'none', fontWeight: 600 }}>
        {cursor.sender_name}
      </text>
    </g>
  );
}
