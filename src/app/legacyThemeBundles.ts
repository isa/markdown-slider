/**
 * Maps legacy `theme:` / `defaultTheme` ids to `{ palette, font }` pairs.
 * Cross-combine palettes and fonts via `palette:` + `font:` without new files.
 */
export const LEGACY_THEME_BUNDLES: Record<string, { palette: string; font: string }> = {
  default: { palette: 'default', font: 'libre-baskerville-franklin' },
  'watermelon-sorbet': { palette: 'watermelon-sorbet', font: 'lora-manrope' },
  'rustic-charm': { palette: 'rustic-charm', font: 'montserrat-nunito' },
  'monochrome-red': { palette: 'monochrome-red', font: 'oswald-montserrat' },
  'cherry-blossom': { palette: 'cherry-blossom', font: 'lusitana-raleway' },
  'fiery-ocean': { palette: 'fiery-ocean', font: 'ovo-mulish' },
};

export function getLegacyThemeBundleIds(): string[] {
  return Object.keys(LEGACY_THEME_BUNDLES).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
