import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

const MAX_BAR_SERIES = 12;
/** Max numeric series on line chart (first = area, rest = lines). */
const MAX_LINE_SERIES = 5;

const tooltipStyle = {
  backgroundColor: 'color-mix(in srgb, var(--slide-code-bg) 95%, transparent)',
  border: '1px solid var(--slide-table-border)',
  borderRadius: '0.375rem',
  fontSize: '0.75rem',
};

/** Slower motion — bar growth, line/area path */
const BAR_GROW_MS = 650;
const BAR_STAGGER_MS = 52;
const BAR_SERIES_OFFSET_MS = 36;
const PATH_ANIM_MS = 650;

function staggeredBarShape(seriesOffsetMs: number) {
  return function StaggeredBarShape(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    fill?: string;
    index?: number;
  }) {
    const x = Number(props.x);
    const y = Number(props.y);
    const w = Number(props.width);
    const h = Number(props.height);
    const fill = props.fill ?? 'var(--slide-accent)';
    const index = props.index ?? 0;
    if (!Number.isFinite(h) || h <= 0) return null;

    const bottomY = y + h;
    const delaySec = (index * BAR_STAGGER_MS + seriesOffsetMs) / 1000;

    return (
      <motion.rect
        x={x}
        width={w}
        rx={4}
        ry={4}
        fill={fill}
        initial={{ y: bottomY, height: 0 }}
        animate={{ y, height: h }}
        transition={{
          duration: BAR_GROW_MS / 1000,
          delay: delaySec,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
    );
  };
}

function labelForKey(key: string): string {
  return key.replace(/_/g, ' ');
}

function fillForBarSeriesIndex(i: number): string {
  if (i === 0) return 'var(--slide-accent)';
  if (i === 1) return 'color-mix(in srgb, var(--slide-accent) 48%, var(--slide-heading-h2-color))';
  if (i === 2) return 'color-mix(in srgb, var(--slide-accent) 35%, var(--slide-heading-h3-color))';
  const t = Math.min(0.65, 0.2 + i * 0.08);
  return `color-mix(in srgb, var(--slide-accent) ${Math.round((1 - t) * 100)}%, var(--slide-text-muted))`;
}

/**
 * Recharts `radius` tuple is [topLeft, topRight, bottomRight, bottomLeft] (see `getRectanglePath` in recharts).
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
 * Strokes for Line series after the Area (indices 0..3 = 2nd..5th numeric column).
 * Uses separate hue families so lines read clearly against each other and the accent area.
 */
function strokeForLineAfterArea(lineIndex: number): string {
  switch (lineIndex) {
    case 0:
      return 'var(--slide-code-text)';
    case 1:
      return 'var(--slide-bullet-color)';
    case 2:
      return 'var(--slide-blockquote-border)';
    case 3:
      return 'color-mix(in srgb, var(--slide-accent) 40%, var(--slide-bullet-color))';
    default:
      return 'var(--slide-text-muted)';
  }
}

function strokeForLineSeries(seriesIndex: number): string {
  if (seriesIndex === 0) return 'var(--slide-accent)';
  return strokeForLineAfterArea(seriesIndex - 1);
}

/** Fill under each series = stroke color at this opacity (YAML `lineChartArea` / `area` true). */
const LINE_AREA_FILL_OPACITY = 0.1;

export interface SlideChartEmbedProps {
  /** From YAML `lineChart:` / `barChart:`; first column = category, rest = numeric series in column order. */
  data?: SlideChartRow[];
}

export interface SlideLineChartEmbedProps extends SlideChartEmbedProps {
  /** YAML `lineChartArea:` or `area:` — `false` = lines only; omitted / `true` = fill under each series at 10% of stroke. */
  lineChartArea?: boolean;
}

export function SlideLineChartEmbed({ data, lineChartArea }: SlideLineChartEmbedProps) {
  const fillUnderLines = lineChartArea !== false;

  const spec = useMemo(() => {
    const rows = data?.length ? data : DEFAULT_LINE;
    let keys = inferChartKeys(rows[0]);
    if (!keys.valueKeys.length) {
      const fb = DEFAULT_LINE;
      keys = inferChartKeys(fb[0]);
      const seriesKeys = keys.valueKeys.slice(0, MAX_LINE_SERIES);
      return {
        chartData: normalizeRowsNumeric(fb, seriesKeys),
        xKey: keys.xKey,
        seriesKeys,
      };
    }
    const seriesKeys = keys.valueKeys.slice(0, MAX_LINE_SERIES);
    return {
      chartData: normalizeRowsNumeric(rows, seriesKeys),
      xKey: keys.xKey,
      seriesKeys,
    };
  }, [data]);

  const { chartData, xKey, seriesKeys } = spec;

  return (
    <div className="slide-chart-embed" role="img" aria-label="Animated line and area chart">
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
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--slide-text)' }}
            cursor={{ stroke: 'color-mix(in srgb, var(--slide-accent) 50%, transparent)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }}
            formatter={(value) => <span style={{ color: 'var(--slide-text-muted)' }}>{value}</span>}
          />
          {fillUnderLines
            ? seriesKeys.map((key, i) => {
                const stroke = strokeForLineSeries(i);
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
                    activeDot={{ r: 6.5 }}
                    isAnimationActive
                    animationDuration={PATH_ANIM_MS}
                    animationBegin={PATH_ANIM_MS * (0.12 * i)}
                    animationEasing="ease-out"
                  />
                );
              })
            : seriesKeys.map((key, j) => {
                const stroke = strokeForLineSeries(j);
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={labelForKey(key)}
                    stroke={stroke}
                    strokeWidth={3.5 + (j % 2) * 0.65}
                    dot={{ r: 3.75, fill: stroke, strokeWidth: 0 }}
                    activeDot={{ r: 6.5 }}
                    isAnimationActive
                    animationDuration={PATH_ANIM_MS}
                    animationBegin={PATH_ANIM_MS * (0.35 + j * 0.12)}
                    animationEasing="ease-out"
                  />
                );
              })}
        </ComposedChart>
      </ResponsiveContainer>
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
      return {
        chartData: normalizeRowsNumeric(fb, keys.valueKeys),
        xKey: keys.xKey,
        barKeys: keys.valueKeys.slice(0, MAX_BAR_SERIES),
      };
    }
    return {
      chartData: normalizeRowsNumeric(rows, keys.valueKeys),
      xKey: keys.xKey,
      barKeys: keys.valueKeys.slice(0, MAX_BAR_SERIES),
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
              fill={fillForBarSeriesIndex(si)}
              radius={stacked ? stackedBarRadius(si, nSeries) : [4, 4, 0, 0]}
              maxBarSize={layout.maxBarSize}
              stackId={stacked ? 'slide-stack' : undefined}
              isAnimationActive={stacked}
              animationDuration={stacked ? BAR_GROW_MS : undefined}
              animationEasing={stacked ? 'ease-out' : undefined}
              shape={stacked ? undefined : staggeredBarShape(si * BAR_SERIES_OFFSET_MS)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
