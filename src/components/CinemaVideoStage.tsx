import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Copy,
  Trash2,
  Heart,
  FastForward,
  Volume2,
  VolumeX,
  Check,
  Scissors,
  Brush,
  Columns2,
  Music,
  Share2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Eraser,
  Maximize2,
  X,
} from 'lucide-react';
import type { GeneratedVideoItem, CinemaEditPreset, CinemaEditSpec } from '../types/index.ts';

interface CinemaVideoStageProps {
  video: GeneratedVideoItem;
  allVersions: GeneratedVideoItem[];
  onSelectVersion: (v: GeneratedVideoItem) => void;
  onApplyTextEdit: (params: {
    instruction: string;
    preset: CinemaEditPreset;
    maskImage?: string | null;
  }) => Promise<void>;
  onApplyMotionBrush: (params: {
    instruction: string;
    maskImage: string;
    direction: CinemaEditSpec['motionBrushDirection'];
  }) => Promise<void>;
  onExtendVideo: (addSec: number, extPrompt: string) => Promise<void>;
  onTrimVideo: (startSec: number, endSec: number) => Promise<void>;
  onInterpolate60Fps: () => Promise<void>;
  onUpscale4k: () => Promise<void>;
  onAudioSync: (params: { audioPrompt?: string; audioDataUrl?: string }) => Promise<void>;
  onGrabKeyframe: (dataUrl: string) => void;
  onToggleFavorite: (id: string) => void;
  onShare: (id: string) => void;
  onDownload: (video: GeneratedVideoItem) => void;
  onDelete: (id: string) => void;
  isBusy: boolean;
}

const BRUSH_DIRECTIONS: CinemaEditSpec['motionBrushDirection'][] = [
  'Flow Right',
  'Flow Left',
  'Push Forward',
  'Pull Back',
  'Rise Up',
  'Swirl / Vortex',
  'Static Mask',
];

const QUICK_EDIT_PRESETS: Array<{ id: CinemaEditPreset; label: string; sample: string }> = [
  { id: 'custom', label: 'Custom', sample: 'Change the vehicle color to matte crimson' },
  { id: 'restyle', label: 'Restyle', sample: 'Transform into theatrical cyberpunk anime style' },
  { id: 'weather_lighting', label: 'Weather & Light', sample: 'Switch to dramatic thunderstorm rain at midnight' },
  { id: 'background_replace', label: 'Background', sample: 'Replace background with futuristic Tokyo neon canyon' },
  { id: 'object_swap', label: 'Object Swap', sample: 'Replace the main subject with a futuristic robot' },
];

export const CinemaVideoStage: React.FC<CinemaVideoStageProps> = ({
  video,
  allVersions,
  onSelectVersion,
  onApplyTextEdit,
  onApplyMotionBrush,
  onExtendVideo,
  onTrimVideo,
  onInterpolate60Fps,
  onUpscale4k,
  onAudioSync,
  onGrabKeyframe,
  onToggleFavorite,
  onShare,
  onDownload,
  onDelete,
  isBusy,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const compareOriginalRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(video.duration || 5);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Split Compare mode
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);

  // Trim bar
  const [isTrimOpen, setIsTrimOpen] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(video.duration || 5);

  // Motion Brush canvas mode
  const [isBrushOpen, setIsBrushOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMaskStrokes, setHasMaskStrokes] = useState(false);
  const [brushSize, setBrushSize] = useState(26);
  const [brushDirection, setBrushDirection] =
    useState<CinemaEditSpec['motionBrushDirection']>('Flow Right');

  // Inline Text-to-Video Edit bar
  const [editPreset, setEditPreset] = useState<CinemaEditPreset>('custom');
  const [editText, setEditText] = useState('');

  // Audio Sync popover
  const [isAudioPopoverOpen, setIsAudioPopoverOpen] = useState(false);
  const [audioPromptInput, setAudioPromptInput] = useState('');

  useEffect(() => {
    setCurrentTime(0);
    setTotalDuration(video.duration || 5);
    setTrimStart(0);
    setTrimEnd(video.duration || 5);
    setIsCompareOpen(false);
    setIsBrushOpen(false);
    setHasMaskStrokes(false);
  }, [video.id, video.duration]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      compareOriginalRef.current?.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      compareOriginalRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const stepFrame = (deltaFrames: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
    const fps = video.fps || 24;
    const next = Math.min(totalDuration, Math.max(0, v.currentTime + deltaFrames / fps));
    v.currentTime = next;
    if (compareOriginalRef.current) compareOriginalRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const captureCurrentFrame = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    onGrabKeyframe(c.toDataURL('image/png'));
  };

  const syncBrushCanvasDimensions = () => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const rect = v.getBoundingClientRect();
    c.width = Math.max(320, Math.round(rect.width));
    c.height = Math.max(180, Math.round(rect.height));
  };

  useEffect(() => {
    if (isBrushOpen) {
      videoRef.current?.pause();
      setIsPlaying(false);
      syncBrushCanvasDimensions();
    }
  }, [isBrushOpen]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };

  const drawAt = (x: number, y: number) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(138, 180, 248, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasMaskStrokes(true);
  };

  const clearMaskCanvas = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasMaskStrokes(false);
  };

  const exportMaskDataUrl = (): string | null => {
    if (!hasMaskStrokes || !canvasRef.current || !videoRef.current) return null;
    const v = videoRef.current;
    const out = document.createElement('canvas');
    out.width = v.videoWidth || canvasRef.current.width;
    out.height = v.videoHeight || canvasRef.current.height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, out.width, out.height);
    ctx.drawImage(canvasRef.current, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  const handleSubmitEdit = async () => {
    const clean = editText.trim();
    if (!clean || isBusy) return;
    const maskImage = isBrushOpen && hasMaskStrokes ? exportMaskDataUrl() : null;
    await onApplyTextEdit({
      instruction: clean,
      preset: editPreset,
      maskImage,
    });
    setEditText('');
    setIsBrushOpen(false);
  };

  const handleSubmitMotionBrush = async () => {
    const maskImage = exportMaskDataUrl();
    if (!maskImage || isBusy) return;
    await onApplyMotionBrush({
      instruction:
        editText.trim() ||
        `Animate the highlighted region moving smoothly (${brushDirection}) while keeping the rest of the frame locked.`,
      maskImage,
      direction: brushDirection,
    });
    setIsBrushOpen(false);
    setEditText('');
  };

  return (
    <div className="h-full flex flex-col p-3 md:p-5 gap-3 max-w-6xl mx-auto w-full">
      {/* Top Version Tree & Utility Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#9AA0A6] tabular-nums min-w-0">
          <span className="text-[#E3E3E3] font-medium truncate max-w-[200px]">
            {video.model}
          </span>
          <span aria-hidden="true">·</span>
          <span>{video.dimensions}</span>
          <span aria-hidden="true">·</span>
          <span>{video.duration.toFixed(1)}s</span>
          <span aria-hidden="true">·</span>
          <span>{video.fps}fps</span>
          {video.version && video.version > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#8AB4F8] font-mono">v{video.version}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {allVersions.length > 1 && (
            <div className="flex items-center gap-1 bg-[#18191C] border border-[#282A2E] rounded-lg px-1.5 py-0.5">
              <span className="text-[11px] text-[#8E918F] px-1">Versions:</span>
              {allVersions.slice(0, 6).map((ver, idx) => (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => onSelectVersion(ver)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors ${
                    ver.id === video.id
                      ? 'bg-[#2B2D30] text-white'
                      : 'text-[#8E918F] hover:text-white'
                  }`}
                  title={ver.aiNotes || ver.prompt}
                >
                  v{ver.version || allVersions.length - idx}
                </button>
              ))}
            </div>
          )}

          {video.sourceVideoUrl && (
            <button
              type="button"
              onClick={() => setIsCompareOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors whitespace-nowrap ${
                isCompareOpen
                  ? 'bg-[#2B2D30] border-[#8AB4F8]/50 text-white'
                  : 'bg-[#18191C] border-[#282A2E] text-[#C4C7C5] hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Compare</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsBrushOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors whitespace-nowrap ${
              isBrushOpen
                ? 'bg-[#2B2D30] border-[#8AB4F8]/50 text-white'
                : 'bg-[#18191C] border-[#282A2E] text-[#C4C7C5] hover:text-white'
            }`}
          >
            <Brush className="w-3.5 h-3.5" />
            <span>Motion Brush</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTrimOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors whitespace-nowrap ${
              isTrimOpen
                ? 'bg-[#2B2D30] border-[#8AB4F8]/50 text-white'
                : 'bg-[#18191C] border-[#282A2E] text-[#C4C7C5] hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Trim</span>
          </button>
        </div>
      </div>

      {/* Main Unobstructed Video Viewport */}
      <div className="flex-1 min-h-[290px] rounded-2xl bg-black border border-[#282A2E] overflow-hidden flex items-center justify-center relative select-none">
        {isCompareOpen && video.sourceVideoUrl && (
          <video
            ref={compareOriginalRef}
            src={video.sourceVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        )}

        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.posterUrl || undefined}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
                setTotalDuration(videoRef.current.duration);
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current?.duration && Number.isFinite(videoRef.current.duration)) {
              setTotalDuration(videoRef.current.duration);
              setTrimEnd(videoRef.current.duration);
            }
          }}
          style={
            isCompareOpen && video.sourceVideoUrl
              ? { clipPath: `inset(0 0 0 ${splitPercent}%)` }
              : undefined
          }
          className="max-h-[54vh] w-full object-contain"
        />

        {isCompareOpen && video.sourceVideoUrl && (
          <>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
              style={{ left: `${splitPercent}%` }}
            />
            <input
              type="range"
              min="5"
              max="95"
              value={splitPercent}
              onChange={(e) => setSplitPercent(Number(e.target.value))}
              className="absolute bottom-3 left-6 right-6 accent-white z-20 opacity-85"
              title="Drag to compare Original vs Edited video"
            />
          </>
        )}

        {isBrushOpen && (
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => {
              setIsDrawing(true);
              const pt = getCanvasPoint(e);
              drawAt(pt.x, pt.y);
            }}
            onMouseMove={(e) => {
              if (!isDrawing) return;
              const pt = getCanvasPoint(e);
              drawAt(pt.x, pt.y);
            }}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
            className="absolute inset-0 m-auto cursor-crosshair z-20"
          />
        )}

        {isBusy && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="w-6 h-6 text-[#8AB4F8] animate-spin" />
            <span className="text-xs text-[#E3E3E3]">Processing cinema render...</span>
          </div>
        )}
      </div>

      {/* Motion Brush Toolbar (Only when toggled open) */}
      {isBrushOpen && (
        <div className="bg-[#18191C] border border-[#2D3036] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#E3E3E3] font-medium">Brush Size</span>
            <input
              type="range"
              min="10"
              max="60"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 accent-[#8AB4F8]"
            />
            <select
              value={brushDirection}
              onChange={(e) => setBrushDirection(e.target.value as any)}
              className="bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1 text-xs text-white"
            >
              {BRUSH_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={clearMaskCanvas}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#C4C7C5]"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
          <button
            type="button"
            disabled={!hasMaskStrokes || isBusy}
            onClick={handleSubmitMotionBrush}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] font-medium disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply Motion Brush</span>
          </button>
        </div>
      )}

      {/* Trim Range Panel (Only when toggled open) */}
      {isTrimOpen && (
        <div className="bg-[#18191C] border border-[#2D3036] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
            <label className="flex items-center gap-1.5 text-[#9AA0A6] tabular-nums">
              <span>In</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max={Math.max(0, trimEnd - 0.5)}
                value={trimStart.toFixed(1)}
                onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                className="w-16 bg-[#131314] border border-[#2F3135] rounded px-1.5 py-1 text-white font-mono"
              />
              <span>s</span>
            </label>
            <label className="flex items-center gap-1.5 text-[#9AA0A6] tabular-nums">
              <span>Out</span>
              <input
                type="number"
                step="0.1"
                min={trimStart + 0.5}
                max={totalDuration}
                value={trimEnd.toFixed(1)}
                onChange={(e) =>
                  setTrimEnd(Math.min(totalDuration, Math.max(trimStart + 0.5, Number(e.target.value))))
                }
                className="w-16 bg-[#131314] border border-[#2F3135] rounded px-1.5 py-1 text-white font-mono"
              />
              <span>s</span>
            </label>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onTrimVideo(trimStart, trimEnd)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] font-medium"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Save Trimmed Clip</span>
          </button>
        </div>
      )}

      {/* Playback Scrubber & Post-Production Strip */}
      <div className="bg-[#18191C] border border-[#282A2E] rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => stepFrame(-1)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#C4C7C5]"
            title="Previous frame"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-[#E3E3E3] hover:bg-white text-[#131314] flex items-center justify-center shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => stepFrame(1)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#C4C7C5]"
            title="Next frame"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="0"
            max={totalDuration || 5}
            step="0.04"
            value={currentTime}
            onChange={(e) => {
              const t = Number(e.target.value);
              setCurrentTime(t);
              if (videoRef.current) videoRef.current.currentTime = t;
              if (compareOriginalRef.current) compareOriginalRef.current.currentTime = t;
            }}
            className="flex-1 accent-[#8AB4F8]"
          />

          <span className="text-[11px] font-mono text-[#9AA0A6] tabular-nums shrink-0">
            {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </span>

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <div className="hidden sm:flex items-center gap-0.5 bg-[#131314] p-0.5 rounded-lg border border-[#2A2B2E]">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  setPlaybackSpeed(spd);
                  if (videoRef.current) videoRef.current.playbackRate = spd;
                  if (compareOriginalRef.current) compareOriginalRef.current.playbackRate = spd;
                }}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums ${
                  playbackSpeed === spd ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Inline Text-to-Video Edit Prompt Bar */}
        <div className="pt-2 border-t border-[#252629] space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {QUICK_EDIT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditPreset(p.id)}
                className={`px-2 py-0.5 rounded-md text-[11px] transition-colors ${
                  editPreset === p.id
                    ? 'bg-[#2B2D30] text-white border border-[#454850]'
                    : 'text-[#8E918F] hover:text-white bg-[#131314] border border-[#252629]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmitEdit();
                }
              }}
              placeholder={
                QUICK_EDIT_PRESETS.find((p) => p.id === editPreset)?.sample ||
                'Describe how to edit this video...'
              }
              className="flex-1 bg-[#131314] border border-[#2C2D30] focus:border-[#4A4D54] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#6E7075] focus:outline-none"
            />
            <button
              type="button"
              disabled={!editText.trim() || isBusy}
              onClick={handleSubmitEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-45 shrink-0 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Edit Video</span>
            </button>
          </div>
        </div>

        {/* Post-Production & Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252629] relative">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onExtendVideo(5, 'Continue the scene smoothly with natural cinema motion.')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3] disabled:opacity-50 whitespace-nowrap"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Extend +5s</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={onInterpolate60Fps}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3] disabled:opacity-50 whitespace-nowrap"
            >
              <span>60 FPS</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={onUpscale4k}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3] disabled:opacity-50 whitespace-nowrap"
            >
              <Maximize2 className="w-3 h-3" />
              <span>4K</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsAudioPopoverOpen((p) => !p)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap ${
                isAudioPopoverOpen
                  ? 'bg-[#2B2D30] text-white'
                  : 'bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Audio Sync</span>
            </button>

            <button
              type="button"
              onClick={captureCurrentFrame}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3] whitespace-nowrap"
              title="Grab current frame as Start Keyframe"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Grab Frame</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(video.prompt).catch(() => {});
                setCopiedPrompt(true);
                setTimeout(() => setCopiedPrompt(false), 1500);
              }}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
              title="Copy prompt"
            >
              {copiedPrompt ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onShare(video.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
              title="Publish & Share link"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(video.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
              title="Favorite"
            >
              <Heart
                className={`w-3.5 h-3.5 ${video.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => onDownload(video)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MP4</span>
            </button>

            <button
              type="button"
              onClick={() => onDelete(video.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-red-950/60 text-[#9AA0A6] hover:text-red-400"
              title="Delete clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Audio Sync Popover */}
          {isAudioPopoverOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#1B1C1E] border border-[#34363A] rounded-xl p-3 shadow-2xl z-30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white">
                  Lyria Score / Custom Audio Mux
                </span>
                <button
                  type="button"
                  onClick={() => setIsAudioPopoverOpen(false)}
                  className="text-[#8E918F] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={audioPromptInput}
                onChange={(e) => setAudioPromptInput(e.target.value)}
                placeholder="Describe music & foley (e.g. tense synthwave pulse)..."
                className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#6E7075] focus:outline-none"
              />
              <input
                ref={audioFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    if (typeof ev.target?.result === 'string') {
                      setIsAudioPopoverOpen(false);
                      await onAudioSync({ audioDataUrl: ev.target.result });
                    }
                  };
                  reader.readAsDataURL(f);
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={async () => {
                    setIsAudioPopoverOpen(false);
                    await onAudioSync({ audioPrompt: audioPromptInput || video.prompt });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium"
                >
                  Generate Lyria Score
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => audioFileRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
                >
                  Upload Audio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
