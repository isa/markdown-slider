import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import elkLayouts from '@mermaid-js/layout-elk';

/** ELK is optional in Mermaid v11 — register once so `defaultRenderer: 'elk'` uses true orthogonal routing. */
mermaid.registerLayoutLoaders(elkLayouts);

/** Serialize mermaid initialize + render so theme config is not interleaved between instances. */
let mermaidChain: Promise<void> = Promise.resolve();

function queueMermaid<T>(fn: () => Promise<T>): Promise<T> {
  const run = mermaidChain.then(() => fn());
  mermaidChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Dagre draws `edgePaths` / `edgeLabels` before `nodes`, so filled nodes cover lines.
 * Move edge groups after `nodes` so strokes and arrows paint on top.
 */
function raiseMermaidEdgesAboveNodes(svgHtml: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return svgHtml;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgHtml, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return svgHtml;
  const svg = doc.documentElement;
  if (!svg || svg.localName !== 'svg') return svgHtml;

  doc.querySelectorAll('g.root').forEach((rootG) => {
    const edgePaths = rootG.querySelector(':scope > g.edgePaths');
    const edgeLabels = rootG.querySelector(':scope > g.edgeLabels');
    const nodes = rootG.querySelector(':scope > g.nodes');
    if (!nodes || (!edgePaths && !edgeLabels)) return;
    if (edgePaths) rootG.appendChild(edgePaths);
    if (edgeLabels) rootG.appendChild(edgeLabels);
  });

  return new XMLSerializer().serializeToString(doc);
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function isTransparent(bg: string): boolean {
  const b = bg.trim().toLowerCase();
  return (
    b === 'transparent' ||
    b === 'rgba(0, 0, 0, 0)' ||
    b === 'rgba(0,0,0,0)' ||
    b === ''
  );
}

/** Parse #rgb / #rrggbb (quoted YAML values may include ""). */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.replace(/^["']|["']$/g, '').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Linear blend of two hex colors (t=0 → a, t=1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  if (!A || !B) return a;
  const u = 1 - t;
  const r = Math.round(A.r * u + B.r * t);
  const g = Math.round(A.g * u + B.g * t);
  const bl = Math.round(A.b * u + B.b * t);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance (sRGB), 0–1. */
function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Pick light or dark ink for readable labels on `fillHex`. */
function pickTextOnFill(fillHex: string, lightInk: string, darkInk: string): string {
  return relativeLuminance(fillHex) > 0.45 ? darkInk : lightInk;
}

const NODE_RX = '10px';
const EDGE_STROKE = '2.5px';

type NodePaint = { fill: string; labelHex: string; stroke?: string };

export type MermaidNodeStyle = 'filled' | 'outline';

/**
 * Dagre flowchart DOM: `g.root` > `g.nodes` > `g.node` (siblings only — safe for :nth-child).
 * Rounded rects + per-node fill + label colors (foreignObject + SVG text).
 */
function buildFlowchartThemeCSS(
  nodes: NodePaint[],
  edgeColor: string,
  nodeStyle: MermaidNodeStyle,
): string {
  const outline = nodeStyle === 'outline';
  const baseShapes = outline
    ? `
g.nodes > g.node rect,
g.nodes > g.node polygon,
g.nodes > g.node .label-container rect,
g.nodes > g.node .basic.label-container rect {
  rx: ${NODE_RX};
  ry: ${NODE_RX};
  fill: none !important;
  stroke-width: 2px !important;
}
`.trim()
    : `
g.nodes > g.node rect,
g.nodes > g.node polygon,
g.nodes > g.node .label-container rect,
g.nodes > g.node .basic.label-container rect {
  rx: ${NODE_RX};
  ry: ${NODE_RX};
  stroke: none !important;
  stroke-width: 0 !important;
}
`.trim();

  const edgeBlock = `
.edgePath .path,
g.edges path,
g.edgePaths path,
.flowchart-link path,
.flowchart-link {
  stroke: ${edgeColor} !important;
  stroke-width: ${EDGE_STROKE} !important;
  stroke-linecap: butt !important;
  stroke-linejoin: miter !important;
}
.arrowheadPath,
marker path,
defs .arrowheadPath {
  fill: ${edgeColor} !important;
}
`.trim();

  if (nodes.length === 0) return `${baseShapes}\n${edgeBlock}`;

  const n = nodes.length;
  const rules = nodes
    .map((node, i) => {
      const idx = i + 1;
      const { fill, labelHex, stroke } = node;
      if (outline && stroke) {
        return `
g.nodes > g.node:nth-child(${n}n+${idx}) rect,
g.nodes > g.node:nth-child(${n}n+${idx}) polygon,
g.nodes > g.node:nth-child(${n}n+${idx}) path:not(.arrowheadPath) {
  fill: none !important;
  stroke: ${stroke} !important;
  stroke-width: 2px !important;
}
g.nodes > g.node:nth-child(${n}n+${idx}) .label text,
g.nodes > g.node:nth-child(${n}n+${idx}) .label span,
g.nodes > g.node:nth-child(${n}n+${idx}) .label tspan,
g.nodes > g.node:nth-child(${n}n+${idx}) .nodeLabel,
g.nodes > g.node:nth-child(${n}n+${idx}) foreignObject div,
g.nodes > g.node:nth-child(${n}n+${idx}) foreignObject span {
  fill: ${labelHex} !important;
  color: ${labelHex} !important;
}`.trim();
      }
      return `
g.nodes > g.node:nth-child(${n}n+${idx}) rect,
g.nodes > g.node:nth-child(${n}n+${idx}) polygon,
g.nodes > g.node:nth-child(${n}n+${idx}) path:not(.arrowheadPath) {
  fill: ${fill} !important;
  stroke: none !important;
  stroke-width: 0 !important;
}
g.nodes > g.node:nth-child(${n}n+${idx}) .label text,
g.nodes > g.node:nth-child(${n}n+${idx}) .label span,
g.nodes > g.node:nth-child(${n}n+${idx}) .label tspan,
g.nodes > g.node:nth-child(${n}n+${idx}) .nodeLabel,
g.nodes > g.node:nth-child(${n}n+${idx}) foreignObject div,
g.nodes > g.node:nth-child(${n}n+${idx}) foreignObject span {
  fill: ${labelHex} !important;
  color: ${labelHex} !important;
}`.trim();
    })
    .join('\n');

  return `${baseShapes}\n${rules}\n${edgeBlock}`;
}

export type SlideMermaidTheme = {
  themeVariables: Record<string, string>;
  themeCSS: string;
};

/**
 * Read slide theme from `.slide-root` and map to Mermaid `base` themeVariables.
 *
 * **Flowchart node boxes:** Mermaid’s flowchart stylesheet sets `.node rect, … { fill: mainBkg }`
 * (see mermaid `flowDiagram` styles) — not `primaryColor`. We tint `mainBkg` from `--slide-accent`
 * + `--slide-code-bg`, and add `themeCSS` for border-radius + a rotating palette (same idea as
 * slide chart series colors).
 */
function buildThemeFromSlideRoot(
  root: Element,
  options?: { nodeStyle?: MermaidNodeStyle },
): SlideMermaidTheme {
  const nodeStyle = options?.nodeStyle ?? 'filled';
  const s = getComputedStyle(root);
  const get = (name: string) => s.getPropertyValue(name).trim();

  const accent = get('--slide-accent') || '#60a5fa';
  const text = get('--slide-text') || '#e4e4e7';
  const textMuted = get('--slide-text-muted') || '#a1a1aa';
  const bullet = get('--slide-bullet-color') || accent;
  const codeBg = get('--slide-code-bg') || '#27272a';
  const codeText = get('--slide-code-text') || '#86efac';
  const tableBorder = get('--slide-table-border') || '#3f3f46';
  const heading = get('--slide-heading-color') || text;
  const blockquoteBorder = get('--slide-blockquote-border') || accent;
  let bg = get('--slide-bg');
  if (isTransparent(bg)) {
    bg = codeBg;
  }

  const fontBody = stripQuotes(get('--slide-font-body') || 'ui-sans-serif, system-ui, sans-serif');

  /** Hue stops (before darkening onto `codeBg` so labels stay readable). */
  const hueStops = [
    accent,
    bullet,
    codeText,
    mixHex(blockquoteBorder, codeText, 0.38),
    mixHex(bullet, accent, 0.45),
  ];
  /** Sit shapes on the slide “surface” (code-bg): vivid but dark enough for light or dark ink. */
  const paletteFills = hueStops.map((c) => mixHex(codeBg, c, 0.52));
  const lightInk = text;
  const darkInk = mixHex('#0a0a0a', codeBg, 0.22);

  const nodePaint: NodePaint[] =
    nodeStyle === 'outline'
      ? hueStops.map((c) => ({
          fill: 'none',
          stroke: c,
          labelHex: text,
        }))
      : paletteFills.map((fill) => ({
          fill,
          labelHex: pickTextOnFill(fill, lightInk, darkInk),
        }));

  const nodeFillDefault = mixHex(codeBg, accent, 0.45);
  const defaultLabel = pickTextOnFill(nodeFillDefault, lightInk, darkInk);
  /** Edges / arrowheads — use accent so links read clearly on any slide theme */
  const edgeColor = accent;

  const themeVariables: Record<string, string> = {
    background: bg,
    primaryColor: accent,
    primaryTextColor: text,
    secondaryColor: bullet,
    tertiaryColor: codeText,
    primaryBorderColor: tableBorder,
    secondaryBorderColor: blockquoteBorder,
    tertiaryBorderColor: textMuted,
    lineColor: edgeColor,
    arrowheadColor: edgeColor,
    textColor: text,
    mainBkg: nodeFillDefault,
    nodeBkg: nodeFillDefault,
    nodeBorder: 'transparent',
    nodeTextColor: defaultLabel,
    clusterBkg: codeBg,
    clusterBorder: tableBorder,
    titleColor: heading,
    edgeLabelBackground: codeBg,
    noteBkgColor: codeBg,
    noteTextColor: text,
    noteBorderColor: tableBorder,
    defaultLinkColor: accent,
    fontFamily: fontBody,
    fontSize: '16px',
    actorBkg: codeBg,
    actorBorder: tableBorder,
    actorTextColor: text,
    actorLineColor: tableBorder,
    signalColor: accent,
    signalTextColor: text,
    labelBoxBkgColor: codeBg,
    labelTextColor: text,
    loopTextColor: textMuted,
    activationBorderColor: accent,
    activationBkgColor: codeBg,
    sequenceNumberColor: text,
    sectionBkgColor: codeBg,
    altSectionBkgColor: codeBg,
    stateBkg: codeBg,
    stateLabelColor: text,
    labelBackgroundColor: codeBg,
    compositeBackground: codeBg,
    compositeBorder: tableBorder,
    secondaryTextColor: textMuted,
    tertiaryTextColor: codeText,
    gridColor: tableBorder,
    git0: accent,
    git1: bullet,
    git2: codeText,
    git3: blockquoteBorder,
    git4: textMuted,
    git5: accent,
    git6: bullet,
    git7: codeText,
    cScale0: paletteFills[0] ?? accent,
    cScale1: paletteFills[1] ?? bullet,
    cScale2: paletteFills[2] ?? codeText,
    cScale3: paletteFills[3] ?? blockquoteBorder,
    cScale4: paletteFills[4] ?? accent,
  };

  return {
    themeVariables,
    themeCSS: buildFlowchartThemeCSS(nodePaint, edgeColor, nodeStyle),
  };
}

export interface SlideMermaidEmbedProps {
  /** Raw fenced block contents (may end with newline). */
  definition: string;
  /** From slide YAML `mermaidNodes:` — default filled boxes; `outline` = stroke only. */
  nodeStyle?: MermaidNodeStyle;
}

export function SlideMermaidEmbed({ definition, nodeStyle = 'filled' }: SlideMermaidEmbedProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const svgMountRef = useRef<HTMLDivElement>(null);
  const bindFunctionsRef = useRef<((element: Element) => void) | undefined>(undefined);
  const reactId = useId().replace(/:/g, '');
  const renderIdRef = useRef(`mmd-${reactId}`);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const def = definition.replace(/\n$/, '').trim();

  useEffect(() => {
    if (!def) {
      setSvg(null);
      setError('Empty mermaid diagram');
      return;
    }

    let cancelled = false;

    const runRender = () => {
      const el = outerRef.current;
      const slideRoot = el?.closest('.slide-root') ?? document.documentElement;

      queueMermaid(async () => {
        try {
          const { themeVariables, themeCSS } = buildThemeFromSlideRoot(slideRoot, {
            nodeStyle,
          });

          mermaid.initialize({
            startOnLoad: false,
            /* `strict` DOMPurify pass + passing a container ref both break React (innerHTML cleared) / output; slides are author-controlled */
            securityLevel: 'loose',
            theme: 'base',
            themeVariables,
            themeCSS,
            /**
             * ELK layered layout: orthogonal paths (not dagre diagonals).
             * Requires `@mermaid-js/layout-elk` + registerLayoutLoaders (see imports).
             */
            flowchart: {
              defaultRenderer: 'elk',
              diagramPadding: 16,
              nodeSpacing: 56,
              rankSpacing: 56,
            },
            elk: {
              mergeEdges: false,
            },
          });
          /* Never pass a container: mermaid sets innerHTML = "" on it, which wipes React-managed nodes and leaves a blank slide. */
          const { svg: out, bindFunctions } = await mermaid.render(renderIdRef.current, def);
          if (cancelled) return;
          bindFunctionsRef.current = bindFunctions;
          setSvg(raiseMermaidEdgesAboveNodes(out));
          setError(null);
        } catch (e) {
          if (cancelled) return;
          bindFunctionsRef.current = undefined;
          const msg = e instanceof Error ? e.message : String(e);
          setSvg(null);
          setError(msg);
        }
      });
    };

    runRender();

    const el = outerRef.current;
    const slideRoot = el?.closest('.slide-root');
    if (!slideRoot) {
      return () => {
        cancelled = true;
      };
    }

    const obs = new MutationObserver(() => {
      if (!cancelled) runRender();
    });
    obs.observe(slideRoot, { attributes: true, attributeFilter: ['style', 'class'] });

    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [def, nodeStyle]);

  useLayoutEffect(() => {
    if (!svg || !svgMountRef.current) return;
    const fn = bindFunctionsRef.current;
    if (fn) fn(svgMountRef.current);
  }, [svg]);

  return (
    <div ref={outerRef} className="slide-mermaid-embed" role="img" aria-label="Mermaid diagram">
      {error ? (
        <pre className="slide-mermaid-embed__error">{error}</pre>
      ) : svg ? (
        <div
          ref={svgMountRef}
          className="slide-mermaid-embed__svg"
          // eslint-disable-next-line react/no-danger -- SVG from trusted mermaid render
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="slide-mermaid-embed__loading" aria-hidden />
      )}
    </div>
  );
}
