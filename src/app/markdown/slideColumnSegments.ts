/**
 * Multi-column blocks: markdown in each cell (parsed as its own markdown subtree).
 *
 * @@@columns:2
 * @@cell
 * First column **markdown** — tables, images, code.
 * @@cell
 * | A | B |
 * |---|---|
 * | 1 | 2 |
 * @@@
 *
 * Premium card grid (same @@cell / @@@ delimiters):
 *
 * @@@cards:3
 * @@cell
 * ### Banner
 * ## Hero
 * Subtitle paragraph
 * - bullets
 * @@@
 */

export type SlideSegment =
  | { type: 'text'; content: string }
  | { type: 'columns'; cols: number; cells: string[] }
  | { type: 'cards'; cols: number; cells: string[] };

function parseCells(raw: string): string[] {
  let s = raw.trim();
  s = s.replace(/^@@cell\s*\n/, '');
  const parts = s.split(/\n@@cell\s*\n/).map((p) => p.trim());
  return parts.filter(Boolean);
}

export function parseSlideSegments(markdown: string): SlideSegment[] {
  const segments: SlideSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = /@@@(columns|cards):(\d+)\s*\n([\s\S]*?)\s*@@@/g;
  while ((m = re.exec(markdown)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', content: markdown.slice(lastIndex, m.index) });
    }
    const kind = m[1] === 'cards' ? 'cards' : 'columns';
    const cols = Math.min(4, Math.max(1, parseInt(m[2], 10) || 1));
    const cells = parseCells(m[3]);
    if (kind === 'cards') {
      segments.push({ type: 'cards', cols, cells });
    } else {
      segments.push({ type: 'columns', cols, cells });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', content: markdown });
  }
  return segments;
}
