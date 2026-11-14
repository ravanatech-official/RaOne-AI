import React, { useState, useRef } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface VisionCompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
}

export const VisionCompareSlider: React.FC<VisionCompareSliderProps> = ({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Edited / Remastered',
  alt = 'Comparison view',
}) => {
  const [splitPct, setSplitPct] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pct = Math.min(98, Math.max(2, ((clientX - rect.left) / rect.width) * 100));
    setSplitPct(pct);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (isDragging) updateFromClientX(e.clientX);
      }}
      onPointerUp={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
      className="relative max-h-[64vh] max-w-full inline-flex items-center justify-center rounded-lg overflow-hidden select-none cursor-ew-resize border border-[#2D3036] bg-black"
    >
      {/* After (Full Base Layer) */}
      <img
        src={afterUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        className="max-h-[64vh] w-auto max-w-full object-contain block pointer-events-none"
      />

      {/* Before (Clipped Layer) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
      >
        <img
          src={beforeUrl}
          alt={`${alt} original`}
          referrerPolicy="no-referrer"
          draggable={false}
          className="w-full h-full object-contain block"
        />
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/75 border border-white/15 text-[11px] font-medium text-[#E3E3E3] pointer-events-none">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/75 border border-[#8AB4F8]/40 text-[11px] font-medium text-[#8AB4F8] pointer-events-none">
        {afterLabel}
      </span>

      {/* Divider & Handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-[#8AB4F8] shadow-[0_0_10px_rgba(138,180,248,0.8)] pointer-events-none"
        style={{ left: `${splitPct}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#161719] border-2 border-[#8AB4F8] flex items-center justify-center text-[#8AB4F8] shadow-lg">
          <MoveHorizontal className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
