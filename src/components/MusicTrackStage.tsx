import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Heart,
  Share2,
  Trash2,
  Repeat,
  Volume2,
  VolumeX,
  Scissors,
  FastForward,
  Sliders,
  Layers,
  Mic,
  Wand2,
  Copy,
  Check,
  SkipBack,
  SkipForward,
  GitBranch,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react';
import type { GeneratedAudioItem, MusicDspSettings, MusicEditPreset } from '../types/index.ts';

interface MusicTrackStageProps {
  track: GeneratedAudioItem;
  versionTree: GeneratedAudioItem[];
  onSelectTrack: (track: GeneratedAudioItem) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  onTogglePlay: (track: GeneratedAudioItem) => void;
  isBusy: boolean;
  onTextEditTrack: (trackId: string, instruction: string, preset: MusicEditPreset) => Promise<void>;
  onMasterTrack: (
    trackId: string,
    dsp: MusicDspSettings,
    removeVocals: boolean,
    outputFormat: 'mp3' | 'wav'
  ) => Promise<void>;
  onTrimTrack: (trackId: string, startSec: number, endSec: number) => Promise<void>;
  onExtendTrack: (trackId: string, extensionPrompt: string) => Promise<void>;
  onSeparateStems: (trackId: string) => Promise<void>;
  onAddProducerTag: (trackId: string, tagText: string, voiceName: string) => Promise<void>;
  onToggleFavorite: (trackId: string) => Promise<void>;
  onPublishShare: (trackId: string) => Promise<void>;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onTimeSync: (time: number, duration: number, playing: boolean) => void;
}

type StemKey = 'mix' | 'vocals' | 'instrumental' | 'bass' | 'drums';
type DockTab = 'none' | 'dsp' | 'trim' | 'extend' | 'tag';

export const MusicTrackStage: React.FC<MusicTrackStageProps> = ({
  track,
  versionTree,
  onSelectTrack,
  audioRef,
  isPlaying,
  onTogglePlay,
  isBusy,
  onTextEditTrack,
  onMasterTrack,
  onTrimTrack,
  onExtendTrack,
  onSeparateStems,
  onAddProducerTag,
  onToggleFavorite,
  onPublishShare,
  onDeleteTrack,
  onTimeSync,
}) => {
  const [stemMode, setStemMode] = useState<StemKey>('mix');
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration || 30);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);

  const [editInstruction, setEditInstruction] = useState('');
  const [editPreset, setEditPreset] = useState<MusicEditPreset>('ai_remix');
  const [activeDock, setActiveDock] = useState<DockTab>('none');

  // Local DSP controls
  const [dsp, setDsp] = useState<MusicDspSettings>({
    pitchSemitones: 0,
    tempoMultiplier: 1.0,
    bassDb: 0,
    trebleDb: 0,
    reverbWet: 0,
    lofiWarmth: false,
    normalizeLufs: true,
    fadeInSec: 0,
    fadeOutSec: 0,
  });
  const [dspRemoveVocals, setDspRemoveVocals] = useState(false);
  const [dspFormat, setDspFormat] = useState<'mp3' | 'wav'>('mp3');

  // Trim / Extend / Producer tag inputs
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(Math.max(5, Math.round(track.duration || 30)));
  const [extendPrompt, setExtendPrompt] = useState(
    'Build a soaring final chorus and clean fade outro matching tempo and key.'
  );
  const [tagText, setTagText] = useState('RaOne Studio Exclusive');
  const [tagVoice, setTagVoice] = useState('Kore');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setStemMode('mix');
    setCompareOriginal(false);
    setDuration(track.duration || 30);
    setTrimStart(0);
    setTrimEnd(Math.max(1, Number((track.duration || 30).toFixed(1))));
    if (track.configSnapshot?.dsp) {
      setDsp({ ...track.configSnapshot.dsp });
    }
  }, [track.id, track.duration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, audioRef]);

  // Deterministic lightweight animated visualizer on playback
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const seed = Number(track.seed || 4242);
    const barCount = 64;

    const draw = (tick: number) => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
      const barWidth = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const harmonic =
          Math.sin(i * 0.42 + seed * 0.01) * 0.35 +
          Math.cos(i * 0.21 - seed * 0.03) * 0.25 +
          0.55;
        const motion = isPlaying ? 0.72 + 0.28 * Math.sin(tick * 0.008 + i * 0.5) : 1.0;
        const barH = Math.max(6, Math.min(height - 6, harmonic * motion * (height * 0.85)));
        const x = i * barWidth + 1;
        const y = (height - barH) / 2;
        const barRatio = i / barCount;

        ctx.fillStyle =
          barRatio <= progressRatio
            ? '#8AB4F8'
            : isPlaying
            ? '#3B4252'
            : '#2A2D34';
        ctx.fillRect(x, y, Math.max(2, barWidth - 2), barH);
      }

      if (isPlaying) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [track.id, track.seed, isPlaying, currentTime, duration]);

  const activeAudioSrc = (() => {
    if (compareOriginal && track.sourceAudioUrl) return track.sourceAudioUrl;
    if (stemMode === 'vocals' && track.vocalStemUrl) return track.vocalStemUrl;
    if (stemMode === 'instrumental' && track.instrumentalStemUrl) return track.instrumentalStemUrl;
    if (stemMode === 'bass' && track.bassStemUrl) return track.bassStemUrl;
    if (stemMode === 'drums' && track.drumsStemUrl) return track.drumsStemUrl;
    return track.audioUrl;
  })();

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownload = async (url: string, label: string) => {
    const ext = track.format?.toLowerCase() === 'wav' && label === 'mix' ? 'wav' : 'mp3';
    const filename = `${track.title.replace(/[^a-zA-Z0-9._-]+/g, '_')}_${label}.${ext}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <audio
        ref={audioRef}
        src={activeAudioSrc}
        loop={isLooping}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const t = audioRef.current.currentTime || 0;
          const d = audioRef.current.duration || track.duration || 0;
          setCurrentTime(t);
          setDuration(d);
          onTimeSync(t, d, !audioRef.current.paused);
        }}
        onLoadedMetadata={() => {
          if (!audioRef.current) return;
          const d = audioRef.current.duration || track.duration || 30;
          setDuration(d);
          setTrimEnd(Number(d.toFixed(1)));
        }}
        onEnded={() => onTimeSync(duration, duration, false)}
      />

      {/* Version / Remix Lineage Switcher & A/B Compare */}
      {(versionTree.length > 1 || track.sourceAudioUrl) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#24262A]">
          {versionTree.length > 1 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <GitBranch className="w-3.5 h-3.5 text-[#8E9198]" />
              <span className="text-[11px] text-[#9AA0A6] mr-1">Versions</span>
              {versionTree.map((v, idx) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectTrack(v)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    v.id === track.id
                      ? 'bg-[#8AB4F8] text-[#131314]'
                      : 'bg-[#1D1F23] text-[#C4C7C5] hover:bg-[#2A2D33]'
                  }`}
                >
                  v{v.version || idx + 1} · {v.operationType || 'mix'}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          {track.sourceAudioUrl && (
            <button
              type="button"
              onClick={() => setCompareOriginal((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border transition-colors ${
                compareOriginal
                  ? 'bg-[#282A2E] border-[#FBBF24] text-[#FBBF24]'
                  : 'bg-[#1B1C1E] border-[#2C2D30] text-[#C4C7C5] hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>{compareOriginal ? 'Playing Original Source' : 'A/B Compare Original'}</span>
            </button>
          )}
        </div>
      )}

      {/* Primary Track Stage Card */}
      <div className="p-5 rounded-xl bg-[#18191C] border border-[#282A2E] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative w-28 h-28 rounded-lg overflow-hidden bg-black shrink-0 border border-[#2C2D30]">
            <img
              src={track.coverUrl}
              alt={track.title}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onTogglePlay(track)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="absolute inset-0 bg-black/40 hover:bg-black/55 flex items-center justify-center transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#E3E3E3] text-[#131314] flex items-center justify-center">
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </div>
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-2 w-full">
            <div>
              <h2 className="text-lg font-semibold text-white truncate">{track.title}</h2>
              <p className="text-xs text-[#9AA0A6] tabular-nums">
                {track.engineModelUsed || track.model} · {track.bpm || 120} BPM ·{' '}
                {track.keySignature || 'C Major'} · {track.format || 'MP3'}
                {track.bitrateKbps ? ` ${track.bitrateKbps}kbps` : ''}
              </p>
            </div>

            {track.styleTags && track.styleTags.length > 0 && (
              <div className="text-xs text-[#8E9198]">
                {track.styleTags.join(' · ')}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onTogglePlay(track)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload(track.audioUrl, 'mix')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232529] hover:bg-[#2E3036] border border-[#34373D] text-xs text-white"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {track.format || 'MP3'}</span>
              </button>

              <button
                type="button"
                onClick={() => onPublishShare(track.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232529] hover:bg-[#2E3036] border border-[#34373D] text-xs text-white"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{track.publishMeta?.isPublished ? 'Copy Share Link' : 'Share Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleFavorite(track.id)}
                title="Favorite Track"
                className={`p-1.5 rounded-lg border transition-colors ${
                  track.isFavorite
                    ? 'bg-[#2B2D30] border-[#8AB4F8] text-[#8AB4F8]'
                    : 'bg-[#232529] border-[#34373D] text-[#C4C7C5] hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => onDeleteTrack(track.id)}
                title="Delete Track"
                className="p-1.5 rounded-lg bg-[#232529] hover:bg-red-950/50 border border-[#34373D] text-[#C4C7C5] hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Waveform & Scrubber Transport */}
        <div className="space-y-2 pt-2 border-t border-[#24262A]">
          <canvas
            ref={canvasRef}
            width={760}
            height={54}
            onClick={(e) => {
              if (!audioRef.current || !duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              const nextTime = ratio * duration;
              audioRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
            }}
            className="w-full h-14 cursor-pointer rounded bg-[#131417] border border-[#24262A]"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#9AA0A6]">
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
                }}
                title="Back 10s"
                className="p-1 hover:text-white"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <span className="text-white">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current)
                    audioRef.current.currentTime = Math.min(duration, currentTime + 10);
                }}
                title="Forward 10s"
                className="p-1 hover:text-white"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsLooping((l) => !l)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] ${
                  isLooping ? 'text-[#8AB4F8] bg-[#24262A]' : 'hover:text-white'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Loop</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="hover:text-white"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-20 accent-[#8AB4F8]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Text-to-Music Edit & Remix Bar */}
      <div className="p-4 rounded-xl bg-[#18191C] border border-[#282A2E] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-white">
            <Wand2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>Text-to-Music Edit & Transform</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'ai_remix', label: 'AI Remix' },
                { id: 'karaoke_instrumental', label: 'Remove Vocals' },
                { id: 'lofi_vinyl', label: 'Lo-Fi Warmth' },
                { id: 'stadium_reverb', label: 'Arena Reverb' },
                { id: 'tempo_pitch', label: 'Speed & Pitch' },
              ] as Array<{ id: MusicEditPreset; label: string }>
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setEditPreset(preset.id)}
                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                  editPreset === preset.id
                    ? 'bg-[#262930] border-[#8AB4F8] text-white'
                    : 'bg-[#1D1F23] border-[#2C2D30] text-[#9AA0A6] hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onTextEditTrack(track.id, editInstruction, editPreset);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            placeholder="Describe edit e.g. 'Convert beat to 6/8 Sri Lankan Baila with brass horns' or pick preset..."
            className="flex-1 bg-[#131417] border border-[#2F3135] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#A6C8FF] text-[#131314] font-medium text-xs shrink-0 disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            <span>Apply Edit</span>
          </button>
        </form>
      </div>

      {/* 4-Stem Separation & Mixer */}
      <div className="p-4 rounded-xl bg-[#18191C] border border-[#282A2E] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-white">
            <Layers className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>4-Stem Isolation & Mixer</span>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onSeparateStems(track.id)}
            className="px-3 py-1.5 rounded-lg bg-[#232529] hover:bg-[#2E3036] border border-[#34373D] text-xs text-white disabled:opacity-50"
          >
            {track.stemsSeparated ? 'Re-Extract Stems' : 'Separate 4 Stems'}
          </button>
        </div>

        {track.stemsSeparated ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(
              [
                { key: 'mix', label: 'Full Mix', url: track.audioUrl },
                { key: 'vocals', label: 'Vocals', url: track.vocalStemUrl },
                { key: 'instrumental', label: 'Instrumental', url: track.instrumentalStemUrl },
                { key: 'bass', label: 'Sub Bass', url: track.bassStemUrl },
                { key: 'drums', label: 'Drums', url: track.drumsStemUrl },
              ] as Array<{ key: StemKey; label: string; url?: string }>
            ).map((s) => (
              <div
                key={s.key}
                className={`p-2 rounded-lg border flex items-center justify-between gap-1 ${
                  stemMode === s.key
                    ? 'bg-[#262930] border-[#8AB4F8]'
                    : 'bg-[#141518] border-[#2A2C32]'
                }`}
              >
                <button
                  type="button"
                  disabled={!s.url}
                  onClick={() => {
                    setCompareOriginal(false);
                    setStemMode(s.key);
                  }}
                  className="text-left text-xs font-medium text-white truncate flex-1 disabled:opacity-40"
                >
                  {s.label}
                </button>
                {s.url && (
                  <button
                    type="button"
                    onClick={() => handleDownload(s.url!, s.key)}
                    title={`Download ${s.label}`}
                    className="p-1 text-[#9AA0A6] hover:text-white shrink-0"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#8E9198]">
            Extract individual playable MP3 stems for Vocals, Instrumental/Karaoke, Bass, and Percussion.
          </p>
        )}
      </div>

      {/* Studio Post-Production Tools Switcher */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[#24262A]">
          {(
            [
              { id: 'dsp', label: 'DSP Master & EQ', Icon: Sliders },
              { id: 'trim', label: 'Trim Audio', Icon: Scissors },
              { id: 'extend', label: 'Extend Outro', Icon: FastForward },
              { id: 'tag', label: 'Add Producer Tag', Icon: Mic },
            ] as Array<{ id: DockTab; label: string; Icon: React.ComponentType<{ className?: string }> }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveDock((prev) => (prev === t.id ? 'none' : t.id))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                activeDock === t.id
                  ? 'bg-[#282A2E] text-white font-medium'
                  : 'text-[#9AA0A6] hover:text-white hover:bg-[#1E2024]'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {activeDock === 'dsp' && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-[#9AA0A6] mb-1">
                  <span>Pitch Shift</span>
                  <span className="font-mono text-white">{dsp.pitchSemitones} st</span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={1}
                  value={dsp.pitchSemitones}
                  onChange={(e) => setDsp({ ...dsp, pitchSemitones: Number(e.target.value) })}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[#9AA0A6] mb-1">
                  <span>Tempo Stretch</span>
                  <span className="font-mono text-white">{dsp.tempoMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  value={dsp.tempoMultiplier}
                  onChange={(e) => setDsp({ ...dsp, tempoMultiplier: Number(e.target.value) })}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[#9AA0A6] mb-1">
                  <span>Reverb Send</span>
                  <span className="font-mono text-white">{dsp.reverbWet}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={dsp.reverbWet}
                  onChange={(e) => setDsp({ ...dsp, reverbWet: Number(e.target.value) })}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[#9AA0A6] mb-1">
                  <span>Sub Bass (90Hz)</span>
                  <span className="font-mono text-white">{dsp.bassDb} dB</span>
                </div>
                <input
                  type="range"
                  min={-8}
                  max={10}
                  step={1}
                  value={dsp.bassDb}
                  onChange={(e) => setDsp({ ...dsp, bassDb: Number(e.target.value) })}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[#9AA0A6] mb-1">
                  <span>Air Treble (9.5kHz)</span>
                  <span className="font-mono text-white">{dsp.trebleDb} dB</span>
                </div>
                <input
                  type="range"
                  min={-8}
                  max={10}
                  step={1}
                  value={dsp.trebleDb}
                  onChange={(e) => setDsp({ ...dsp, trebleDb: Number(e.target.value) })}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
              <div>
                <label className="text-[#9AA0A6] block mb-1">Master Export Format</label>
                <select
                  value={dspFormat}
                  onChange={(e) => setDspFormat(e.target.value as 'mp3' | 'wav')}
                  className="w-full bg-[#131417] border border-[#2F3135] rounded px-2 py-1 text-white"
                >
                  <option value="mp3">MP3 (256 kbps)</option>
                  <option value="wav">WAV (Studio PCM)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#24262A]">
              <div className="flex flex-wrap gap-4 text-xs text-[#C4C7C5]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dsp.lofiWarmth}
                    onChange={(e) => setDsp({ ...dsp, lofiWarmth: e.target.checked })}
                    className="accent-[#8AB4F8]"
                  />
                  <span>Lo-Fi Vinyl Warmth</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dspRemoveVocals}
                    onChange={(e) => setDspRemoveVocals(e.target.checked)}
                    className="accent-[#8AB4F8]"
                  />
                  <span>Karaoke Vocal Cut</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dsp.normalizeLufs}
                    onChange={(e) => setDsp({ ...dsp, normalizeLufs: e.target.checked })}
                    className="accent-[#8AB4F8]"
                  />
                  <span>-14 LUFS Loudness</span>
                </label>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => onMasterTrack(track.id, dsp, dspRemoveVocals, dspFormat)}
                className="px-4 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-50"
              >
                Render Master Version
              </button>
            </div>
          </div>
        )}

        {activeDock === 'trim' && (
          <div className="p-4 flex flex-wrap items-end gap-3 text-xs">
            <div className="w-32">
              <label className="text-[#9AA0A6] block mb-1">Start (sec)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                max={Math.max(0, trimEnd - 0.5)}
                value={trimStart}
                onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#131417] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <div className="w-32">
              <label className="text-[#9AA0A6] block mb-1">End (sec)</label>
              <input
                type="number"
                min={trimStart + 0.5}
                step={0.5}
                max={duration || 600}
                value={trimEnd}
                onChange={(e) => setTrimEnd(Math.max(trimStart + 0.5, Number(e.target.value)))}
                className="w-full bg-[#131417] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onTrimTrack(track.id, trimStart, trimEnd)}
              className="px-4 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] font-medium disabled:opacity-50"
            >
              Create Trimmed Cut
            </button>
          </div>
        )}

        {activeDock === 'extend' && (
          <div className="p-4 flex flex-col sm:flex-row gap-2 text-xs">
            <input
              type="text"
              value={extendPrompt}
              onChange={(e) => setExtendPrompt(e.target.value)}
              className="flex-1 bg-[#131417] border border-[#2F3135] rounded-lg px-3 py-1.5 text-white"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onExtendTrack(track.id, extendPrompt)}
              className="px-4 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] font-medium shrink-0 disabled:opacity-50"
            >
              Generate Extension (+30s)
            </button>
          </div>
        )}

        {activeDock === 'tag' && (
          <div className="p-4 flex flex-col sm:flex-row gap-2 text-xs">
            <input
              type="text"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="Spoken intro tag e.g. RaOne Exclusive"
              className="flex-1 bg-[#131417] border border-[#2F3135] rounded-lg px-3 py-1.5 text-white"
            />
            <select
              value={tagVoice}
              onChange={(e) => setTagVoice(e.target.value)}
              className="bg-[#131417] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-white"
            >
              <option value="Kore">Kore</option>
              <option value="Puck">Puck</option>
              <option value="Charon">Charon</option>
              <option value="Fenrir">Fenrir</option>
              <option value="Zephyr">Zephyr</option>
            </select>
            <button
              type="button"
              disabled={isBusy || !tagText.trim()}
              onClick={() => onAddProducerTag(track.id, tagText, tagVoice)}
              className="px-4 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] font-medium shrink-0 disabled:opacity-50"
            >
              Mix TTS Intro Tag
            </button>
          </div>
        )}
      </div>

      {/* Lyrics & Production Notes */}
      {(track.lyrics || track.aiNotes) && (
        <div className="p-4 rounded-xl bg-[#18191C] border border-[#282A2E] space-y-2.5">
          {track.aiNotes && (
            <p className="text-xs text-[#9AA0A6]">{track.aiNotes}</p>
          )}
          {track.lyrics && (
            <>
              <div className="flex items-center justify-between pt-1 border-t border-[#24262A]">
                <span className="text-xs font-medium text-white">Song Lyrics</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(track.lyrics || '').catch(() => {});
                    setCopiedLyrics(true);
                    setTimeout(() => setCopiedLyrics(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-[#9AA0A6] hover:text-white"
                >
                  {copiedLyrics ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLyrics ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-xs text-[#C4C7C5] whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                {track.lyrics}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};
