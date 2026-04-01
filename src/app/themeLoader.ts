import { parse } from 'yaml';

/** Color / layout tokens (per light/dark UI mode) */
export type PalettePreset = {
  id: string;
  varsDark: Record<string, string>;
  varsLight: Record<string, string>;
  rootClassName?: string;
  defaultAlign?: 'left' | 'center' | 'right';
  name?: string;
  description?: string;
};

/** Typography tokens only */
export type FontPreset = {
  id: string;
  varsDark: Record<string, string>;
  varsLight: Record<string, string>;
  name?: string;
  description?: string;
};

const paletteRawFiles = import.meta.glob('/themes/palettes/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const fontRawFiles = import.meta.glob('/themes/fonts/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function fileIdFromPath(path: string, subdir: 'palettes' | 'fonts'): string {
  const m = path.match(new RegExp(`/themes/${subdir}/([^/]+)\\.yaml$`));
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

function extractCssBlock(section: unknown): unknown {
  if (!section || typeof section !== 'object') return undefined;
  return (section as Record<string, unknown>).css;
}

function splitVarsByFontKeys(vars: Record<string, string>): {
  font: Record<string, string>;
  palette: Record<string, string>;
} {
  const font: Record<string, string> = {};
  const palette: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (isFontCssVar(k)) font[k] = v;
    else palette[k] = v;
  }
  return { font, palette };
}

function isFontCssVar(key: string): boolean {
  return (
    key.startsWith('--slide-font-') ||
    key === '--slide-line-height-body' ||
    key.startsWith('--slide-heading-weight')
  );
}

/** Embedded merged fallback when YAML files are missing (subset split for loaders) */
const FALLBACK_MERGED_DARK: Record<string, string> = {
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
};

/** Light-mode palette tokens for embedded default merge */
const FALLBACK_LIGHT_PALETTE: Record<string, string> = {
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

const FALLBACK_MERGED_LIGHT: Record<string, string> = {
  '--slide-font-heading': '"Libre Baskerville", Georgia, "Times New Roman", serif',
  '--slide-font-body': '"Libre Franklin", system-ui, sans-serif',
  '--slide-font-mono': 'ui-monospace, monospace',
  '--slide-font-size-h1': '3rem',
  '--slide-font-size-h2': '2.25rem',
  '--slide-font-size-h3': '1.75rem',
  '--slide-font-size-body': '1.25rem',
  '--slide-line-height-body': '1.625',
  ...FALLBACK_LIGHT_PALETTE,
};

const { font: fbFontDark, palette: fbPaletteDark } = splitVarsByFontKeys(FALLBACK_MERGED_DARK);
const { font: fbFontLight, palette: fbPaletteLight } = splitVarsByFontKeys(FALLBACK_MERGED_LIGHT);

export function loadPalettePresets(): Record<string, PalettePreset> {
  const out: Record<string, PalettePreset> = {};

  for (const [path, raw] of Object.entries(paletteRawFiles)) {
    const fileId = fileIdFromPath(path, 'palettes');
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
    const varsLight = normalizeCssVars(lightRaw) ?? { ...fbPaletteLight };

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
      id: 'default',
      varsDark: { ...fbPaletteDark },
      varsLight: { ...fbPaletteLight },
      name: 'Default',
      description: 'Embedded fallback when themes/palettes/default.yaml is missing.',
    };
  }

  return out;
}

export function loadFontPresets(): Record<string, FontPreset> {
  const out: Record<string, FontPreset> = {};

  for (const [path, raw] of Object.entries(fontRawFiles)) {
    const fileId = fileIdFromPath(path, 'fonts');
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
    const varsLight = normalizeCssVars(lightRaw) ?? { ...varsDark };

    let name: string | undefined;
    if (typeof d.name === 'string' && d.name.trim()) name = d.name.trim();

    let description: string | undefined;
    if (typeof d.description === 'string' && d.description.trim()) description = d.description.trim();

    out[id] = {
      id,
      varsDark,
      varsLight,
      name,
      description,
    };
  }

  if (!out['libre-baskerville-franklin']) {
    out['libre-baskerville-franklin'] = {
      id: 'libre-baskerville-franklin',
      varsDark: { ...fbFontDark },
      varsLight: { ...fbFontLight },
      name: 'Libre Baskerville + Franklin',
      description: 'Embedded fallback when themes/fonts/libre-baskerville-franklin.yaml is missing.',
    };
  }

  return out;
}

export function mergePaletteAndFontVars(
  palette: PalettePreset,
  font: FontPreset,
  colorMode: 'light' | 'dark',
): Record<string, string> {
  const p = colorMode === 'light' ? palette.varsLight : palette.varsDark;
  const f = colorMode === 'light' ? font.varsLight : font.varsDark;
  return { ...p, ...f };
}
