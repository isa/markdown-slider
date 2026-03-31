import type { CSSProperties } from 'react';
import matter from 'gray-matter';
import { loadThemePresets, type ThemePreset } from './themeLoader';

/** CSS variable keys applied to `.slide-root` */
export type SlideCssVars = Record<string, string>;

export type SlideColorMode = 'light' | 'dark';

export interface ResolvedSlideTheme {
  id: string;
  /** CSS custom properties for inline style on slide root */
  cssVariables: CSSProperties;
  /** Optional class on slide root for entrance animation */
  rootClassName?: string;
  /** Whole-slide text alignment from frontmatter `align` */
  align?: 'left' | 'center' | 'right';
}

const PRESETS: Record<string, ThemePreset> = loadThemePresets();

/** Theme ids available from `/themes/*.yaml` (for docs and tooling) */
export function getRegisteredThemeIds(): string[] {
  return Object.keys(PRESETS).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
): ResolvedSlideTheme {
  const requested = typeof data.theme === 'string' ? data.theme.trim() : '';
  const themeId = requested && requested in PRESETS ? requested : 'default';
  const preset = PRESETS[themeId] ?? PRESETS.default;
  const slide = data.slide as Record<string, unknown> | undefined;
  const baseVars = colorMode === 'light' ? preset.varsLight : preset.varsDark;
  const vars = mergeOverrides(baseVars, slide);
  const cssVariables = vars as unknown as CSSProperties;

  let rootClassName = preset.rootClassName;
  if (slide?.entrance === 'stagger' || vars['--slide-entrance'] === 'stagger') {
    rootClassName = 'slide-root--stagger';
  }

  let align: 'left' | 'center' | 'right' | undefined;
  const alignRaw = data.align ?? slide?.align ?? preset.defaultAlign;
  if (alignRaw === 'left' || alignRaw === 'center' || alignRaw === 'right') {
    align = alignRaw;
  }

  return {
    id: preset.id,
    cssVariables,
    rootClassName,
    align,
  };
}

export function parseSlideMarkdown(
  raw: string,
  isDarkMode = true,
): {
  body: string;
  theme: ResolvedSlideTheme;
  title?: string;
  subtitle?: string;
} {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  const colorMode: SlideColorMode = isDarkMode ? 'dark' : 'light';
  const theme = resolveSlideTheme(d, colorMode);
  const titleRaw = d.title;
  const subtitleRaw = d.subtitle;
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : undefined;
  const subtitle =
    typeof subtitleRaw === 'string' && subtitleRaw.trim() ? subtitleRaw.trim() : undefined;
  return { body: content.trim(), theme, title, subtitle };
}
