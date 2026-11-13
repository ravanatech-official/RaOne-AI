import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Maximize2,
  Download,
  Copy,
  Trash2,
  Heart,
  Wand2,
  Check,
  Dices,
  Search,
  ImageIcon,
  Cpu,
} from 'lucide-react';
import { GeneratedImageItem } from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
} from './UnifiedStudioWorkspace';

interface LeonardoVisionStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const T2I_MODELS = [
  { id: 'Flux 1.1 Pro (LDM)', label: 'Flux 1.1 Pro', description: 'Black Forest Labs · Rectified Flow Photoreal' },
  { id: 'Midjourney v6.1 Aesthetics', label: 'Midjourney v6.1', description: 'Cinematic framing & aesthetic gold' },
  { id: 'Google Imagen 3 Ultra', label: 'Imagen 3 Ultra', description: 'DeepMind cascading text & spatial accuracy' },
  { id: 'DALL-E 3 Precision', label: 'DALL-E 3', description: 'Dense semantic prompt compliance' },
  { id: 'Leonardo Diffusion XL', label: 'Leonardo XL', description: 'Studio concept art & lighting' },
  { id: 'Stable Diffusion 3.5 Large', label: 'SD 3.5 Large', description: 'MMDiT dual-encoder architecture' },
];

const STYLE_PRESETS = [
  'Cinematic Photoreal',
  'Ray Traced 3D',
  'High Fashion Concept',
  'Architectural Digest',
  'Anime Illustration',
  'Concept Art',
  'Dark Fantasy',
  'Macro Photography',
];

const ASPECT_RATIOS = [
  { id: '16:9', dim: '1344x768' },
  { id: '1:1', dim: '1024x1024' },
  { id: '9:16', dim: '768x1344' },
  { id: '4:3', dim: '1152x864' },
  { id: '3:4', dim: '864x1152' },
  { id: '21:9', dim: '1536x640' },
];

const RANDOM_PROMPTS = [
  'A sovereign cybernetic lion with glowing gold circuitry walking through mist-covered ancient Sigiriya ruins, cinematic 8k, volumetric light beams',
  'Futuristic crystalline spacecraft docking at an orbital quantum space station above Earth during sunrise, shot on 70mm IMAX',
  'Cyberpunk street food market in rainy Colombo 2077, vibrant neon reflections, shallow depth of field, Hasselblad portrait',
  'Sleek matte-black hypercar driving on a suspended highway above a futuristic metropolis at twilight, anamorphic streaks',
];

export const LeonardoVisionStudio: React.FC<LeonardoVisionStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'blurry, low resolution, deformed, bad anatomy, artifacts, text watermark'
  );
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

  const [tokens, setTokens] = useState<number>(150);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [galleryItems, setGalleryItems] = useState<GeneratedImageItem[]>([]);
  const [batchItems, setBatchItems] = useState<GeneratedImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [filesFilter, setFilesFilter] = useState<'all' | 'favorites'>('all');
  const [fileSearch, setFileSearch] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/vision/history');
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setGalleryItems(data.items);
      }
    } catch {
      // ignore initial fetch error
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const tokenCost =
    imageCount * (photoReal ? 3 : 2) + (alchemy ? 2 : 0) + (promptMagic ? 1 : 0);

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
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
        showToast('Prompt enhanced.');
      }
    } catch {
      showToast('Failed to enhance prompt.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isGenerating) return;

    if (tokens < tokenCost) {
      setTokens(150);
      showToast('Fast tokens replenished to 150.');
    }

    const startMs = Date.now();
    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: cleanPrompt },
    ]);
    setPrompt('');
    setIsGenerating(true);

    try {
      const aspectObj = ASPECT_RATIOS.find((a) => a.id === selectedAspect);
      const dimensions = aspectObj ? aspectObj.dim : '1344x768';

      const res = await fetch('/api/vision/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          negativePrompt,
          model: selectedModel,
          style: selectedStyle,
          aspectRatio: selectedAspect,
          dimensions,
          cfgScale,
          steps,
          seed: seed
            ? parseInt(seed, 10)
            : Math.floor(Math.random() * 90000000) + 10000000,
          alchemy,
          photoReal,
          promptMagic,
          count: imageCount,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      if (Array.isArray(data.items) && data.items.length > 0) {
        setGalleryItems((prev) => [...data.items, ...prev]);
        setBatchItems(data.items);
        setSelectedImage(data.items[0]);
        setTokens((prev) => Math.max(0, prev - tokenCost));
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: selectedModel,
            durationSec: elapsed,
            content: `Synthesized ${data.items.length} image variation(s) in ${dimensions} (${selectedStyle}).`,
            details: [
              `Seed: ${data.items[0].seed} · CFG: ${cfgScale} · Steps: ${steps}`,
              `Pipeline: ${photoReal ? 'PhotoReal v2' : 'Standard'}${alchemy ? ' + Alchemy v2' : ''}`,
            ],
          },
        ]);
      } else {
        showToast(data?.error || 'Image synthesis failed.');
      }
    } catch {
      showToast('Error during image synthesis.');
    } finally {
      setIsGenerating(false);
    }
  };

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
          prev.map((item) =>
            item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
          )
        );
        setBatchItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
          )
        );
        if (selectedImage?.id === id) {
          setSelectedImage((prev) =>
            prev ? { ...prev, isFavorite: !prev.isFavorite } : null
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteImage = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/vision/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setGalleryItems((prev) => prev.filter((item) => item.id !== id));
        setBatchItems((prev) => prev.filter((item) => item.id !== id));
        if (selectedImage?.id === id) {
          setSelectedImage(null);
        }
        showToast('Image deleted.');
      }
    } catch {
      showToast('Delete failed.');
    }
  };

  const handleUpscale = async (id: string) => {
    showToast('Upscaling 4x Ultra Clarity...');
    try {
      const res = await fetch('/api/vision/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setGalleryItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, upscaled: true, dimensions: data.item.dimensions }
              : item
          )
        );
        if (selectedImage?.id === id) {
          setSelectedImage((prev) =>
            prev
              ? { ...prev, upscaled: true, dimensions: data.item.dimensions }
              : null
          );
        }
        showToast('Upscaled to 4K resolution.');
      }
    } catch {
      showToast('Upscale failed.');
    }
  };

  const handleRemixItem = (item: GeneratedImageItem) => {
    setPrompt(item.prompt);
    if (item.negativePrompt) setNegativePrompt(item.negativePrompt);
    setSelectedModel(item.model);
    setSelectedStyle(item.style);
    setSelectedAspect(item.aspectRatio);
    setCfgScale(item.cfgScale);
    setSteps(item.steps);
    setSeed(String(item.seed));
    showToast('Loaded parameters into composer for remix.');
  };

  const downloadImage = (item: GeneratedImageItem) => {
    const a = document.createElement('a');
    a.href = item.imageUrl;
    a.download = `raone-vision-${item.id}.png`;
    a.click();
  };

  const previewContent = selectedImage ? (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 max-w-5xl mx-auto w-full">
      <div className="flex-1 min-h-[280px] rounded-2xl bg-[#161719] border border-[#282A2E] overflow-hidden flex items-center justify-center relative p-3">
        <img
          src={selectedImage.imageUrl}
          alt={selectedImage.prompt}
          referrerPolicy="no-referrer"
          className="max-h-[64vh] w-auto max-w-full object-contain rounded-lg"
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18191C] border border-[#282A2E] rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[#9AA0A6] tabular-nums min-w-0">
          <span className="text-[#E3E3E3] font-medium truncate max-w-[200px]">
            {selectedImage.model}
          </span>
          <span>·</span>
          <span>{selectedImage.dimensions}</span>
          <span>·</span>
          <span>Seed {selectedImage.seed}</span>
          {selectedImage.upscaled && (
            <>
              <span>·</span>
              <span className="text-[#8AB4F8]">4K Upscaled</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleUpscale(selectedImage.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs font-medium text-[#E3E3E3]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>4x Upscale</span>
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedImage.prompt);
              setCopiedId(selectedImage.id);
              setTimeout(() => setCopiedId(null), 1500);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs font-medium text-[#E3E3E3]"
          >
            {copiedId === selectedImage.id ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>Prompt</span>
          </button>
          <button
            onClick={() => handleToggleFavorite(selectedImage.id)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
            title="Favorite"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                selectedImage.isFavorite ? 'fill-rose-500 text-rose-500' : ''
              }`}
            />
          </button>
          <button
            onClick={() => downloadImage(selectedImage)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          <button
            onClick={() => handleDeleteImage(selectedImage.id)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-red-950/60 text-[#9AA0A6] hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Batch Variations Strip */}
      {batchItems.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 chat-scroll-area">
          {batchItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedImage(item)}
              className={`w-24 h-14 rounded-lg overflow-hidden border shrink-0 transition-all ${
                selectedImage.id === item.id
                  ? 'border-[#8AB4F8] ring-1 ring-[#8AB4F8]'
                  : 'border-[#282A2E] opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={item.imageUrl}
                alt={item.prompt}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white">Active Diffusion Parameters (JSON)</span>
          <span className="text-[11px] text-[#8E918F] tabular-nums">{tokens} / 150 Fast Tokens</span>
        </div>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto">
          {JSON.stringify(
            selectedImage || {
              model: selectedModel,
              style: selectedStyle,
              aspectRatio: selectedAspect,
              cfgScale,
              steps,
              photoReal,
              alchemy,
              promptMagic,
              negativePrompt,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Cpu className="w-4 h-4 text-[#8AB4F8]" />
          <span>Latent Diffusion Pipeline Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. Variational Autoencoder (VAE)</div>
            Compresses pixel space 8x into continuous latent tensors for ultra-fast denoising.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. Rectified Flow Matching</div>
            Straight vector probability trajectories yield crisp text and anatomy in 28-40 steps.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">3. Dual CLIP + T5-XXL Conditioning</div>
            Pairs compositional aesthetics with dense spatial token alignment.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">4. ControlNet, IP-Adapter & LoRA</div>
            Supports pose/depth guidance, character face lock, and custom fine-tuned adapters.
          </div>
        </div>
      </div>
    </div>
  );

  const visibleGallery = galleryItems.filter((item) => {
    const matchFav = filesFilter === 'all' || item.isFavorite;
    const matchSearch =
      !fileSearch.trim() ||
      item.prompt.toLowerCase().includes(fileSearch.toLowerCase()) ||
      item.model.toLowerCase().includes(fileSearch.toLowerCase());
    return matchFav && matchSearch;
  });

  const filesContent = (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          <button
            onClick={() => setFilesFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filesFilter === 'all' ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            All Generations ({galleryItems.length})
          </button>
          <button
            onClick={() => setFilesFilter('favorites')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filesFilter === 'favorites'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Favorites ({galleryItems.filter((i) => i.isFavorite).length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
          <input
            type="text"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="Search images..."
            className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none focus:border-[#4A4D54] w-56"
          />
        </div>
      </div>

      {visibleGallery.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No saved images yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visibleGallery.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedImage(item);
                setBatchItems([item]);
                setRightTab('preview');
              }}
              className="group rounded-xl overflow-hidden bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer flex flex-col"
            >
              <div className="relative aspect-video bg-black overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.prompt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  onClick={(e) => handleToggleFavorite(item.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      item.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-xs text-[#E3E3E3] line-clamp-2">{item.prompt}</p>
                <div className="flex items-center justify-between text-[11px] text-[#8E918F] tabular-nums">
                  <span className="truncate">{item.model}</span>
                  <span>{item.dimensions}</span>
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
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E1F20] border border-[#2C2D30] text-xs">
        <span className="flex items-center gap-1.5 text-[#E3E3E3]">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="tabular-nums">{tokens} / 150 Tokens</span>
        </span>
        <button
          onClick={() => setTokens(150)}
          className="text-[11px] text-[#8AB4F8] hover:underline"
        >
          Reset
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Number of Images
        </label>
        <div className="grid grid-cols-4 gap-1 bg-[#1B1C1E] p-1 rounded-lg border border-[#2C2D30]">
          {[1, 2, 3, 4].map((num) => (
            <button
              key={num}
              onClick={() => setImageCount(num)}
              className={`py-1 rounded text-xs font-medium tabular-nums ${
                imageCount === num ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Style Preset
        </label>
        <select
          value={selectedStyle}
          onChange={(e) => setSelectedStyle(e.target.value)}
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        >
          {STYLE_PRESETS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-3 gap-1.5">
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

      <div className="space-y-2 p-3 rounded-lg bg-[#1B1C1E] border border-[#2C2D30]">
        {[
          { label: 'PhotoReal v2', val: photoReal, set: setPhotoReal },
          { label: 'Alchemy v2', val: alchemy, set: setAlchemy },
          { label: 'Prompt Magic v3', val: promptMagic, set: setPromptMagic },
        ].map((t) => (
          <div key={t.label} className="flex items-center justify-between text-xs">
            <span className="text-[#E3E3E3]">{t.label}</span>
            <button
              onClick={() => t.set(!t.val)}
              className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
                t.val ? 'bg-[#8AB4F8] justify-end' : 'bg-[#34363A] justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-[#131314]" />
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#C4C7C5]">CFG Scale</span>
          <span className="font-mono text-[#8AB4F8] tabular-nums">{cfgScale}</span>
        </div>
        <input
          type="range"
          min="1"
          max="15"
          step="0.5"
          value={cfgScale}
          onChange={(e) => setCfgScale(Number(e.target.value))}
          className="w-full accent-[#8AB4F8]"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#C4C7C5]">Inference Steps</span>
          <span className="font-mono text-[#8AB4F8] tabular-nums">{steps}</span>
        </div>
        <input
          type="range"
          min="15"
          max="60"
          step="5"
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
          className="w-full accent-[#8AB4F8]"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1">
          Negative Prompt
        </label>
        <textarea
          rows={2}
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg p-2 text-xs text-[#E3E3E3] focus:outline-none resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1">
          Seed (optional)
        </label>
        <input
          type="text"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Random"
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
        />
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
          <span>{isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}</span>
        </button>

        <button
          onClick={() => {
            setPrompt(RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)]);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Inspiration</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedStyle}
          onChange={(e) => setSelectedStyle(e.target.value)}
          className="bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-[#E3E3E3]"
        >
          {STYLE_PRESETS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={selectedAspect}
          onChange={(e) => setSelectedAspect(e.target.value)}
          className="bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-[#E3E3E3]"
        >
          {ASPECT_RATIOS.map((a) => (
            <option key={a.id} value={a.id}>{a.id} ({a.dim})</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Vision Studio"
      workspaceTitle={
        selectedImage ? selectedImage.prompt.slice(0, 56) : 'Untitled Workspace'
      }
      modelOptions={T2I_MODELS}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={handleGenerate}
      isGenerating={isGenerating}
      turns={turns}
      onResetWorkspace={() => {
        setSelectedImage(null);
        setBatchItems([]);
        setTurns([]);
        setPrompt('');
        setRightTab('preview');
        showToast('Started empty workspace.');
      }}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={selectedImage ? `/vision/${selectedImage.id}` : '/'}
      onRefresh={fetchHistory}
      onRemix={() => {
        if (selectedImage) {
          handleRemixItem(selectedImage);
        } else {
          setPrompt(RANDOM_PROMPTS[0]);
          showToast('Sample prompt loaded.');
        }
      }}
      onShare={() => {
        if (selectedImage) {
          navigator.clipboard?.writeText(selectedImage.prompt).catch(() => {});
          showToast('Image prompt copied.');
        } else {
          showToast('Workspace ready.');
        }
      }}
      onPublish={() => {
        if (selectedImage) {
          downloadImage(selectedImage);
        } else {
          showToast('Generate or select an image first.');
        }
      }}
      publishLabel="Download"
      filesCount={galleryItems.length}
      hasActiveItem={!!selectedImage}
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Describe an image on the left to generate, or browse saved renders."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
    />
  );
};
