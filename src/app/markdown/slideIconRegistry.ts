import type { IconType } from 'react-icons';
import * as FaIcons from 'react-icons/fa';
import * as Fa6Icons from 'react-icons/fa6';

/**
 * Optional overrides when the `fa-kebab` name does not match the react-icons export
 * (e.g. `fa-github` → `FaGithub` is usually correct; add here only if a key fails).
 */
const slideIconOverrides: Record<string, IconType> = {};

/**
 * `fa-angle-left` → `FaAngleLeft`, `fa-reg-star` → `FaRegStar` (react-icons FA export names).
 */
function faKebabToExportName(kebab: string): string | null {
  if (!kebab.startsWith('fa-')) return null;
  const rest = kebab.slice(3);
  if (!rest) return null;
  const segments = rest.split('-').filter(Boolean);
  const pascal = segments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
  return `Fa${pascal}`;
}

/** FA5 (`react-icons/fa`), then FA6 (`react-icons/fa6`) — names like `FaGaugeHigh` exist only in FA6. */
function getFaExport(exportName: string): IconType | undefined {
  const from5 = (FaIcons as Record<string, IconType | undefined>)[exportName];
  if (typeof from5 === 'function') return from5;
  const from6 = (Fa6Icons as Record<string, IconType | undefined>)[exportName];
  if (typeof from6 === 'function') return from6;
  return undefined;
}

/**
 * Resolves `<icon class="fa-moon …" />` or `<icon name="FaMoon" pack="fa" />` to a component.
 * Uses the full `react-icons/fa` and `react-icons/fa6` sets (FA5 first, then FA6 fallback).
 */
export function resolveSlideIcon(key: string): IconType | undefined {
  if (slideIconOverrides[key]) return slideIconOverrides[key];

  if (key.startsWith('fa/')) {
    const exportName = key.slice(3);
    return getFaExport(exportName);
  }

  const fromKebab = faKebabToExportName(key);
  if (fromKebab) {
    const Icon = getFaExport(fromKebab);
    if (Icon) return Icon;
  }

  return undefined;
}
