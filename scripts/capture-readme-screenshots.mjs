/**
 * Captures README screenshots (requires `bun run dev` on BASE_URL, default http://127.0.0.1:5173).
 * Usage: bun scripts/capture-readme-screenshots.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { waitForSlideChartAnimationsIfPresent } from './playwright-slide-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function ensurePlaywrightBrowsersPath() {
  const local = path.join(root, 'node_modules', 'playwright-core', '.local-browsers');
  if (fs.existsSync(local)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = local;
  }
}
const outDir = path.join(root, 'docs', 'readme');

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  ensurePlaywrightBrowsersPath();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 60_000 });
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
    await waitForSlideChartAnimationsIfPresent(page);
    await page.screenshot({ path: path.join(outDir, 'sample-deck-slide-03.png'), type: 'png' });

    await goToSlide(16);
    await waitForSlideChartAnimationsIfPresent(page);
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
