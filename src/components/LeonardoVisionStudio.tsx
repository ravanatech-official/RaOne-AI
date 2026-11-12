import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Sliders,
  Maximize2,
  Download,
  Copy,
  Trash2,
  Heart,
  RefreshCw,
  Dices,
  Layers,
  Camera,
  Wand2,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Info,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { GeneratedImageItem } from '../types/index.ts';

interface LeonardoVisionStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const T2I_MODELS = [
  {
    id: 'Flux 1.1 Pro (LDM)',
    name: 'Flux 1.1 Pro (LDM)',
    provider: 'Black Forest Labs',
    badge: 'State of the Art',
    desc: '12B parameter Rectified Flow Latent Diffusion. Unmatched photorealism, hands, and typography.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'Midjourney v6.1 Aesthetics',
    name: 'Midjourney v6.1 Aesthetics',
    provider: 'Midjourney / RaOne Core',
    badge: 'Aesthetic Gold',
    desc: 'Proprietary aesthetic reward modeling with cinematic lighting and high fashion framing.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'Google Imagen 3 Ultra',
    name: 'Google Imagen 3 Ultra',
    provider: 'Google DeepMind',
    badge: 'Cascading T2I',
    desc: 'Deep multimodal cross-attention with flawless text generation and spatial coherence.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'DALL-E 3 Precision',
    name: 'DALL-E 3 Precision',
    provider: 'OpenAI Synthetics',
    badge: 'Semantic Match',
    desc: 'Dense descriptive synthetic caption conditioning for exact prompt compliance.',
    color: 'from-purple-500 to-pink-600',
  },
  {
    id: 'Leonardo Diffusion XL',
    name: 'Leonardo Diffusion XL',
    provider: 'Leonardo AI Standard',
    badge: 'Flagship XL',
    desc: 'Trained on high-end digital concept art and photorealistic studio lighting.',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'Stable Diffusion 3.5 Large',
    name: 'SD 3.5 Large MMDiT',
    provider: 'Stability AI',
    badge: 'MMDiT Transformer',
    desc: 'Multimodal Diffusion Transformer (DiT) architecture with dual text encoders.',
    color: 'from-violet-500 to-purple-600',
  },
];

const STYLE_PRESETS = [
  { id: 'Cinematic Photoreal', label: 'Cinematic Photoreal', desc: 'Hasselblad 85mm, volumetric lighting' },
  { id: 'Ray Traced 3D', label: 'Ray Traced 3D', desc: 'Octane Render, Unreal Engine 5 aesthetic' },
  { id: 'High Fashion Concept', label: 'High Fashion Concept', desc: 'Vogue editorial, studio strobes' },
  { id: 'Architectural Digest', label: 'Architectural Digest', desc: 'Wide-angle, clean lines, golden hour' },
  { id: 'Anime Illustration', label: 'Anime Illustration', desc: 'Makoto Shinkai vibrant cloudscapes' },
  { id: 'Concept Art', label: 'Sci-Fi Concept Art', desc: 'Matte painting, atmospheric fog' },
  { id: 'Dark Fantasy', label: 'Dark Fantasy / Elden', desc: 'Gothic mood, glowing runes, obsidian' },
  { id: 'Macro Photography', label: 'Macro Photography', desc: 'Extreme depth of field, dew drops' },
];

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', dim: '1344x768', name: 'Landscape / Cinema' },
  { id: '1:1', label: '1:1', dim: '1024x1024', name: 'Square / Social' },
  { id: '9:16', label: '9:16', dim: '768x1344', name: 'Portrait / Story' },
  { id: '4:3', label: '4:3', dim: '1152x864', name: 'Standard Display' },
  { id: '3:4', label: '3:4', dim: '864x1152', name: 'Editorial Portrait' },
  { id: '21:9', label: '21:9', dim: '1536x640', name: 'Ultrawide Cinematic' },
];

const RANDOM_PROMPTS = [
  'A sovereign cybernetic lion with glowing gold and cyan circuitry walking through mist-covered ancient Sigiriya ruins, cinematic 8k, volumetric light beams, photorealistic Unreal Engine 5 render',
  'Futuristic crystalline spacecraft docking at an orbital quantum space station above Earth during sunrise, raytraced lens flare, hyper-detailed mechanical hull, shot on 70mm IMAX',
  'Cyberpunk Sri Lankan street food vendor serving holographic neon delicacies in rainy Colombo 2077, vibrant reflections, steam rising, shallow depth of field, Hasselblad portrait',
  'Ethereal mythical sorceress commanding floating orb of liquid plasma inside an ancient subterranean temple, intricate filigree robes, bioluminescent flora, octane render 8k',
  'Hyperrealistic macro photograph of an iridescent robotic hummingbird sipping nectar from a glowing crystal flower, extreme details of gears, water droplet refraction',
  'Sleek matte-black hypercar driving on a suspended highway above a futuristic neon metropolis at twilight, motion blur wheels, anamorphic streaks, ultra photorealism',
];

export const LeonardoVisionStudio: React.FC<LeonardoVisionStudioProps> = ({ isOpen, onClose }) => {
  // Generation Options
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('blurry, low resolution, deformed, bad anatomy, artifacts, text watermark');
  const [selectedModel, setSelectedModel] = useState('Flux 1.1 Pro (LDM)');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic Photoreal');
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  const [imageCount, setImageCount] = useState<number>(2);
  const [cfgScale, setCfgScale] = useState<number>(7.5);
  const [steps, setSteps] = useState<number>(40);
  const [seed, setSeed] = useState<string>('');
  const [photoReal, setPhotoReal] = useState<boolean>(true);
  const [alchemy, setAlchemy] = useState<boolean>(true);
  const [promptMagic, setPromptMagic] = useState<boolean>(true);

  // Studio UI states
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [tokens, setTokens] = useState<number>(150);
  const [activeTab, setActiveTab] = useState<'feed' | 'my' | 'favorites' | 'architecture'>('feed');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Gallery items and lightbox
  const [galleryItems, setGalleryItems] = useState<GeneratedImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageItem | null>(null);

  // Load history from backend
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/vision/history');
      const data = await res.json();
      if (data.items) {
        setGalleryItems(data.items);
      }
    } catch (err) {
      console.warn('Failed to fetch vision history:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Token cost calculation based on features
  const tokenCost = imageCount * (photoReal ? 3 : 2) + (alchemy ? 2 : 0) + (promptMagic ? 1 : 0);

  // Enhance prompt with AI
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/vision/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: selectedStyle }),
      });
      const data = await res.json();
      if (data.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
      }
    } catch (err) {
      console.warn('Enhance prompt failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Randomize prompt
  const handleRandomizePrompt = () => {
    const random = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setPrompt(random);
  };

  // Generate Image
  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    if (tokens < tokenCost) {
      alert('Tokens depleted! Resetting tokens to 150.');
      setTokens(150);
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Allocating latent diffusion tensors...');

    try {
      const currentAspectObj = ASPECT_RATIOS.find((a) => a.id === selectedAspect);
      const dimensions = currentAspectObj ? currentAspectObj.dim : '1344x768';

      const payload = {
        prompt,
        negativePrompt,
        model: selectedModel,
        style: selectedStyle,
        aspectRatio: selectedAspect,
        dimensions,
        cfgScale,
        steps,
        seed: seed ? parseInt(seed, 10) : Math.floor(Math.random() * 90000000) + 10000000,
        alchemy,
        photoReal,
        promptMagic,
        count: imageCount,
      };

      const res = await fetch('/api/vision/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.items) {
        setGalleryItems((prev) => [...data.items, ...prev]);
        setTokens((prev) => Math.max(0, prev - tokenCost));
        setStatusMessage('Generation complete!');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setStatusMessage('Error during synthesis.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/vision/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setGalleryItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
        );
        if (selectedImage && selectedImage.id === id) {
          setSelectedImage((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
        }
      }
    } catch (err) {
      console.warn('Favorite toggle error:', err);
    }
  };

  // Delete Image
  const handleDeleteImage = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to delete this generation from your gallery?')) return;
    try {
      const res = await fetch('/api/vision/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setGalleryItems((prev) => prev.filter((item) => item.id !== id));
        if (selectedImage?.id === id) {
          setSelectedImage(null);
        }
      }
    } catch (err) {
      console.warn('Delete error:', err);
    }
  };

  // Upscale Image 4x
  const handleUpscale = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStatusMessage('Upscaling via Ultra-Clarity 4x ESRGAN...');
    try {
      const res = await fetch('/api/vision/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setGalleryItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, upscaled: true, dimensions: data.item.dimensions } : item))
        );
        if (selectedImage?.id === id) {
          setSelectedImage((prev) => (prev ? { ...prev, upscaled: true, dimensions: data.item.dimensions } : null));
        }
        setStatusMessage('Upscaling complete (4x Ultra Resolution)!');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch (err) {
      console.warn('Upscale error:', err);
    }
  };

  // Copy prompt
  const handleCopyPrompt = (text: string, id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Remix (populate dock with image params)
  const handleRemix = (item: GeneratedImageItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPrompt(item.prompt);
    if (item.negativePrompt) setNegativePrompt(item.negativePrompt);
    setSelectedModel(item.model);
    setSelectedStyle(item.style);
    setSelectedAspect(item.aspectRatio);
    setCfgScale(item.cfgScale);
    setSteps(item.steps);
    setSeed(String(item.seed));
    if (item.photoReal !== undefined) setPhotoReal(item.photoReal);
    if (item.alchemy !== undefined) setAlchemy(item.alchemy);
    if (item.promptMagic !== undefined) setPromptMagic(item.promptMagic);
    setSelectedImage(null);
  };

  // Filter items
  const filteredItems = galleryItems.filter((item) => {
    if (activeTab === 'favorites') return item.isFavorite;
    if (activeTab === 'my') return true;
    return true;
  });

  const activeModelObj = T2I_MODELS.find((m) => m.id === selectedModel) || T2I_MODELS[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#07090E] text-slate-100 flex flex-col overflow-hidden font-sans select-none animate-in fade-in duration-200">
      {/* Top Leonardo Navigation Bar */}
      <header className="h-14 border-b border-[#1E2330] bg-[#0B0E17]/95 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <div className="w-full h-full bg-[#0B0E17] rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0B0E17]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">RaOne Vision Studio</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30">
                Leonardo Engine
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Latent Diffusion Models • Midjourney v6.1 • Flux 1.1 • Imagen 3 • DALL-E 3</p>
          </div>
        </div>

        {/* Center Status / Tokens Badge */}
        <div className="flex items-center gap-3">
          {statusMessage && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-xs text-cyan-300 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Leonardo Fast Tokens */}
          <div className="flex items-center gap-2 bg-[#121724] border border-[#242C3F] px-3 py-1.5 rounded-full shadow-inner">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">
              <span className="text-amber-400">{tokens}</span> / 150 Fast Tokens
            </span>
            <button
              onClick={() => setTokens(150)}
              title="Reset Tokens"
              className="text-[10px] text-slate-400 hover:text-white ml-1 px-1.5 py-0.5 rounded bg-[#1B2233] hover:bg-[#252F47] transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
              activeTab === 'architecture'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                : 'bg-[#121724] border-[#242C3F] text-slate-300 hover:border-slate-500'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Silicon Valley T2I Architecture</span>
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#141A28] border border-[#242C3F] text-slate-400 hover:text-white hover:bg-[#1E273D] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Studio Body: Left Sidebar Controls + Center Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Leonardo AI Generation Settings Sidebar */}
        <aside className="w-80 md:w-88 border-r border-[#1E2330] bg-[#0A0D15] flex flex-col shrink-0 overflow-y-auto chat-scroll-area">
          <div className="p-4 space-y-5">
            {/* 1. Number of Images */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Number of Images</label>
                <span className="text-[11px] text-slate-500">{imageCount} Variations</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 bg-[#121622] p-1 rounded-xl border border-[#21283B]">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setImageCount(num)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      imageCount === num
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-[#1A2030]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Feature Toggles: PhotoReal v2 & Alchemy v2 */}
            <div className="space-y-2 bg-[#101420] p-3 rounded-xl border border-[#1E2538]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">PhotoReal v2</span>
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">PRO</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Hyperrealistic skin textures & 35mm optical depth</p>
                </div>
                <button
                  onClick={() => setPhotoReal(!photoReal)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                    photoReal ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="border-t border-[#1C2234] pt-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">Alchemy v2</span>
                    <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-bold">PIPELINE</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Multi-resolution latent upsampling & noise suppression</p>
                </div>
                <button
                  onClick={() => setAlchemy(!alchemy)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                    alchemy ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="border-t border-[#1C2234] pt-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">Prompt Magic v3</span>
                    <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300 font-bold">CROSS-ATTN</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Strict keyword attention guidance & token weight balance</p>
                </div>
                <button
                  onClick={() => setPromptMagic(!promptMagic)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                    promptMagic ? 'bg-purple-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>

            {/* 3. Base Model Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Finetuned Model Engine
              </label>
              <div className="relative">
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#121622] border border-[#21283B] hover:border-slate-500 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${activeModelObj.color} shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{activeModelObj.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{activeModelObj.provider}</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-[#101420] border border-[#242C3F] rounded-xl shadow-2xl p-1.5 space-y-1 max-h-72 overflow-y-auto chat-scroll-area">
                    {T2I_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-colors flex items-start gap-2.5 ${
                          selectedModel === m.id
                            ? 'bg-cyan-500/15 border border-cyan-500/40 text-white'
                            : 'hover:bg-[#181F30] text-slate-300'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${m.color} mt-1 shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">{m.name}</span>
                            <span className="text-[9px] px-1 rounded bg-[#1C2335] text-cyan-300">{m.badge}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1">{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Style Preset Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Leonardo Style Preset
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      selectedStyle === style.id
                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'bg-[#121622] border-[#21283B] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[11px] font-semibold truncate">{style.label}</div>
                    <div className="text-[9px] text-slate-500 line-clamp-1">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Aspect Ratio & Dimensions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Aspect Ratio</label>
                <span className="text-[10px] text-cyan-400">
                  {ASPECT_RATIOS.find((a) => a.id === selectedAspect)?.dim}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ASPECT_RATIOS.map((aspect) => (
                  <button
                    key={aspect.id}
                    onClick={() => setSelectedAspect(aspect.id)}
                    className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                      selectedAspect === aspect.id
                        ? 'bg-gradient-to-b from-[#1C2436] to-[#121725] border-cyan-500 text-white shadow-sm'
                        : 'bg-[#121622] border-[#21283B] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold">{aspect.label}</div>
                    <div className="text-[9px] text-slate-500 truncate">{aspect.dim}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Advanced Settings Accordion */}
            <div className="border border-[#1E2538] rounded-xl overflow-hidden bg-[#0E121D]">
              <button
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Advanced Guidance & Latents</span>
                </div>
                {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isAdvancedOpen && (
                <div className="p-3 border-t border-[#1E2538] space-y-4 bg-[#0A0D15]">
                  {/* Guidance Scale (CFG) */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Guidance Scale (CFG)</span>
                      <span className="text-cyan-400 font-bold">{cfgScale}</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="20.0"
                      step="0.5"
                      value={cfgScale}
                      onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 h-1.5 bg-[#1B2233] rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                      <span>Creative (1.0)</span>
                      <span>Strict Prompt (20.0)</span>
                    </div>
                  </div>

                  {/* Step Count */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Inference Steps</span>
                      <span className="text-cyan-400 font-bold">{steps}</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="60"
                      step="5"
                      value={steps}
                      onChange={(e) => setSteps(parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-500 h-1.5 bg-[#1B2233] rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Seed Input */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Seed (Optional for reproducibility)</label>
                    <input
                      type="text"
                      placeholder="Random (e.g. 84920194)"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121622] border border-[#21283B] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Negative Prompt */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Negative Prompt</label>
                    <textarea
                      rows={2}
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="What to exclude (e.g. blurry, low quality, artifacts)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121622] border border-[#21283B] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none chat-scroll-area"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#07090E] overflow-hidden">
          {/* Top Prompt Dock (Leonardo AI Style) */}
          <div className="p-4 border-b border-[#1E2330] bg-[#0A0D15]/90 backdrop-blur shrink-0 space-y-3">
            <div className="relative">
              <textarea
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe your imagination... (e.g., Majestic sovereign cybernetic lion with glowing gold runes, cinematic 8k, Hasselblad 85mm...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#121624] border border-[#232C42] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none pr-32 chat-scroll-area"
              />

              {/* In-prompt quick actions */}
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                <button
                  onClick={handleRandomizePrompt}
                  title="Randomize Prompt Idea"
                  className="px-2 py-1 rounded-lg bg-[#1A2033] hover:bg-[#252E49] text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors border border-[#2B354F]"
                >
                  <Dices className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Dice</span>
                </button>

                <button
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancing || !prompt.trim()}
                  title="Prompt Enhance (Silicon Valley Magic Expansion)"
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs flex items-center gap-1 transition-all disabled:opacity-50 shadow-sm"
                >
                  <Wand2 className={`w-3.5 h-3.5 text-yellow-300 ${isEnhancing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Enhance</span>
                </button>
              </div>
            </div>

            {/* Bottom row of Prompt Dock: Model Tags & Main Generate Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto py-0.5 text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded bg-[#131826] border border-[#20273B] text-slate-300">
                  Model: <span className="text-cyan-300 font-semibold">{selectedModel}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#131826] border border-[#20273B] text-slate-300">
                  Style: <span className="text-purple-300 font-semibold">{selectedStyle}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#131826] border border-[#20273B] text-slate-300">
                  Aspect: <span className="text-amber-300 font-semibold">{selectedAspect}</span>
                </span>
              </div>

              {/* Generate Button with Token Indicator */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-sm font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing ({imageCount}x)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 border border-white/20 text-amber-200">
                      ⚡ {tokenCost} Tokens
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Subheader: Filter Navigation Tabs */}
          <div className="px-4 py-2.5 border-b border-[#1A1F2D] bg-[#090C14] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 bg-[#121624] p-1 rounded-xl border border-[#21283C]">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'feed'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Generation Feed ({galleryItems.length})
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  activeTab === 'favorites'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                <span>Favorites ({galleryItems.filter((i) => i.isFavorite).length})</span>
              </button>
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  activeTab === 'architecture'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3 h-3 text-purple-400" />
                <span>T2I Architecture Guide</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 hidden sm:block">
              {filteredItems.length} generations stored in database
            </div>
          </div>

          {/* Center Content View: Gallery OR Architecture Guide */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 chat-scroll-area">
            {activeTab === 'architecture' ? (
              /* Silicon Valley T2I Architecture Breakdown */
              <div className="max-w-4xl mx-auto space-y-6 text-slate-200 py-4 animate-in fade-in">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#121624] to-[#0A0D15] border border-cyan-500/30 shadow-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Silicon Valley Grade T2I Engine Architecture</h2>
                      <p className="text-xs text-slate-400">
                        Detailed breakdown of Latent Diffusion Models (LDM), Flow Matching, and Multi-modal Vision Transformers
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Modern state-of-the-art visual generation systems (such as Midjourney v6.1, Flux 1.1 Pro, and Google Imagen 3) operate on compressed continuous latent representations rather than raw pixel matrices. This achieves high computational throughput while preserving fine visual aesthetics.
                  </p>
                </div>

                {/* 4 Pillars of Silicon Valley Grade T2I */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0E1320] border border-[#1E263A]">
                    <div className="flex items-center gap-2 mb-2 text-cyan-400 font-bold text-sm">
                      <Layers className="w-4 h-4" />
                      <span>1. Variational Autoencoders (VAE) Latents</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Images are compressed 8x (e.g. from 1024x1024x3 to 128x128x4) through high-frequency preserving VAE encoders. The reverse diffusion denoising happens entirely inside this latent manifold, saving 64x GPU FLOPs.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0E1320] border border-[#1E263A]">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-sm">
                      <Zap className="w-4 h-4" />
                      <span>2. Rectified Flow / Flow Matching</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Unlike standard DDPM or ancestral Euler samplers, Flux 1.1 uses linear vector trajectories in probability space (Flow Matching). This produces sharper details, crisp text rendering, and anatomically accurate extremities in under 28 steps.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0E1320] border border-[#1E263A]">
                    <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold text-sm">
                      <Wand2 className="w-4 h-4" />
                      <span>3. Dual Conditioning (CLIP + T5-XXL)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Two complementary language models encode user prompts: OpenAI CLIP-L extracts broad aesthetic and compositional semantics, while Google T5-XXL (4.7B params) extracts dense spatial logic, text tokens, and entity relationships.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0E1320] border border-[#1E263A]">
                    <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-sm">
                      <Sparkles className="w-4 h-4" />
                      <span>4. Aesthetic Reward & LoRA Adapters</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Like Leonardo AI and Midjourney, custom Low-Rank Adaptation (LoRA) matrices and Direct Preference Optimization (DPO) are applied to steer colors, skin specular highlights, and cinematic camera optics.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#121624] border border-[#232C42] flex items-center justify-between">
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-white">Ready to create?</span> Switch to the Generation Feed or adjust the sidebar parameters to synthesize images.
                  </div>
                  <button
                    onClick={() => setActiveTab('feed')}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
                  >
                    Open Generation Feed
                  </button>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              /* Empty State */
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-[#121622] border border-[#21283B] flex items-center justify-center text-slate-400 mb-4">
                  <Sparkles className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">No generations in this view</h3>
                <p className="text-xs max-w-sm text-slate-400 mb-4">
                  Enter a prompt in the dock above and click Generate to unleash the RaOne Vision Studio Latent Diffusion engine.
                </p>
                <button
                  onClick={handleRandomizePrompt}
                  className="px-4 py-2 rounded-xl bg-[#171D2B] hover:bg-[#202739] text-xs text-cyan-300 border border-cyan-500/30 transition-colors"
                >
                  🎲 Try a sample prompt
                </button>
              </div>
            ) : (
              /* Image Grid (Leonardo AI Masonry style) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedImage(item)}
                    className="group relative rounded-2xl overflow-hidden bg-[#101420] border border-[#1E2538] hover:border-cyan-500/60 transition-all duration-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.25)] cursor-pointer flex flex-col"
                  >
                    {/* Image Preview Container */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                      <img
                        src={item.imageUrl}
                        alt={item.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-[10px] font-semibold text-cyan-300 border border-cyan-500/30 pointer-events-auto">
                          {item.model}
                        </span>
                        <div className="flex items-center gap-1 pointer-events-auto">
                          {item.upscaled && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-900/80 text-purple-200 text-[9px] font-bold border border-purple-500/40">
                              4K
                            </span>
                          )}
                          <button
                            onClick={(e) => handleToggleFavorite(item.id, e)}
                            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur flex items-center justify-center transition-colors text-white"
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                item.isFavorite ? 'text-red-500 fill-red-500' : 'text-slate-300'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Hover Overlay with Leonardo Quick Actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                        <div className="flex items-center justify-between gap-1.5 pt-2">
                          <button
                            onClick={(e) => handleRemix(item, e)}
                            title="Remix with these parameters"
                            className="px-2 py-1 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Remix</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleUpscale(item.id, e)}
                              title="Upscale 4x Ultra Clarity"
                              className="p-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white transition-colors"
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleCopyPrompt(item.prompt, item.id, e)}
                              title="Copy Prompt"
                              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-slate-200 transition-colors"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={(e) => handleDeleteImage(item.id, e)}
                              title="Delete"
                              className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="p-3 bg-[#0C101A] flex-1 flex flex-col justify-between">
                      <p className="text-xs text-slate-300 line-clamp-2 mb-2 font-normal leading-relaxed">
                        {item.prompt}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-[#1C2233] pt-2">
                        <span>{item.dimensions}</span>
                        <span>CFG: {item.cfgScale}</span>
                        <span>Seed: {item.seed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Lightbox / High-Res Inspect Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[92vh] bg-[#0C101B] border border-[#232C42] rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl"
          >
            {/* Left Image Large View */}
            <div className="flex-1 bg-black/80 flex items-center justify-center p-4 min-h-[300px] overflow-hidden relative">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.prompt}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="md:hidden absolute top-3 right-3 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Right Details Panel */}
            <div className="w-full md:w-96 p-5 bg-[#0F1422] border-t md:border-t-0 md:border-l border-[#232C42] flex flex-col justify-between overflow-y-auto chat-scroll-area">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Image Metadata</span>
                    {selectedImage.upscaled && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                        4x Upscaled
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="hidden md:flex w-7 h-7 rounded-lg bg-[#182033] hover:bg-[#25314D] text-slate-300 hover:text-white items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Prompt display with copy button */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Prompt</span>
                    <button
                      onClick={() => handleCopyPrompt(selectedImage.prompt, selectedImage.id)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedId === selectedImage.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === selectedImage.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-200 bg-[#080B12] p-2.5 rounded-xl border border-[#1A2234] leading-relaxed">
                    {selectedImage.prompt}
                  </p>
                </div>

                {/* Negative Prompt */}
                {selectedImage.negativePrompt && (
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Negative Prompt</span>
                    <p className="text-[11px] text-slate-400 bg-[#080B12] p-2 rounded-lg border border-[#1A2234]">
                      {selectedImage.negativePrompt}
                    </p>
                  </div>
                )}

                {/* Grid of specs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#080B12] border border-[#1A2234]">
                    <span className="text-slate-500 block text-[10px]">Model</span>
                    <span className="font-semibold text-cyan-300 truncate block">{selectedImage.model}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#080B12] border border-[#1A2234]">
                    <span className="text-slate-500 block text-[10px]">Style</span>
                    <span className="font-semibold text-purple-300 truncate block">{selectedImage.style}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#080B12] border border-[#1A2234]">
                    <span className="text-slate-500 block text-[10px]">Dimensions</span>
                    <span className="font-semibold text-slate-200">{selectedImage.dimensions}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#080B12] border border-[#1A2234]">
                    <span className="text-slate-500 block text-[10px]">Aspect Ratio</span>
                    <span className="font-semibold text-slate-200">{selectedImage.aspectRatio}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#080B12] border border-[#1A2234]">
                    <span className="text-slate-500 block text-[10px]">CFG Guidance</span>
                    <span className="font-semibold text-amber-300">{selectedImage.cfgScale}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#080B12] border border-[#1A2234]">
                    <span className="text-slate-500 block text-[10px]">Seed</span>
                    <span className="font-semibold text-slate-200">{selectedImage.seed}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal */}
              <div className="mt-5 space-y-2 pt-3 border-t border-[#1E2538]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpscale(selectedImage.id)}
                    className="py-2 px-3 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>4x Upscale</span>
                  </button>

                  <button
                    onClick={() => handleRemix(selectedImage)}
                    className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Remix</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={selectedImage.imageUrl}
                    download={`raone-vision-${selectedImage.id}.png`}
                    className="flex-1 py-2 rounded-xl bg-[#182033] hover:bg-[#25314D] text-slate-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-[#2B3754]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>

                  <button
                    onClick={() => handleToggleFavorite(selectedImage.id)}
                    className={`p-2 rounded-xl border transition-colors ${
                      selectedImage.isFavorite
                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-[#182033] border-[#2B3754] text-slate-300 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${selectedImage.isFavorite ? 'fill-red-400' : ''}`} />
                  </button>

                  <button
                    onClick={() => handleDeleteImage(selectedImage.id)}
                    className="p-2 rounded-xl bg-red-950/40 border border-red-800/40 text-red-400 hover:bg-red-900/60 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
