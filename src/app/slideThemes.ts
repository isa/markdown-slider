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
  /** CSS `max-width` on `.slide-root` (e.g. `90%`, `72rem`, `min(100%, 48rem)`) */
  maxWidth: '--slide-root-max-width',
  /** Same as `maxWidth` — if both are set under `slide:`, the later key in OVERRIDE_KEYS wins (`width`). */
  width: '--slide-root-max-width',
};

function mergeOverrides(
  base: SlideCssVars,
  slide?: Record<string, unknown>,
  data?: Record<string, unknown>,
): SlideCssVars {
  const out = { ...base };
  if (slide && typeof slide === 'object') {
    for (const [key, cssVar] of Object.entries(OVERRIDE_KEYS)) {
      const v = slide[key];
      if (v !== undefined && v !== null) out[cssVar] = String(v);
    }
  }
  if (out['--slide-root-max-width'] === undefined && data) {
    const top = data.width ?? data.maxWidth;
    if (top !== undefined && top !== null && String(top).trim()) {
      out['--slide-root-max-width'] = String(top).trim();
    }
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
  const vars = mergeOverrides(baseVars, slide, data);
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

/** YAML `cornerPosition:` — anchor for `cornerImage:` */
export type SlideCornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Single CSS filter step for `cornerAppearance:` / `cornerFilter:` (can combine several). */
export type SlideCornerFilterToken = 'grayscale' | 'white' | 'invert';

const CORNER_FILTER_CSS: Record<SlideCornerFilterToken, string> = {
  grayscale: 'grayscale(1)',
  white: 'brightness(0) invert(1)',
  invert: 'invert(1)',
};

/** Combined `filter` value for `<img>` — order matches frontmatter (left to right). */
export function cornerImageFilterCss(tokens: SlideCornerFilterToken[]): string | undefined {
  if (!tokens.length) return undefined;
  return tokens.map((t) => CORNER_FILTER_CSS[t]).join(' ');
}

/** `outward` | `soft` | `strong` = radial mask centered on slide corner; `linear` = legacy diagonal fade */
export type SlideCornerGradient = 'outward' | 'soft' | 'strong' | 'linear';

/** Parsed `cornerImage:` and related frontmatter */
export interface SlideCornerDecoration {
  src: string;
  position: SlideCornerPosition;
  scale: number;
  /** From `cornerAppearance:` — one or more of grayscale, white, invert */
  filters: SlideCornerFilterToken[];
  /** 0–1, multiplied with the gradient mask */
  opacity: number;
  gradient: SlideCornerGradient;
  /**
   * Optional radial mask circle radius (`cornerGradientRadius:` or `cornerGradientLength:`), e.g. `180px`,
   * `12rem`, `45%`, or a positive number (interpreted as `px`). Overrides preset `cornerGradient` stop distances.
   */
  gradientRadius?: string;
}

function parseCornerPosition(raw: unknown): SlideCornerPosition | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase().replace(/_/g, '-');
  const c = s.replace(/-/g, '');
  if (c === 'topleft') return 'top-left';
  if (c === 'topright') return 'top-right';
  if (c === 'bottomleft') return 'bottom-left';
  if (c === 'bottomright') return 'bottom-right';
  return undefined;
}

function parseCornerScale(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw.trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

function parseCornerOpacity(raw: unknown): number {
  if (raw === undefined || raw === null) return 1;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(1, Math.max(0, raw));
  }
  if (typeof raw === 'string') {
    const n = parseFloat(raw.trim());
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return 1;
}

function parseCornerGradient(raw: unknown): SlideCornerGradient {
  if (typeof raw !== 'string') return 'outward';
  const s = raw.trim().toLowerCase();
  if (s === 'soft' || s === 'strong' || s === 'outward' || s === 'linear') return s;
  return 'outward';
}

/** `cornerGradientRadius:` / `cornerGradientLength:` — CSS length for radial mask circle (number → px). */
function parseCornerGradientRadius(d: Record<string, unknown>): string | undefined {
  const raw = d.cornerGradientRadius ?? d.cornerGradientLength;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return `${raw}px`;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return undefined;
}

function parseOneCornerFilterToken(s: string): SlideCornerFilterToken | undefined {
  const t = s.trim().toLowerCase();
  if (t === 'grayscale' || t === 'grey' || t === 'gray') return 'grayscale';
  if (t === 'white' || t === 'silhouette') return 'white';
  if (t === 'invert' || t === 'inverted' || t === 'inverse') return 'invert';
  if (t === 'none' || t === 'off' || t === 'false') return undefined;
  return undefined;
}

/** `cornerAppearance: grayscale` or `invert, grayscale` or YAML `[invert, grayscale]` */
function parseCornerFilters(raw: unknown): SlideCornerFilterToken[] {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        for (const seg of item.split(',')) {
          const p = seg.trim();
          if (p) parts.push(p);
        }
      }
    }
  } else if (typeof raw === 'string') {
    for (const seg of raw.split(',')) {
      const p = seg.trim();
      if (p) parts.push(p);
    }
  }
  const out: SlideCornerFilterToken[] = [];
  const seen = new Set<SlideCornerFilterToken>();
  for (const p of parts) {
    const tok = parseOneCornerFilterToken(p);
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

function parseCornerDecoration(d: Record<string, unknown>): SlideCornerDecoration | undefined {
  const srcRaw = d.cornerImage;
  if (typeof srcRaw !== 'string' || !srcRaw.trim()) return undefined;
  const filters = parseCornerFilters(d.cornerAppearance ?? d.cornerFilter);
  return {
    src: srcRaw.trim(),
    position: parseCornerPosition(d.cornerPosition) ?? 'top-right',
    scale: parseCornerScale(d.cornerScale),
    filters,
    opacity: parseCornerOpacity(d.cornerOpacity),
    gradient: parseCornerGradient(d.cornerGradient),
    gradientRadius: parseCornerGradientRadius(d),
  };
}

/** YAML `slideLogo:` / `logoImage:` — inset brand mark (no gradient mask; distinct from `cornerImage:`) */
export interface SlideLogo {
  src: string;
  position: SlideCornerPosition;
  scale: number;
  /** CSS length(s), e.g. `1.5rem` or `1rem 2rem` (vertical / horizontal inset from the chosen corner). */
  padding: string;
  /** From `logoAppearance:` — same tokens as corner */
  filters: SlideCornerFilterToken[];
  opacity: number;
  alt?: string;
}

function parseLogoPadding(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '1.25rem';
  return raw.trim();
}

function parseSlideLogo(d: Record<string, unknown>): SlideLogo | undefined {
  const srcRaw = d.slideLogo ?? d.logoImage;
  if (typeof srcRaw !== 'string' || !srcRaw.trim()) return undefined;
  const filters = parseCornerFilters(d.logoAppearance ?? d.logoFilter);
  const altRaw = d.logoAlt;
  return {
    src: srcRaw.trim(),
    position: parseCornerPosition(d.logoPosition) ?? 'top-right',
    scale: parseCornerScale(d.logoScale),
    padding: parseLogoPadding(d.logoPadding),
    filters,
    opacity: parseCornerOpacity(d.logoOpacity),
    alt: typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : undefined,
  };
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
  /** YAML `cornerImage:` — optional corner watermark with position, scale, filters */
  cornerDecoration?: SlideCornerDecoration;
  /** YAML `slideLogo:` / `logoImage:` — inset logo (no gradient); uses `logoPadding` for distance from edges */
  slideLogo?: SlideLogo;
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

  const cornerDecoration = parseCornerDecoration(d);
  const slideLogo = parseSlideLogo(d);

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
    cornerDecoration,
    slideLogo,
  };
}
