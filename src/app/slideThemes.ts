import type { CSSProperties } from 'react';
import matter from 'gray-matter';
import type { LineChartEndMarker } from './components/SlideChartEmbeds';
import { parseChartRowsFromFrontmatter, type SlideChartRow } from './slideChartData';

export type { SlideChartRow } from './slideChartData';
import {
  loadPalettePresets,
  loadFontPresets,
  mergePaletteAndFontVars,
  type FontPreset,
  type PalettePreset,
} from './themeLoader';
import { LEGACY_THEME_BUNDLES, getLegacyThemeBundleIds } from './legacyThemeBundles';

const PALETTES = loadPalettePresets();
const FONTS = loadFontPresets();

/** Deck-level defaults from `metadata.md` (and optional legacy `defaultTheme`). */
export interface DeckSlideThemeDefaults {
  defaultTheme?: string;
  defaultPalette?: string;
  defaultFont?: string;
}

/** CSS variable keys applied to `.slide-root` */
export type SlideCssVars = Record<string, string>;

export type SlideColorMode = 'light' | 'dark';

/** Visual layout for markdown slides (YAML `layout:`). Default: `content`. */
export type SlideLayout = 'content' | 'cover' | 'infographic' | 'image' | 'quote';

function parseSlideLayout(raw: unknown): SlideLayout {
  if (
    raw === 'cover' ||
    raw === 'infographic' ||
    raw === 'image' ||
    raw === 'content' ||
    raw === 'quote'
  ) {
    return raw;
  }
  return 'content';
}

export interface ResolvedSlideTheme {
  /** Composite id, e.g. `default/libre-baskerville-franklin` */
  id: string;
  paletteId: string;
  fontId: string;
  /** CSS custom properties for inline style on slide root */
  cssVariables: CSSProperties;
  /** Optional class on slide root for entrance animation */
  rootClassName?: string;
  /** Whole-slide text alignment from frontmatter `align` */
  align?: 'left' | 'center' | 'right';
}

/** Registered palette ids (`themes/palettes/*.yaml`) */
export function getRegisteredPaletteIds(): string[] {
  return Object.keys(PALETTES).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Registered font pack ids (`themes/fonts/*.yaml`) */
export function getRegisteredFontIds(): string[] {
  return Object.keys(FONTS).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Legacy bundle ids for `theme:` / `defaultTheme` (each maps to a palette + font pair). */
export function getRegisteredThemeIds(): string[] {
  return getLegacyThemeBundleIds();
}

function resolveDeckPaletteFont(deck?: DeckSlideThemeDefaults): { palette: string; font: string } {
  if (!deck) return { ...LEGACY_THEME_BUNDLES.default };
  const dp = typeof deck.defaultPalette === 'string' && deck.defaultPalette.trim();
  const df = typeof deck.defaultFont === 'string' && deck.defaultFont.trim();
  if (dp || df) {
    return {
      palette: dp ? deck.defaultPalette!.trim() : 'default',
      font: df ? deck.defaultFont!.trim() : 'libre-baskerville-franklin',
    };
  }
  const dt = typeof deck.defaultTheme === 'string' && deck.defaultTheme.trim();
  if (dt && LEGACY_THEME_BUNDLES[dt]) {
    return { ...LEGACY_THEME_BUNDLES[dt] };
  }
  if (dt && dt in PALETTES) {
    return { palette: dt, font: 'libre-baskerville-franklin' };
  }
  return { ...LEGACY_THEME_BUNDLES.default };
}

function resolveSlidePaletteAndFont(
  data: Record<string, unknown>,
  deck?: DeckSlideThemeDefaults,
): { palette: PalettePreset; font: FontPreset } {
  const deckR = resolveDeckPaletteFont(deck);

  let paletteId =
    typeof data.palette === 'string' && data.palette.trim() ? data.palette.trim() : '';
  let fontId = typeof data.font === 'string' && data.font.trim() ? data.font.trim() : '';

  const themeLegacy =
    typeof data.theme === 'string' && data.theme.trim() ? data.theme.trim() : '';
  if (themeLegacy) {
    const bundle = LEGACY_THEME_BUNDLES[themeLegacy];
    if (bundle) {
      if (!paletteId) paletteId = bundle.palette;
      if (!fontId) fontId = bundle.font;
    } else if (themeLegacy in PALETTES) {
      if (!paletteId) paletteId = themeLegacy;
    }
  }

  if (!paletteId) paletteId = deckR.palette;
  if (!fontId) fontId = deckR.font;

  const palette = PALETTES[paletteId] ?? PALETTES.default;
  const font = FONTS[fontId] ?? FONTS['libre-baskerville-franklin'];

  return { palette, font };
}

/** Maps frontmatter `slide` keys to CSS variable names */
const OVERRIDE_KEYS: Record<string, string> = {
  fontHeading: '--slide-font-heading',
  fontBody: '--slide-font-body',
  fontMono: '--slide-font-mono',
  fontSizeH1: '--slide-font-size-h1',
  fontSizeH2: '--slide-font-size-h2',
  fontSizeH3: '--slide-font-size-h3',
  fontSizeBody: '--slide-font-size-body',
  lineHeightBody: '--slide-line-height-body',
  text: '--slide-text',
  textMuted: '--slide-text-muted',
  headingColor: '--slide-heading-color',
  headingH1Color: '--slide-heading-h1-color',
  headingH2Color: '--slide-heading-h2-color',
  headingH3Color: '--slide-heading-h3-color',
  headingWeight1: '--slide-heading-weight-1',
  headingWeight2: '--slide-heading-weight-2',
  headingWeight3: '--slide-heading-weight-3',
  accent: '--slide-accent',
  bg: '--slide-bg',
  bulletColor: '--slide-bullet-color',
  listSpacing: '--slide-list-spacing',
  imageRadius: '--slide-image-radius',
  imageShadow: '--slide-image-shadow',
  imageMaxWidth: '--slide-image-max-width',
  codeBg: '--slide-code-bg',
  codeText: '--slide-code-text',
  blockquoteBorder: '--slide-blockquote-border',
  tableBorder: '--slide-table-border',
  tableHeaderBg: '--slide-table-header-bg',
  columnGap: '--slide-column-gap',
};

function mergeOverrides(base: SlideCssVars, slide?: Record<string, unknown>): SlideCssVars {
  if (!slide || typeof slide !== 'object') return { ...base };
  const out = { ...base };
  for (const [key, cssVar] of Object.entries(OVERRIDE_KEYS)) {
    const v = slide[key];
    if (v !== undefined && v !== null) out[cssVar] = String(v);
  }
  return out;
}

export function resolveSlideTheme(
  data: Record<string, unknown>,
  colorMode: SlideColorMode = 'dark',
  deckDefaults?: DeckSlideThemeDefaults,
): ResolvedSlideTheme {
  const { palette, font } = resolveSlidePaletteAndFont(data, deckDefaults);
  const baseVars = mergePaletteAndFontVars(palette, font, colorMode);
  const slide = data.slide as Record<string, unknown> | undefined;
  const vars = mergeOverrides(baseVars, slide);
  const cssVariables = vars as unknown as CSSProperties;

  let rootClassName = palette.rootClassName;
  if (slide?.entrance === 'stagger' || vars['--slide-entrance'] === 'stagger') {
    rootClassName = 'slide-root--stagger';
  }

  let align: 'left' | 'center' | 'right' | undefined;
  const alignRaw = data.align ?? slide?.align ?? palette.defaultAlign;
  if (alignRaw === 'left' || alignRaw === 'center' || alignRaw === 'right') {
    align = alignRaw;
  }

  return {
    id: `${palette.id}/${font.id}`,
    paletteId: palette.id,
    fontId: font.id,
    cssVariables,
    rootClassName,
    align,
  };
}

function normalizeDeckThemeDefaults(
  deck?: DeckSlideThemeDefaults | string,
): DeckSlideThemeDefaults | undefined {
  if (deck === undefined) return undefined;
  if (typeof deck === 'string') return { defaultTheme: deck };
  return deck;
}

export function parseSlideMarkdown(
  raw: string,
  isDarkMode = false,
  deckThemeDefaults?: DeckSlideThemeDefaults | string,
): {
  body: string;
  theme: ResolvedSlideTheme;
  title?: string;
  subtitle?: string;
  layout: SlideLayout;
  /** Full-bleed cover background URL when `layout: cover` and `backgroundImage:` is set in frontmatter */
  coverBackgroundImage?: string;
  /** `layout: image` — optional CSS length for max-width of the figure (e.g. `80%`, `28rem`) */
  imageLayoutMaxWidth?: string;
  /** `layout: image` — optional CSS length for max-height of the image (e.g. `50vh`, `400px`) */
  imageLayoutMaxHeight?: string;
  /** `layout: image` — small caption below the image (e.g. "Figure 01 — …") */
  imageCaption?: string;
  /** YAML `lineChart:` rows for `<div class="slide-embed-line-chart">` (first column = X, next = series) */
  lineChart?: SlideChartRow[];
  /** YAML `barChart:` rows for `<div class="slide-embed-bar-chart">` */
  barChart?: SlideChartRow[];
  /** YAML `pieChart:` rows for `<div class="slide-embed-pie-chart">` */
  pieChart?: SlideChartRow[];
  /** YAML `pieChartLegendPosition:` — `left` | `right` | `bottom` (default) */
  pieChartLegendPosition?: 'left' | 'right' | 'bottom';
  /** YAML `barChartStacked: true` — stacked bars instead of grouped */
  barChartStacked?: boolean;
  /** YAML `lineChartArea:` or `area:` — fill under lines at 10% of stroke; `false` = lines only */
  lineChartArea?: boolean;
  /** YAML `lineChartEndMarker:` / `lineEndMarker:` — `arrow` | `circle` | `openCircle` */
  lineChartEndMarker?: LineChartEndMarker;
  /** YAML `mermaidNodes:` — `filled` (default) or `outline` (stroke-only flowchart boxes) */
  mermaidNodes?: 'filled' | 'outline';
} {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  const layout = parseSlideLayout(d.layout);
  const colorMode: SlideColorMode = isDarkMode ? 'dark' : 'light';
  const theme = resolveSlideTheme(d, colorMode, normalizeDeckThemeDefaults(deckThemeDefaults));
  const titleRaw = d.title;
  const subtitleRaw = d.subtitle;
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : undefined;
  const subtitleParsed =
    typeof subtitleRaw === 'string' && subtitleRaw.trim() ? subtitleRaw.trim() : undefined;
  const subtitle =
    layout === 'infographic' || layout === 'image' ? undefined : subtitleParsed;
  const bgRaw = d.backgroundImage;
  let coverBackgroundImage: string | undefined;
  if (
    layout === 'cover' &&
    typeof bgRaw === 'string' &&
    bgRaw.trim()
  ) {
    coverBackgroundImage = bgRaw.trim();
  }

  let imageLayoutMaxWidth: string | undefined;
  let imageLayoutMaxHeight: string | undefined;
  let imageCaption: string | undefined;
  if (layout === 'image') {
    const cap = d.caption;
    if (typeof cap === 'string' && cap.trim()) {
      imageCaption = cap.trim();
    }
    const iw = d.imageWidth;
    if (typeof iw === 'string' && iw.trim()) {
      imageLayoutMaxWidth = iw.trim();
    }
    const ih = d.imageHeight;
    if (typeof ih === 'string' && ih.trim()) {
      imageLayoutMaxHeight = ih.trim();
    }
  }

  const lineChart = parseChartRowsFromFrontmatter(d.lineChart);
  const barChart = parseChartRowsFromFrontmatter(d.barChart);
  const pieChart = parseChartRowsFromFrontmatter(d.pieChart);
  let pieChartLegendPosition: 'left' | 'right' | 'bottom' | undefined;
  const plpRaw =
    d.pieChartLegendPosition ??
    d.pieLegendPosition ??
    (typeof (d as Record<string, unknown>).pie_chart_legend_position === 'string'
      ? (d as Record<string, unknown>).pie_chart_legend_position
      : undefined);
  if (typeof plpRaw === 'string') {
    const s = plpRaw.trim().toLowerCase();
    if (s === 'left' || s === 'right' || s === 'bottom') pieChartLegendPosition = s;
  }
  const bcs = d.barChartStacked;
  let barChartStacked: boolean | undefined;
  if (bcs === true || bcs === 'true' || bcs === 1) barChartStacked = true;
  else if (bcs === false || bcs === 'false' || bcs === 0) barChartStacked = false;

  const lca = d.lineChartArea ?? d.area;
  let lineChartArea: boolean | undefined;
  if (lca === true || lca === 'true' || lca === 1) lineChartArea = true;
  else if (lca === false || lca === 'false' || lca === 0) lineChartArea = false;

  let lineChartEndMarker: LineChartEndMarker | undefined;
  const lemRaw = d.lineChartEndMarker ?? d.lineEndMarker;
  if (typeof lemRaw === 'string') {
    const s = lemRaw.trim().toLowerCase().replace(/[-_]/g, '');
    if (s === 'arrow') lineChartEndMarker = 'arrow';
    else if (s === 'circle' || s === 'dot' || s === 'disc') lineChartEndMarker = 'circle';
    else if (s === 'opencircle' || s === 'open' || s === 'ring' || s === 'hollow')
      lineChartEndMarker = 'openCircle';
    else if (s === 'none' || s === 'off' || s === 'false') lineChartEndMarker = 'none';
  }

  let mermaidNodes: 'filled' | 'outline' | undefined;
  const mn = d.mermaidNodes;
  if (typeof mn === 'string') {
    const s = mn.trim().toLowerCase();
    if (s === 'outline' || s === 'outline-only' || s === 'stroke') mermaidNodes = 'outline';
    else if (s === 'filled' || s === 'fill solid') mermaidNodes = 'filled';
  }

  return {
    body: content.trim(),
    theme,
    title,
    subtitle,
    layout,
    coverBackgroundImage,
    imageLayoutMaxWidth,
    imageLayoutMaxHeight,
    imageCaption,
    lineChart,
    barChart,
    pieChart,
    pieChartLegendPosition,
    barChartStacked,
    lineChartArea,
    lineChartEndMarker,
    mermaidNodes,
  };
}
