#!/usr/bin/env node
import { mkdtempSync, existsSync, mkdirSync, rmSync, readdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const decksRoot = path.join(projectRoot, 'decks');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assertDeckId(deckId) {
  if (!deckId || !/^[a-z0-9-]+$/.test(deckId)) {
    fail('Deck id must contain only lowercase letters, numbers, and hyphens.');
  }
}

function ensureDecksRoot() {
  if (!existsSync(decksRoot)) mkdirSync(decksRoot, { recursive: true });
}

function nextAvailableDeckId(baseId) {
  if (!existsSync(path.join(decksRoot, baseId))) return baseId;
  let i = 2;
  while (existsSync(path.join(decksRoot, `${baseId}-${i}`))) i += 1;
  return `${baseId}-${i}`;
}

function cmdCreate(args) {
  ensureDecksRoot();
  const id = String(args.id || '').trim();
  assertDeckId(id);
  const title = String(args.title || id).trim() || id;
  const subtitle = String(args.subtitle || '').trim();
  const author = String(args.author || '').trim();
  const defaultPaletteArg = String(args['default-palette'] || '').trim();
  const defaultFontArg = String(args['default-font'] || '').trim();
  const defaultTheme = String(args['default-theme'] || '').trim();
  const date = String(args.date || new Date().toISOString().slice(0, 10)).trim();

  const deckDir = path.join(decksRoot, id);
  if (existsSync(deckDir)) fail(`Deck already exists: decks/${id}`);

  mkdirSync(path.join(deckDir, 'slide01'), { recursive: true });

  let themeBlock;
  if (defaultPaletteArg || defaultFontArg) {
    const palette = defaultPaletteArg || 'default';
    const font = defaultFontArg || 'libre-baskerville-franklin';
    themeBlock = [`defaultPalette: ${palette}`, `defaultFont: ${font}`];
  } else if (defaultTheme) {
    themeBlock = [`defaultTheme: ${defaultTheme}`];
  } else {
    themeBlock = ['defaultPalette: default', 'defaultFont: libre-baskerville-franklin'];
  }

  const metadata = [
    '---',
    `title: ${title}`,
    ...(subtitle ? [`subtitle: ${subtitle}`] : []),
    ...(author ? [`author: ${author}`] : []),
    ...(date ? [`date: ${date}`] : []),
    ...themeBlock,
    'description: New deck',
    '---',
    '',
    'Deck metadata.',
    '',
  ].join('\n');
  const firstSlide = ['---', `title: ${title}`, '---', '', 'Start writing your first slide.', ''].join('\n');

  writeFileSync(path.join(deckDir, 'metadata.md'), metadata, 'utf8');
  writeFileSync(path.join(deckDir, 'slide01', 'slide.md'), firstSlide, 'utf8');
  console.log(`Created deck at decks/${id}`);
}

function cmdExport(args) {
  ensureDecksRoot();
  const id = String(args.id || '').trim();
  assertDeckId(id);
  const deckDir = path.join(decksRoot, id);
  if (!existsSync(deckDir)) fail(`Deck not found: decks/${id}`);

  const outPath = String(args.out || '').trim() || `${id}.zip`;
  const outAbs = path.isAbsolute(outPath) ? outPath : path.join(projectRoot, outPath);
  const outDir = path.dirname(outAbs);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  if (existsSync(outAbs)) rmSync(outAbs);

  const result = spawnSync('zip', ['-r', outAbs, id], { cwd: decksRoot, stdio: 'inherit' });
  if (result.status !== 0) fail('zip command failed.');
  console.log(`Exported deck to ${outAbs}`);
}

function findImportedDeckRoot(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const queue = entries.filter((e) => e.isDirectory()).map((e) => path.join(rootDir, e.name));
  while (queue.length) {
    const dir = queue.shift();
    if (!dir) continue;
    if (existsSync(path.join(dir, 'metadata.md'))) return dir;
    const nested = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name));
    queue.push(...nested);
  }
  return null;
}

function cmdImport(args) {
  ensureDecksRoot();
  const zipPath = String(args.zip || '').trim();
  if (!zipPath) fail('Missing --zip path.');
  const zipAbs = path.isAbsolute(zipPath) ? zipPath : path.join(projectRoot, zipPath);
  if (!existsSync(zipAbs)) fail(`Zip not found: ${zipAbs}`);

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'markdown-slider-deck-import-'));
  const unzip = spawnSync('unzip', ['-q', zipAbs, '-d', tmpRoot], { stdio: 'inherit' });
  if (unzip.status !== 0) {
    rmSync(tmpRoot, { recursive: true, force: true });
    fail('unzip command failed.');
  }

  const sourceDeckDir = findImportedDeckRoot(tmpRoot);
  if (!sourceDeckDir) {
    rmSync(tmpRoot, { recursive: true, force: true });
    fail('Could not find metadata.md in zip.');
  }

  const overrideId = String(args.id || '').trim();
  const sourceId = path.basename(sourceDeckDir);
  const candidate = overrideId || sourceId || slugify(readFileSync(path.join(sourceDeckDir, 'metadata.md'), 'utf8')) || 'imported-deck';
  assertDeckId(candidate);
  const finalId = nextAvailableDeckId(candidate);
  const targetDir = path.join(decksRoot, finalId);
  cpSync(sourceDeckDir, targetDir, { recursive: true });

  if (finalId !== sourceId) {
    const metaPath = path.join(targetDir, 'metadata.md');
    if (existsSync(metaPath)) {
      const raw = readFileSync(metaPath, 'utf8');
      if (!/\nid:\s*/.test(raw)) {
        writeFileSync(metaPath, `${raw.trimEnd()}\n`, 'utf8');
      }
    }
  }

  rmSync(tmpRoot, { recursive: true, force: true });
  console.log(`Imported deck to decks/${finalId}`);
}

function printUsage() {
  console.log(`Usage:
  bun run deck:create --id <deck-id> --title <title> [--subtitle <text>] [--author <author>] [--default-palette <id>] [--default-font <id>] [--default-theme <bundle>] [--date YYYY-MM-DD]
  bun run deck:export --id <deck-id> [--out ./deck.zip]
  bun run deck:import --zip ./deck.zip [--id <override-id>]
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === 'create') return cmdCreate(args);
  if (command === 'export') return cmdExport(args);
  if (command === 'import') return cmdImport(args);
  printUsage();
  process.exit(command ? 1 : 0);
}

main();
