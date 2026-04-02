/**
 * Shared Playwright helpers for slide capture (README screenshots, PDF export).
 * Keep `PATH_ANIM_MS` in sync with `src/app/components/SlideChartEmbeds.tsx`.
 */

/** Keep in sync with `PATH_ANIM_MS` in `src/app/components/SlideChartEmbeds.tsx`. */
export const PATH_ANIM_MS = 780;
/** Max series line chart: `animationBegin` scales with index; last series finishes last. */
export const LINE_CHART_MAX_SERIES = 5;

export function lineChartAnimationSettleMs() {
  const n = LINE_CHART_MAX_SERIES;
  const lineLastFinish = PATH_ANIM_MS * (0.35 + (n - 1) * 0.12) + PATH_ANIM_MS;
  const areaLastFinish = PATH_ANIM_MS * (0.12 * (n - 1)) + PATH_ANIM_MS;
  return Math.ceil(Math.max(lineLastFinish, areaLastFinish) + 250);
}

/** Bar chart worst-case (grouped/stacked) when `data-ms-chart-settle-ms` is missing. */
export function barChartFallbackSettleMs() {
  return 4000;
}

/** Pie chart when attribute missing. */
export function pieChartFallbackSettleMs() {
  return PATH_ANIM_MS + 300;
}

/**
 * Wait for slide chart motion (line / bar / pie) using `data-ms-chart-settle-ms` from SlideChartEmbeds.
 * Falls back to legacy heuristics if attributes are absent (older builds).
 * @param {import('playwright').Page} page
 */
export async function waitForSlideChartAnimationsIfPresent(page) {
  const ms = await page.evaluate(() => {
    let max = 0;
    document.querySelectorAll('[data-ms-chart-settle-ms]').forEach((el) => {
      const v = parseInt(el.getAttribute('data-ms-chart-settle-ms') || '0', 10);
      if (Number.isFinite(v) && v > max) max = v;
    });
    return max;
  });
  if (ms > 0) {
    await page.waitForTimeout(ms);
    return;
  }
  /** Parallel animations: use a single wait = max(line, bar, pie), not sum. */
  let maxMs = 0;
  const line = page.locator('.slide-chart-embed--line').first();
  try {
    await line.waitFor({ state: 'attached', timeout: 1500 });
    await line.waitFor({ state: 'visible', timeout: 3000 });
    maxMs = Math.max(maxMs, lineChartAnimationSettleMs());
  } catch {
    /* no line chart */
  }
  if ((await page.locator('.slide-chart-embed--bar').count()) > 0) {
    maxMs = Math.max(maxMs, barChartFallbackSettleMs());
  }
  if ((await page.locator('.slide-chart-embed--pie').count()) > 0) {
    maxMs = Math.max(maxMs, pieChartFallbackSettleMs());
  }
  if (maxMs > 0) await page.waitForTimeout(maxMs);
}

/**
 * When a slide embeds a line chart, Recharts + motion run path draw animations.
 * Wait for the embed to mount, then long enough for the slowest series to finish.
 * Returns quickly when no line chart is present (does not block for seconds on plain slides).
 * @param {import('playwright').Page} page
 */
export async function waitForLineChartAnimationsIfPresent(page) {
  const loc = page.locator('.slide-chart-embed--line').first();
  try {
    await loc.waitFor({ state: 'attached', timeout: 2000 });
  } catch {
    return;
  }
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(lineChartAnimationSettleMs());
}

/**
 * Wait for Mermaid SVG to finish loading (async render) or error text.
 * Returns quickly when no Mermaid embed is present.
 * @param {import('playwright').Page} page
 */
export async function waitForMermaidIfPresent(page) {
  const loc = page.locator('.slide-mermaid-embed').first();
  try {
    await loc.waitFor({ state: 'attached', timeout: 2000 });
  } catch {
    return;
  }
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  await page
    .waitForFunction(
      () => {
        const root = document.querySelector('.slide-mermaid-embed');
        if (!root) return true;
        return (
          root.querySelector('.slide-mermaid-embed__svg') != null ||
          root.querySelector('.slide-mermaid-embed__error') != null
        );
      },
      { timeout: 12000 },
    )
    .catch(() => {});
  await page.waitForTimeout(150);
}
