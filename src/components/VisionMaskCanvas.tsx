import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Brush, Eraser, Undo2, Trash2 } from 'lucide-react';
import type { VisionDarkroomAdjustments } from '../types/index.ts';

interface VisionMaskCanvasProps {
  imageUrl: string;
  alt: string;
  isMaskMode: boolean;
  darkroom: VisionDarkroomAdjustments;
  zoomPct: number;
  maskStrokeCount: number;
  onMaskChange: (maskDataUrl: string | null, strokeCount: number) => void;
}

export async function exportGradedImageDataUrl(
  imageUrl: string,
  darkroom: VisionDarkroomAdjustments,
  format: 'png' | 'jpeg' | 'webp' = 'png'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 1024;
      canvas.height = img.naturalHeight || img.height || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.save();
      ctx.translate(
        darkroom.flipH ? canvas.width : 0,
        darkroom.flipV ? canvas.height : 0
      );
      ctx.scale(darkroom.flipH ? -1 : 1, darkroom.flipV ? -1 : 1);

      const warmthSepia = darkroom.warmth > 0 ? Math.min(35, darkroom.warmth * 0.6) : 0;
      const coolHue = darkroom.warmth < 0 ? Math.round(darkroom.warmth * 0.45) : 0;
      ctx.filter = [
        `brightness(${darkroom.brightness}%)`,
        `contrast(${darkroom.contrast + darkroom.sharpness * 0.2}%)`,
        `saturate(${darkroom.saturation}%)`,
        warmthSepia ? `sepia(${warmthSepia}%)` : '',
        coolHue ? `hue-rotate(${coolHue}deg)` : '',
      ]
        .filter(Boolean)
        .join(' ');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (darkroom.vignette > 0) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const outer = Math.hypot(cx, cy);
        const grad = ctx.createRadialGradient(cx, cy, outer * 0.35, cx, cy, outer);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, darkroom.vignette / 100)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const mime =
        format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      resolve(canvas.toDataURL(mime, 0.94));
    };
    img.onerror = () => reject(new Error('Unable to load image for export'));
    img.src = imageUrl;
  });
}

export const VisionMaskCanvas: React.FC<VisionMaskCanvasProps> = ({
  imageUrl,
  alt,
  isMaskMode,
  darkroom,
  zoomPct,
  onMaskChange,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [brushSize, setBrushSize] = useState(32);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState(0);

  const syncCanvasDimensions = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const natW = img.naturalWidth || img.clientWidth || 1024;
    const natH = img.naturalHeight || img.clientHeight || 1024;
    if (canvas.width !== natW || canvas.height !== natH) {
      canvas.width = natW;
      canvas.height = natH;
      historyRef.current = [];
      setStrokes(0);
      onMaskChange(null, 0);
    }
  }, [onMaskChange]);

  useEffect(() => {
    historyRef.current = [];
    setStrokes(0);
    onMaskChange(null, 0);
  }, [imageUrl]);

  const emitCompositeMask = useCallback(
    (nextStrokeCount: number) => {
      const img = imgRef.current;
      const maskCanvas = canvasRef.current;
      if (!img || !maskCanvas || nextStrokeCount <= 0) {
        onMaskChange(null, 0);
        return;
      }
      // Produce an overlaid guidance image (original + opaque vivid red/white brush highlights)
      // so multimodal Nano Banana inpaint accurately targets the painted region.
      const out = document.createElement('canvas');
      out.width = maskCanvas.width;
      out.height = maskCanvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, out.width, out.height);
      ctx.drawImage(maskCanvas, 0, 0, out.width, out.height);
      onMaskChange(out.toDataURL('image/png'), nextStrokeCount);
    },
    [onMaskChange]
  );

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const paintAt = (x: number, y: number, isStart = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const scaledRadius = (brushSize * canvas.width) / Math.max(400, canvas.clientWidth || 800);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = scaledRadius;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
    }

    if (isStart) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y + 0.01);
      ctx.stroke();
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMaskMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > 20) historyRef.current.shift();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    paintAt(x, y, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMaskMode || !isDrawing) return;
    const { x, y } = getCanvasPoint(e);
    paintAt(x, y, false);
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const nextCount = strokes + 1;
    setStrokes(nextCount);
    emitCompositeMask(nextCount);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || historyRef.current.length === 0) return;
    const prev = historyRef.current.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      const nextCount = Math.max(0, strokes - 1);
      setStrokes(nextCount);
      emitCompositeMask(nextCount);
    }
  };

  const handleClearMask = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setStrokes(0);
    onMaskChange(null, 0);
  };

  const warmthSepia = darkroom.warmth > 0 ? Math.min(35, darkroom.warmth * 0.6) : 0;
  const coolHue = darkroom.warmth < 0 ? Math.round(darkroom.warmth * 0.45) : 0;
  const filterString = [
    `brightness(${darkroom.brightness}%)`,
    `contrast(${darkroom.contrast + darkroom.sharpness * 0.2}%)`,
    `saturate(${darkroom.saturation}%)`,
    warmthSepia ? `sepia(${warmthSepia}%)` : '',
    coolHue ? `hue-rotate(${coolHue}deg)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative flex flex-col items-center justify-center max-w-full">
      {/* Compact Mask Controls Pill (Only appears when Mask Mode is active) */}
      {isMaskMode && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1E1F22] border border-[#34373E] shadow-lg text-xs">
          <span className="text-[#8AB4F8] font-medium">Mask Brush:</span>
          <button
            type="button"
            onClick={() => setTool('brush')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              tool === 'brush'
                ? 'bg-[#8AB4F8]/20 text-[#8AB4F8] border border-[#8AB4F8]/40'
                : 'text-[#C4C7C5] hover:bg-[#2A2C32]'
            }`}
          >
            <Brush className="w-3.5 h-3.5" />
            <span>Paint</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              tool === 'eraser'
                ? 'bg-[#8AB4F8]/20 text-[#8AB4F8] border border-[#8AB4F8]/40'
                : 'text-[#C4C7C5] hover:bg-[#2A2C32]'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Erase</span>
          </button>
          <div className="flex items-center gap-1.5 pl-1 border-l border-[#34373E]">
            <span className="text-[11px] text-[#9AA0A6]">Size</span>
            <input
              type="range"
              min={8}
              max={96}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 accent-[#8AB4F8]"
            />
            <span className="text-[11px] font-mono text-[#E3E3E3] w-7">{brushSize}</span>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[#C4C7C5] hover:bg-[#2A2C32] disabled:opacity-40"
            title="Undo stroke"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClearMask}
            disabled={strokes === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-rose-400 hover:bg-rose-950/40 disabled:opacity-40"
            title="Clear mask"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Image + Interactive Mask Layer */}
      <div
        className="relative inline-flex items-center justify-center rounded-lg overflow-hidden transition-transform duration-150"
        style={{
          transform: `scale(${zoomPct / 100})`,
          transformOrigin: 'center center',
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={syncCanvasDimensions}
          style={{
            filter: filterString,
            transform: `scaleX(${darkroom.flipH ? -1 : 1}) scaleY(${darkroom.flipV ? -1 : 1})`,
          }}
          className="max-h-[60vh] w-auto max-w-full object-contain rounded-lg select-none block"
        />

        {/* Vignette Overlay */}
        {darkroom.vignette > 0 && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              background: `radial-gradient(circle, transparent 42%, rgba(0,0,0,${Math.min(
                0.85,
                darkroom.vignette / 100
              )}) 100%)`,
            }}
          />
        )}

        {/* Mask Drawing Overlay */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 w-full h-full touch-none rounded-lg ${
            isMaskMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
          }`}
        />
      </div>
    </div>
  );
};
