/** One row from YAML `lineChart:` / `barChart:` / `pieChart:` frontmatter (Recharts `data` array). */
export type SlideChartRow = Record<string, unknown>;

export function parseChartRowsFromFrontmatter(raw: unknown): SlideChartRow[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SlideChartRow[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      out.push(item as SlideChartRow);
    }
  }
  return out.length ? out : undefined;
}

/** First object key = category axis; remaining keys with numeric values = series (in order). */
export function inferChartKeys(row: SlideChartRow): { xKey: string; valueKeys: string[] } {
  const keys = Object.keys(row);
  if (keys.length === 0) return { xKey: 'x', valueKeys: [] };
  const xKey = keys[0];
  const valueKeys = keys.slice(1).filter((k) => {
    const v = row[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return true;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return true;
    return false;
  });
  return { xKey, valueKeys };
}

/** Ensure value columns are numbers for Recharts scales. */
export function normalizeRowsNumeric(
  rows: SlideChartRow[],
  valueKeys: string[],
): Record<string, string | number>[] {
  return rows.map((row) => {
    const o: Record<string, string | number> = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (valueKeys.includes(k)) {
        o[k] = typeof v === 'number' && !Number.isNaN(v) ? v : Number(v);
      } else {
        o[k] = v == null ? '' : typeof v === 'string' || typeof v === 'number' ? v : String(v);
      }
    }
    return o;
  });
}
