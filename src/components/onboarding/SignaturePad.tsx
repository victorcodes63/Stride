'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, PenLine, Type } from 'lucide-react';

type Mode = 'draw' | 'type';

type SignaturePadProps = {
  /** Called whenever the drawn signature changes; null when cleared. */
  onDrawChange: (dataUrl: string | null) => void;
  /** Called whenever the typed name changes (used as the "type your name" fallback). */
  onTypedNameChange: (name: string) => void;
  typedName: string;
  disabled?: boolean;
  surface?: 'dashboard' | 'ess';
};

/**
 * Canvas-based signature capture. Supports drawing (mouse/touch) that returns a
 * PNG dataURL, plus a "type your name" fallback for accessibility / no-touch devices.
 */
export function SignaturePad({
  onDrawChange,
  onTypedNameChange,
  typedName,
  disabled,
  surface = 'ess',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<Mode>('draw');
  const [hasDrawn, setHasDrawn] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = pointFromEvent(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const point = pointFromEvent(e);
    const last = lastRef.current ?? point;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastRef.current = point;
    hasStrokeRef.current = true;
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    if (hasStrokeRef.current) {
      setHasDrawn(true);
      const dataUrl = canvasRef.current?.toDataURL('image/png') ?? null;
      onDrawChange(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasStrokeRef.current = false;
    setHasDrawn(false);
    onDrawChange(null);
  };

  const tabActive =
    surface === 'dashboard'
      ? 'bg-primary-600 text-white'
      : 'bg-[var(--ess-primary)] text-white';
  const tabIdle =
    surface === 'dashboard'
      ? 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
      : 'text-[var(--ess-muted)]';

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-[var(--ess-border)] p-0.5 text-xs font-semibold">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('draw')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${mode === 'draw' ? tabActive : tabIdle}`}
        >
          <PenLine className="h-3.5 w-3.5" />
          Draw
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('type')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${mode === 'type' ? tabActive : tabIdle}`}
        >
          <Type className="h-3.5 w-3.5" />
          Type
        </button>
      </div>

      {mode === 'draw' ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-dashed border-[var(--ess-border)] bg-white">
            <canvas
              ref={canvasRef}
              className="h-44 w-full touch-none"
              style={{ touchAction: 'none' }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              onPointerCancel={end}
            />
            {!hasDrawn ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
                Sign here
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled || !hasDrawn}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ess-muted)] disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear signature
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={typedName}
            disabled={disabled}
            onChange={(e) => onTypedNameChange(e.target.value)}
            placeholder="Type your full name"
            className="w-full rounded-lg border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-2 text-lg text-[var(--ess-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            style={{ fontFamily: 'cursive' }}
          />
          <p className="mt-1 text-xs text-[var(--ess-muted)]">
            Typing your name counts as your legal signature.
          </p>
        </div>
      )}
    </div>
  );
}
