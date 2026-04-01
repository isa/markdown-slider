import { parse } from 'yaml';

/** Built from `/themes/*.yaml` at compile time */
export type ThemePreset = {
  id: string;
  /** Tokens when the app UI is in dark mode */
  varsDark: Record<string, string>;
  /** Tokens when the app UI is in light mode */
  varsLight: Record<string, string>;
  rootClassName?: string;
  /** Used when the slide omits `align` in frontmatter */
  defaultAlign?: 'left' | 'center' | 'right';
  name?: string;
  description?: string;
};

const themeRawFiles = import.meta.glob('/themes/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function fileIdFromPath(path: string): string {
  const m = path.match(/\/themes\/([^/]+)\.yaml$/);
  return m ? m[1] : '';
}

function normalizeCssVars(css: unknown): Record<string, string> | null {
  if (!css || typeof css !== 'object') return null;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(css as Record<string, unknown>)) {
    if (!k.startsWith('--')) continue;
    if (typeof v === 'string' || typeof v === 'number') vars[k] = String(v);
  }
  return Object.keys(vars).length ? vars : null;
}

/** Used when a theme omits `light:` (legacy); also as embedded default light palette */
export const FALLBACK_LIGHT_DEFAULT: Record<string, string> = {
  '--slide-font-heading': '"Libre Baskerville", Georgia, "Times New Roman", serif',
  '--slide-font-body': '"Libre Franklin", system-ui, sans-serif',
  '--slide-font-mono': 'ui-monospace, monospace',
  '--slide-font-size-h1': '3rem',
  '--slide-font-size-h2': '2.25rem',
  '--slide-font-size-h3': '1.75rem',
  '--slide-font-size-body': '1.25rem',
  '--slide-line-height-body': '1.625',
  '--slide-text': '#0A0A0A',
  '--slide-text-muted': '#4E4E7E',
  '--slide-heading-color': '#1A1A2E',
  '--slide-heading-h1-color': '#1A1A2E',
  '--slide-heading-h2-color': '#1A1A2E',
  '--slide-heading-h3-color': '#4E4E7E',
  '--slide-accent': '#E94560',
  '--slide-bg': 'transparent',
  '--slide-bullet-color': '#E94560',
  '--slide-list-spacing': '0.75rem',
  '--slide-image-radius': '0.75rem',
  '--slide-image-shadow': '0 20px 40px -12px rgb(26 26 46 / 0.12)',
  '--slide-image-max-width': 'min(100%, 36rem)',
  '--slide-code-bg': '#E8E8EE',
  '--slide-code-text': '#1A1A2E',
  '--slide-blockquote-border': '#E94560',
  '--slide-table-border': '#C8C8D8',
  '--slide-table-header-bg': '#F0F0F0',
  '--slide-column-gap': '1.25rem',
  '--slide-entrance': 'none',
};

/** Used only if no `themes/default.yaml` is present */
export const FALLBACK_DEFAULT_PRESET: ThemePreset = {
  id: 'default',
  name: 'Default',
  description: 'Embedded fallback when themes/default.yaml is missing.',
  varsDark: {
    '--slide-font-heading': '"Libre Baskerville", Georgia, "Times New Roman", serif',
    '--slide-font-body': '"Libre Franklin", system-ui, sans-serif',
    '--slide-font-mono': 'ui-monospace, monospace',
    '--slide-font-size-h1': '3rem',
    '--slide-font-size-h2': '2.25rem',
    '--slide-font-size-h3': '1.75rem',
    '--slide-font-size-body': '1.25rem',
    '--slide-line-height-body': '1.625',
    '--slide-text': '#F0F0F0',
    '--slide-text-muted': '#9B9BC4',
    '--slide-heading-color': '#F5F5F5',
    '--slide-heading-h1-color': '#FFFFFF',
    '--slide-heading-h2-color': '#F0F0F0',
    '--slide-heading-h3-color': '#B8B8D4',
    '--slide-accent': '#E94560',
    '--slide-bg': 'transparent',
    '--slide-bullet-color': '#E94560',
    '--slide-list-spacing': '0.75rem',
    '--slide-image-radius': '0.75rem',
    '--slide-image-shadow': '0 25px 50px -12px rgb(0 0 0 / 0.4)',
    '--slide-image-max-width': 'min(100%, 36rem)',
    '--slide-code-bg': '#12121F',
    '--slide-code-text': '#F0ABAB',
    '--slide-blockquote-border': '#E94560',
    '--slide-table-border': '#4E4E7E',
    '--slide-table-header-bg': '#1A1A2E',
    '--slide-column-gap': '1.25rem',
    '--slide-entrance': 'none',
  },
  varsLight: { ...FALLBACK_LIGHT_DEFAULT },
};

function extractCssBlock(section: unknown): unknown {
  if (!section || typeof section !== 'object') return undefined;
  return (section as Record<string, unknown>).css;
}

export function loadThemePresets(): Record<string, ThemePreset> {
  const out: Record<string, ThemePreset> = {};

  for (const [path, raw] of Object.entries(themeRawFiles)) {
    const fileId = fileIdFromPath(path);
    if (fileId.startsWith('_')) continue;

    let doc: unknown;
    try {
      doc = parse(raw);
    } catch {
      continue;
    }
    if (!doc || typeof doc !== 'object') continue;
    const d = doc as Record<string, unknown>;

    const id = typeof d.id === 'string' && d.id.trim() ? d.id.trim() : fileId;
    if (!id) continue;

    const darkRaw = extractCssBlock(d.dark) ?? d.css;
    const varsDark = normalizeCssVars(darkRaw);
    if (!varsDark) continue;

    const lightRaw = extractCssBlock(d.light);
    const varsLight = normalizeCssVars(lightRaw) ?? { ...FALLBACK_LIGHT_DEFAULT };

    let rootClassName: string | undefined;
    if (typeof d.rootClassName === 'string' && d.rootClassName.trim()) {
      rootClassName = d.rootClassName.trim();
    }

    let defaultAlign: 'left' | 'center' | 'right' | undefined;
    const ar = d.align;
    if (ar === 'left' || ar === 'center' || ar === 'right') defaultAlign = ar;

    let name: string | undefined;
    if (typeof d.name === 'string' && d.name.trim()) name = d.name.trim();

    let description: string | undefined;
    if (typeof d.description === 'string' && d.description.trim()) description = d.description.trim();

    out[id] = {
      id,
      varsDark,
      varsLight,
      rootClassName,
      defaultAlign,
      name,
      description,
    };
  }

  if (!out.default) {
    out.default = {
      ...FALLBACK_DEFAULT_PRESET,
      varsDark: { ...FALLBACK_DEFAULT_PRESET.varsDark },
      varsLight: { ...FALLBACK_DEFAULT_PRESET.varsLight },
    };
  }

  return out;
}
