import { toBlob } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Keep in sync with `SlideChartEmbeds.tsx` and `scripts/playwright-slide-helpers.mjs`. */
const PATH_ANIM_MS = 780;
const LINE_CHART_MAX_SERIES = 5;

/** Fallback when `data-ms-chart-settle-ms` is missing (older bundles). Parallel chart animations → max, not sum. */
function lineChartFallbackSettleMs(): number {
  const n = LINE_CHART_MAX_SERIES;
  const lineLastFinish = PATH_ANIM_MS * (0.35 + (n - 1) * 0.12) + PATH_ANIM_MS;
  const areaLastFinish = PATH_ANIM_MS * (0.12 * (n - 1)) + PATH_ANIM_MS;
  return Math.ceil(Math.max(lineLastFinish, areaLastFinish) + 250);
}

function maxChartSettleMsInFrame(frame: HTMLElement): number {
  let maxMs = 0;
  frame.querySelectorAll('[data-ms-chart-settle-ms]').forEach((el) => {
    const v = parseInt(el.getAttribute('data-ms-chart-settle-ms') || '0', 10);
    if (Number.isFinite(v) && v > maxMs) maxMs = v;
  });
  if (maxMs > 0) return maxMs;
  if (frame.querySelector('.slide-chart-embed--line')) maxMs = Math.max(maxMs, lineChartFallbackSettleMs());
  if (frame.querySelector('.slide-chart-embed--bar')) maxMs = Math.max(maxMs, 4000);
  if (frame.querySelector('.slide-chart-embed--pie')) maxMs = Math.max(maxMs, PATH_ANIM_MS + 300);
  return maxMs;
}

export async function waitUntilSlideMetaMatches(slide1Based: number, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  const re = new RegExp(`^${slide1Based}\\s+/\\s+\\d+$`);
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector('#ms-export-slide-meta');
    const t = el?.textContent?.trim() ?? '';
    if (re.test(t)) return;
    await sleep(16);
  }
  throw new Error(`Timed out waiting for slide ${slide1Based} to render`);
}

async function waitForMermaidIfPresent(): Promise<void> {
  const root = document.querySelector('.slide-mermaid-embed');
  if (!root) return;
  const start = Date.now();
  while (Date.now() - start < 14000) {
    if (
      root.querySelector('.slide-mermaid-embed__svg') != null ||
      root.querySelector('.slide-mermaid-embed__error') != null
    ) {
      await sleep(150);
      return;
    }
    await sleep(32);
  }
}

async function waitForChartAnimationsInSlideFrame(): Promise<void> {
  const frame = document.querySelector('[data-ms-slide-frame]') as HTMLElement | null;
  if (!frame) return;
  const ms = maxChartSettleMsInFrame(frame);
  if (ms > 0) await sleep(ms);
}

export async function waitForSlideEmbedsBeforeCapture(): Promise<void> {
  await waitForMermaidIfPresent();
  await waitForChartAnimationsInSlideFrame();
  await sleep(120);
}

export async function captureDeckFramesToPdf(options: {
  totalSlides: number;
  goToSlide: (n: number) => void;
  onProgress: (current: number, total: number) => void;
  shouldAbort: () => boolean;
}): Promise<Uint8Array> {
  const { totalSlides, goToSlide, onProgress, shouldAbort } = options;
  const pdf = await PDFDocument.create();

  for (let n = 1; n <= totalSlides; n++) {
    if (shouldAbort()) throw new DOMException('aborted', 'AbortError');
    goToSlide(n);
    await waitUntilSlideMetaMatches(n);
    await doubleRaf();
    await waitForSlideEmbedsBeforeCapture();
    if (shouldAbort()) throw new DOMException('aborted', 'AbortError');

    const frame = document.querySelector('[data-ms-slide-frame]') as HTMLElement | null;
    if (!frame) throw new Error('Slide frame not found');

    /** `html-to-image` snapshots via SVG foreignObject so modern CSS (e.g. `oklch()`) renders like the live page. */
    const pngBlob = await toBlob(frame, {
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      cacheBust: true,
      backgroundColor: 'rgba(0,0,0,0)',
    });
    if (!pngBlob) throw new Error('Could not capture slide image');
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const pngImage = await pdf.embedPng(pngBytes);
    const w = pngImage.width;
    const h = pngImage.height;
    const page = pdf.addPage([w, h]);
    page.drawImage(pngImage, { x: 0, y: 0, width: w, height: h });
    onProgress(n, totalSlides);
  }

  return pdf.save();
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
