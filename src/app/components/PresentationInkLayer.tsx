import { useCallback, useEffect, useRef, useState } from 'react';

const LINE_WIDTH = 4;
const STROKE_TTL_MS = 10_000;

type Point = { x: number; y: number };

type Stroke = {
  id: number;
  points: Point[];
  color: string;
};

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  scale: number,
) {
  if (points.length === 0) return;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 1) {
    const r = (LINE_WIDTH / 2) * scale;
    ctx.beginPath();
    ctx.arc(points[0].x * scale, points[0].y * scale, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale, points[0].y * scale);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * scale, points[i].y * scale);
  }
  ctx.stroke();
}

interface PresentationInkLayerProps {
  isDarkMode: boolean;
}

export function PresentationInkLayer({ isDarkMode }: PresentationInkLayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const strokeIdRef = useRef(0);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const color = isDarkMode ? '#facc15' : '#dc2626';

  const redraw = useCallback((list: Stroke[], active: Stroke | null) => {
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
      drawStroke(ctx, s.points, s.color, 1);
    }
    if (active?.points.length) {
      drawStroke(ctx, active.points, active.color, 1);
    }
  }, []);

  useEffect(() => {
    redraw(strokes, currentStrokeRef.current);
  }, [strokes, redraw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      redraw(strokesRef.current, currentStrokeRef.current);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  const clientToLocal = (clientX: number, clientY: number): Point | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = clientToLocal(e.clientX, e.clientY);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    strokeIdRef.current += 1;
    currentStrokeRef.current = {
      id: strokeIdRef.current,
      points: [p],
      color,
    };
    redraw(strokesRef.current, currentStrokeRef.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!currentStrokeRef.current) return;
    const p = clientToLocal(e.clientX, e.clientY);
    if (!p) return;
    currentStrokeRef.current.points.push(p);
    redraw(strokesRef.current, currentStrokeRef.current);
  };

  const finishStroke = () => {
    const cur = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!cur || cur.points.length < 1) return;
    const id = cur.id;
    const strokeToAdd = { ...cur, color: cur.color };
    setStrokes((prev) => [...prev, strokeToAdd]);
    window.setTimeout(() => {
      setStrokes((prev) => prev.filter((s) => s.id !== id));
    }, STROKE_TTL_MS);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    finishStroke();
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-[40] touch-none cursor-crosshair"
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={finishStroke}
        onPointerCancel={finishStroke}
      />
    </div>
  );
}
