/**
 * Export a deck to a multi-page PDF by screenshotting each slide (Playwright + pdf-lib).
 * Requires the app running at BASE_URL (e.g. `bun run dev` or `bun run build && bun run preview`).
 *
 * Usage:
 *   bun scripts/export-deck-pdf.mjs --deck sample-deck --out ./deck.pdf
 *   bun scripts/export-deck-pdf.mjs --deck my-deck --out ./out.pdf --from 1 --to 10
 *   bun scripts/export-deck-pdf.mjs --deck my-deck --out ./wa.pdf --working-area
 *
 * With --working-area: only slides that have a working area are included; others are skipped (logged).
 *
 * Uses `?pdfExport=1` (full-viewport slide, no UI chrome) and a 1920×1080 viewport so each page matches HD slide pixels.
 */
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { waitForSlideChartAnimationsIfPresent, waitForMermaidIfPresent } from './playwright-slide-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

/** Prefer browsers under this repo when env points at a missing path (e.g. sandbox). */
function ensurePlaywrightBrowsersPath() {
  const local = path.join(repoRoot, 'node_modules', 'playwright-core', '.local-browsers');
  if (fs.existsSync(local)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = local;
  }
}

function parseArgs(argv) {
  const out = {
    deck: null,
    outPath: null,
    baseUrl: process.env.BASE_URL ?? 'http://127.0.0.1:5173',
    from: null,
    to: null,
    workingArea: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deck') out.deck = argv[++i];
    else if (a === '--out') out.outPath = argv[++i];
    else if (a === '--base-url') out.baseUrl = argv[++i];
    else if (a === '--from') out.from = parseInt(argv[++i], 10);
    else if (a === '--to') out.to = parseInt(argv[++i], 10);
    else if (a === '--working-area') out.workingArea = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`export-deck-pdf.mjs — build a PDF from rendered slides

Options:
  --deck <id>       Deck folder id under decks/ (required)
  --out <path>      Output .pdf path (required)
  --base-url <url>  App origin (default: http://127.0.0.1:5173 or BASE_URL)
  --from <n>        First slide, 1-based (default: 1)
  --to <n>          Last slide, 1-based (default: last slide in deck)
  --working-area    Capture working-area view per slide when present; slides without one are skipped
  -h, --help        Show this message

Requires: Chromium for Playwright (\`bunx playwright install chromium\`) and the app running.
`);
}

/** ASCII bar avoids double-width glyphs that break single-line \\r redraw in many terminals. */
function formatProgressBar(current, total, width) {
  if (total <= 0) return `[${'.'.repeat(width)}]`;
  const ratio = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(ratio * width);
  return `[${'#'.repeat(filled)}${'.'.repeat(width - filled)}]`;
}

/** Single-line progress: clear line with ANSI (EL), then redraw (no staircase from wrap). */
function writeProgress(current, total, detail) {
  const cols = process.stdout.columns ?? 96;
  const barW = Math.min(32, Math.max(10, cols - 52));
  const bar = formatProgressBar(current, total, barW);
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  let line = `${bar} ${pct}%  ${detail}`;
  if (line.length > cols - 1) {
    line = line.slice(0, Math.max(20, cols - 4)) + '…';
  }
  const pad = Math.max(0, cols - 1 - line.length);
  process.stdout.write(`\r\x1b[K${line}${' '.repeat(pad)}`);
}

function clearProgressLine() {
  process.stdout.write('\r\x1b[K');
}

/** Chrome is hidden in pdf export mode; use \`data-ms-pdf-export-view\` from App. */
async function ensureSlideView(page) {
  for (let i = 0; i < 3; i++) {
    const v = await page.evaluate(() => document.documentElement.dataset.msPdfExportView);
    if (v === 'slide' || v === undefined) return;
    await page.keyboard.press('f');
    await page.waitForTimeout(400);
  }
}

async function goToSlide(page, n) {
  await page.waitForFunction(
    () => typeof window.__markdownSliderPdfExport?.goToSlide === 'function',
    { timeout: 15_000 },
  );
  await page.evaluate((slideNum) => {
    window.__markdownSliderPdfExport?.goToSlide(slideNum);
  }, n);
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('#ms-export-slide-meta');
      const t = el?.textContent?.trim() ?? '';
      return new RegExp(`^${expected} / `).test(t);
    },
    n,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(120);
}

async function readTotalSlides(page) {
  const meta = page.locator('#ms-export-slide-meta');
  await meta.waitFor({ state: 'attached', timeout: 30_000 });
  const text = (await meta.textContent())?.trim() ?? '';
  const m = text.match(/^(\d+)\s+\/\s+(\d+)$/);
  if (!m) throw new Error(`Could not parse slide count from #ms-export-slide-meta: "${text}"`);
  return parseInt(m[2], 10);
}

async function hasWorkingAreaForCurrentSlide(page) {
  const blocked = page.locator('[title="No working area for this slide"]');
  return (await blocked.count()) === 0;
}

async function enterWorkingArea(page) {
  await page.keyboard.press('f');
  await page.waitForTimeout(400);
}

async function leaveWorkingArea(page) {
  const v = await page.evaluate(() => document.documentElement.dataset.msPdfExportView);
  if (v === 'working') {
    await page.keyboard.press('f');
    await page.waitForTimeout(400);
  }
}

async function captureSlideFrame(page) {
  const frame = page.locator('[data-ms-slide-frame]').first();
  await frame.waitFor({ state: 'visible', timeout: 15_000 });
  return frame.screenshot({ type: 'png' });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.deck || !args.outPath) {
    printHelp();
    process.exit(1);
  }

  const outAbs = path.resolve(process.cwd(), args.outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  ensurePlaywrightBrowsersPath();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const pngBuffers = [];

  try {
    const url = `${args.baseUrl.replace(/\/$/, '')}/?deck=${encodeURIComponent(args.deck)}&pdfExport=1`;
    console.log(`Loading ${url} …`);
    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-ms-slide-frame]') !== null &&
        document.querySelector('#ms-export-slide-meta') !== null &&
        /^\d+\s+\/\s+\d+$/.test(
          document.querySelector('#ms-export-slide-meta')?.textContent?.trim() ?? '',
        ),
      { timeout: 60_000 },
    );
    await page.locator('[data-ms-slide-frame]').first().waitFor({ state: 'visible', timeout: 10_000 });
    console.log('App ready.\n');

    const totalSlides = await readTotalSlides(page);
    let from = Number.isFinite(args.from) && args.from > 0 ? args.from : 1;
    let to = Number.isFinite(args.to) && args.to > 0 ? args.to : totalSlides;
    from = Math.min(Math.max(1, from), totalSlides);
    to = Math.min(Math.max(from, to), totalSlides);

    const slideRangeCount = to - from + 1;
    console.log(`\nPDF export: deck "${args.deck}" → ${outAbs}`);
    console.log(`Slides ${from}–${to} of ${totalSlides} (${slideRangeCount} to process)\n`);

    let step = 0;
    for (let n = from; n <= to; n++) {
      step += 1;
      writeProgress(step, slideRangeCount, `Capturing slide ${n}…`);

      await ensureSlideView(page);
      await goToSlide(page, n);
      await waitForSlideChartAnimationsIfPresent(page);
      await waitForMermaidIfPresent(page);

      if (args.workingArea) {
        const ok = await hasWorkingAreaForCurrentSlide(page);
        if (!ok) {
          clearProgressLine();
          process.stderr.write(`export-deck-pdf: slide ${n}: no working area — skipped (--working-area)\n`);
          writeProgress(step, slideRangeCount, `Skipped slide ${n} (no working area)`);
          continue;
        }
        await enterWorkingArea(page);
        await waitForSlideChartAnimationsIfPresent(page);
        await waitForMermaidIfPresent(page);
      }

      const png = await captureSlideFrame(page);
      pngBuffers.push(png);

      if (args.workingArea) {
        await leaveWorkingArea(page);
      }
    }

    clearProgressLine();

    if (pngBuffers.length === 0) {
      throw new Error('No pages captured (empty range or all slides skipped).');
    }

    console.log('Building PDF…');
    const pdf = await PDFDocument.create();
    for (const buf of pngBuffers) {
      const img = await pdf.embedPng(buf);
      const w = img.width;
      const h = img.height;
      const pdfPage = pdf.addPage([w, h]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: w, height: h });
    }
    const bytes = await pdf.save();
    fs.writeFileSync(outAbs, bytes);
    console.log(`Done. Wrote ${pngBuffers.length} page(s) to ${outAbs}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
