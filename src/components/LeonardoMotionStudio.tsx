import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Play,
  Pause,
  Maximize2,
  Download,
  Copy,
  Trash2,
  Heart,
  RefreshCw,
  Dices,
  Sliders,
  Video,
  Film,
  Camera,
  Layers,
  Wand2,
  Check,
  ChevronDown,
  Upload,
  Gauge,
  Clock,
  Compass,
  FastForward,
  Cpu,
  Share2,
  Sparkle,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GeneratedVideoItem } from '../types/index.ts';

interface LeonardoMotionStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const T2V_MODELS = [
  {
    id: 'Google Veo 2 (Frontier)',
    name: 'Google Veo 2 (Frontier)',
    provider: 'Google DeepMind',
    badge: 'Frontier SOTA',
    desc: 'Advanced physical world dynamics, cinematic lighting adherence, high temporal coherence, and 4K ultra-definition.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'OpenAI Sora Turbo',
    name: 'OpenAI Sora Turbo',
    provider: 'OpenAI Research',
    badge: 'World Simulator',
    desc: 'Spatio-temporal latent diffusion transformer operating as a physical simulator with multi-shot consistency.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'Runway Gen-3 Alpha',
    name: 'Runway Gen-3 Alpha',
    provider: 'Runway ML',
    badge: 'Cinematography Gold',
    desc: 'Unmatched human kinematic motion fidelity, director camera control, and nuanced actor facial expressions.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'Kling AI 1.5 Pro',
    name: 'Kling AI 1.5 Pro',
    provider: 'Kuaishou Kling',
    badge: 'Fluid Dynamics',
    desc: 'Elite 3D spatio-temporal attention with realistic gravity, water, smoke, and complex rotational physics.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'Luma Dream Machine 2.0',
    name: 'Luma Dream Machine 2.0',
    provider: 'Luma AI',
    badge: 'Ultra Rapid DiT',
    desc: 'Direct flow matching video transformer with zero-latency preview synthesis and smooth cinematic camera paths.',
    color: 'from-rose-500 to-red-500',
  },
  {
    id: 'MiniMax Hailuo Video 01',
    name: 'MiniMax Hailuo Video 01',
    provider: 'MiniMax Labs',
    badge: 'Action Master',
    desc: 'Dense temporal kinematics designed for high-octane martial arts, racing dynamics, and dynamic explosions.',
    color: 'from-indigo-500 to-violet-500',
  },
];

const CAMERA_MOTIONS = [
  { id: 'Fly Through Forward', label: 'Fly Through Forward', icon: '🚀', desc: 'Continuous forward cinematic push' },
  { id: 'Pan Right & Tilt Up', label: 'Pan Right & Tilt Up', icon: '↗️', desc: 'Sweeping majestic landscape pan' },
  { id: 'Orbit 360', label: 'Orbit 360 (Dolly)', icon: '🔄', desc: 'Full rotational camera sweep around subject' },
  { id: 'Zoom In Hyper', label: 'Zoom In Hyper', icon: '🔍', desc: 'Rapid optical push into core focal point' },
  { id: 'Zoom Out (Reveal)', label: 'Zoom Out (Reveal)', icon: '🔎', desc: 'Dramatic pullback establishing scene scale' },
  { id: 'Crane Up High Angle', label: 'Crane Up High Angle', icon: '🏗️', desc: 'Ascending high-altitude crane perspective' },
  { id: 'Tilt Down Grounding', label: 'Tilt Down Grounding', icon: '⬇️', desc: 'Descend vertically from clouds to ground' },
  { id: 'Static Camera (Tripod)', label: 'Static (Tripod)', icon: '📷', desc: 'Locked-off cinema framing with subject motion' },
];

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9 Cinema', dim: '1920x1080', desc: 'Standard Film / TV' },
  { id: '9:16', label: '9:16 Mobile', dim: '1080x1920', desc: 'Reels / Shorts / TikTok' },
  { id: '1:1', label: '1:1 Square', dim: '1080x1080', desc: 'Instagram Grid' },
  { id: '2.39:1', label: '2.39:1 Anamorphic', dim: '1920x804', desc: 'Hollywood Ultrawide' },
];

const RANDOM_VIDEO_PROMPTS = [
  'A neon-lit cybernetic assassin running across rain-slicked glass skyscrapers in Neo Tokyo 2099, dynamic low-angle tracking camera, volumetric steam, anamorphic lens flares, ultra-realistic motion blur',
  'Hyperrealistic drone shot soaring through a glowing crystalline ice canyon under dancing green emerald aurora borealis, crystalline water particles catching sunlight, Arri Alexa 65mm',
  'A sovereign golden robotic cheetah accelerating across the red sand dunes of Mars at sunset, plumes of dust kicking up with physics-based fluid simulation, high-speed 60fps tracking camera',
  'Ancient mystical Sigiriya fortress surrounded by floating glowing bioluminescent lanterns at midnight, mist rolling through valleys, majestic slow 360-degree rotational helicopter orbit',
  'Macro cinematic time-lapse of a glowing alien flower blossoming in deep space, iridescent pollen spiraling in zero gravity with astrophysical fluid dynamics, IMAX 70mm celestial perspective',
  'Cinematic street race between two matte-black futuristic supercars on a neon ocean bridge at dusk, camera mounted on front bumper skimming asphalt at 200mph with motion blur',
];

export const LeonardoMotionStudio: React.FC<LeonardoMotionStudioProps> = ({ isOpen, onClose }) => {
  // Generation Options
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('blurry, morphing, jitter, low framerate, artifacts, glitch, static');
  const [selectedModel, setSelectedModel] = useState('Google Veo 2 (Frontier)');
  const [selectedCamera, setSelectedCamera] = useState('Fly Through Forward');
  const [motionStrength, setMotionStrength] = useState<number>(7);
  const [duration, setDuration] = useState<number>(5);
  const [fps, setFps] = useState<number>(30);
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  const [generationMode, setGenerationMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [seed, setSeed] = useState<number>(894172);

  // Studio State
  const [videoFeed, setVideoFeed] = useState<GeneratedVideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'architecture'>('feed');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Video Feed on mount & when open
  useEffect(() => {
    if (isOpen) {
      fetchVideoHistory();
    }
  }, [isOpen]);

  const fetchVideoHistory = async () => {
    try {
      const res = await fetch('/api/motion/history');
      const data = await res.json();
      if (data.success && data.items) {
        setVideoFeed(data.items);
      }
    } catch (err) {
      console.error('Failed to load video history:', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);

    try {
      const dim = ASPECT_RATIOS.find((a) => a.id === selectedAspect)?.dim || '1920x1080';
      const payload = {
        prompt,
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
      };

      const res = await fetch('/api/motion/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.video) {
        setVideoFeed((prev) => [data.video, ...prev]);
        setSelectedVideo(data.video);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
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
      }
    } catch (err) {
      console.error('Prompt enhancement failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleRandomizePrompt = () => {
    const random = RANDOM_VIDEO_PROMPTS[Math.floor(Math.random() * RANDOM_VIDEO_PROMPTS.length)];
    setPrompt(random);
    setSeed(Math.floor(Math.random() * 99999999) + 10000000);
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/motion/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setVideoFeed((prev) => prev.map((v) => (v.id === id ? { ...v, isFavorite: data.item.isFavorite } : v)));
        if (selectedVideo?.id === id) {
          setSelectedVideo((prev) => (prev ? { ...prev, isFavorite: data.item.isFavorite } : null));
        }
      }
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/motion/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setVideoFeed((prev) => prev.filter((v) => v.id !== id));
        if (selectedVideo?.id === id) {
          setSelectedVideo(null);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleExtend = async (id: string) => {
    try {
      const res = await fetch('/api/motion/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setVideoFeed((prev) => prev.map((v) => (v.id === id ? data.item : v)));
        if (selectedVideo?.id === id) setSelectedVideo(data.item);
      }
    } catch (err) {
      console.error('Extend failed:', err);
    }
  };

  const handleInterpolate = async (id: string) => {
    try {
      const res = await fetch('/api/motion/interpolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setVideoFeed((prev) => prev.map((v) => (v.id === id ? data.item : v)));
        if (selectedVideo?.id === id) setSelectedVideo(data.item);
      }
    } catch (err) {
      console.error('Interpolate failed:', err);
    }
  };

  const handleUpscale = async (id: string) => {
    try {
      const res = await fetch('/api/motion/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setVideoFeed((prev) => prev.map((v) => (v.id === id ? data.item : v)));
        if (selectedVideo?.id === id) setSelectedVideo(data.item);
      }
    } catch (err) {
      console.error('Upscale failed:', err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
        setGenerationMode('image-to-video');
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  // Video Player scrubbing handlers
  const togglePlay = () => {
    if (videoPlayerRef.current) {
      if (isPlaying) {
        videoPlayerRef.current.pause();
      } else {
        videoPlayerRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.playbackRate = speed;
    }
  };

  const handleTimeUpdate = () => {
    if (videoPlayerRef.current) {
      setCurrentTime(videoPlayerRef.current.currentTime);
      setVideoDuration(videoPlayerRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = time;
    }
  };

  if (!isOpen) return null;

  const displayedVideos = filterFavorite ? videoFeed.filter((v) => v.isFavorite) : videoFeed;

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0c0d14] text-slate-100 font-sans overflow-hidden select-none">
      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR: EXACT LEONARDO AI MOTION CONTROLS DRAWER     */}
      {/* ============================================================== */}
      <aside className="w-84 flex-shrink-0 bg-[#12131e] border-r border-slate-800/80 flex flex-col h-full z-20 overflow-y-auto custom-scrollbar">
        {/* Studio Branding Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#151726]/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-[1.5px] shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#0e0f1a] rounded-[10px] flex items-center justify-center">
                <Video className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-wide text-white">RaOne Cinema</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-semibold">
                  T2V DiT
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Generative Video Diffusion</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1f2137] px-2.5 py-1 rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold shadow-inner">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" />
            <span>500</span>
          </div>
        </div>

        {/* Mode Selector: Text-to-Video vs Image-to-Video */}
        <div className="p-4 border-b border-slate-800/80">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 block">
            Generation Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-[#0a0a10] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setGenerationMode('text-to-video')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                generationMode === 'text-to-video'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Text to Video
            </button>
            <button
              onClick={() => setGenerationMode('image-to-video')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                generationMode === 'image-to-video'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Image to Video
            </button>
          </div>

          {/* Image to Video Reference Box */}
          {generationMode === 'image-to-video' && (
            <div className="mt-3 p-3 bg-[#151726] rounded-xl border border-dashed border-purple-500/40 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {referenceImage ? (
                <div className="relative group rounded-lg overflow-hidden border border-purple-500/50">
                  <img src={referenceImage} alt="Reference" className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs text-white"
                    >
                      Change
                    </button>
                    <button
                      onClick={() => setReferenceImage(null)}
                      className="p-1.5 bg-red-600/80 hover:bg-red-500 rounded text-xs text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 flex flex-col items-center justify-center text-slate-400 hover:text-purple-300 transition-colors"
                >
                  <Upload className="w-6 h-6 mb-1 text-purple-400 animate-pulse" />
                  <span className="text-xs font-medium">Drop Keyframe or Upload Image</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Motion synthesis will animate this photo</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Motion Strength Slider (Leonardo Motion Signature Slider 1-10) */}
        <div className="p-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">Motion Strength</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
              {motionStrength} / 10
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={motionStrength}
            onChange={(e) => setMotionStrength(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>1 (Subtle Ambient)</span>
            <span>5 (Natural)</span>
            <span>10 (High Kinetic)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed bg-[#0c0d16] p-2 rounded-lg border border-slate-800/60">
            {motionStrength <= 3
              ? '✨ Subtle Micro-Motion: gentle wind, blinking eyes, flickering candlelights, smooth ocean drift.'
              : motionStrength <= 7
              ? '🎬 Dynamic Cinematography: natural human walking, moving vehicles, fluid camera tracking.'
              : '⚡ High Kinetic Energy: hyper-velocity pans, flying supersonic ships, explosive particles.'}
          </p>
        </div>

        {/* Camera Trajectory & Controls */}
        <div className="p-4 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Compass className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-slate-200">Camera Trajectory (Plücker Vector)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CAMERA_MOTIONS.map((cam) => {
              const active = selectedCamera === cam.id;
              return (
                <button
                  key={cam.id}
                  onClick={() => setSelectedCamera(cam.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-purple-950/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-500/20'
                      : 'bg-[#151726]/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">{cam.icon}</span>
                  <div className="overflow-hidden">
                    <div className="text-[11px] font-semibold truncate leading-tight">{cam.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SOTA Generative Video Model Selector */}
        <div className="p-4 border-b border-slate-800/80">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Video Diffusion Model
          </label>
          <div className="space-y-2">
            {T2V_MODELS.map((model) => {
              const active = selectedModel === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    active
                      ? 'bg-[#171b30] border-cyan-500/80 shadow-md shadow-cyan-500/10'
                      : 'bg-[#151726]/40 border-slate-800/80 hover:border-slate-700 hover:bg-[#151726]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${active ? 'text-cyan-300' : 'text-slate-200'}`}>
                      {model.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-gradient-to-r ${model.color} text-white`}
                    >
                      {model.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">{model.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Video Duration & Framerate */}
        <div className="p-4 border-b border-slate-800/80">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Duration
              </div>
              <div className="grid grid-cols-2 gap-1 bg-[#0a0a10] p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDuration(5)}
                  className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                    duration === 5 ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  5s
                </button>
                <button
                  onClick={() => setDuration(10)}
                  className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                    duration === 10 ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  10s
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-300 mb-1.5">
                <FastForward className="w-3.5 h-3.5 text-emerald-400" />
                Frame Rate
              </div>
              <div className="grid grid-cols-3 gap-1 bg-[#0a0a10] p-1 rounded-xl border border-slate-800">
                {[24, 30, 60].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFps(f)}
                    className={`py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${
                      fps === f ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 block">
              Aspect Ratio & Dimensions
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ASPECT_RATIOS.map((aspect) => {
                const active = selectedAspect === aspect.id;
                return (
                  <button
                    key={aspect.id}
                    onClick={() => setSelectedAspect(aspect.id)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                        : 'bg-[#151726]/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-white">{aspect.label}</div>
                    <div className="text-[10px] font-mono text-slate-400">{aspect.dim}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Advanced Accordion: Negative Prompt & Seed */}
        <div className="p-4 border-b border-slate-800/80">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Advanced Guidance & Seed</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Negative Prompt</label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0a0a10] border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/60 resize-none"
                  placeholder="Elements to suppress in video diffusion..."
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400 block mb-1">Diffusion Seed</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="w-full bg-[#0a0a10] border border-slate-800 rounded-lg p-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 99999999) + 10000000)}
                  title="Randomize Seed"
                  className="mt-5 p-2 bg-[#1f2137] hover:bg-[#282b45] text-cyan-400 rounded-lg border border-slate-700"
                >
                  <Dices className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 text-center mt-auto border-t border-slate-800/80 bg-[#0e0f19]">
          <p className="text-[10px] text-slate-500">
            Powered by RaOne Diffusion Core & Sovereign Video Transformer
          </p>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MAIN WORKSPACE: TOP PROMPT DOCK + GENERATION FEED          */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col h-full bg-[#0d0e17] overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-[#12131e]/70 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-[#0a0a10] p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'feed'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Generation Feed ({videoFeed.length})
              </button>
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'architecture'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Silicon Valley T2V Architecture Guide
              </button>
            </div>

            <button
              onClick={() => setFilterFavorite(!filterFavorite)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                filterFavorite
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                  : 'bg-[#151726]/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${filterFavorite ? 'fill-rose-400 text-rose-400' : ''}`} />
              Favorites Only
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Top Video Prompt Dock (Leonardo AI Style Floating Input) */}
        <div className="p-6 bg-gradient-to-b from-[#141627] to-[#0d0e17] border-b border-slate-800/80">
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-[#151726] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/30 overflow-hidden focus-within:border-cyan-400/80 transition-all">
              <div className="flex items-center px-4 pt-3 pb-2 gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-spin-slow" />
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGenerate()}
                  placeholder="Describe your cinematic scene... e.g. Cyberpunk hovercar drifting on a rain-slicked highway at midnight in Tokyo, 8K Arri Alexa"
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Prompt Bar Utility Actions */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#0d0e17]/80 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  {/* Prompt Enhancer Button */}
                  <button
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing || !prompt.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-800/60 hover:to-indigo-800/60 text-purple-300 border border-purple-500/40 text-xs font-medium transition-all disabled:opacity-50"
                  >
                    <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                    <span>{isEnhancing ? 'Expanding Prompt...' : 'Enhance Video Prompt'}</span>
                  </button>

                  {/* Randomize Dice */}
                  <button
                    onClick={handleRandomizePrompt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f2137] hover:bg-[#282b45] text-slate-300 text-xs font-medium border border-slate-700 transition-all"
                  >
                    <Dices className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Inspiration</span>
                  </button>
                </div>

                {/* Primary Generate Video Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Video...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Generate Video</span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/30 text-[10px] font-mono text-cyan-200 border border-cyan-400/20">
                        <Zap className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        25 Tokens
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* View Content: Feed vs Architecture */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'feed' ? (
            <div className="max-w-7xl mx-auto">
              {displayedVideos.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
                    <Film className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">No Video Generations Yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Enter a prompt above or use inspiration dice to generate your first cinematic AI video using Veo 2, Sora, or Runway.
                  </p>
                  <button
                    onClick={handleRandomizePrompt}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold"
                  >
                    Load Sample Prompt
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedVideos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => {
                        setSelectedVideo(video);
                        setIsPlaying(true);
                      }}
                      className="group relative bg-[#131524] rounded-2xl border border-slate-800/80 hover:border-cyan-500/60 overflow-hidden shadow-xl transition-all duration-300 hover:shadow-cyan-950/30 flex flex-col cursor-pointer"
                    >
                      {/* Video Preview Card */}
                      <div className="relative aspect-video bg-black overflow-hidden">
                        <video
                          src={video.videoUrl}
                          poster={video.posterUrl}
                          loop
                          muted
                          playsInline
                          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                          onMouseLeave={(e) => {
                            const v = e.currentTarget as HTMLVideoElement;
                            v.pause();
                            v.currentTime = 0;
                          }}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Badges Overlay */}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
                          <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                            {video.model.split(' ')[0]} {video.model.split(' ')[1]}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[10px] font-mono text-purple-300 border border-purple-500/30">
                            {video.duration}s • {video.fps}fps
                          </span>
                          {video.upscaled && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/80 text-black text-[9px] font-bold">
                              4K UHD
                            </span>
                          )}
                          {video.interpolated && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-black text-[9px] font-bold">
                              60 FPS
                            </span>
                          )}
                        </div>

                        {/* Top-Right Favorite Button */}
                        <button
                          onClick={(e) => handleToggleFavorite(video.id, e)}
                          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-slate-300 hover:text-rose-400 transition-colors z-10"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              video.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                            }`}
                          />
                        </button>

                        {/* Play Indicator Overlay on Hover */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-cyan-500/90 text-white flex items-center justify-center shadow-lg shadow-cyan-500/50 scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Camera Trajectory Tag */}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] text-slate-300 flex items-center gap-1">
                          <Compass className="w-3 h-3 text-cyan-400" />
                          <span>{video.cameraMotion}</span>
                        </div>
                      </div>

                      {/* Card Meta & Prompt */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-xs text-slate-200 line-clamp-2 mb-2 font-medium leading-relaxed">
                            {video.prompt}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>Motion: {video.motionStrength}/10</span>
                            <span>{video.dimensions}</span>
                          </div>
                        </div>

                        {/* Quick Action Footer */}
                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(video.prompt, video.id);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors"
                              title="Copy Prompt"
                            >
                              {copyFeedback === video.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={video.videoUrl}
                              download={`raone_motion_${video.id}.mp4`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors"
                              title="Download MP4"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={(e) => handleDelete(video.id, e)}
                              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Video"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="text-[10px] text-slate-500">
                            {new Date(video.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ============================================================== */
            /* 3. SILICON VALLEY GRADE T2V ARCHITECTURE EXPLANATION           */
            /* ============================================================== */
            <div className="max-w-4xl mx-auto py-4 space-y-6">
              <div className="bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-purple-950/40 border border-cyan-500/40 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Cpu className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Silicon Valley-Grade Generative Video Diffusion Architecture
                    </h2>
                    <p className="text-xs text-cyan-300">
                      Inside Sora, Google Veo 2, Runway Gen-3, Kling AI, and RaOne Cinema Core
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Generative Video (Text-to-Video & Image-to-Video) represents the most compute-intensive and mathematically sophisticated frontier in modern Artificial Intelligence. Below is the blueprint of what a production-grade Silicon Valley video generation system requires:
                </p>
              </div>

              {/* Architecture Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#141627] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                    <span className="w-6 h-6 rounded-full bg-cyan-950 flex items-center justify-center text-xs font-mono border border-cyan-500/40">1</span>
                    Spatio-Temporal DiT (Diffusion Transformer)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unlike standard 2D image models (UNet), video engines pack video frames into 3D spacetime spacetime patches (e.g., 2×4×4 patches). A Transformer with joint spatial and temporal self-attention models how every pixel moves across consecutive timestamps with zero hallucination.
                  </p>
                </div>

                <div className="p-4 bg-[#141627] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                    <span className="w-6 h-6 rounded-full bg-purple-950 flex items-center justify-center text-xs font-mono border border-purple-500/40">2</span>
                    3D Causal Latent Video VAE
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Generating raw 1080p uncompressed video at 60fps requires petabytes of VRAM. A 3D Causal Autoencoder compresses raw video 8× spatially and 4× temporally into latent space, enforcing strict causality so future frames cannot paradoxically alter past frames.
                  </p>
                </div>

                <div className="p-4 bg-[#141627] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <span className="w-6 h-6 rounded-full bg-emerald-950 flex items-center justify-center text-xs font-mono border border-emerald-500/40">3</span>
                    Camera Trajectory Conditioning (CameraCtrl)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    True director control requires injecting Plücker coordinates and 3D camera extrinsic matrices $[R | T]$ into the temporal attention layers. This gives creators 100% deterministic control over Pan, Tilt, Zoom, Orbit, and Crane dynamics without camera shaking.
                  </p>
                </div>

                <div className="p-4 bg-[#141627] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                    <span className="w-6 h-6 rounded-full bg-amber-950 flex items-center justify-center text-xs font-mono border border-amber-500/40">4</span>
                    Rectified Flow Matching & Temporal Consistency
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Traditional DDPM diffusion requires 50–100 iterative denoising steps. Modern video models (Veo 2 & Flux Video) utilize Rectified Flow Matching with straight vector trajectories, allowing cinema-quality video rendering in only 20–30 high-speed inference steps.
                  </p>
                </div>
              </div>

              {/* Recommendations for Next-Level Expansion */}
              <div className="bg-[#12131f] border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkle className="w-4 h-4 text-cyan-400" />
                  What to Add Next to make RaOne Cinema Studio World #1:
                </h3>
                <ul className="text-xs text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                  <li>
                    <strong className="text-white">Motion Brush & Trajectory Painting:</strong> Allow users to draw directional motion arrows directly on uploaded reference images to guide exactly where characters or water should flow.
                  </li>
                  <li>
                    <strong className="text-white">Voice & Foley Sound Synthesis (Audio-to-Video):</strong> Synchronize generated videos with realistic ambient audio, footsteps, engine roars, and speech using multimodal audio-diffusion.
                  </li>
                  <li>
                    <strong className="text-white">Multi-Shot Storyboard Director:</strong> Chain 3-5 consecutive shots with persistent character LoRAs and shared camera continuity to create full 60-second cinema scenes.
                  </li>
                  <li>
                    <strong className="text-white">Realtime WebRTC Video Canvas:</strong> Connect directly to GPU clusters running TensorRT-LLM and vLLM-Video for live interactive video streaming.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ============================================================== */}
      {/* 4. MODAL: FULL-SCREEN CINEMATIC VIDEO PLAYER & SCRUBBER       */}
      {/* ============================================================== */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-[#11121d] border border-cyan-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#151726]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {selectedVideo.model}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                      {selectedVideo.cameraMotion}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedVideo.id} • Seed: {selectedVideo.seed}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedVideo.id)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${selectedVideo.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
                  />
                </button>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Player Display */}
            <div className="relative bg-black flex items-center justify-center overflow-hidden flex-1 min-h-[380px] max-h-[520px]">
              <video
                ref={videoPlayerRef}
                src={selectedVideo.videoUrl}
                poster={selectedVideo.posterUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlay}
                className="w-full h-full object-contain cursor-pointer"
              />

              {/* Big Play/Pause indicator on pause */}
              {!isPlaying && (
                <div
                  onClick={togglePlay}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-cyan-500/90 text-white flex items-center justify-center shadow-2xl scale-110">
                    <Play className="w-7 h-7 fill-white ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls Timeline Bar */}
            <div className="p-4 bg-[#141627] border-t border-slate-800/80 space-y-3">
              {/* Progress Scrubber Bar */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
                  {Math.floor(currentTime)}s
                </span>
                <input
                  type="range"
                  min="0"
                  max={videoDuration || selectedVideo.duration || 10}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-[11px] font-mono text-slate-400 w-10">
                  {Math.floor(videoDuration || selectedVideo.duration)}s
                </span>
              </div>

              {/* Player Controls & Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Playback Speed selector */}
                  <div className="flex items-center gap-1 bg-[#0a0a10] px-2 py-1 rounded-xl border border-slate-800 text-[10px] font-mono">
                    {[0.5, 1, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`px-1.5 py-0.5 rounded ${
                          playbackSpeed === s ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Enhancement & Export Actions */}
                <div className="flex items-center gap-2">
                  {/* Extend Video (+5s) */}
                  <button
                    onClick={() => handleExtend(selectedVideo.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedVideo.extended
                        ? 'bg-purple-950/60 text-purple-300 border-purple-500/50'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <FastForward className="w-3.5 h-3.5 text-purple-400" />
                    <span>{selectedVideo.extended ? `Extended (${selectedVideo.duration}s)` : '+5s Extend'}</span>
                  </button>

                  {/* 60fps Interpolate */}
                  <button
                    onClick={() => handleInterpolate(selectedVideo.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedVideo.interpolated
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{selectedVideo.interpolated ? '60 FPS Ultra' : 'Boost 60 FPS'}</span>
                  </button>

                  {/* 4K Upscale */}
                  <button
                    onClick={() => handleUpscale(selectedVideo.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedVideo.upscaled
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedVideo.upscaled ? '4K Rendered' : '4K Upscale'}</span>
                  </button>

                  {/* Download MP4 */}
                  <a
                    href={selectedVideo.videoUrl}
                    download={`raone_motion_${selectedVideo.id}.mp4`}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>
                </div>
              </div>

              {/* Prompt Box in Modal */}
              <div className="p-3 bg-[#0c0d16] rounded-xl border border-slate-800/80 flex items-start justify-between gap-3">
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedVideo.prompt}</p>
                <button
                  onClick={() => copyToClipboard(selectedVideo.prompt, 'modal')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1f2137] hover:bg-[#282b45] text-slate-300 text-[11px] font-medium flex-shrink-0"
                >
                  {copyFeedback === 'modal' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy Prompt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default LeonardoMotionStudio;
