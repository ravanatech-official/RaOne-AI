import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dices,
  Film,
  Wand2,
  Upload,
  Search,
  Heart,
  Sparkles,
  Image as ImageIcon,
  X,
  Cpu,
  Scissors,
} from 'lucide-react';
import {
  DEFAULT_CINEMA_CONFIG,
  type CinemaConfig,
  type CinemaEditPreset,
  type CinemaEditSpec,
  type CinemaEnhancerMode,
} from '../types/cinema.ts';
import type { GeneratedVideoItem } from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  type WorkspaceTurn,
  type WorkspaceRightTab,
} from './UnifiedStudioWorkspace';
import { CinemaConfigDrawer } from './CinemaConfigDrawer';
import { CinemaVideoStage } from './CinemaVideoStage';
import {
  fetchUniversalSettings,
  subscribeUniversalSettings,
} from '../utils/settingsClient.ts';

interface LeonardoMotionStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const T2V_MODELS = [
  {
    id: 'Google Veo 2 (Gemini Omni)',
    label: 'Veo 2 · Gemini Omni',
    description: 'Gemini Omni 1.2 Flash · T2V, I2V, Video Edit & Extend',
  },
  {
    id: 'OpenAI Sora Turbo',
    label: 'Sora Turbo Profile',
    description: 'Spatio-temporal cinematic world simulator preset',
  },
  {
    id: 'Runway Gen-3 Alpha',
    label: 'Runway Gen-3 Profile',
    description: 'Director camera trajectories & human motion',
  },
  {
    id: 'Kling AI 1.5 Pro',
    label: 'Kling 1.5 Physics',
    description: 'Fluid dynamics & long-horizon continuity',
  },
  {
    id: 'Luma Dream Machine 2.0',
    label: 'Luma Dream 2.0',
    description: 'Keyframe Start/End interpolation preset',
  },
];

const RANDOM_VIDEO_PROMPTS = [
  'A sleek obsidian electric supercar drifting through rain-slicked neon Colombo Port City streets at midnight, low tracking gimbal 35mm anamorphic',
  'Aerial FPV drone soaring through glowing emerald aurora over jagged snow peaks, dramatic volumetric mist, IMAX 70mm film grain',
  'Ancient Sigiriya rock fortress surrounded by floating golden lanterns at dawn, mist rolling through the jungle valley, slow 360 helicopter orbit',
  'Futuristic cybernetic artisan assembling a holographic watch inside a warm candlelight workshop, macro shallow depth of field',
];

export const LeonardoMotionStudio: React.FC<LeonardoMotionStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [prompt, setPrompt] = useState('');
  const [enhancedFromPrompt, setEnhancedFromPrompt] = useState<string | null>(null);
  const [config, setConfig] = useState<CinemaConfig>(DEFAULT_CINEMA_CONFIG);

  const [startKeyframe, setStartKeyframe] = useState<string | null>(null);
  const [endKeyframe, setEndKeyframe] = useState<string | null>(null);
  const [storyboardRefs, setStoryboardRefs] = useState<string[]>([]);

  const [videoFeed, setVideoFeed] = useState<GeneratedVideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideoItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isPostBusy, setIsPostBusy] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [libraryFilter, setLibraryFilter] = useState<'all' | 'favorites' | 'uploads'>('all');
  const [fileSearch, setFileSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const quickImageInputRef = useRef<HTMLInputElement>(null);
  const quickVideoUploadRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const fetchVideoHistory = async () => {
    try {
      const res = await fetch('/api/motion/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setVideoFeed(data.items);
      }
    } catch {
      // ignore transient load failure
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchVideoHistory();
    fetchUniversalSettings()
      .then((profile) => {
        if (profile?.studioDefaults?.cinema) {
          setConfig((prev) => ({ ...prev, ...profile.studioDefaults.cinema }));
        }
      })
      .catch(() => {});

    return subscribeUniversalSettings((profile) => {
      if (profile?.studioDefaults?.cinema) {
        setConfig((prev) => ({ ...prev, ...profile.studioDefaults.cinema }));
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || videoFeed.length === 0) return;
    const pending = (window as any).__RAONE_PENDING_ASSET__;
    if (pending && pending.studio === 'cinema' && pending.rawId) {
      const match = videoFeed.find((v) => v.id === pending.rawId);
      if (match) {
        setSelectedVideo(match);
        setRightTab('preview');
        delete (window as any).__RAONE_PENDING_ASSET__;
      }
    }
  }, [isOpen, videoFeed]);

  const versionTree = useMemo(() => {
    if (!selectedVideo) return [];
    const rootId = selectedVideo.rootId || selectedVideo.id;
    const related = videoFeed.filter(
      (v) => v.id === rootId || v.rootId === rootId || v.parentId === selectedVideo.id
    );
    return related.sort((a, b) => (b.version || 1) - (a.version || 1));
  }, [selectedVideo, videoFeed]);

  const registerNewVideoResult = (
    video: GeneratedVideoItem,
    userMessage: string,
    assistantSummary: string,
    details: string[]
  ) => {
    setVideoFeed((prev) => [video, ...prev.filter((item) => item.id !== video.id)]);
    setSelectedVideo(video);
    setRightTab('preview');
    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: userMessage },
      {
        id: `a_${Date.now() + 1}`,
        role: 'assistant',
        modelLabel: video.engineModelUsed || video.model,
        content: assistantSummary,
        details,
      },
    ]);
  };

  const handleUploadSourceVideo = async (file: File) => {
    if (isLoading || isPostBusy) return;
    setIsPostBusy(true);
    showToast(`Uploading & normalizing ${file.name}...`);
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch('/api/motion/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'video/mp4',
          'X-File-Name': file.name,
          'X-Clip-Title': file.name.replace(/\.[^.]+$/, ''),
        },
        body: buf,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        setConfig((prev) => ({ ...prev, mode: 'video-edit' }));
        registerNewVideoResult(
          data.video,
          `Uploaded video: ${file.name}`,
          `Video uploaded (${data.video.dimensions}, ${data.video.duration}s, ${data.video.fps}fps) and loaded into Text-to-Video Edit mode.`,
          ['Ready for natural-language AI video edits, Motion Brush, Trim, 60fps & Audio Sync.']
        );
        showToast('Video uploaded. Ready for AI Editing!');
      } else {
        showToast(data?.error || 'Video upload failed.');
      }
    } catch {
      showToast('Failed to upload video.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleEnhancePrompt = async (modeOverride?: CinemaEnhancerMode) => {
    if (!prompt.trim() || isEnhancing) return;
    const raw = prompt.trim();
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/motion/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: raw,
          enhancerMode: modeOverride || config.enhancerMode,
          cinemaConfig: config,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.enhancedPrompt) {
        setEnhancedFromPrompt(raw);
        setPrompt(data.enhancedPrompt);
        if (data.suggestedNegativePrompt || data.suggestedAudioCue) {
          setConfig((prev) => ({
            ...prev,
            negativePrompt: data.suggestedNegativePrompt || prev.negativePrompt,
            audio: {
              ...prev.audio,
              audioPrompt: prev.audio.audioPrompt || data.suggestedAudioCue || '',
            },
          }));
        }
        showToast(`Enhanced via ${data.providerUsed || 'Cinema Architect'}.`);
      } else {
        showToast(data?.error || 'Prompt enhancement unavailable.');
      }
    } catch {
      showToast('Prompt enhancement failed.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmitMainComposer = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isLoading) return;

    // If user is in Video Edit mode with an active video, route composer directly to Text-to-Video Edit
    if (config.mode === 'video-edit' && selectedVideo) {
      await handleApplyTextEdit({
        instruction: cleanPrompt,
        preset: config.edit.preset,
      });
      setPrompt('');
      return;
    }

    const startMs = Date.now();
    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: cleanPrompt },
    ]);
    setPrompt('');
    setIsLoading(true);

    try {
      const activeSeed = config.seedLocked
        ? config.seed
        : Math.floor(Math.random() * 9000000) + 100000;
      if (!config.seedLocked) {
        setConfig((prev) => ({ ...prev, seed: activeSeed }));
      }

      const res = await fetch('/api/motion/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          enhancedFrom: enhancedFromPrompt,
          negativePrompt: config.negativePrompt,
          model: config.model,
          cameraMotion: config.camera.trajectory,
          motionStrength: config.camera.motionStrength,
          duration: config.duration,
          fps: config.fps,
          aspectRatio: config.aspectRatio,
          mode: config.mode,
          referenceImage: startKeyframe,
          endKeyframeImage: endKeyframe,
          referenceImages: storyboardRefs,
          seed: activeSeed,
          cinemaConfig: { ...config, seed: activeSeed },
        }),
      });
      const data = await res.json().catch(() => ({}));
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      setEnhancedFromPrompt(null);

      if (res.ok && data.success && data.video) {
        setVideoFeed((prev) => [data.video, ...prev]);
        setSelectedVideo(data.video);
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: data.video.engineModelUsed || config.model,
            durationSec: elapsed,
            content: `Rendered ${data.video.duration.toFixed(1)}s clip (${data.video.dimensions} · ${data.video.fps}fps).`,
            details: [
              `Camera: ${config.camera.trajectory} · ${config.camera.focalLength} (${config.camera.aperture})`,
              `Style: ${config.look.visualStyle} · LUT: ${config.look.colorGrade}`,
            ],
          },
        ]);
        showToast('Cinema clip synthesized!');
      } else {
        showToast(data?.error || 'Video generation failed.');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: data?.error || 'Video generation failed.',
          },
        ]);
      }
    } catch {
      showToast('Error contacting Cinema Studio server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTextEdit = async ({
    instruction,
    preset,
    maskImage,
  }: {
    instruction: string;
    preset: CinemaEditPreset;
    maskImage?: string | null;
  }) => {
    if (!selectedVideo || isPostBusy) return;
    setIsPostBusy(true);
    showToast('Synthesizing Text-to-Video Edit...');
    try {
      const res = await fetch('/api/motion/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedVideo.id,
          instruction,
          maskImage,
          referenceImages: storyboardRefs,
          cinemaConfig: {
            ...config,
            mode: 'video-edit',
            edit: { ...config.edit, preset },
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        registerNewVideoResult(
          data.video,
          `Edit video: ${instruction}`,
          `Created edited version v${data.video.version || 2} (${data.video.dimensions}).`,
          [`Preset: ${preset}`, `Parent clip: ${selectedVideo.id}`]
        );
        showToast('Text-to-Video edit complete! Compare slider enabled.');
      } else {
        showToast(data?.error || 'Video edit failed.');
      }
    } catch {
      showToast('Video edit failed.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleApplyMotionBrush = async ({
    instruction,
    maskImage,
    direction,
  }: {
    instruction: string;
    maskImage: string;
    direction: CinemaEditSpec['motionBrushDirection'];
  }) => {
    if (!selectedVideo || isPostBusy) return;
    setIsPostBusy(true);
    showToast(`Synthesizing Motion Brush (${direction})...`);
    try {
      const res = await fetch('/api/motion/motion-brush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedVideo.id,
          instruction,
          maskImage,
          direction,
          cinemaConfig: config,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        registerNewVideoResult(
          data.video,
          `Motion Brush (${direction}): ${instruction}`,
          `Synthesized regional Motion Brush v${data.video.version || 2}.`,
          [`Direction: ${direction}`]
        );
        showToast('Motion Brush clip rendered.');
      } else {
        showToast(data?.error || 'Motion Brush failed.');
      }
    } catch {
      showToast('Motion Brush failed.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleExtendVideo = async (addSec: number, extPrompt: string) => {
    if (!selectedVideo || isPostBusy) return;
    setIsPostBusy(true);
    showToast(`Extending video +${addSec}s...`);
    try {
      const res = await fetch('/api/motion/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedVideo.id,
          addDurationSec: addSec,
          extensionPrompt: extPrompt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        registerNewVideoResult(
          data.video,
          `Extend +${addSec}s`,
          `Extended video to ${data.video.duration.toFixed(1)}s (v${data.video.version || 2}).`,
          ['Seamless tail scene continuation merged.']
        );
        showToast('Video extended seamlessly.');
      } else {
        showToast(data?.error || 'Video extension failed.');
      }
    } catch {
      showToast('Video extension failed.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleTrimVideo = async (startSec: number, endSec: number) => {
    if (!selectedVideo || isPostBusy) return;
    setIsPostBusy(true);
    showToast(`Trimming ${startSec.toFixed(1)}s – ${endSec.toFixed(1)}s...`);
    try {
      const res = await fetch('/api/motion/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedVideo.id, startSec, endSec }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        registerNewVideoResult(
          data.video,
          `Trim ${startSec.toFixed(1)}s–${endSec.toFixed(1)}s`,
          `Trimmed clip saved (${data.video.duration.toFixed(1)}s).`,
          ['FFmpeg frame-accurate trim complete.']
        );
        showToast('Clip trimmed cleanly.');
      } else {
        showToast(data?.error || 'Trim failed.');
      }
    } catch {
      showToast('Trim failed.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handlePostProcess = async (
    endpoint: 'interpolate' | 'upscale',
    label: string,
    extraBody?: Record<string, any>
  ) => {
    if (!selectedVideo || isPostBusy) return;
    setIsPostBusy(true);
    showToast(`Processing ${label}...`);
    try {
      const res = await fetch(`/api/motion/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedVideo.id, ...(extraBody || {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        registerNewVideoResult(
          data.video,
          label,
          `${label} finished (${data.video.dimensions} · ${data.video.fps}fps).`,
          [`Saved as version v${data.video.version || 2}.`]
        );
        showToast(`${label} complete.`);
      } else {
        showToast(data?.error || `${label} failed.`);
      }
    } catch {
      showToast(`${label} failed.`);
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleAudioSync = async ({
    audioPrompt,
    audioDataUrl,
  }: {
    audioPrompt?: string;
    audioDataUrl?: string;
  }) => {
    if (!selectedVideo || isPostBusy) return;
    setIsPostBusy(true);
    showToast(audioDataUrl ? 'Muxing custom audio track...' : 'Composing Lyria soundtrack & muxing...');
    try {
      const res = await fetch('/api/motion/audio-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedVideo.id, audioPrompt, audioDataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.video) {
        registerNewVideoResult(
          data.video,
          `Audio sync: ${audioPrompt || 'Custom audio'}`,
          `Audio track synchronized (v${data.video.version || 2}).`,
          [`Engine: ${data.video.engineModelUsed}`]
        );
        showToast('Audio synchronized!');
      } else {
        showToast(data?.error || 'Audio sync failed.');
      }
    } catch {
      showToast('Audio sync failed.');
    } finally {
      setIsPostBusy(false);
    }
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/motion/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setVideoFeed((prev) =>
          prev.map((v) => (v.id === id ? { ...v, isFavorite: data.item.isFavorite } : v))
        );
        if (selectedVideo?.id === id) {
          setSelectedVideo((prev) => (prev ? { ...prev, isFavorite: data.item.isFavorite } : null));
        }
      }
    } catch {
      // ignore
    }
  };

  const handleShareVideo = async (id: string) => {
    try {
      const res = await fetch('/api/motion/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.shareUrl) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        navigator.clipboard?.writeText(fullUrl).catch(() => {});
        showToast(`Share URL copied: ${data.shareUrl}`);
      } else {
        showToast(data?.error || 'Publish failed.');
      }
    } catch {
      showToast('Share failed.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/motion/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setVideoFeed((prev) => prev.filter((v) => v.id !== id));
        if (selectedVideo?.id === id) setSelectedVideo(null);
        showToast('Video deleted.');
      }
    } catch {
      showToast('Delete failed.');
    }
  };

  const downloadVideo = (video: GeneratedVideoItem) => {
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `raone_cinema_${video.id}.mp4`;
    a.click();
  };

  const displayedVideos = videoFeed.filter((v) => {
    const matchTab =
      libraryFilter === 'all'
        ? true
        : libraryFilter === 'favorites'
        ? v.isFavorite
        : v.operationType === 'upload';
    const matchSearch =
      !fileSearch.trim() ||
      v.prompt.toLowerCase().includes(fileSearch.toLowerCase()) ||
      v.model.toLowerCase().includes(fileSearch.toLowerCase());
    return matchTab && matchSearch;
  });

  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
        <span className="text-xs font-medium text-white block">
          Cinema Studio Shot Manifest & Engine Specification (JSON)
        </span>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto">
          {JSON.stringify(selectedVideo || config, null, 2)}
        </pre>
      </div>

      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Cpu className="w-4 h-4 text-[#8AB4F8]" />
          <span>Active Silicon Valley Video Pipeline</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. Gemini Omni 1.2 Flash</div>
            Multi-turn Interactions API supporting Text-to-Video, Start/End Keyframe Morph, Storyboard (up to 6 refs), Video-to-Video Edit & Extension.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. FFmpeg Optical Post-Prod</div>
            Real frame-accurate trim, optical-flow 60fps minterpolate, Lanczos 4K super-resolution, HTTP Range streaming & Lyria 3 audio muxing.
          </div>
        </div>
      </div>
    </div>
  );

  const filesContent = (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          {(
            [
              { id: 'all', label: `All Clips (${videoFeed.length})` },
              {
                id: 'favorites',
                label: `Favorites (${videoFeed.filter((v) => v.isFavorite).length})`,
              },
              {
                id: 'uploads',
                label: `Uploaded (${videoFeed.filter((v) => v.operationType === 'upload').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLibraryFilter(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                libraryFilter === tab.id
                  ? 'bg-[#2B2D30] text-white'
                  : 'text-[#8E918F] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => quickVideoUploadRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] border border-[#35373B] text-xs text-[#E3E3E3] whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>Upload Video</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
            <input
              type="text"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Search videos..."
              className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none focus:border-[#4A4D54] w-48"
            />
          </div>
        </div>
      </div>

      {displayedVideos.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No videos yet. Generate a scene or upload your own MP4/WebM to edit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => {
                setSelectedVideo(video);
                setRightTab('preview');
              }}
              className="rounded-xl overflow-hidden bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer flex flex-col"
            >
              <div className="relative aspect-video bg-black">
                <video
                  src={video.videoUrl}
                  poster={video.posterUrl || undefined}
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => handleToggleFavorite(video.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      video.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-xs text-[#E3E3E3] line-clamp-2">{video.prompt}</p>
                <div className="flex items-center justify-between text-[11px] text-[#8E918F] tabular-nums">
                  <span className="truncate">
                    {video.operationType || video.mode} · v{video.version || 1}
                  </span>
                  <span>
                    {video.duration.toFixed(1)}s · {video.fps}fps
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const composerAddContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => quickImageInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Attach Keyframe Image</span>
        </button>

        <button
          type="button"
          onClick={() => quickVideoUploadRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Upload Video to Edit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setPrompt(
              RANDOM_VIDEO_PROMPTS[Math.floor(Math.random() * RANDOM_VIDEO_PROMPTS.length)]
            );
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Director Sample</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        {(
          [
            { id: 'text-to-video', label: 'Text to Video' },
            { id: 'image-to-video', label: 'Keyframe I2V' },
            { id: 'video-edit', label: 'Text-to-Video Edit' },
            { id: 'storyboard', label: 'Storyboard Refs' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, mode: m.id }))}
            className={`py-1.5 px-2 rounded-lg border text-left ${
              config.mode === m.id
                ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                : 'bg-[#18191B] border-[#2C2D30] text-[#9AA0A6]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  const composerExtraFooter = (
    <div className="space-y-1.5 mb-2">
      {(startKeyframe || endKeyframe || storyboardRefs.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {startKeyframe && (
            <div className="relative w-11 h-8 rounded overflow-hidden border border-[#383A40]">
              <img src={startKeyframe} alt="Start frame" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setStartKeyframe(null)}
                className="absolute top-0 right-0 bg-black/75 text-white p-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          {endKeyframe && (
            <div className="relative w-11 h-8 rounded overflow-hidden border border-[#383A40]">
              <img src={endKeyframe} alt="End frame" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setEndKeyframe(null)}
                className="absolute top-0 right-0 bg-black/75 text-white p-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          {storyboardRefs.map((src, idx) => (
            <div key={idx} className="relative w-11 h-8 rounded overflow-hidden border border-[#383A40]">
              <img src={src} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setStoryboardRefs((prev) => prev.filter((_, i) => i !== idx))}
                className="absolute top-0 right-0 bg-black/75 text-white p-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {config.mode === 'video-edit' && selectedVideo && (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-[#1A1C20] border border-[#2D3036] text-[11px] text-[#C4C7C5]">
          <span className="truncate">
            Editing active clip · v{selectedVideo.version || 1} ({selectedVideo.dimensions})
          </span>
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, mode: 'text-to-video' }))}
            className="text-[#8AB4F8] hover:underline shrink-0 ml-2"
          >
            New Shot
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <input
        ref={quickImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') {
              setStartKeyframe(ev.target.result);
              setConfig((prev) => ({ ...prev, mode: 'image-to-video' }));
              showToast('Start keyframe attached.');
            }
          };
          reader.readAsDataURL(f);
        }}
      />
      <input
        ref={quickVideoUploadRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadSourceVideo(f);
        }}
      />

      <UnifiedStudioWorkspace
        isOpen={isOpen}
        onBackToStart={onClose}
        moduleName="RaOne Cinema Studio"
        workspaceTitle={
          selectedVideo ? selectedVideo.prompt.slice(0, 56) : 'Untitled Cinema Scene'
        }
        modelOptions={T2V_MODELS}
        selectedModel={config.model}
        onSelectModel={(model) => setConfig((prev) => ({ ...prev, model }))}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmitPrompt={handleSubmitMainComposer}
        isGenerating={isLoading || isPostBusy}
        turns={turns}
        onResetWorkspace={() => {
          setSelectedVideo(null);
          setTurns([]);
          setPrompt('');
          setStartKeyframe(null);
          setEndKeyframe(null);
          setStoryboardRefs([]);
          setConfig(DEFAULT_CINEMA_CONFIG);
          setRightTab('preview');
          showToast('Started fresh cinema workspace.');
        }}
        rightTab={rightTab}
        onRightTabChange={setRightTab}
        routePath={selectedVideo ? `/cinema/${selectedVideo.id}` : '/cinema'}
        onRefresh={fetchVideoHistory}
        onRemix={() => {
          if (selectedVideo) {
            setPrompt(selectedVideo.prompt);
            setConfig((prev) => ({
              ...prev,
              ...(selectedVideo.configSnapshot || {}),
              mode: 'text-to-video',
            }));
            showToast('Shot configuration loaded for remix.');
          } else {
            setPrompt(RANDOM_VIDEO_PROMPTS[0]);
            showToast('Sample director prompt loaded.');
          }
        }}
        onShare={() => {
          if (selectedVideo) {
            handleShareVideo(selectedVideo.id);
          } else {
            showToast('Generate or upload a clip first.');
          }
        }}
        onPublish={() => {
          if (selectedVideo) {
            downloadVideo(selectedVideo);
          } else {
            showToast('Generate or select a video first.');
          }
        }}
        publishLabel="Download"
        filesCount={videoFeed.length}
        hasActiveItem={!!selectedVideo}
        extraToolbarActions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => quickVideoUploadRef.current?.click()}
              disabled={isPostBusy || isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E1F20] hover:bg-[#28292C] border border-[#323438] text-xs font-medium text-[#E3E3E3] whitespace-nowrap disabled:opacity-50"
              title="Upload your own video for AI Text-to-Video Editing"
            >
              <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span className="hidden sm:inline">Upload Video</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  mode: prev.mode === 'video-edit' ? 'text-to-video' : 'video-edit',
                }))
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                config.mode === 'video-edit'
                  ? 'bg-[#2B2D30] border-[#8AB4F8]/50 text-white'
                  : 'bg-[#1E1F20] hover:bg-[#28292C] border-[#323438] text-[#C4C7C5]'
              }`}
              title="Toggle Text-to-Video Edit Mode"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Mode</span>
            </button>
          </div>
        }
        composerInlineActions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleEnhancePrompt()}
              disabled={!prompt.trim() || isEnhancing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] border border-[#35373B] text-[11px] font-medium text-[#E3E3E3] disabled:opacity-45 whitespace-nowrap"
              title="Expand even 2 words into a full director cinema prompt"
            >
              <Wand2 className="w-3 h-3 text-[#8AB4F8]" />
              <span>{isEnhancing ? 'Enhancing...' : 'Enhance'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPrompt(
                  RANDOM_VIDEO_PROMPTS[Math.floor(Math.random() * RANDOM_VIDEO_PROMPTS.length)]
                )
              }
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#2A2B2E]"
              title="Load sample director prompt"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>

            <span className="hidden sm:inline text-[11px] text-[#8E918F] pl-1 whitespace-nowrap">
              {config.aspectRatio} · {config.duration}s
            </span>
          </div>
        }
        composerExtraFooter={composerExtraFooter}
        previewContent={
          selectedVideo ? (
            <CinemaVideoStage
              video={selectedVideo}
              allVersions={versionTree}
              onSelectVersion={(v) => setSelectedVideo(v)}
              onApplyTextEdit={handleApplyTextEdit}
              onApplyMotionBrush={handleApplyMotionBrush}
              onExtendVideo={handleExtendVideo}
              onTrimVideo={handleTrimVideo}
              onInterpolate60Fps={() => handlePostProcess('interpolate', '60 FPS Optical Flow')}
              onUpscale4k={() =>
                handlePostProcess('upscale', '4K Super-Resolution', { targetTier: '4k' })
              }
              onAudioSync={handleAudioSync}
              onGrabKeyframe={(dataUrl) => {
                setStartKeyframe(dataUrl);
                setConfig((prev) => ({ ...prev, mode: 'image-to-video' }));
                showToast('Captured current frame as Start Keyframe!');
              }}
              onToggleFavorite={(id) => handleToggleFavorite(id)}
              onShare={handleShareVideo}
              onDownload={downloadVideo}
              onDelete={handleDelete}
              isBusy={isLoading || isPostBusy}
            />
          ) : null
        }
        codeContent={codeContent}
        filesContent={filesContent}
        editDrawerContent={
          <CinemaConfigDrawer
            config={config}
            onChange={setConfig}
            startKeyframe={startKeyframe}
            endKeyframe={endKeyframe}
            storyboardRefs={storyboardRefs}
            onStartKeyframeChange={setStartKeyframe}
            onEndKeyframeChange={setEndKeyframe}
            onStoryboardRefsChange={setStoryboardRefs}
            onUploadSourceVideo={handleUploadSourceVideo}
            hasSelectedVideo={!!selectedVideo}
          />
        }
        composerAddContent={composerAddContent}
        emptyStateTitle="RaOne Cinema Studio"
        emptyStateSubtitle="Type a short 2-word idea and click Enhance, generate any T2V/Keyframe shot, or upload a video for Text-to-Video editing."
        emptyStateActionLabel="Open Clip Library"
        onEmptyStateAction={() => setRightTab('files')}
        toastMessage={toastMessage}
        universalSettingsSection="cinema_studio"
      />
    </>
  );
};
