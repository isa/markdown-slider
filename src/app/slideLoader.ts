// Build-time slide loader using Vite's import.meta.glob
// Loads all slides from /slides/slideN/ folders at compile time

export interface SlideData {
  index: number;
  content: string;
  type: 'md' | 'html';
  workingArea?: {
    content: string;
    type: 'md' | 'html';
  };
}

// Eagerly import all slide content at build time
const slideMdFiles = import.meta.glob('/slides/*/slide.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const slideHtmlFiles = import.meta.glob('/slides/*/slide.html', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

// Working area content
const waMdFiles = import.meta.glob('/slides/*/working-area/slide.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const waHtmlFiles = import.meta.glob('/slides/*/working-area/slide.html', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

// Working area supporting files (CSS/JS) for iframe injection
const waCssFiles = import.meta.glob('/slides/*/working-area/style.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const waJsFiles = import.meta.glob('/slides/*/working-area/script.js', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function extractSlideKey(path: string): string {
  // e.g. "/slides/slide3/slide.md" → "slide3"
  const match = path.match(/\/slides\/([^/]+)\//);
  return match ? match[1] : '';
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function loadSlides(): SlideData[] {
  // Collect all unique slide folder keys
  const keys = new Set<string>();
  for (const path of [
    ...Object.keys(slideMdFiles),
    ...Object.keys(slideHtmlFiles),
  ]) {
    const key = extractSlideKey(path);
    if (key) keys.add(key);
  }

  // Sort naturally (slide1, slide2, ..., slide10)
  const sortedKeys = [...keys].sort(naturalSort);

  return sortedKeys.map((key, index) => {
    // Slide content: md wins over html
    const mdPath = `/slides/${key}/slide.md`;
    const htmlPath = `/slides/${key}/slide.html`;
    const hasMd = mdPath in slideMdFiles;

    // Full raw markdown (including YAML frontmatter) for editing and theme parsing
    const content = hasMd ? slideMdFiles[mdPath] : (slideHtmlFiles[htmlPath] ?? '');
    const type = hasMd ? 'md' : 'html';

    // Working area: md wins over html
    const waMdPath = `/slides/${key}/working-area/slide.md`;
    const waHtmlPath = `/slides/${key}/working-area/slide.html`;
    const hasWaMd = waMdPath in waMdFiles;
    const hasWaHtml = waHtmlPath in waHtmlFiles;

    let workingArea: SlideData['workingArea'] = undefined;
    if (hasWaMd || hasWaHtml) {
      let waContent = hasWaMd ? waMdFiles[waMdPath] : waHtmlFiles[waHtmlPath];
      const waType = hasWaMd ? 'md' : 'html';

      // For HTML working areas, inject any supporting CSS/JS
      if (waType === 'html') {
        const cssPath = `/slides/${key}/working-area/style.css`;
        const jsPath = `/slides/${key}/working-area/script.js`;
        const css = waCssFiles[cssPath];
        const js = waJsFiles[jsPath];
        if (css) waContent = waContent.replace('</head>', `<style>${css}</style></head>`);
        if (js) waContent = waContent.replace('</body>', `<script>${js}<\/script></body>`);
      }

      workingArea = { content: waContent, type: waType };
    }

    return { index, content, type, workingArea };
  });
}
