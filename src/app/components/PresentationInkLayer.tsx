import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Highlighter, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const PEN_LINE_WIDTH = 4;
const HIGHLIGHTER_LINE_WIDTH = 24;
const HIGHLIGHTER_ALPHA = 0.35;
const STROKE_TTL_MS = 6_000;

/**
 * Latent coordinate system: origin (0,0) = cursor position at open time.
 * Circle radius in latent px — swatch centers lie on this circle.
 */
const FLYWHEEL_RADIUS_PX = 80;
const COLOR_DOT_PX = 48;

/** θ = -π/2 + 2π·i/n  →  first at top, then clockwise. */
function flywheelLatentOffset(index: number, count: number, radius: number) {
  const theta = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
}

const FAN_FADE_IN_S = 0.25;
const FAN_STAGGER_S = 0.04;

const HIGHLIGHTER_COLORS = new Set(['#facc15', '#d4d4d4']);

type FlywheelOption = {
  color: string;
  label: string;
  Icon?: LucideIcon;
  darkGlyph?: boolean;
  highlighter?: boolean;
};

/**
 * Clockwise from top.
 * Yellow & grey are highlighters (show icon); others are plain pen colors.
 */
const FLYWHEEL_OPTIONS: FlywheelOption[] = [
  { color: '#dc2626', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#22c55e', label: 'Green' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#a855f7', label: 'Purple' },
  { color: '#262626', label: 'Black' },
  { color: '#d4d4d4', label: 'Grey highlighter', Icon: Highlighter, darkGlyph: true, highlighter: true },
  { color: '#facc15', label: 'Yellow highlighter', Icon: Sun, darkGlyph: true, highlighter: true },
];

const PEN_CURSOR_HOTSPOT = '6 26';

function penCursorDataUrl(fillHex: string): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(fillHex) ? fillHex : '#dc2626';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M22 3L29 10L11 28L4 29L5 22L22 3Z" fill="${safe}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 22L11 28" stroke="#374151" stroke-width="1"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${PEN_CURSOR_HOTSPOT}, crosshair`;
}

const HIGHLIGHTER_CURSOR_HOTSPOT = '4 28';

function highlighterCursorDataUrl(fillHex: string): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(fillHex) ? fillHex : '#facc15';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="8" y="1" width="14" height="26" rx="3" ry="3" fill="${safe}" stroke="#ffffff" stroke-width="1.2" transform="rotate(-25 15 14)"/><rect x="11" y="22" width="8" height="6" rx="1" fill="#888" stroke="#fff" stroke-width="0.6" transform="rotate(-25 15 25)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${HIGHLIGHTER_CURSOR_HOTSPOT}, crosshair`;
}

const DEFAULT_BRUSH_COLOR = '#dc2626';

type Point = { x: number; y: number };

type Stroke = {
  id: number;
  points: Point[];
  color: string;
  lineWidth: number;
  baseAlpha: number;
  completedAt: number | null;
};

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  lineWidth: number,
  baseAlpha: number,
  fadeAlpha: number,
) {
  if (points.length === 0 || fadeAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = baseAlpha * fadeAlpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 1) {
    const r = lineWidth / 2;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function strokeFadeAlpha(completedAt: number | null, now: number): number {
  if (completedAt == null) return 1;
  const t = (now - completedAt) / STROKE_TTL_MS;
  return Math.max(0, 1 - t);
}

export function PresentationInkLayer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const strokeIdRef = useRef(0);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [brushColor, setBrushColor] = useState<string>(DEFAULT_BRUSH_COLOR);
  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [wheelPos, setWheelPos] = useState({ x: 0, y: 0 });

  const isHighlighter = HIGHLIGHTER_COLORS.has(brushColor);

  const cursorStyle = useMemo(
    () => (isHighlighter ? highlighterCursorDataUrl(brushColor) : penCursorDataUrl(brushColor)),
    [brushColor, isHighlighter],
  );

  const redraw = useCallback((list: Stroke[], active: Stroke | null, now: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    for (const s of list) {
      const fade = strokeFadeAlpha(s.completedAt, now);
      drawStroke(ctx, s.points, s.color, s.lineWidth, s.baseAlpha, fade);
    }
    if (active?.points.length) {
      drawStroke(ctx, active.points, active.color, active.lineWidth, active.baseAlpha, 1);
    }
  }, []);

  useEffect(() => {
    redraw(strokes, currentStrokeRef.current, Date.now());
  }, [strokes, redraw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      redraw(strokesRef.current, currentStrokeRef.current, Date.now());
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const now = Date.now();
      redraw(strokesRef.current, currentStrokeRef.current, now);
      const list = strokesRef.current;
      const pruned = list.filter((s) => !s.completedAt || now - s.completedAt < STROKE_TTL_MS);
      if (pruned.length !== list.length) {
        strokesRef.current = pruned;
        setStrokes(pruned);
      }
      const stillFading = strokesRef.current.some(
        (s) => s.completedAt != null && now - s.completedAt < STROKE_TTL_MS,
      );
      if (stillFading) rafId = requestAnimationFrame(tick);
    };
    const stillFading = strokes.some(
      (s) => s.completedAt != null && Date.now() - s.completedAt < STROKE_TTL_MS,
    );
    if (stillFading) rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [strokes, redraw]);

  const clientToLocal = (clientX: number, clientY: number): Point | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = clientToLocal(e.clientX, e.clientY);
    if (!p) return;
    if (colorWheelOpen) setColorWheelOpen(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    strokeIdRef.current += 1;
    currentStrokeRef.current = {
      id: strokeIdRef.current,
      points: [p],
      color: brushColor,
      lineWidth: isHighlighter ? HIGHLIGHTER_LINE_WIDTH : PEN_LINE_WIDTH,
      baseAlpha: isHighlighter ? HIGHLIGHTER_ALPHA : 1,
      completedAt: null,
    };
    redraw(strokesRef.current, currentStrokeRef.current, Date.now());
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!currentStrokeRef.current) return;
    const p = clientToLocal(e.clientX, e.clientY);
    if (!p) return;
    currentStrokeRef.current.points.push(p);
    redraw(strokesRef.current, currentStrokeRef.current, Date.now());
  };

  const finishStroke = () => {
    const cur = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!cur || cur.points.length < 1) return;
    const completedAt = Date.now();
    const strokeToAdd: Stroke = { ...cur, completedAt };
    setStrokes((prev) => {
      const next = [...prev, strokeToAdd];
      strokesRef.current = next;
      return next;
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    finishStroke();
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = clientToLocal(e.clientX, e.clientY);
    if (!p) return;
    setWheelPos(p);
    setColorWheelOpen(true);
  };

  useEffect(() => {
    if (!colorWheelOpen) return;
    const close = (ev: MouseEvent) => {
      if ((ev.target as HTMLElement).closest?.('[data-ink-wheel]')) return;
      setColorWheelOpen(false);
    };
    const onKey = () => setColorWheelOpen(false);
    document.addEventListener('mousedown', close, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [colorWheelOpen]);

  const dotOffset = COLOR_DOT_PX / 2;
  const nOpts = FLYWHEEL_OPTIONS.length;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-[40] touch-none pointer-events-auto"
      style={{ cursor: cursorStyle }}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={finishStroke}
        onPointerCancel={finishStroke}
        onContextMenu={onContextMenu}
      />
      <AnimatePresence>
        {colorWheelOpen
          ? FLYWHEEL_OPTIONS.map((opt, i) => {
              const { x, y } = flywheelLatentOffset(i, nOpts, FLYWHEEL_RADIUS_PX);
              const { color, label, Icon, darkGlyph } = opt;
              return (
                <motion.button
                  key={color + label}
                  data-ink-wheel
                  type="button"
                  className={`absolute flex items-center justify-center rounded-full outline-none pointer-events-auto hover:brightness-110 active:brightness-90 ${
                    darkGlyph ? 'text-zinc-900' : 'text-white'
                  }`}
                  style={{
                    zIndex: 2,
                    left: wheelPos.x + x - dotOffset,
                    top: wheelPos.y + y - dotOffset,
                    width: COLOR_DOT_PX,
                    height: COLOR_DOT_PX,
                    backgroundColor: color,
                  }}
                  title={label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: FAN_FADE_IN_S,
                    delay: i * FAN_STAGGER_S,
                    ease: 'easeOut',
                  }}
                  onClick={() => {
                    setBrushColor(color);
                    setColorWheelOpen(false);
                  }}
                >
                  {Icon ? (
                    <Icon className="h-[22px] w-[22px] shrink-0 pointer-events-none" strokeWidth={2.25} aria-hidden />
                  ) : null}
                </motion.button>
              );
            })
          : null}
      </AnimatePresence>
    </div>
  );
}
