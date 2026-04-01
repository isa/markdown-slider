const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function dayOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function calendarPartsFromYyyyMmDd(s: string): { y: number; m: number; d: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

/**
 * Pretty label for deck `metadata.md` dates (e.g. April 2nd, 2026).
 * Prefers `YYYY-MM-DD` parsed as a calendar date (no UTC shift).
 */
export function formatDeckMetaDateDisplay(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  const cal = calendarPartsFromYyyyMmDd(t);
  if (cal) {
    return `${MONTHS[cal.m - 1]} ${cal.d}${dayOrdinalSuffix(cal.d)}, ${cal.y}`;
  }
  const dt = new Date(t);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = dt.getMonth() + 1;
    const d = dt.getDate();
    return `${MONTHS[mo - 1]} ${d}${dayOrdinalSuffix(d)}, ${y}`;
  }
  return t;
}
