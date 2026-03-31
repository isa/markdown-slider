import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react';
import { getPath } from 'recharts/es6/shape/Curve';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Customized,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { inferChartKeys, normalizeRowsNumeric, type SlideChartRow } from '../slideChartData';

const DEFAULT_LINE: SlideChartRow[] = [
  { q: 'Q1', alpha: 42, beta: 28 },
  { q: 'Q2', alpha: 55, beta: 34 },
  { q: 'Q3', alpha: 48, beta: 41 },
  { q: 'Q4', alpha: 63, beta: 52 },
];

const DEFAULT_BAR: SlideChartRow[] = [
  { cat: 'A', v1: 120, v2: 98, v3: 46 },
  { cat: 'B', v1: 86, v2: 110, v3: 52 },
  { cat: 'C', v1: 140, v2: 72, v3: 61 },
  { cat: 'D', v1: 95, v2: 105, v3: 48 },
  { cat: 'E', v1: 72, v2: 128, v3: 55 },
];

const DEFAULT_PIE: SlideChartRow[] = [
  { label: 'A', value: 34 },
  { label: 'B', value: 22 },
  { label: 'C', value: 18 },
  { label: 'D', value: 16 },
  { label: 'E', value: 10 },
];

/** Max numeric series (YAML columns after category) for line and bar charts. */
const MAX_CHART_SERIES = 5;

const tooltipStyle = {
  backgroundColor: 'color-mix(in srgb, var(--slide-code-bg) 95%, transparent)',
  border: '1px solid var(--slide-table-border)',
  borderRadius: '0.375rem',
  fontSize: '0.75rem',
};

/** Grouped bars: custom motion (slower). Stacked: custom motion, bottom segment first, then up. */
const BAR_GROUPED_GROW_MS = 1400;
/** Per-segment grow duration; next stack layer starts when the previous finishes (`delay = index × this`). */
const BAR_STACKED_SEGMENT_MS = 380;
const BAR_STAGGER_MS = 72;
const BAR_SERIES_OFFSET_MS = 55;
const PATH_ANIM_MS = 780;

/**
 * Same as Recharts `Rectangle` path (corner order matches Bar `radius`).
 * Tuple: [topLeft, topRight, bottomRight, bottomLeft].
 */
function getRectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | [number, number, number, number],
): string {
  const maxRadius = Math.min(Math.abs(width) / 2, Math.abs(height) / 2);
  const ySign = height >= 0 ? 1 : -1;
  const xSign = width >= 0 ? 1 : -1;
  const clockWise = (height >= 0 && width >= 0) || (height < 0 && width < 0) ? 1 : 0;
  let path: string;
  if (maxRadius > 0 && Array.isArray(radius)) {
    const newRadius: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const r = radius[i] ?? 0;
      newRadius[i] = r > maxRadius ? maxRadius : r;
    }
    path = `M${x},${y + ySign * newRadius[0]}`;
    if (newRadius[0] > 0) {
      path += `A ${newRadius[0]},${newRadius[0]},0,0,${clockWise},${x + xSign * newRadius[0]},${y}`;
    }
    path += `L ${x + width - xSign * newRadius[1]},${y}`;
    if (newRadius[1] > 0) {
      path += `A ${newRadius[1]},${newRadius[1]},0,0,${clockWise},${x + width},${y + ySign * newRadius[1]}`;
    }
    path += `L ${x + width},${y + height - ySign * newRadius[2]}`;
    if (newRadius[2] > 0) {
      path += `A ${newRadius[2]},${newRadius[2]},0,0,${clockWise},${x + width - xSign * newRadius[2]},${y + height}`;
    }
    path += `L ${x + xSign * newRadius[3]},${y + height}`;
    if (newRadius[3] > 0) {
      path += `A ${newRadius[3]},${newRadius[3]},0,0,${clockWise},${x},${y + height - ySign * newRadius[3]}`;
    }
    path += 'Z';
  } else if (maxRadius > 0 && typeof radius === 'number' && radius > 0) {
    const nr = Math.min(maxRadius, radius);
    path = `M ${x},${y + ySign * nr} A ${nr},${nr},0,0,${clockWise},${x + xSign * nr},${y} L ${x + width - xSign * nr},${y} A ${nr},${nr},0,0,${clockWise},${x + width},${y + ySign * nr} L ${x + width},${y + height - ySign * nr} A ${nr},${nr},0,0,${clockWise},${x + width - xSign * nr},${y + height} L ${x + xSign * nr},${y + height} A ${nr},${nr},0,0,${clockWise},${x},${y + height - ySign * nr} Z`;
  } else {
    path = `M ${x},${y} h ${width} v ${height} h ${-width} Z`;
  }
  return path;
}

/**
 * Recharts `radius` tuple is [topLeft, topRight, bottomRight, bottomLeft].
 * Stacked: first Bar in JSX = bottom of stack, last = top.
 */
function stackedBarRadius(seriesIndex: number, n: number): [number, number, number, number] {
  const r = 4;
  if (n <= 0) return [0, 0, 0, 0];
  if (n === 1) return [r, r, r, r];
  if (seriesIndex === 0) return [0, 0, r, r];
  if (seriesIndex === n - 1) return [r, r, 0, 0];
  return [0, 0, 0, 0];
}

/**
 * Grow bars bottom-up using a single animated progress value (0 -> 1).
 * Both `y` and `height` are derived from that one motion value via useTransform,
 * so they stay perfectly in sync at every frame — no mid-tween dip below the x-axis.
 */
function staggeredBarShape(seriesOffsetMs: number, growMs: number) {
  return function StaggeredBarShape(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    fill?: string;
    index?: number;
  }) {
    const x = Number(props.x);
    const finalY = Number(props.y);
    const w = Number(props.width);
    const h = Number(props.height);
    const fill = props.fill ?? 'var(--slide-accent)';
    const index = props.index ?? 0;
    if (!Number.isFinite(h) || h <= 0) return null;

    const bottomY = finalY + h;
    const delaySec = (index * BAR_STAGGER_MS + seriesOffsetMs) / 1000;

    const progress = useMotionValue(0);
    const rectY = useTransform(progress, (p) => bottomY - h * p);
    const rectH = useTransform(progress, (p) => h * p);

    useEffect(() => {
      const ctrl = animate(progress, 1, {
        duration: growMs / 1000,
        delay: delaySec,
        ease: [0.22, 1, 0.36, 1],
      });
      return () => ctrl.stop();
    }, []);

    return (
      <motion.rect
        x={x}
        width={w}
        rx={4}
        ry={4}
        fill={fill}
        style={{ y: rectY, height: rectH }}
      />
    );
  };
}

/**
 * Stacked bars: bottom segment grows, then the next, etc. Delay is `seriesIndex * growMs` so each
 * layer starts exactly when the one below completes — no intentional gap. Linear easing avoids an
 * ease-out “tail” that makes the bar look done while time is still elapsing (felt like a pause).
 * Category index still staggers columns slightly.
 * Corners: `stackedBarRadius` (bottom segment bottom corners, top segment top corners, middle sharp).
 */
function stackedStaggeredBarShape(seriesIndex: number, growMs: number, nSeries: number) {
  return function StackedStaggeredBarShape(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    fill?: string;
    index?: number;
  }) {
    const x = Number(props.x);
    const finalY = Number(props.y);
    const w = Number(props.width);
    const h = Number(props.height);
    const fill = props.fill ?? 'var(--slide-accent)';
    const barIndex = props.index ?? 0;
    if (!Number.isFinite(h) || h <= 0) return null;

    const bottomY = finalY + h;
    const delaySec = (barIndex * BAR_STAGGER_MS + seriesIndex * growMs) / 1000;
    const radiusTuple = stackedBarRadius(seriesIndex, nSeries);

    const progress = useMotionValue(0);
    const rectY = useTransform(progress, (p) => bottomY - h * p);
    const rectH = useTransform(progress, (p) => h * p);
    const pathD = useTransform([rectY, rectH], ([ry, rh]) =>
      getRectanglePath(x, ry, w, rh, radiusTuple),
    );

    useEffect(() => {
      const ctrl = animate(progress, 1, {
        duration: growMs / 1000,
        delay: delaySec,
        ease: 'linear',
      });
      return () => ctrl.stop();
    }, []);

    return <motion.path fill={fill} d={pathD} />;
  };
}

function labelForKey(key: string): string {
  return key.replace(/_/g, ' ');
}

/**
 * One distinct color per series (up to MAX_CHART_SERIES). Uses different theme tokens / mixes
 * so hues diverge (accent, bullet, code, blockquote, blended) instead of only accent tints.
 */
function chartSeriesColor(seriesIndex: number): string {
  const palette = [
    'var(--slide-accent)',
    'var(--slide-bullet-color)',
    'var(--slide-code-text)',
    'color-mix(in srgb, var(--slide-blockquote-border) 62%, var(--slide-code-text))',
    'color-mix(in srgb, var(--slide-bullet-color) 52%, var(--slide-accent))',
  ];
  const i = Math.min(Math.max(seriesIndex, 0), palette.length - 1);
  return palette[i];
}

/** Slice fills defined in `slide-content.css` (`.slide-chart-embed--pie` --slide-pie-1 … 5) for theme-aware contrast */
const PIE_SLICE_FILLS = [
  'var(--slide-pie-1)',
  'var(--slide-pie-2)',
  'var(--slide-pie-3)',
  'var(--slide-pie-4)',
  'var(--slide-pie-5)',
] as const;

function pieSliceFill(index: number): string {
  return PIE_SLICE_FILLS[index % PIE_SLICE_FILLS.length];
}

/** No stroke on slices — `color-mix(..., transparent)` skews black in CSS; gaps only via paddingAngle */
const PIE_PADDING_ANGLE = 0.2;

/** Fill under each series = stroke color at this opacity (YAML `lineChartArea` / `area` true). */
const LINE_AREA_FILL_OPACITY = 0.1;

type LineTooltipPayloadEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

type FormattedGraphicalItem = {
  item?: { props?: { dataKey?: string | number } };
  props?: { points?: Array<{ x: number; y: number }> };
};

type LineChartGeometrySnapshot = {
  formattedGraphicalItems?: FormattedGraphicalItem[];
  activeTooltipIndex?: number;
};

/** Actual SVG y per series at the active x (matches Y-axis scale + padding; raw data min/max does not). */
function buildPixelYByDataKey(
  formattedGraphicalItems: FormattedGraphicalItem[] | undefined,
  activeTooltipIndex: number,
): Map<string, number> | undefined {
  if (!formattedGraphicalItems?.length || activeTooltipIndex < 0) return undefined;
  const m = new Map<string, number>();
  for (const gi of formattedGraphicalItems) {
    const dk = gi.item?.props?.dataKey;
    const pt = gi.props?.points?.[activeTooltipIndex];
    if (dk == null || pt == null || typeof pt.y !== 'number') continue;
    m.set(String(dk), pt.y);
  }
  return m.size ? m : undefined;
}

/** Single emphasized dot on the closest series only (Recharts shared axis would draw activeDot on every series). */
function LineChartSingleActiveDot(props: {
  activeTooltipIndex?: number;
  isTooltipActive?: boolean;
  activePayload?: LineTooltipPayloadEntry[];
  activeCoordinate?: { x?: number; y?: number };
  offset?: { left?: number; top?: number; width?: number; height?: number };
  formattedGraphicalItems?: FormattedGraphicalItem[];
  valueMin: number;
  valueMax: number;
}) {
  const {
    activeTooltipIndex = -1,
    isTooltipActive,
    activePayload,
    activeCoordinate,
    offset,
    formattedGraphicalItems,
    valueMin,
    valueMax,
  } = props;

  if (
    !isTooltipActive ||
    activeTooltipIndex < 0 ||
    !offset?.width ||
    offset.width <= 0 ||
    !activePayload?.length ||
    !formattedGraphicalItems?.length
  ) {
    return null;
  }

  const viewBox = {
    x: offset.left ?? 0,
    y: offset.top ?? 0,
    width: offset.width,
    height: offset.height,
  };

  const pixelYByDataKey = buildPixelYByDataKey(formattedGraphicalItems, activeTooltipIndex);

  const picked = pickClosestLinePayload(
    activePayload,
    activeCoordinate,
    viewBox,
    valueMin,
    valueMax,
    pixelYByDataKey,
  );

  const pickedKey = picked.dataKey;
  const seriesIndex = formattedGraphicalItems.findIndex((gi) => {
    const dk = gi.item?.props?.dataKey;
    return dk === pickedKey || String(dk) === String(pickedKey);
  });
  if (seriesIndex < 0) {
    return null;
  }

  const points = formattedGraphicalItems[seriesIndex]?.props?.points;
  const pt = points?.[activeTooltipIndex];
  if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') {
    return null;
  }

  const fill = chartSeriesColor(seriesIndex);

  return (
    <circle
      cx={pt.x}
      cy={pt.y}
      r={6.5}
      fill={fill}
      stroke="#fff"
      strokeWidth={2}
      pointerEvents="none"
      className="slide-chart-line-active-dot"
    />
  );
}

type LineChartLegendLine = {
  label: string;
  name: string;
  value: string;
  color?: string;
};

function valueExtentForSeries(rows: SlideChartRow[], seriesKeys: string[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    for (const k of seriesKeys) {
      const n = Number(row[k]);
      if (!Number.isNaN(n)) {
        min = Math.min(min, n);
        max = Math.max(max, n);
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }
  return { min, max };
}

/**
 * Pick series closest to the pointer in the vertical direction.
 * Prefer rendered point Y from Recharts (`pixelYByDataKey`); fallback uses raw data extent (can disagree with axis padding).
 */
function pickClosestLinePayload(
  payload: LineTooltipPayloadEntry[],
  coordinate: { x?: number; y?: number } | undefined,
  viewBox: { x?: number; y?: number; width?: number; height?: number } | undefined,
  valueMin: number,
  valueMax: number,
  pixelYByDataKey?: Map<string, number>,
): LineTooltipPayloadEntry {
  if (payload.length <= 1) return payload[0];
  const mouseY = coordinate?.y;
  if (typeof mouseY !== 'number') return payload[0];

  if (pixelYByDataKey && pixelYByDataKey.size > 0) {
    let best = 0;
    let bestD = Infinity;
    payload.forEach((p, i) => {
      const key = String(p.dataKey ?? '');
      const py = pixelYByDataKey.get(key);
      if (typeof py !== 'number') return;
      const d = Math.abs(py - mouseY);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (bestD !== Infinity) return payload[best];
  }

  const h = viewBox?.height;
  const top = viewBox?.y ?? 0;
  if (typeof h !== 'number' || h <= 0) {
    return payload[0];
  }
  const span = Math.max(valueMax - valueMin, 1e-9);
  let best = 0;
  let bestD = Infinity;
  payload.forEach((p, i) => {
    const v = Number(p.value);
    if (Number.isNaN(v)) return;
    const plotY = top + h - ((v - valueMin) / span) * h;
    const d = Math.abs(plotY - mouseY);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return payload[best];
}

function LineChartSingleTooltipContent(props: {
  active?: boolean;
  payload?: LineTooltipPayloadEntry[];
  label?: unknown;
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  valueMin: number;
  valueMax: number;
  onHoverEntry: (entry: LineChartLegendLine | null) => void;
  geometryRef: RefObject<LineChartGeometrySnapshot | null>;
}) {
  const { active, payload, label, coordinate, viewBox, valueMin, valueMax, onHoverEntry, geometryRef } =
    props;

  const pixelYByDataKey = (() => {
    const g = geometryRef.current;
    if (g?.activeTooltipIndex == null || g.activeTooltipIndex < 0) return undefined;
    return buildPixelYByDataKey(g.formattedGraphicalItems, g.activeTooltipIndex);
  })();

  useEffect(() => {
    if (!active || !payload?.length) {
      onHoverEntry(null);
      return;
    }
    const picked = pickClosestLinePayload(payload, coordinate, viewBox, valueMin, valueMax, pixelYByDataKey);
    const name = String(picked.name ?? '');
    const value = picked.value != null ? String(picked.value) : '';
    const labelStr = label != null ? String(label) : '';
    onHoverEntry({ name, value, color: picked.color, label: labelStr });
  }, [active, payload, label, coordinate, viewBox, valueMin, valueMax, onHoverEntry, pixelYByDataKey]);

  if (!active || !payload?.length) return null;
  const picked = pickClosestLinePayload(payload, coordinate, viewBox, valueMin, valueMax, pixelYByDataKey);
  const labelStr = label != null ? String(label) : '';
  return (
    <div
      className="slide-chart-tooltip-single"
      style={{
        ...tooltipStyle,
        padding: '8px 10px',
      }}
    >
      {labelStr ? (
        <div style={{ color: 'var(--slide-text-muted)', fontSize: '0.7rem', marginBottom: 4 }}>{labelStr}</div>
      ) : null}
      <div style={{ color: picked.color ?? 'var(--slide-text)', fontWeight: 600 }}>
        <span>{picked.name}</span>
        <span style={{ color: 'var(--slide-text-muted)', fontWeight: 400 }}> : </span>
        <span>{picked.value}</span>
      </div>
    </div>
  );
}

export interface SlideChartEmbedProps {
  /** From YAML `lineChart:` / `barChart:`; first column = category, rest = numeric series in column order. */
  data?: SlideChartRow[];
}

export type PieChartLegendPosition = 'left' | 'right' | 'bottom';

/** YAML `lineChartEndMarker:` / `lineEndMarker:` — decoration at the last point of each series. */
export type LineChartEndMarker = 'none' | 'arrow' | 'circle' | 'openCircle';

const LINE_END_ARROW_LEN = 9;
const LINE_END_ARROW_HALF_WIDTH = 4.5;
const LINE_END_CIRCLE_R = 4.5;
const LINE_END_OPEN_STROKE = 2;
/** Extra path length to leave the stroke shy of the tip (caps/AA); avoids the line reading through the head. */
const LINE_END_STROKE_NUDGE = 2;

/** Distance along the path / tangent to leave between stroke end and marker so the line doesn’t run through the head. */
function lineEndMarkerStrokeInset(marker: LineChartEndMarker): number {
  if (marker === 'arrow') return LINE_END_ARROW_LEN + LINE_END_STROKE_NUDGE;
  if (marker === 'circle') return LINE_END_CIRCLE_R + LINE_END_STROKE_NUDGE;
  if (marker === 'openCircle') return LINE_END_CIRCLE_R + LINE_END_OPEN_STROKE / 2 + LINE_END_STROKE_NUDGE;
  return 0;
}

function filterLinePoints(
  pts: Array<{ x?: number; y?: number }> | undefined,
): Array<{ x: number; y: number }> {
  if (!pts?.length) return [];
  const out: Array<{ x: number; y: number }> = [];
  for (const p of pts) {
    if (typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
}

/** Interpolate along the polyline (same x-order as Recharts category line) for Area clip sync. */
function markerPointOnPolyline(
  points: Array<{ x: number; y: number }>,
  xClip: number,
): { x: number; y: number; angle: number } | null {
  if (points.length < 2) return null;
  const p0 = points[0];
  const pN = points[points.length - 1];
  const xMin = Math.min(p0.x, pN.x);
  const xMax = Math.max(p0.x, pN.x);
  const x = Math.min(Math.max(xClip, xMin), xMax);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (x >= minX && x <= maxX) {
      const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x);
      const y = a.y + t * (b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      return { x, y, angle };
    }
  }
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/**
 * (cx, cy) = path end (last data point): arrow tip / circle center sit here so the series stroke
 * does not continue past the marker toward the dot. The animated stroke is shortened by
 * lineEndMarkerStrokeInset so it meets the base / inner edge; this glyph is not shifted backward
 * along the path (that left a gap on the tail and let the native stroke run tip → dot).
 */
function LineEndMarkerGlyph({
  marker,
  stroke,
  cx,
  cy,
  angle,
}: {
  marker: LineChartEndMarker;
  stroke: string;
  cx: number;
  cy: number;
  angle: number;
}) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  if (marker === 'circle') {
    return <circle cx={cx} cy={cy} r={LINE_END_CIRCLE_R} fill={stroke} />;
  }
  if (marker === 'openCircle') {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={LINE_END_CIRCLE_R}
        fill="none"
        stroke={stroke}
        strokeWidth={LINE_END_OPEN_STROKE}
      />
    );
  }
  if (marker === 'arrow') {
    const bx = cx - ux * LINE_END_ARROW_LEN;
    const by = cy - uy * LINE_END_ARROW_LEN;
    const px = -uy;
    const py = ux;
    const b1x = bx + px * LINE_END_ARROW_HALF_WIDTH;
    const b1y = by + py * LINE_END_ARROW_HALF_WIDTH;
    const b2x = bx - px * LINE_END_ARROW_HALF_WIDTH;
    const b2y = by - py * LINE_END_ARROW_HALF_WIDTH;
    return <polygon points={`${cx},${cy} ${b1x},${b1y} ${b2x},${b2y}`} fill={stroke} />;
  }
  return null;
}

/** Area: marker follows horizontal clip (same t as Recharts Area animation). */
function AnimatedAreaEndMarker({
  points,
  stroke,
  animationBeginMs,
  animationDurationMs,
  endMarker,
}: {
  points: Array<{ x: number; y: number }>;
  stroke: string;
  animationBeginMs: number;
  animationDurationMs: number;
  endMarker: LineChartEndMarker;
}) {
  const p0 = points[0];
  const pN = points[points.length - 1];
  const progress = useMotionValue(0);
  const [tip, setTip] = useState<{ cx: number; cy: number; angle: number } | null>(null);

  useMotionValueEvent(progress, 'change', (t) => {
    const xClip = p0.x + t * (pN.x - p0.x);
    const hit = markerPointOnPolyline(points, xClip);
    if (hit) setTip({ cx: hit.x, cy: hit.y, angle: hit.angle });
    else setTip(null);
  });

  useEffect(() => {
    progress.set(0);
    const hit0 = markerPointOnPolyline(points, p0.x);
    if (hit0) setTip({ cx: hit0.x, cy: hit0.y, angle: hit0.angle });
    const ctrl = animate(progress, 1, {
      duration: animationDurationMs / 1000,
      delay: animationBeginMs / 1000,
      ease: 'easeOut',
    });
    return () => ctrl.stop();
  }, [progress, animationBeginMs, animationDurationMs, points.length, p0.x, p0.y, pN.x, pN.y]);

  if (endMarker === 'none') return null;
  return tip ? <LineEndMarkerGlyph marker={endMarker} stroke={stroke} cx={tip.cx} cy={tip.cy} angle={tip.angle} /> : null;
}

/** Line-only: stroke + marker share one progress (matches Recharts stroke-dash line animation). */
function AnimatedLineStrokeWithEndMarker({
  points,
  stroke,
  strokeWidth,
  animationBeginMs,
  animationDurationMs,
  endMarker,
}: {
  points: Array<{ x: number; y: number }>;
  stroke: string;
  strokeWidth: number;
  animationBeginMs: number;
  animationDurationMs: number;
  endMarker: LineChartEndMarker;
}) {
  const pathD = useMemo(() => {
    if (points.length < 2) return '';
    return getPath({
      points,
      type: 'monotone',
      layout: 'horizontal',
      connectNulls: false,
    });
  }, [points]);

  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  const progress = useMotionValue(0);
  const [tip, setTip] = useState<{ cx: number; cy: number; angle: number } | null>(null);

  const strokeInset = lineEndMarkerStrokeInset(endMarker);
  const dashStyle = useTransform(progress, (p) => {
    if (pathLen <= 0) return '0 0';
    const cur = p * pathLen;
    const drawLen = Math.max(0, cur - strokeInset);
    return `${drawLen}px ${pathLen}px`;
  });

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el || !pathD) {
      setPathLen(0);
      return;
    }
    try {
      setPathLen(el.getTotalLength());
    } catch {
      setPathLen(0);
    }
  }, [pathD]);

  useMotionValueEvent(progress, 'change', (p) => {
    const el = pathRef.current;
    if (!el || pathLen <= 0) {
      setTip(null);
      return;
    }
    const cur = p * pathLen;
    const pt = el.getPointAtLength(cur);
    const pt0 = el.getPointAtLength(Math.max(0, cur - 2));
    const angle = Math.atan2(pt.y - pt0.y, pt.x - pt0.x);
    setTip({ cx: pt.x, cy: pt.y, angle });
  });

  useEffect(() => {
    if (pathLen <= 0) return;
    progress.set(0);
    const ctrl = animate(progress, 1, {
      duration: animationDurationMs / 1000,
      delay: animationBeginMs / 1000,
      ease: 'easeOut',
    });
    return () => ctrl.stop();
  }, [pathLen, animationBeginMs, animationDurationMs, pathD, progress]);

  if (!pathD) return null;

  return (
    <g className="slide-chart-line-series--with-end-marker">
      <motion.path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: dashStyle }}
      />
      {tip && endMarker !== 'none' ? (
        <LineEndMarkerGlyph marker={endMarker} stroke={stroke} cx={tip.cx} cy={tip.cy} angle={tip.angle} />
      ) : null}
    </g>
  );
}

function findFormattedItemForKey(
  items: FormattedGraphicalItem[] | undefined,
  key: string,
): FormattedGraphicalItem | undefined {
  return items?.find((g) => String(g.item?.props?.dataKey) === String(key));
}

function SlideLineChartAnimatedEndMarkers({
  formattedGraphicalItems,
  seriesKeys,
  fillUnderLines,
  endMarker,
}: {
  formattedGraphicalItems?: FormattedGraphicalItem[];
  seriesKeys: string[];
  fillUnderLines: boolean;
  endMarker: LineChartEndMarker;
}) {
  if (endMarker === 'none') return null;

  return (
    <g className="slide-chart-line-end-markers" aria-hidden pointerEvents="none">
      {seriesKeys.map((key, i) => {
        const gi = findFormattedItemForKey(formattedGraphicalItems, key);
        const pts = filterLinePoints(gi?.props?.points as Array<{ x?: number; y?: number }> | undefined);
        if (pts.length < 2) return null;
        const stroke = chartSeriesColor(i);
        const strokeW = 3.5 + (i % 2) * 0.65;
        const beginMs = fillUnderLines ? PATH_ANIM_MS * (0.12 * i) : PATH_ANIM_MS * (0.35 + i * 0.12);

        if (fillUnderLines) {
          return (
            <AnimatedAreaEndMarker
              key={key}
              points={pts}
              stroke={stroke}
              animationBeginMs={beginMs}
              animationDurationMs={PATH_ANIM_MS}
              endMarker={endMarker}
            />
          );
        }
        return (
          <AnimatedLineStrokeWithEndMarker
            key={key}
            points={pts}
            stroke={stroke}
            strokeWidth={strokeW}
            animationBeginMs={beginMs}
            animationDurationMs={PATH_ANIM_MS}
            endMarker={endMarker}
          />
        );
      })}
    </g>
  );
}

export interface SlideLineChartEmbedProps extends SlideChartEmbedProps {
  /** YAML `lineChartArea:` or `area:` — `false` = lines only; omitted / `true` = fill under each series at 10% of stroke. */
  lineChartArea?: boolean;
  /** YAML `lineChartEndMarker:` or `lineEndMarker:` — `arrow` | `circle` | `openCircle` (omit = none). */
  lineChartEndMarker?: LineChartEndMarker;
}

export function SlideLineChartEmbed({
  data,
  lineChartArea,
  lineChartEndMarker = 'none',
}: SlideLineChartEmbedProps) {
  const fillUnderLines = lineChartArea !== false;

  const spec = useMemo(() => {
    const rows = data?.length ? data : DEFAULT_LINE;
    let keys = inferChartKeys(rows[0]);
    if (!keys.valueKeys.length) {
      const fb = DEFAULT_LINE;
      keys = inferChartKeys(fb[0]);
      const seriesKeys = keys.valueKeys.slice(0, MAX_CHART_SERIES);
      return {
        chartData: normalizeRowsNumeric(fb, seriesKeys),
        xKey: keys.xKey,
        seriesKeys,
      };
    }
    const seriesKeys = keys.valueKeys.slice(0, MAX_CHART_SERIES);
    return {
      chartData: normalizeRowsNumeric(rows, seriesKeys),
      xKey: keys.xKey,
      seriesKeys,
    };
  }, [data]);

  const { chartData, xKey, seriesKeys } = spec;

  const valueExtent = useMemo(() => valueExtentForSeries(chartData, seriesKeys), [chartData, seriesKeys]);

  const [legendLine, setLegendLine] = useState<LineChartLegendLine | null>(null);
  const onLegendHover = useCallback((entry: LineChartLegendLine | null) => {
    setLegendLine(entry);
  }, []);

  const lineChartGeometryRef = useRef<LineChartGeometrySnapshot | null>(null);

  return (
    <div
      className="slide-chart-embed slide-chart-embed--line"
      role="img"
      aria-label="Animated line and area chart"
    >
      <div className="slide-chart-embed__chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="color-mix(in srgb, var(--slide-text-muted) 35%, transparent)"
            />
            <XAxis
              dataKey={xKey}
              tick={{ fill: 'var(--slide-text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--slide-table-border)' }}
            />
            <YAxis
              tick={{ fill: 'var(--slide-text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--slide-table-border)' }}
            />
            <Customized
              component={(chartProps: Record<string, unknown>) => {
                lineChartGeometryRef.current = {
                  formattedGraphicalItems: chartProps.formattedGraphicalItems as
                    | FormattedGraphicalItem[]
                    | undefined,
                  activeTooltipIndex: chartProps.activeTooltipIndex as number | undefined,
                };
                return null;
              }}
            />
            <Tooltip
              shared
              content={(tooltipProps) => (
                <LineChartSingleTooltipContent
                  {...tooltipProps}
                  valueMin={valueExtent.min}
                  valueMax={valueExtent.max}
                  onHoverEntry={onLegendHover}
                  geometryRef={lineChartGeometryRef}
                />
              )}
              cursor={{ stroke: 'color-mix(in srgb, var(--slide-accent) 50%, transparent)' }}
            />
            {fillUnderLines
              ? seriesKeys.map((key, i) => {
                  const stroke = chartSeriesColor(i);
                  return (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={labelForKey(key)}
                      stroke={stroke}
                      strokeWidth={3.5 + (i % 2) * 0.65}
                      fill={stroke}
                      fillOpacity={LINE_AREA_FILL_OPACITY}
                      dot={{ r: 3.75, fill: stroke, strokeWidth: 0 }}
                      activeDot={false}
                      isAnimationActive
                      animationDuration={PATH_ANIM_MS}
                      animationBegin={PATH_ANIM_MS * (0.12 * i)}
                      animationEasing="ease-out"
                    />
                  );
                })
              : seriesKeys.map((key, j) => {
                  const stroke = chartSeriesColor(j);
                  const hideNativeStroke = lineChartEndMarker !== 'none';
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={labelForKey(key)}
                      stroke={hideNativeStroke ? 'transparent' : stroke}
                      strokeWidth={hideNativeStroke ? 0 : 3.5 + (j % 2) * 0.65}
                      dot={
                        hideNativeStroke ? false : { r: 3.75, fill: stroke, strokeWidth: 0 }
                      }
                      activeDot={false}
                      isAnimationActive={!hideNativeStroke}
                      animationDuration={PATH_ANIM_MS}
                      animationBegin={PATH_ANIM_MS * (0.35 + j * 0.12)}
                      animationEasing="ease-out"
                    />
                  );
                })}
            {lineChartEndMarker !== 'none' ? (
              <Customized
                component={(props: Record<string, unknown>) => (
                  <SlideLineChartAnimatedEndMarkers
                    endMarker={lineChartEndMarker}
                    fillUnderLines={fillUnderLines}
                    formattedGraphicalItems={props.formattedGraphicalItems as FormattedGraphicalItem[] | undefined}
                    seriesKeys={seriesKeys}
                  />
                )}
              />
            ) : null}
            <Customized
              component={LineChartSingleActiveDot}
              valueMin={valueExtent.min}
              valueMax={valueExtent.max}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="slide-chart-embed__legend-line" aria-live="polite">
        {legendLine ? (
          <span className="slide-chart-embed__legend-line-inner">
            <span className="slide-chart-embed__legend-line-axis">{legendLine.label}</span>
            <span className="slide-chart-embed__legend-line-sep"> · </span>
            <span className="slide-chart-embed__legend-line-pair" style={{ color: legendLine.color }}>
              {legendLine.name}: {legendLine.value}
            </span>
          </span>
        ) : (
          <span className="slide-chart-embed__legend-line-placeholder">Hover chart for values</span>
        )}
      </div>
    </div>
  );
}

export interface SlideBarChartEmbedProps extends SlideChartEmbedProps {
  /** YAML `barChartStacked: true` — Recharts stackId on all series */
  stacked?: boolean;
}

export function SlideBarChartEmbed({ data, stacked = false }: SlideBarChartEmbedProps) {
  const spec = useMemo(() => {
    const rows = data?.length ? data : DEFAULT_BAR;
    let keys = inferChartKeys(rows[0]);
    if (!keys.valueKeys.length) {
      const fb = DEFAULT_BAR;
      keys = inferChartKeys(fb[0]);
      const barKeys = keys.valueKeys.slice(0, MAX_CHART_SERIES);
      return {
        chartData: normalizeRowsNumeric(fb, barKeys),
        xKey: keys.xKey,
        barKeys,
      };
    }
    const barKeys = keys.valueKeys.slice(0, MAX_CHART_SERIES);
    return {
      chartData: normalizeRowsNumeric(rows, barKeys),
      xKey: keys.xKey,
      barKeys,
    };
  }, [data]);

  const { chartData, xKey, barKeys } = spec;
  const nSeries = barKeys.length;

  const layout = useMemo(() => {
    if (nSeries === 0) {
      return { barGap: undefined as string | undefined, barCategoryGap: '12%' as const, maxBarSize: 48 };
    }
    if (stacked) {
      return {
        barGap: undefined as string | undefined,
        barCategoryGap: '8%' as const,
        maxBarSize: nSeries >= 3 ? 52 : 56,
      };
    }
    if (nSeries === 1) {
      return {
        barGap: undefined as string | undefined,
        barCategoryGap: '6%' as const,
        maxBarSize: 58,
      };
    }
    return {
      barGap: (nSeries >= 3 ? '1%' : '2%') as const,
      barCategoryGap: (nSeries >= 3 ? '10%' : '12%') as const,
      maxBarSize: nSeries >= 3 ? 40 : 44,
    };
  }, [nSeries, stacked]);

  const barGapProp = !stacked && nSeries > 1 ? layout.barGap : undefined;

  return (
    <div className="slide-chart-embed" role="img" aria-label={stacked ? 'Animated stacked bar chart' : 'Animated bar chart'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
          barGap={barGapProp}
          barCategoryGap={layout.barCategoryGap}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="color-mix(in srgb, var(--slide-text-muted) 35%, transparent)"
          />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--slide-text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--slide-table-border)' }}
          />
          <YAxis
            tick={{ fill: 'var(--slide-text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--slide-table-border)' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--slide-text)' }}
            cursor={{ fill: 'color-mix(in srgb, var(--slide-accent) 12%, transparent)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }}
            formatter={(value) => <span style={{ color: 'var(--slide-text-muted)' }}>{value}</span>}
          />
          {barKeys.map((key, si) => (
            <Bar
              key={key}
              dataKey={key}
              name={labelForKey(key)}
              fill={chartSeriesColor(si)}
              radius={stacked ? stackedBarRadius(si, nSeries) : [4, 4, 0, 0]}
              maxBarSize={layout.maxBarSize}
              stackId={stacked ? 'slide-stack' : undefined}
              isAnimationActive={false}
              shape={
                stacked
                  ? stackedStaggeredBarShape(si, BAR_STACKED_SEGMENT_MS, nSeries)
                  : staggeredBarShape(si * BAR_SERIES_OFFSET_MS, BAR_GROUPED_GROW_MS)
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type PieDatum = {
  name: string;
  value: number;
};

function SlidePieTooltipContent({
  active,
  payload,
  chartData,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; payload?: PieDatum }>;
  chartData: PieDatum[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = String(p.name ?? p.payload?.name ?? '');
  const value = Number(p.value);
  const idx = chartData.findIndex((d) => d.name === name);
  const sliceColor = pieSliceFill(idx >= 0 ? idx : 0);
  const total = chartData.reduce((s, d) => s + d.value, 0);
  const pct = total > 0 && Number.isFinite(value) ? Math.round((value / total) * 100) : 0;

  return (
    <div
      className="slide-chart-pie-tooltip"
      style={{ '--slide-pie-tooltip-accent': sliceColor } as CSSProperties}
    >
      <div className="slide-chart-pie-tooltip__accent" aria-hidden />
      <div className="slide-chart-pie-tooltip__label">{name}</div>
      <div className="slide-chart-pie-tooltip__value">
        {value}
        <span style={{ color: 'var(--slide-text-muted)', fontWeight: 500 }}> · </span>
        {pct}%
      </div>
      <div className="slide-chart-pie-tooltip__meta">Share of total</div>
    </div>
  );
}

export interface SlidePieChartEmbedProps extends SlideChartEmbedProps {
  /** YAML `pieChartLegendPosition:` — `left` | `right` (stacked) | `bottom` (default; two rows when more than 3 items) */
  legendPosition?: PieChartLegendPosition;
}

function pieLegendClassNames(
  position: PieChartLegendPosition,
  itemCount: number,
): string {
  const parts = ['slide-chart-pie-legend'];
  if (position === 'left' || position === 'right') {
    parts.push('slide-chart-pie-legend--side');
  } else {
    parts.push('slide-chart-pie-legend--bottom');
    if (itemCount > 3) {
      parts.push('slide-chart-pie-legend--bottom-multiline');
      parts.push('slide-chart-pie-legend--bottom-split');
    }
  }
  return parts.join(' ');
}

function PieLegendRow({
  entries,
  startIndex,
}: {
  entries: PieDatum[];
  startIndex: number;
}) {
  return (
    <ul className="slide-chart-pie-legend__row">
      {entries.map((entry, j) => {
        const i = startIndex + j;
        return (
          <li key={`${entry.name}-${i}`} className="slide-chart-pie-legend__item">
            <span
              className="slide-chart-pie-legend__swatch"
              style={{ backgroundColor: pieSliceFill(i) }}
            />
            <span>{entry.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function SlidePieChartEmbed({ data, legendPosition = 'bottom' }: SlidePieChartEmbedProps) {
  const chartData = useMemo<PieDatum[]>(() => {
    const rows = data?.length ? data : DEFAULT_PIE;
    let keys = inferChartKeys(rows[0]);
    if (!keys.valueKeys.length) {
      const fb = DEFAULT_PIE;
      keys = inferChartKeys(fb[0]);
      const valueKey = keys.valueKeys[0];
      return fb.map((row) => ({
        name: String(row[keys.xKey] ?? ''),
        value: Number(row[valueKey]),
      }));
    }

    const valueKey = keys.valueKeys[0];
    return rows.map((row) => {
      const value = Number(row[valueKey]);
      return {
        name: String(row[keys.xKey] ?? ''),
        value: Number.isFinite(value) ? value : 0,
      };
    });
  }, [data]);

  const legendList =
    legendPosition === 'bottom' && chartData.length > 3 ? (
      <div className={pieLegendClassNames(legendPosition, chartData.length)}>
        <PieLegendRow
          entries={chartData.slice(0, chartData.length === 4 ? 2 : 3)}
          startIndex={0}
        />
        <PieLegendRow
          entries={chartData.slice(chartData.length === 4 ? 2 : 3)}
          startIndex={chartData.length === 4 ? 2 : 3}
        />
      </div>
    ) : (
      <ul className={pieLegendClassNames(legendPosition, chartData.length)}>
        {chartData.map((entry, i) => (
          <li key={`${entry.name}-${i}`} className="slide-chart-pie-legend__item">
            <span
              className="slide-chart-pie-legend__swatch"
              style={{ backgroundColor: pieSliceFill(i) }}
            />
            <span>{entry.name}</span>
          </li>
        ))}
      </ul>
    );

  const pieMargins =
    legendPosition === 'left'
      ? { top: 8, right: 8, left: 2, bottom: 8 }
      : legendPosition === 'right'
        ? { top: 8, right: 2, left: 8, bottom: 8 }
        : { top: 8, right: 12, left: 12, bottom: 0 };

  const chartAreaClass =
    legendPosition === 'left' || legendPosition === 'right'
      ? 'slide-chart-embed__pie-chart-area slide-chart-embed__pie-chart-area--side'
      : 'slide-chart-embed__pie-chart-area';

  const chartBlock = (
    <div className={chartAreaClass}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={pieMargins}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="48%"
            outerRadius="78%"
            innerRadius="42%"
            paddingAngle={PIE_PADDING_ANGLE}
            stroke="none"
            strokeWidth={0}
            isAnimationActive
            animationDuration={PATH_ANIM_MS}
            animationEasing="ease-out"
          >
            {chartData.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={pieSliceFill(i)} stroke="none" strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            cursor={{
              stroke: 'color-mix(in srgb, var(--slide-text) 18%, var(--slide-code-bg))',
              strokeWidth: 1,
            }}
            content={(props) => <SlidePieTooltipContent {...props} chartData={chartData} />}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div
      className={`slide-chart-embed slide-chart-embed--pie slide-chart-embed--pie-legend-${legendPosition}`}
      role="img"
      aria-label="Animated pie chart"
    >
      {legendPosition === 'left' ? legendList : null}
      {chartBlock}
      {legendPosition === 'right' ? legendList : null}
      {legendPosition === 'bottom' ? legendList : null}
    </div>
  );
}

