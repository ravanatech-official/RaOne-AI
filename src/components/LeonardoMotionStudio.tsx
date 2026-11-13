import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Copy,
  Trash2,
  Heart,
  Dices,
  Film,
  Wand2,
  Check,
  Upload,
  FastForward,
  Cpu,
  Volume2,
  VolumeX,
  Search,
  Sparkles,
} from 'lucide-react';
import { GeneratedVideoItem } from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
} from './UnifiedStudioWorkspace';

interface LeonardoMotionStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const T2V_MODELS = [
  { id: 'Google Veo 2 (Frontier)', label: 'Google Veo 2', description: 'Google DeepMind · 4K physical world dynamics' },
  { id: 'OpenAI Sora Turbo', label: 'Sora Turbo', description: 'Spatio-temporal latent world simulator' },
  { id: 'Runway Gen-3 Alpha', label: 'Runway Gen-3', description: 'Director camera & human motion fidelity' },
  { id: 'Kling AI 1.5 Pro', label: 'Kling 1.5 Pro', description: '3D spatio-temporal fluid dynamics' },
  { id: 'Luma Dream Machine 2.0', label: 'Luma Dream 2.0', description: 'Flow matching rapid video transformer' },
  { id: 'MiniMax Hailuo Video 01', label: 'MiniMax Hailuo', description: 'High-octane kinematic action synthesis' },
];

const CAMERA_MOTIONS = [
  'Fly Through Forward',
  'Pan Right & Tilt Up',
  'Orbit 360',
  'Zoom In Hyper',
  'Zoom Out (Reveal)',
  'Crane Up High Angle',
  'Tilt Down Grounding',
  'Static Camera (Tripod)',
];

const ASPECT_RATIOS = [
  { id: '16:9', dim: '1920x1080' },
  { id: '9:16', dim: '1080x1920' },
  { id: '1:1', dim: '1080x1080' },
  { id: '2.39:1', dim: '1920x804' },
];

const RANDOM_VIDEO_PROMPTS = [
  'A neon-lit cybernetic runner dashing across rain-slicked glass skyscrapers in Neo Tokyo 2099, low-angle tracking camera, 8K Arri Alexa',
  'Drone shot soaring through a glowing crystalline ice canyon under emerald aurora borealis, 70mm IMAX aesthetic',
  'Robotic cheetah accelerating across red Mars dunes at sunset with dust physics simulation, 60fps tracking camera',
  'Ancient Sigiriya rock fortress surrounded by floating lanterns at midnight, rolling valley mist, slow 360 helicopter orbit',
];

export const LeonardoMotionStudio: React.FC<LeonardoMotionStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'blurry, morphing, jitter, low framerate, artifacts, glitch, static'
  );
  const [selectedModel, setSelectedModel] = useState('Google Veo 2 (Frontier)');
  const [selectedCamera, setSelectedCamera] = useState('Fly Through Forward');
  const [motionStrength, setMotionStrength] = useState<number>(7);
  const [duration, setDuration] = useState<number>(5);
  const [fps, setFps] = useState<number>(30);
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  const [generationMode, setGenerationMode] = useState<'text-to-video' | 'image-to-video'>(
    'text-to-video'
  );
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [seed, setSeed] = useState<number>(894172);

  const [videoFeed, setVideoFeed] = useState<GeneratedVideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideoItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchVideoHistory = async () => {
    try {
      const res = await fetch('/api/motion/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setVideoFeed(data.items);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVideoHistory();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isLoading) return;

    const startMs = Date.now();
    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: cleanPrompt },
    ]);
    setPrompt('');
    setIsLoading(true);

    try {
      const dim = ASPECT_RATIOS.find((a) => a.id === selectedAspect)?.dim || '1920x1080';
      const res = await fetch('/api/motion/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          negativePrompt,
          model: selectedModel,
          cameraMotion: selectedCamera,
          motionStrength,
          duration,
          fps,
          aspectRatio: selectedAspect,
          dimensions: dim,
          mode: generationMode,
          referenceImage,
          seed,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      if (data.success && data.video) {
        setVideoFeed((prev) => [data.video, ...prev]);
        setSelectedVideo(data.video);
        setIsPlaying(true);
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: selectedModel,
            durationSec: elapsed,
            content: `Synthesized ${data.video.duration}s cinema clip at ${data.video.fps}fps (${dim}).`,
            details: [
              `Camera: ${selectedCamera} · Motion Strength: ${motionStrength}/10`,
              `Mode: ${generationMode === 'image-to-video' ? 'Image-to-Video' : 'Text-to-Video'}`,
            ],
          },
        ]);
      } else {
        showToast(data?.error || 'Video generation failed.');
      }
    } catch {
      showToast('Error synthesizing video.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/motion/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          cameraMotion: selectedCamera,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (data.success && data.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        showToast('Video prompt enhanced.');
      }
    } catch {
      showToast('Enhancement failed.');
    } finally {
      setIsEnhancing(false);
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
          prev.map((v) =>
            v.id === id ? { ...v, isFavorite: data.item.isFavorite } : v
          )
        );
        if (selectedVideo?.id === id) {
          setSelectedVideo((prev) =>
            prev ? { ...prev, isFavorite: data.item.isFavorite } : null
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const handleVideoOp = async (endpoint: 'extend' | 'interpolate' | 'upscale', id: string, label: string) => {
    showToast(`Processing ${label}...`);
    try {
      const res = await fetch(`/api/motion/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setVideoFeed((prev) => prev.map((v) => (v.id === id ? data.item : v)));
        if (selectedVideo?.id === id) setSelectedVideo(data.item);
        showToast(`${label} complete.`);
      }
    } catch {
      showToast(`${label} failed.`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
        setGenerationMode('image-to-video');
        showToast('Keyframe image attached.');
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePlay = () => {
    if (!videoPlayerRef.current) return;
    if (isPlaying) {
      videoPlayerRef.current.pause();
    } else {
      videoPlayerRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const downloadVideo = (video: GeneratedVideoItem) => {
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `raone_cinema_${video.id}.mp4`;
    a.click();
  };

  const previewContent = selectedVideo ? (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 max-w-5xl mx-auto w-full">
      <div className="flex-1 min-h-[280px] rounded-2xl bg-black border border-[#282A2E] overflow-hidden flex items-center justify-center relative">
        <video
          ref={videoPlayerRef}
          src={selectedVideo.videoUrl}
          poster={selectedVideo.posterUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          onTimeUpdate={() => {
            if (videoPlayerRef.current) {
              setCurrentTime(videoPlayerRef.current.currentTime);
              setVideoDuration(videoPlayerRef.current.duration || 0);
            }
          }}
          className="max-h-[62vh] w-full object-contain"
        />
      </div>

      {/* Player Scrubber + Actions */}
      <div className="bg-[#18191C] border border-[#282A2E] rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-[#E3E3E3] hover:bg-white text-[#131314] flex items-center justify-center shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max={videoDuration || 5}
            step="0.05"
            value={currentTime}
            onChange={(e) => {
              const t = Number(e.target.value);
              setCurrentTime(t);
              if (videoPlayerRef.current) videoPlayerRef.current.currentTime = t;
            }}
            className="flex-1 accent-[#8AB4F8]"
          />

          <span className="text-[11px] font-mono text-[#9AA0A6] tabular-nums shrink-0">
            {currentTime.toFixed(1)}s / {(videoDuration || selectedVideo.duration).toFixed(1)}s
          </span>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <div className="hidden sm:flex items-center gap-1 bg-[#131314] p-0.5 rounded-lg border border-[#2A2B2E]">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                onClick={() => {
                  setPlaybackSpeed(spd);
                  if (videoPlayerRef.current) videoPlayerRef.current.playbackRate = spd;
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

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252629]">
          <div className="text-xs text-[#9AA0A6] tabular-nums">
            <span className="text-[#E3E3E3] font-medium">{selectedVideo.model}</span> ·{' '}
            {selectedVideo.cameraMotion} · {selectedVideo.fps}fps · {selectedVideo.dimensions}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleVideoOp('extend', selectedVideo.id, 'Extend +5s')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Extend +5s</span>
            </button>
            <button
              onClick={() => handleVideoOp('interpolate', selectedVideo.id, '60 FPS Smooth')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
            >
              <span>60 FPS</span>
            </button>
            <button
              onClick={() => handleVideoOp('upscale', selectedVideo.id, '4K Upscale')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
            >
              <span>4K</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedVideo.prompt);
                setCopiedId(selectedVideo.id);
                setTimeout(() => setCopiedId(null), 1500);
              }}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
              title="Copy prompt"
            >
              {copiedId === selectedVideo.id ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => handleToggleFavorite(selectedVideo.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  selectedVideo.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
            <button
              onClick={() => downloadVideo(selectedVideo)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MP4</span>
            </button>
            <button
              onClick={() => handleDelete(selectedVideo.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-red-950/60 text-[#9AA0A6] hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
        <span className="text-xs font-medium text-white block">
          Cinema Video Diffusion Specification (JSON)
        </span>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto">
          {JSON.stringify(
            selectedVideo || {
              model: selectedModel,
              mode: generationMode,
              cameraMotion: selectedCamera,
              motionStrength,
              duration,
              fps,
              aspectRatio: selectedAspect,
              seed,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Cpu className="w-4 h-4 text-[#8AB4F8]" />
          <span>Generative Video Diffusion Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. Spatio-Temporal DiT</div>
            Models 3D spacetime patches across frames with joint spatial and temporal attention.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. 3D Causal Video VAE</div>
            Compresses 8x spatially and 4x temporally while enforcing causal frame ordering.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">3. CameraCtrl Trajectory</div>
            Injects Plucker camera rays for deterministic Pan, Orbit, Zoom, and Crane motion.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">4. Foley Audio Sync & Motion Brush</div>
            Supports frame interpolation, 4K upscaling, and synchronized ambient sound.
          </div>
        </div>
      </div>
    </div>
  );

  const displayedVideos = videoFeed.filter((v) => {
    const matchFav = !filterFavorite || v.isFavorite;
    const matchSearch =
      !fileSearch.trim() ||
      v.prompt.toLowerCase().includes(fileSearch.toLowerCase()) ||
      v.model.toLowerCase().includes(fileSearch.toLowerCase());
    return matchFav && matchSearch;
  });

  const filesContent = (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          <button
            onClick={() => setFilterFavorite(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              !filterFavorite ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            All Videos ({videoFeed.length})
          </button>
          <button
            onClick={() => setFilterFavorite(true)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterFavorite ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Favorites ({videoFeed.filter((v) => v.isFavorite).length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
          <input
            type="text"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="Search videos..."
            className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none focus:border-[#4A4D54] w-56"
          />
        </div>
      </div>

      {displayedVideos.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No videos found in this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => {
                setSelectedVideo(video);
                setIsPlaying(true);
                setRightTab('preview');
              }}
              className="rounded-xl overflow-hidden bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer flex flex-col"
            >
              <div className="relative aspect-video bg-black">
                <video
                  src={video.videoUrl}
                  poster={video.posterUrl}
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
                  <span className="truncate">{video.cameraMotion}</span>
                  <span>
                    {video.duration}s · {video.fps}fps
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editDrawerContent = (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Generation Mode
        </label>
        <div className="grid grid-cols-2 gap-1 bg-[#1B1C1E] p-1 rounded-lg border border-[#2C2D30]">
          <button
            onClick={() => setGenerationMode('text-to-video')}
            className={`py-1.5 rounded text-xs font-medium ${
              generationMode === 'text-to-video'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Text to Video
          </button>
          <button
            onClick={() => setGenerationMode('image-to-video')}
            className={`py-1.5 rounded text-xs font-medium ${
              generationMode === 'image-to-video'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Image to Video
          </button>
        </div>
      </div>

      {generationMode === 'image-to-video' && (
        <div className="p-3 rounded-lg bg-[#1E1F20] border border-dashed border-[#383A40] text-center">
          {referenceImage ? (
            <div className="space-y-2">
              <img
                src={referenceImage}
                alt="Reference keyframe"
                className="w-full h-24 object-cover rounded"
              />
              <button
                onClick={() => setReferenceImage(null)}
                className="text-xs text-red-400 hover:underline"
              >
                Remove Keyframe
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 flex flex-col items-center gap-1 text-xs text-[#9AA0A6] hover:text-white"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Reference Keyframe</span>
            </button>
          )}
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Camera Trajectory
        </label>
        <select
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        >
          {CAMERA_MOTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#C4C7C5]">Motion Strength</span>
          <span className="font-mono text-[#8AB4F8] tabular-nums">{motionStrength} / 10</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={motionStrength}
          onChange={(e) => setMotionStrength(Number(e.target.value))}
          className="w-full accent-[#8AB4F8]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-[#C4C7C5] block mb-1">
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
          >
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[#C4C7C5] block mb-1">
            Framerate
          </label>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
          >
            <option value={24}>24 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.id}
              onClick={() => setSelectedAspect(ar.id)}
              className={`py-1.5 rounded-lg border text-xs tabular-nums ${
                selectedAspect === ar.id
                  ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                  : 'bg-[#1E1F20] border-[#2C2D30] text-[#8E918F] hover:text-white'
              }`}
            >
              {ar.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const composerAddContent = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={handleEnhancePrompt}
          disabled={!prompt.trim() || isEnhancing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3] disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{isEnhancing ? 'Enhancing...' : 'Enhance Video Prompt'}</span>
        </button>

        <button
          onClick={() => {
            setPrompt(
              RANDOM_VIDEO_PROMPTS[
                Math.floor(Math.random() * RANDOM_VIDEO_PROMPTS.length)
              ]
            );
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Inspiration</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Keyframe Image</span>
        </button>
      </div>
    </div>
  );

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Cinema Studio"
      workspaceTitle={
        selectedVideo ? selectedVideo.prompt.slice(0, 56) : 'Untitled Workspace'
      }
      modelOptions={T2V_MODELS}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={handleGenerate}
      isGenerating={isLoading}
      turns={turns}
      onResetWorkspace={() => {
        setSelectedVideo(null);
        setTurns([]);
        setPrompt('');
        setRightTab('preview');
        showToast('Started empty workspace.');
      }}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={selectedVideo ? `/cinema/${selectedVideo.id}` : '/'}
      onRefresh={fetchVideoHistory}
      onRemix={() => {
        if (selectedVideo) {
          setPrompt(selectedVideo.prompt);
          setSelectedModel(selectedVideo.model);
          setSelectedCamera(selectedVideo.cameraMotion);
          showToast('Video parameters loaded for remix.');
        } else {
          setPrompt(RANDOM_VIDEO_PROMPTS[0]);
          showToast('Sample prompt loaded.');
        }
      }}
      onShare={() => {
        if (selectedVideo) {
          navigator.clipboard?.writeText(selectedVideo.prompt).catch(() => {});
          showToast('Video prompt copied.');
        } else {
          showToast('Workspace ready.');
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
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Describe a cinematic video scene on the left, or browse saved renders."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
    />
  );
};
