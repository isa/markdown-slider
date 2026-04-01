// Build-time deck + slide loader using Vite's import.meta.glob
import matter from 'gray-matter';

export interface SlideData {
  index: number;
  id: string;
  deckId: string;
  content: string;
  type: 'md' | 'html';
  workingArea?: {
    content: string;
    type: 'md' | 'html';
  };
}

export interface DeckMeta {
  id: string;
  title: string;
  /** Shown under the deck title in the app chrome (deck mode), not slide frontmatter. */
  subtitle?: string;
  author?: string;
  date?: string;
  defaultTheme?: string;
  /** When set, overrides palette implied by `defaultTheme` for that axis. */
  defaultPalette?: string;
  defaultFont?: string;
  description?: string;
  tags?: string[];
}

export interface DeckData {
  id: string;
  meta: DeckMeta;
  slides: SlideData[];
}

const deckMetaFiles = import.meta.glob('/decks/*/metadata.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const slideMdFiles = import.meta.glob('/decks/*/*/slide.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const slideHtmlFiles = import.meta.glob('/decks/*/*/slide.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const waMdFiles = import.meta.glob('/decks/*/*/working-area/slide.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const waHtmlFiles = import.meta.glob('/decks/*/*/working-area/slide.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const waCssFiles = import.meta.glob('/decks/*/*/working-area/style.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const waJsFiles = import.meta.glob('/decks/*/*/working-area/script.js', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function parseDeckAndSlide(path: string): { deckId: string; slideId: string } | null {
  const match = path.match(/^\/decks\/([^/]+)\/([^/]+)\/slide\.(?:md|html)$/);
  if (!match) return null;
  return { deckId: match[1], slideId: match[2] };
}

function toStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return out.length ? out : undefined;
}

function parseDeckMeta(deckId: string): DeckMeta {
  const raw = deckMetaFiles[`/decks/${deckId}/metadata.md`];
  if (!raw) {
    return { id: deckId, title: deckId };
  }
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : deckId;
  const subtitle =
    typeof data.subtitle === 'string' && data.subtitle.trim() ? data.subtitle.trim() : undefined;
  const author = typeof data.author === 'string' && data.author.trim() ? data.author.trim() : undefined;
  const date = typeof data.date === 'string' && data.date.trim() ? data.date.trim() : undefined;
  const defaultTheme =
    typeof data.defaultTheme === 'string' && data.defaultTheme.trim()
      ? data.defaultTheme.trim()
      : undefined;
  const defaultPalette =
    typeof data.defaultPalette === 'string' && data.defaultPalette.trim()
      ? data.defaultPalette.trim()
      : undefined;
  const defaultFont =
    typeof data.defaultFont === 'string' && data.defaultFont.trim()
      ? data.defaultFont.trim()
      : undefined;
  const description =
    typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined;
  return {
    id: deckId,
    title,
    subtitle,
    author,
    date,
    defaultTheme,
    defaultPalette,
    defaultFont,
    description,
    tags: toStringArray(data.tags),
  };
}

function loadSlidesForDeck(deckId: string): SlideData[] {
  const slideIds = new Set<string>();
  for (const path of [...Object.keys(slideMdFiles), ...Object.keys(slideHtmlFiles)]) {
    const parts = parseDeckAndSlide(path);
    if (!parts || parts.deckId !== deckId) continue;
    slideIds.add(parts.slideId);
  }

  const sortedSlideIds = [...slideIds].sort(naturalSort);
  return sortedSlideIds.map((slideId, index) => {
    const mdPath = `/decks/${deckId}/${slideId}/slide.md`;
    const htmlPath = `/decks/${deckId}/${slideId}/slide.html`;
    const hasMd = mdPath in slideMdFiles;
    const type: 'md' | 'html' = hasMd ? 'md' : 'html';
    const content = hasMd ? slideMdFiles[mdPath] : (slideHtmlFiles[htmlPath] ?? '');

    const waMdPath = `/decks/${deckId}/${slideId}/working-area/slide.md`;
    const waHtmlPath = `/decks/${deckId}/${slideId}/working-area/slide.html`;
    const hasWaMd = waMdPath in waMdFiles;
    const hasWaHtml = waHtmlPath in waHtmlFiles;

    let workingArea: SlideData['workingArea'];
    if (hasWaMd || hasWaHtml) {
      const waType: 'md' | 'html' = hasWaMd ? 'md' : 'html';
      let waContent = hasWaMd ? waMdFiles[waMdPath] : waHtmlFiles[waHtmlPath];
      if (waType === 'html') {
        const css = waCssFiles[`/decks/${deckId}/${slideId}/working-area/style.css`];
        const js = waJsFiles[`/decks/${deckId}/${slideId}/working-area/script.js`];
        if (css) waContent = waContent.replace('</head>', `<style>${css}</style></head>`);
        if (js) waContent = waContent.replace('</body>', `<script>${js}<\/script></body>`);
      }
      workingArea = { content: waContent, type: waType };
    }

    return { index, id: slideId, deckId, content, type, workingArea };
  });
}

export function loadDecks(): DeckData[] {
  const deckIds = new Set<string>();
  for (const path of [...Object.keys(deckMetaFiles), ...Object.keys(slideMdFiles), ...Object.keys(slideHtmlFiles)]) {
    const m = path.match(/^\/decks\/([^/]+)\//);
    if (m?.[1]) deckIds.add(m[1]);
  }
  return [...deckIds]
    .sort(naturalSort)
    .map((deckId) => ({
      id: deckId,
      meta: parseDeckMeta(deckId),
      slides: loadSlidesForDeck(deckId),
    }))
    .filter((deck) => deck.slides.length > 0);
}

export function getDefaultDeckId(decks: DeckData[]): string | null {
  if (!decks.length) return null;
  const sample = decks.find((d) => d.id === 'sample-deck');
  return sample?.id ?? decks[0].id;
}
