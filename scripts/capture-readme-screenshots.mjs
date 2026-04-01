/**
 * Captures README screenshots (requires `bun run dev` on BASE_URL, default http://127.0.0.1:5173).
 * Usage: bun scripts/capture-readme-screenshots.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'readme');

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';

/** Keep in sync with `PATH_ANIM_MS` in `src/app/components/SlideChartEmbeds.tsx`. */
const PATH_ANIM_MS = 780;
/** Max series line chart: `animationBegin` scales with index; last series finishes last. */
const LINE_CHART_MAX_SERIES = 5;

function lineChartAnimationSettleMs() {
  const lastBegin = PATH_ANIM_MS * (0.35 + (LINE_CHART_MAX_SERIES - 1) * 0.12);
  return Math.ceil(lastBegin + PATH_ANIM_MS + 250);
}

/**
 * When a slide embeds a line chart, Recharts + motion run path draw animations.
 * Wait for the embed to mount, then long enough for the slowest series to finish.
 */
async function waitForLineChartAnimationsIfPresent(page) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if ((await page.locator('.slide-chart-embed--line').count()) > 0) break;
    await page.waitForTimeout(80);
  }
  if ((await page.locator('.slide-chart-embed--line').count()) === 0) return;

  await page.locator('.slide-chart-embed--line').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(lineChartAnimationSettleMs());
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.getByRole('heading', { name: 'Choose a deck' }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'deck-selector.png'), type: 'png' });

    await page.getByRole('combobox').filter({ hasText: /Feature showcase/ }).click();
    await page.getByRole('option', { name: /Feature showcase/ }).click();
    await page.getByRole('button', { name: 'Open deck' }).click();
    await page.getByRole('heading', { name: /Feature showcase/ }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(500);

    async function goToSlide(n) {
      await page.keyboard.press('g');
      await page.locator('#go-to-slide-input').waitFor({ state: 'visible' });
      await page.locator('#go-to-slide-input').fill(String(n));
      await page.keyboard.press('Enter');
      await page.getByText(new RegExp(`^${n} / `)).waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(200);
    }

    await goToSlide(3);
    await waitForLineChartAnimationsIfPresent(page);
    await page.screenshot({ path: path.join(outDir, 'sample-deck-slide-03.png'), type: 'png' });

    await goToSlide(16);
    await waitForLineChartAnimationsIfPresent(page);
    await page.screenshot({ path: path.join(outDir, 'sample-deck-slide-16.png'), type: 'png' });

    console.log(`Wrote PNGs under ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
