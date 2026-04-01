/**
 * Vite dev-server middleware: read/write deck files under ./decks (local dev only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { stringify as yamlStringify } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const decksRoot = path.join(projectRoot, 'decks');

function assertDeckId(deckId) {
  if (!deckId || !/^[a-z0-9-]+$/.test(deckId)) {
    throw new Error('Invalid deck id');
  }
}

function safeResolveUnderDeck(deckId, relativePath) {
  assertDeckId(deckId);
  const rel = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (rel.startsWith('..')) throw new Error('Invalid path');
  const base = path.resolve(decksRoot, deckId);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error('Path escapes deck directory');
  }
  return full;
}

const SAVE_REL_PATTERN =
  /^metadata\.md$|^slide\d+\/slide\.(md|html)$|^slide\d+\/working-area\/slide\.(md|html)$|^slide\d+\/speaker\.md$/;

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function parseSlideFolderName(name) {
  const m = /^slide(\d+)$/.exec(name);
  return m ? parseInt(m[1], 10) : null;
}

function formatSlideFolder(n) {
  return `slide${String(n).padStart(2, '0')}`;
}

function listSlideNums(deckDir) {
  if (!fs.existsSync(deckDir)) return [];
  const nums = [];
  for (const name of fs.readdirSync(deckDir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const n = parseSlideFolderName(name.name);
    if (n != null) nums.push(n);
  }
  nums.sort((a, b) => a - b);
  return nums;
}

function readFileUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function stripWorkingAreaHtmlInjections(waDir, html) {
  const cssPath = path.join(waDir, 'style.css');
  const jsPath = path.join(waDir, 'script.js');
  let out = html;
  if (fs.existsSync(cssPath)) {
    const css = readFileUtf8(cssPath);
    const needle = `<style>${css}</style></head>`;
    if (out.includes(needle)) out = out.replace(needle, '</head>');
  }
  if (fs.existsSync(jsPath)) {
    const js = readFileUtf8(jsPath);
    const needle = `<script>${js}</script></body>`;
    if (out.includes(needle)) out = out.replace(needle, '</body>');
  }
  return out;
}

function toStringArray(v) {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  return out.length ? out : undefined;
}

/** YAML parsers turn `date: 2026-04-01` into a Date, not a string. */
function coerceDeckMetaDate(value) {
  if (typeof value === 'string') {
    const t = value.trim();
    return t || undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return undefined;
}

function parseDeckMetaFromRaw(deckId, raw) {
  const parsed = matter(raw);
  const data = parsed.data || {};
  const title =
    typeof data.title === 'string' && data.title.trim() ? data.title.trim() : deckId;
  return {
    id: deckId,
    title,
    subtitle:
      typeof data.subtitle === 'string' && data.subtitle.trim() ? data.subtitle.trim() : undefined,
    author: typeof data.author === 'string' && data.author.trim() ? data.author.trim() : undefined,
    date: coerceDeckMetaDate(data.date),
    defaultTheme:
      typeof data.defaultTheme === 'string' && data.defaultTheme.trim()
        ? data.defaultTheme.trim()
        : undefined,
    defaultPalette:
      typeof data.defaultPalette === 'string' && data.defaultPalette.trim()
        ? data.defaultPalette.trim()
        : undefined,
    defaultFont:
      typeof data.defaultFont === 'string' && data.defaultFont.trim()
        ? data.defaultFont.trim()
        : undefined,
    description:
      typeof data.description === 'string' && data.description.trim()
        ? data.description.trim()
        : undefined,
    tags: toStringArray(data.tags),
  };
}

function loadSlideForDeck(deckId, slideFolderName, index) {
  const base = path.join(decksRoot, deckId, slideFolderName);
  const mdPath = path.join(base, 'slide.md');
  const htmlPath = path.join(base, 'slide.html');
  const hasMd = fs.existsSync(mdPath);
  const type = hasMd ? 'md' : 'html';
  const content = hasMd ? readFileUtf8(mdPath) : readFileUtf8(htmlPath);

  const waMd = path.join(base, 'working-area', 'slide.md');
  const waHtml = path.join(base, 'working-area', 'slide.html');
  let workingArea;
  if (fs.existsSync(waMd)) {
    workingArea = { type: 'md', content: readFileUtf8(waMd) };
  } else if (fs.existsSync(waHtml)) {
    const waDir = path.dirname(waHtml);
    let waContent = readFileUtf8(waHtml);
    waContent = stripWorkingAreaHtmlInjections(waDir, waContent);
    const cssPath = path.join(waDir, 'style.css');
    const jsPath = path.join(waDir, 'script.js');
    if (fs.existsSync(cssPath)) {
      const css = readFileUtf8(cssPath);
      waContent = waContent.replace('</head>', `<style>${css}</style></head>`);
    }
    if (fs.existsSync(jsPath)) {
      const js = readFileUtf8(jsPath);
      waContent = waContent.replace('</body>', `<script>${js}</script></body>`);
    }
    workingArea = { type: 'html', content: waContent };
  }

  const speakerPath = path.join(base, 'speaker.md');
  const speakerNotes = fs.existsSync(speakerPath) ? readFileUtf8(speakerPath) : undefined;

  return {
    index,
    id: slideFolderName,
    deckId,
    content,
    type,
    speakerNotes,
    workingArea,
  };
}

function getDeckDataFromFs(deckId) {
  assertDeckId(deckId);
  const deckDir = path.join(decksRoot, deckId);
  if (!fs.existsSync(deckDir)) return null;
  const metaPath = path.join(deckDir, 'metadata.md');
  const metaRaw = fs.existsSync(metaPath) ? readFileUtf8(metaPath) : '';
  const meta = parseDeckMetaFromRaw(deckId, metaRaw || `---\ntitle: ${deckId}\n---\n`);

  const nums = listSlideNums(deckDir);
  const folderNames = nums.map(formatSlideFolder);
  const slides = folderNames.map((name, index) => loadSlideForDeck(deckId, name, index));
  return { id: deckId, meta, slides };
}

function buildMetadataYamlBody(meta) {
  const doc = { title: meta.title };
  if (meta.subtitle !== undefined && meta.subtitle !== '') doc.subtitle = meta.subtitle;
  if (meta.author) doc.author = meta.author;
  if (meta.date) doc.date = meta.date;
  if (meta.defaultTheme) doc.defaultTheme = meta.defaultTheme;
  if (meta.defaultPalette) doc.defaultPalette = meta.defaultPalette;
  if (meta.defaultFont) doc.defaultFont = meta.defaultFont;
  if (meta.description) doc.description = meta.description;
  if (meta.tags?.length) doc.tags = meta.tags;
  const body = yamlStringify(doc).trimEnd();
  return `---\n${body}\n---\n`;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

function insertSlideAfter(deckId, afterSlideId) {
  assertDeckId(deckId);
  const deckDir = path.join(decksRoot, deckId);
  if (!fs.existsSync(deckDir)) throw new Error('Deck not found');

  const nums = listSlideNums(deckDir);
  if (nums.length === 0) throw new Error('No slides in deck');

  const afterMatch = /^slide(\d+)$/.exec(afterSlideId || '');
  if (!afterMatch) throw new Error('Invalid afterSlideId');
  const afterNum = parseInt(afterMatch[1], 10);
  if (!nums.includes(afterNum)) throw new Error('afterSlideId not found in deck');
  const maxNum = nums[nums.length - 1];
  const k = afterNum + 1;

  for (let n = maxNum; n >= k; n--) {
    const from = path.join(deckDir, formatSlideFolder(n));
    const to = path.join(deckDir, formatSlideFolder(n + 1));
    if (fs.existsSync(to)) throw new Error(`Rename conflict: ${formatSlideFolder(n + 1)} exists`);
    fs.renameSync(from, to);
  }

  const newDir = path.join(deckDir, formatSlideFolder(k));
  fs.mkdirSync(newDir, { recursive: true });
  const starter = `---\ntitle: New Slide\n---\n\nAdd your content here.\n`;
  fs.writeFileSync(path.join(newDir, 'slide.md'), starter, 'utf8');

  return getDeckDataFromFs(deckId);
}

function createWorkingAreaFolder(deckId, slideId) {
  assertDeckId(deckId);
  const slideDir = path.join(decksRoot, deckId, slideId);
  if (!fs.existsSync(slideDir)) throw new Error('Slide folder not found');
  const waDir = path.join(slideDir, 'working-area');
  if (fs.existsSync(waDir)) throw new Error('Working area already exists');
  fs.mkdirSync(waDir, { recursive: true });
  const md = `# Working Area\n\nUse this space for notes, drafts, or demo snippets.\n`;
  fs.writeFileSync(path.join(waDir, 'slide.md'), md, 'utf8');
  return getDeckDataFromFs(deckId);
}

export function deckDevApiPlugin() {
  return {
    name: 'deck-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/__deck/')) return next();

        if (req.method === 'GET' && url === '/__deck/ping') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET' && url.startsWith('/__deck/deck/')) {
          const deckId = decodeURIComponent(url.slice('/__deck/deck/'.length));
          try {
            const data = getDeckDataFromFs(deckId);
            if (!data || data.slides.length === 0) {
              sendJson(res, 404, { error: 'Deck not found or empty' });
              return;
            }
            sendJson(res, 200, { deck: data });
          } catch (e) {
            sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
          }
          return;
        }

        /** Serve binary assets next to slide.md (corner images, etc.) — dev fallback when not yet in Vite glob. */
        if (req.method === 'GET' && url.startsWith('/__deck/asset/')) {
          const rest = url.slice('/__deck/asset/'.length);
          const segments = rest.split('/').filter(Boolean).map((s) => {
            try {
              return decodeURIComponent(s);
            } catch {
              return s;
            }
          });
          if (segments.length < 3) {
            sendJson(res, 400, { error: 'Invalid asset path' });
            return;
          }
          const deckId = segments[0];
          const slideId = segments[1];
          const relPath = segments.slice(2).join('/');
          try {
            assertDeckId(deckId);
            if (!/^slide\d+$/i.test(slideId)) {
              throw new Error('Invalid slide id');
            }
            if (!relPath || relPath.includes('..')) {
              throw new Error('Invalid asset name');
            }
            const ext = path.extname(relPath).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
            if (!allowed.includes(ext)) {
              throw new Error('Unsupported file type');
            }
            const abs = safeResolveUnderDeck(deckId, `${slideId}/${relPath}`);
            if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
              sendJson(res, 404, { error: 'Not found' });
              return;
            }
            const mime = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
            }[ext];
            res.statusCode = 200;
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'no-cache');
            res.end(fs.readFileSync(abs));
          } catch (e) {
            sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
          }
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        try {
          if (url === '/__deck/save-file') {
            const { deckId, relativePath, content } = body;
            if (typeof content !== 'string') throw new Error('content must be a string');
            if (typeof relativePath !== 'string' || !SAVE_REL_PATTERN.test(relativePath)) {
              throw new Error('Invalid relativePath');
            }
            const abs = safeResolveUnderDeck(deckId, relativePath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            let toWrite = content;
            if (relativePath.endsWith('working-area/slide.html')) {
              toWrite = stripWorkingAreaHtmlInjections(path.dirname(abs), content);
            }
            fs.writeFileSync(abs, toWrite, 'utf8');
            sendJson(res, 200, { ok: true });
            return;
          }

          if (url === '/__deck/save-metadata') {
            const { deckId, meta } = body;
            if (!meta || typeof meta !== 'object') throw new Error('meta required');
            const metaPath = safeResolveUnderDeck(deckId, 'metadata.md');
            let bodyMarkdown = '';
            if (fs.existsSync(metaPath)) {
              const raw = readFileUtf8(metaPath);
              const parsed = matter(raw);
              bodyMarkdown = typeof parsed.content === 'string' ? parsed.content : '';
            }
            const front = buildMetadataYamlBody(meta);
            const combined =
              bodyMarkdown.trim() === ''
                ? `${front}\n`
                : `${front}${bodyMarkdown.startsWith('\n') ? '' : '\n'}${bodyMarkdown}`;
            fs.writeFileSync(metaPath, combined, 'utf8');
            sendJson(res, 200, { ok: true, deck: getDeckDataFromFs(deckId) });
            return;
          }

          if (url === '/__deck/create-slide') {
            const { deckId, afterSlideId } = body;
            const deck = insertSlideAfter(deckId, afterSlideId);
            sendJson(res, 200, { ok: true, deck });
            return;
          }

          if (url === '/__deck/create-working-area') {
            const { deckId, slideId } = body;
            const deck = createWorkingAreaFolder(deckId, slideId);
            sendJson(res, 200, { ok: true, deck });
            return;
          }

          sendJson(res, 404, { error: 'Unknown route' });
        } catch (e) {
          sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
