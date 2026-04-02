import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
/**
 * Bar chart width (the outer block Recharts measures) is deterministic:
 *   widthPx ≈ nCategories × pitchPx + BAR_CHART_SVG_WIDTH_CHROME_PX
 * then × SLIDE_CHART_W_SCALE (keep in sync with `.slide-chart-embed { --slide-chart-w-scale }` in CSS).
 * `pitchPx` is at least `BAR_CHART_PX_PER_CATEGORY` and may grow so each bar reaches `BAR_MIN_WIDTH_PX`
 * (Recharts `getBarPosition` in `ChartUtils`: grouped series split each category band).
 */
const BAR_CHART_PX_PER_CATEGORY = 68;
/** Minimum horizontal bar thickness (px); widens the chart when grouped/stack math would go below this. */
const BAR_MIN_WIDTH_PX = 32;
const BAR_CHART_SVG_WIDTH_CHROME_PX = 56;
/**
 * Multiplier on the computed bar-chart block width (SVG). When > 1, increase `barCategoryGap`
 * proportionally so `share × band` stays ~constant (bars don’t get wider—extra space is gutters).
 */
const BAR_CHART_WIDTH_STRETCH = 1.25;
/** Sync with `slide-content.css` `.slide-chart-embed { --slide-chart-w-scale }`. */
const SLIDE_CHART_W_SCALE = 1;
/** Room inside the SVG for axis ticks/labels so they don’t sit flush against prose above/below. */
const RECHARTS_CARTESIAN_MARGIN = { top: 12, right: 12, left: -8, bottom: 22 } as const;
const PATH_ANIM_MS = 780;

/** Worst-case ms until line/area Recharts animations finish (PDF / screenshots). */
export function slideLineChartSettleMs(nSeries: number): number {
  const n = Math.max(1, Math.min(MAX_CHART_SERIES, nSeries));
  const lineLastFinish = PATH_ANIM_MS * (0.35 + (n - 1) * 0.12) + PATH_ANIM_MS;
  const areaLastFinish = PATH_ANIM_MS * (0.12 * (n - 1)) + PATH_ANIM_MS;
  return Math.ceil(Math.max(lineLastFinish, areaLastFinish) + 250);
}

/** Bar motion: grouped vs stacked (see `staggeredBarShape` / `stackedStaggeredBarShape`). */
export function slideBarChartSettleMs(nCategories: number, nSeries: number, stacked: boolean): number {
  const nc = Math.max(1, nCategories);
  const ns = Math.max(1, Math.min(MAX_CHART_SERIES, nSeries));
  if (stacked) {
    return Math.ceil((nc - 1) * BAR_STAGGER_MS + ns * BAR_STACKED_SEGMENT_MS + 200);
  }
  return Math.ceil((nc - 1) * BAR_STAGGER_MS + (ns - 1) * BAR_SERIES_OFFSET_MS + BAR_GROUPED_GROW_MS + 200);
}

export function slidePieChartSettleMs(): number {
  return PATH_ANIM_MS + 250;
}

/** Align with `barCategoryGap` / `barGap` in `SlideBarChartEmbed` layout. */
const BAR_LAYOUT_CATEGORY_GAP = 0.06;

function barGapFractionForSeries(nSeries: number): number {
  if (nSeries < 2) return 0;
  return nSeries >= 3 ? 0.01 : 0.02;
}

/**
 * Min px per category on the outer width so Recharts `originalSize` (see `getBarPosition`) is ≥ BAR_MIN_WIDTH_PX.
 * Stacked / single: one horizontal bar per category (share = 1 − 2×categoryGap).
 * Grouped: share = (1 − 2×categoryGap − (n−1)×barGap) / n.
 */
function barPitchPxForMinBarWidth(nSeries: number, stacked: boolean): number {
  const g = barGapFractionForSeries(nSeries);
  let share: number;
  if (stacked || nSeries <= 1) {
    share = 1 - 2 * BAR_LAYOUT_CATEGORY_GAP;
  } else {
    share = (1 - 2 * BAR_LAYOUT_CATEGORY_GAP - (nSeries - 1) * g) / nSeries;
  }
  const minBand = BAR_MIN_WIDTH_PX / Math.max(share, 1e-6);
  return Math.max(BAR_CHART_PX_PER_CATEGORY, Math.ceil(minBand));
}

/**
 * When outer width is multiplied by `stretch`, increase per-side category padding so Recharts
 * `originalSize ≈ share × band` stays ~unchanged (same bar thickness, wider gutters).
 */
function barCategoryGapFractionForStretch(
  stretch: number,
  nSeries: number,
  stacked: boolean,
): number {
  const g0 = BAR_LAYOUT_CATEGORY_GAP;
  if (stretch <= 1) return g0;
  const bg = barGapFractionForSeries(nSeries);
  let shareBase: number;
  if (stacked || nSeries <= 1) {
    shareBase = 1 - 2 * g0;
  } else {
    shareBase = (1 - 2 * g0 - (nSeries - 1) * bg) / nSeries;
  }
  const shareTarget = shareBase / stretch;
  let g1: number;
  if (stacked || nSeries <= 1) {
    g1 = (1 - shareTarget) / 2;
  } else {
    g1 = (1 - (nSeries - 1) * bg - nSeries * shareTarget) / 2;
  }
  return Math.min(0.45, Math.max(g0, g1));
}

function barCategoryGapProp(stretch: number, nSeries: number, stacked: boolean): string {
  const frac = barCategoryGapFractionForStretch(stretch, nSeries, stacked);
  const pct = Math.round(frac * 1000) / 10;
  return `${pct}%`;
}

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
  props?: {
    points?: Array<{ x: number; y: number }>;
    baseLine?: unknown;
  };
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
/** Recharts uses stroke for Line tooltip color; placeholder lines use `stroke="transparent"` (end-marker mode). */
function resolveLineTooltipDisplayColor(
  picked: LineTooltipPayloadEntry,
  seriesKeys: string[] | undefined,
): string {
  const raw = picked.color;
  if (typeof raw === 'string' && raw.trim() !== '' && raw.toLowerCase() !== 'transparent') {
    return raw;
  }
  const dk = picked.dataKey;
  if (dk != null && seriesKeys?.length) {
    const idx = seriesKeys.findIndex((k) => k === dk || String(k) === String(dk));
    if (idx >= 0) return chartSeriesColor(idx);
  }
  return 'var(--slide-text)';
}

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
  seriesKeys?: string[];
}) {
  const {
    active,
    payload,
    label,
    coordinate,
    viewBox,
    valueMin,
    valueMax,
    onHoverEntry,
    geometryRef,
    seriesKeys,
  } = props;

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
    onHoverEntry({
      name,
      value,
      color: resolveLineTooltipDisplayColor(picked, seriesKeys),
      label: labelStr,
    });
  }, [
    active,
    payload,
    label,
    coordinate,
    viewBox,
    valueMin,
    valueMax,
    onHoverEntry,
    pixelYByDataKey,
    seriesKeys,
  ]);

  if (!active || !payload?.length) return null;
  const picked = pickClosestLinePayload(payload, coordinate, viewBox, valueMin, valueMax, pixelYByDataKey);
  const labelStr = label != null ? String(label) : '';
  const displayColor = resolveLineTooltipDisplayColor(picked, seriesKeys);
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
      <div style={{ color: displayColor, fontWeight: 600 }}>
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

const LINE_END_ARROW_LEN = 10;
const LINE_END_ARROW_HALF_W = 4.5;
const LINE_END_CIRCLE_R = 4.5;
const LINE_END_OPEN_STROKE = 2;
/** Extra path length gap between stroke end and marker base (small breathing room for anti-aliasing). */
const LINE_END_STROKE_NUDGE = 0.5;

/** Distance along the path / tangent to leave between stroke end and marker so the line doesn’t run through the head. */
function lineEndMarkerStrokeInset(marker: LineChartEndMarker): number {
  if (marker === 'arrow') return LINE_END_ARROW_LEN + LINE_END_STROKE_NUDGE;
  if (marker === 'circle') return LINE_END_CIRCLE_R + LINE_END_STROKE_NUDGE;
  if (marker === 'openCircle') return LINE_END_CIRCLE_R + LINE_END_OPEN_STROKE / 2 + LINE_END_STROKE_NUDGE;
  return 0;
}

/** Clamp desired inset so a short path still has drawable length; pairs with linear drawLen = p * drawable. */
function lineEndMarkerEffectiveStrokeInset(pathLen: number, marker: LineChartEndMarker): number {
  const raw = lineEndMarkerStrokeInset(marker);
  return Math.min(raw, Math.max(0, pathLen - 0.5));
}

/** Arrow head from tip T and base midpoint B (same frame as stroke end on the path — not a straight offset from T). */
function lineEndArrowPolygonFromChord(
  tx: number,
  ty: number,
  bx: number,
  by: number,
  halfWidth: number,
): string {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return `${tx},${ty} ${tx},${ty} ${tx},${ty}`;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const b1x = bx + px * halfWidth;
  const b1y = by + py * halfWidth;
  const b2x = bx - px * halfWidth;
  const b2y = by - py * halfWidth;
  return `${tx},${ty} ${b1x},${b1y} ${b2x},${b2y}`;
}

/** Walk backward along a polyline by `dist` px from the last point (for arrow base aligned with stroke inset). */
function polylinePointAtDistanceFromEnd(
  points: Array<{ x: number; y: number }>,
  dist: number,
): { x: number; y: number } | null {
  if (!points.length) return null;
  if (points.length < 2 || dist <= 0) return points[points.length - 1]!;
  let remaining = dist;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i]!;
    const b = points[i - 1]!;
    const segLen = Math.hypot(a.x - b.x, a.y - b.y);
    if (remaining <= segLen) {
      return {
        x: a.x + (remaining / segLen) * (b.x - a.x),
        y: a.y + (remaining / segLen) * (b.y - a.y),
      };
    }
    remaining -= segLen;
  }
  return points[0]!;
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

/**
 * (cx, cy) = path end (last data point): arrow tip / circle center sit here so the series stroke
 * does not continue past the marker toward the dot. The animated stroke is shortened by
 * lineEndMarkerStrokeInset so it meets the base / inner edge; this glyph is not shifted backward
 * along the path (that left a gap on the tail and let the native stroke run tip → dot).
 *
 * `arrowBase` = stroke end on the path (arc-length–consistent). Circles ignore it; arrows use it
 * instead of a straight tangent step (which drifts on curves — circles stay symmetric so they look fine).
 */
function LineEndMarkerGlyph({
  marker,
  stroke,
  cx,
  cy,
  angle,
  arrowBase,
}: {
  marker: LineChartEndMarker;
  stroke: string;
  cx: number;
  cy: number;
  angle: number;
  arrowBase?: { x: number; y: number };
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
    if (arrowBase) {
      return (
        <polygon
          points={lineEndArrowPolygonFromChord(cx, cy, arrowBase.x, arrowBase.y, LINE_END_ARROW_HALF_W)}
          fill={stroke}
        />
      );
    }
    const bx = cx - ux * LINE_END_ARROW_LEN;
    const by = cy - uy * LINE_END_ARROW_LEN;
    const px = -uy;
    const py = ux;
    const b1x = bx + px * LINE_END_ARROW_HALF_W;
    const b1y = by + py * LINE_END_ARROW_HALF_W;
    const b2x = bx - px * LINE_END_ARROW_HALF_W;
    const b2y = by - py * LINE_END_ARROW_HALF_W;
    return <polygon points={`${cx},${cy} ${b1x},${b1y} ${b2x},${b2y}`} fill={stroke} />;
  }
  return null;
}

/** Stroke + marker share one progress (stroke-dasharray animation with end marker). */
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
  const [tip, setTip] = useState<{ cx: number; cy: number; angle: number; along: number } | null>(null);

  const dashStyle = useTransform(progress, (p) => {
    if (pathLen <= 0) return '0 0';
    const effectiveInset = lineEndMarkerEffectiveStrokeInset(pathLen, endMarker);
    const front = p * pathLen;
    const drawLen = Math.max(0, front - effectiveInset);
    return `${drawLen}px ${pathLen}px`;
  });

  useLayoutEffect(() => {
    if (!pathD) {
      setPathLen(0);
      return;
    }
    const el = pathRef.current;
    // Do not zero pathLen when `el` is briefly null during reconcile (e.g. tooltip hover); that
    // restarts the dash animation at progress 0 and makes strokes disappear until it completes.
    if (!el) {
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
    const front = p * pathLen;
    const pt = el.getPointAtLength(front);
    const pt0 = el.getPointAtLength(Math.max(0, front - 2));
    const angle = Math.atan2(pt.y - pt0.y, pt.x - pt0.x);
    setTip({ cx: pt.x, cy: pt.y, angle, along: front });
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

  let arrowBaseLine: { x: number; y: number } | undefined;
  if (endMarker === 'arrow' && tip && pathRef.current && pathLen > 0) {
    try {
      const effectiveInset = lineEndMarkerEffectiveStrokeInset(pathLen, endMarker);
      const strokeEndAlong = Math.max(0, tip.along - effectiveInset);
      const bp = pathRef.current.getPointAtLength(strokeEndAlong);
      arrowBaseLine = { x: bp.x, y: bp.y };
    } catch {
      arrowBaseLine = undefined;
    }
  }

  return (
    <g className="slide-chart-line-series--with-end-marker">
      <motion.path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeLinejoin="round"
        style={{ strokeDasharray: dashStyle }}
      />
      {tip && endMarker !== 'none' ? (
        <LineEndMarkerGlyph
          marker={endMarker}
          stroke={stroke}
          cx={tip.cx}
          cy={tip.cy}
          angle={tip.angle}
          arrowBase={arrowBaseLine}
        />
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

/** Build an SVG area-fill path: line path → bottom edge → close. */
function areaFillPath(
  points: Array<{ x: number; y: number }>,
  bottomY: number,
): string {
  if (points.length < 2) return '';
  const linePath = getPath({ points, type: 'monotone', layout: 'horizontal', connectNulls: false });
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePath} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
}

function SlideLineChartAnimatedEndMarkers({
  formattedGraphicalItems,
  seriesKeys,
  fillUnderLines,
  endMarker,
  offset,
}: {
  formattedGraphicalItems?: FormattedGraphicalItem[];
  seriesKeys: string[];
  fillUnderLines: boolean;
  endMarker: LineChartEndMarker;
  offset?: { top?: number; height?: number };
}) {
  if (endMarker === 'none') return null;

  const bottomY = (offset?.top ?? 0) + (offset?.height ?? 0);

  return (
    <g className="slide-chart-line-end-markers" aria-hidden pointerEvents="none">
      {fillUnderLines
        ? seriesKeys.map((key, i) => {
            const gi = findFormattedItemForKey(formattedGraphicalItems, key);
            const pts = filterLinePoints(gi?.props?.points as Array<{ x?: number; y?: number }> | undefined);
            if (pts.length < 2) return null;
            const stroke = chartSeriesColor(i);
            return (
              <path
                key={`${key}-fill`}
                d={areaFillPath(pts, bottomY)}
                fill={stroke}
                fillOpacity={LINE_AREA_FILL_OPACITY}
              />
            );
          })
        : null}
      {seriesKeys.map((key, i) => {
        const gi = findFormattedItemForKey(formattedGraphicalItems, key);
        const pts = filterLinePoints(gi?.props?.points as Array<{ x?: number; y?: number }> | undefined);
        if (pts.length < 2) return null;
        const stroke = chartSeriesColor(i);
        const strokeW = 3.5 + (i % 2) * 0.65;
        const beginMs = PATH_ANIM_MS * (0.35 + i * 0.12);

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
  const hasEndMarker = lineChartEndMarker !== 'none';

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

  const onLegendHover = useCallback((_entry: LineChartLegendLine | null) => {}, []);

  const lineChartGeometryRef = useRef<LineChartGeometrySnapshot | null>(null);
  const renderLineEndMarkers = useCallback(
    (props: Record<string, unknown>) => (
      <SlideLineChartAnimatedEndMarkers
        endMarker={lineChartEndMarker}
        fillUnderLines={fillUnderLines}
        formattedGraphicalItems={props.formattedGraphicalItems as FormattedGraphicalItem[] | undefined}
        seriesKeys={seriesKeys}
        offset={props.offset as { top?: number; height?: number } | undefined}
      />
    ),
    [fillUnderLines, lineChartEndMarker, seriesKeys],
  );

  const chartSettleMs = slideLineChartSettleMs(seriesKeys.length);

  return (
    <div
      className="slide-chart-embed slide-chart-embed--line"
      role="img"
      aria-label="Animated line and area chart"
      data-ms-chart-settle-ms={String(chartSettleMs)}
    >
      <div className="slide-chart-embed__chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={RECHARTS_CARTESIAN_MARGIN}>
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
                  seriesKeys={seriesKeys}
                />
              )}
              cursor={{ stroke: 'color-mix(in srgb, var(--slide-accent) 50%, transparent)' }}
            />
            {hasEndMarker
              ? /* Lines only — strokes + arrows drawn by Customized; area fill drawn manually */
                seriesKeys.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={labelForKey(key)}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                ))
              : fillUnderLines
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
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={labelForKey(key)}
                        stroke={stroke}
                        strokeWidth={3.5 + (j % 2) * 0.65}
                        dot={{ r: 3.75, fill: stroke, strokeWidth: 0 }}
                        activeDot={false}
                        isAnimationActive
                        animationDuration={PATH_ANIM_MS}
                        animationBegin={PATH_ANIM_MS * (0.35 + j * 0.12)}
                        animationEasing="ease-out"
                      />
                    );
                  })}
            {hasEndMarker ? (
              <Customized
                component={renderLineEndMarkers}
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
    const categoryGap = barCategoryGapProp(BAR_CHART_WIDTH_STRETCH, Math.max(1, nSeries), stacked);
    if (nSeries === 0) {
      return { barGap: undefined as string | undefined, barCategoryGap: categoryGap, maxBarSize: 64 };
    }
    /*
     * Stacked / single-series: cap bar width so stacks aren’t full-band slabs; keep barCategoryGap
     * low so category spacing stays tight (min(originalSize, maxBarSize) centers bars in each band).
     * Grouped: higher maxBarSize so pitch-driven width isn’t capped below the natural band size.
     * With BAR_CHART_WIDTH_STRETCH > 1, categoryGap grows so bar thickness stays ~constant.
     */
    if (stacked || nSeries === 1) {
      return {
        barGap: undefined as string | undefined,
        barCategoryGap: categoryGap,
        maxBarSize: 64 as const,
      };
    }
    return {
      barGap: nSeries >= 3 ? ('1%' as const) : ('2%' as const),
      barCategoryGap: categoryGap,
      maxBarSize: 64 as const,
    };
  }, [nSeries, stacked]);

  const barGapProp = !stacked && nSeries > 1 ? layout.barGap : undefined;

  const nCategories = Math.max(1, chartData.length);
  const pitchPx = barPitchPxForMinBarWidth(nSeries, stacked);
  const barChartOuterWidthPx = Math.round(
    (nCategories * pitchPx + BAR_CHART_SVG_WIDTH_CHROME_PX) * SLIDE_CHART_W_SCALE * BAR_CHART_WIDTH_STRETCH,
  );
  const chartSettleMs = slideBarChartSettleMs(chartData.length, nSeries, stacked);

  return (
    <div
      className="slide-chart-embed slide-chart-embed--bar"
      role="img"
      aria-label={stacked ? 'Animated stacked bar chart' : 'Animated bar chart'}
      data-ms-chart-settle-ms={String(chartSettleMs)}
      style={{
        width: `min(100%, ${barChartOuterWidthPx}px)`,
        maxWidth: '100%',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={RECHARTS_CARTESIAN_MARGIN}
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
        : { top: 10, right: 12, left: 12, bottom: 10 };

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

  const chartSettleMs = slidePieChartSettleMs();

  return (
    <div
      className={`slide-chart-embed slide-chart-embed--pie slide-chart-embed--pie-legend-${legendPosition}`}
      role="img"
      aria-label="Animated pie chart"
      data-ms-chart-settle-ms={String(chartSettleMs)}
    >
      {legendPosition === 'left' ? legendList : null}
      {chartBlock}
      {legendPosition === 'right' ? legendList : null}
      {legendPosition === 'bottom' ? legendList : null}
    </div>
  );
}

