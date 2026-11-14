import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
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
  Upload,
  Brush,
  Columns2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Share2,
  X,
  ExternalLink,
  Layers,
  Undo2,
  Loader2,
  Globe,
} from 'lucide-react';
import type {
  GeneratedImageItem,
  VisionCameraSpec,
  VisionDarkroomAdjustments,
} from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  type WorkspaceTurn,
  type WorkspaceRightTab,
} from './UnifiedStudioWorkspace';
import { VisionParameterDrawer } from './VisionParameterDrawer';
import { VisionMaskCanvas, exportGradedImageDataUrl } from './VisionMaskCanvas';
import { VisionCompareSlider } from './VisionCompareSlider';
import {
  VISION_MODELS,
  ENHANCER_MODES,
  ALL_STYLE_PRESETS,
  ASPECT_RATIO_OPTIONS,
  BEGINNER_TEMPLATES,
  DEFAULT_DARKROOM,
} from '../data/visionPresets.ts';

interface LeonardoVisionStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeonardoVisionStudio: React.FC<LeonardoVisionStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');

  // Creation / Editing workflow state
  const [composerMode, setComposerMode] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'blurry, low resolution, deformed, bad anatomy, artifacts, watermark'
  );
  const [selectedModel, setSelectedModel] = useState(VISION_MODELS[0].id);
  const [selectedStyle, setSelectedStyle] = useState('Cinematic Photoreal');
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageCount, setImageCount] = useState<number>(2);
  const [cfgScale, setCfgScale] = useState<number>(7.5);
  const [steps, setSteps] = useState<number>(40);
  const [seed, setSeed] = useState<string>('');
  const [photoReal, setPhotoReal] = useState<boolean>(true);
  const [alchemy, setAlchemy] = useState<boolean>(true);
  const [promptMagic, setPromptMagic] = useState<boolean>(true);
  const [googleSearchGrounding, setGoogleSearchGrounding] = useState<boolean>(false);
  const [cameraSpec, setCameraSpec] = useState<VisionCameraSpec>({
    shotType: 'Auto',
    lens: 'Auto',
    aperture: 'Auto',
    lighting: 'Auto',
    atmosphere: 'Auto',
    colorGrade: 'Auto',
    composition: 'Auto',
  });

  // Edit & Reference attachments
  const [editOperation, setEditOperation] = useState<string>('edit');
  const [preservationStrength, setPreservationStrength] = useState<number>(75);
  const [uploadedSourceImage, setUploadedSourceImage] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [maskOverlayDataUrl, setMaskOverlayDataUrl] = useState<string | null>(null);
  const [maskStrokeCount, setMaskStrokeCount] = useState<number>(0);

  // Enhancer state
  const [enhancerMode, setEnhancerMode] = useState<string>('auto');
  const [enhancedPreview, setEnhancedPreview] = useState<{
    original: string;
    enhanced: string;
    negative: string;
    provider: string;
    breakdown?: { subject: string; camera: string; lighting: string; mood: string };
  } | null>(null);
  const [lastEnhancedFrom, setLastEnhancedFrom] = useState<string | undefined>(undefined);

  // Darkroom & Stage view state
  const [isMaskMode, setIsMaskMode] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [darkroom, setDarkroom] = useState<VisionDarkroomAdjustments>(DEFAULT_DARKROOM);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');

  // Persistence & UI feedback
  const [tokens, setTokens] = useState<number>(150);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);

  const [galleryItems, setGalleryItems] = useState<GeneratedImageItem[]>([]);
  const [batchItems, setBatchItems] = useState<GeneratedImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [filesFilter, setFilesFilter] = useState<'all' | 'favorites' | 'generated' | 'edited'>('all');
  const [fileSearch, setFileSearch] = useState('');

  const uploadSourceRef = useRef<HTMLInputElement>(null);
  const uploadRefImgRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/vision/history');
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setGalleryItems(data.items);
      }
    } catch {
      // ignore initial load error
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  // Active source image for Text-to-Image editing (either explicitly uploaded photo or selected generated image)
  const activeEditBaseUrl = uploadedSourceImage || selectedImage?.imageUrl || null;

  // Parent image for Before/After comparison slider
  const parentCompareImage = useMemo(() => {
    if (!selectedImage) return null;
    if (selectedImage.parentId) {
      const match = galleryItems.find((i) => i.id === selectedImage.parentId);
      if (match) return match.imageUrl;
    }
    if (selectedImage.sourceImageUrl) return selectedImage.sourceImageUrl;
    return null;
  }, [selectedImage, galleryItems]);

  // Related version lineage tree for current image
  const versionLineage = useMemo(() => {
    if (!selectedImage) return [];
    const rootId = selectedImage.rootId || selectedImage.id;
    const related = galleryItems.filter(
      (item) => item.id === rootId || item.rootId === rootId || item.id === selectedImage.id
    );
    return related.sort((a, b) => (a.version || 1) - (b.version || 1));
  }, [selectedImage, galleryItems]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });

  const handleSourceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image (PNG, JPG, WebP).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploadedItem: GeneratedImageItem = {
        id: `upload-${Date.now()}`,
        rootId: `upload-${Date.now()}`,
        version: 1,
        operationType: 'generate',
        prompt: `Uploaded Photo: ${file.name}`,
        model: 'Uploaded Asset',
        style: selectedStyle,
        aspectRatio: selectedAspect,
        dimensions: 'Original',
        cfgScale,
        steps,
        seed: 0,
        imageUrl: dataUrl,
        createdAt: new Date().toISOString(),
      };
      setUploadedSourceImage(dataUrl);
      setSelectedImage(uploadedItem);
      setBatchItems([uploadedItem]);
      setComposerMode('edit');
      setRightTab('preview');
      showToast('Photo loaded onto stage. Type an edit or paint a mask!');
    } catch {
      showToast('Could not read uploaded image.');
    }
  };

  const handleReferenceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setReferenceImages((prev) => [...prev.slice(-2), dataUrl]);
      showToast('Reference image attached.');
    } catch {
      showToast('Failed to read reference image.');
    }
  };

  const handleEnhancePrompt = async () => {
    const clean = prompt.trim();
    if (!clean || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/vision/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: clean,
          mode: enhancerMode,
          style: selectedStyle,
          cameraSpec,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.enhancedPrompt) {
        setEnhancedPreview({
          original: clean,
          enhanced: data.enhancedPrompt,
          negative: data.suggestedNegativePrompt || negativePrompt,
          provider: data.providerUsed || 'prompt-architect',
          breakdown: data.breakdown,
        });
        showToast('Enhanced prompt ready — review & apply!');
      } else {
        showToast(data?.error || 'Prompt enhancement unavailable.');
      }
    } catch {
      showToast('Prompt enhancer request failed.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const applyEnhancedPrompt = () => {
    if (!enhancedPreview) return;
    setLastEnhancedFrom(enhancedPreview.original);
    setPrompt(enhancedPreview.enhanced);
    if (enhancedPreview.negative) setNegativePrompt(enhancedPreview.negative);
    setEnhancedPreview(null);
    showToast('Enhanced prompt & negative prompt applied.');
  };

  const handleSubmitPrompt = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isGenerating) return;

    const shouldEdit = (composerMode === 'edit' || isMaskMode || !!maskOverlayDataUrl) && !!activeEditBaseUrl;
    const tierCost = resolution === '4K' ? 4 : resolution === '2K' ? 3 : 2;
    const creditEstimate = shouldEdit ? tierCost : imageCount * tierCost;
    if (tokens < creditEstimate) {
      setTokens(150);
    }

    const startMs = Date.now();
    setTurns((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}`,
        role: 'user',
        content: shouldEdit
          ? `[${maskOverlayDataUrl ? 'Mask Inpaint' : 'Image Edit'}] ${cleanPrompt}`
          : cleanPrompt,
      },
    ]);
    setPrompt('');
    setEnhancedPreview(null);
    setIsGenerating(true);

    try {
      if (shouldEdit && activeEditBaseUrl) {
        const res = await fetch('/api/vision/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: cleanPrompt,
            sourceImage: activeEditBaseUrl,
            parentId: selectedImage?.id?.startsWith('upload-') ? null : selectedImage?.id,
            rootId: selectedImage?.rootId || selectedImage?.id,
            parentVersion: selectedImage?.version || 1,
            maskImage: maskOverlayDataUrl || undefined,
            referenceImages,
            operationType: maskOverlayDataUrl ? 'inpaint' : editOperation,
            preservationStrength,
            model: selectedModel,
            style: selectedStyle,
            aspectRatio: selectedAspect,
            resolution,
            negativePrompt,
            seed: seed ? parseInt(seed, 10) : Math.floor(Math.random() * 90000000) + 10000000,
            cameraSpec,
          }),
        });
        const data = await res.json().catch(() => ({}));
        const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
        if (res.ok && data.item) {
          const editedItem = data.item as GeneratedImageItem;
          setGalleryItems((prev) => [editedItem, ...prev]);
          setBatchItems([editedItem]);
          setSelectedImage(editedItem);
          setUploadedSourceImage(null);
          setIsMaskMode(false);
          setMaskOverlayDataUrl(null);
          setMaskStrokeCount(0);
          setTokens((prev) => Math.max(0, prev - tierCost));
          setRightTab('preview');
          setTurns((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              modelLabel: editedItem.engineModelUsed || selectedModel,
              durationSec: elapsed,
              content: `Completed ${editedItem.operationType === 'inpaint' ? 'mask inpaint' : 'image edit'} (v${editedItem.version || 2}) at ${editedItem.dimensions}.`,
              details: [
                `Preservation: ${preservationStrength}% · Resolution: ${editedItem.resolution || resolution}`,
                editedItem.aiNotes ? `Vision note: ${editedItem.aiNotes}` : `Seed: ${editedItem.seed}`,
              ],
            },
          ]);
        } else {
          showToast(data?.error || 'Image edit failed.');
          setTurns((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              role: 'assistant',
              modelLabel: 'Vision Engine',
              content: data?.error || 'Image editing could not complete.',
            },
          ]);
        }
      } else {
        const res = await fetch('/api/vision/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPrompt,
            enhancedFrom: lastEnhancedFrom,
            negativePrompt,
            model: selectedModel,
            style: selectedStyle,
            aspectRatio: selectedAspect,
            resolution,
            cfgScale,
            steps,
            seed: seed ? parseInt(seed, 10) : Math.floor(Math.random() * 90000000) + 10000000,
            alchemy,
            photoReal,
            promptMagic,
            googleSearchGrounding,
            cameraSpec,
            referenceImages,
            count: imageCount,
          }),
        });
        const data = await res.json().catch(() => ({}));
        const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
        if (res.ok && Array.isArray(data.items) && data.items.length > 0) {
          setGalleryItems((prev) => [...data.items, ...prev]);
          setBatchItems(data.items);
          setSelectedImage(data.items[0]);
          setUploadedSourceImage(null);
          setLastEnhancedFrom(undefined);
          setDarkroom(DEFAULT_DARKROOM);
          setIsCompareMode(false);
          setTokens((prev) => Math.max(0, prev - imageCount * tierCost));
          setRightTab('preview');
          setTurns((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              modelLabel: data.items[0].engineModelUsed || selectedModel,
              durationSec: elapsed,
              content: `Generated ${data.items.length} render(s) in ${data.items[0].dimensions} (${selectedStyle}).`,
              details: [
                `Seed: ${data.items[0].seed} · Res: ${resolution} · Aspect: ${selectedAspect}`,
                cameraSpec.lens && cameraSpec.lens !== 'Auto'
                  ? `Camera: ${cameraSpec.lens}${cameraSpec.lighting && cameraSpec.lighting !== 'Auto' ? ` · ${cameraSpec.lighting}` : ''}`
                  : `Pipeline: ${photoReal ? 'PhotoReal' : 'Standard'}${alchemy ? ' + Alchemy' : ''}`,
              ],
            },
          ]);
        } else {
          showToast(data?.error || 'Image generation failed.');
          setTurns((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              role: 'assistant',
              modelLabel: 'Vision Engine',
              content: data?.error || 'Generation returned an error.',
            },
          ]);
        }
      }
    } catch {
      showToast('Network error during Vision synthesis.');
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
        const update = (arr: GeneratedImageItem[]) =>
          arr.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item));
        setGalleryItems(update);
        setBatchItems(update);
        if (selectedImage?.id === id) {
          setSelectedImage((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
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
        if (selectedImage?.id === id) setSelectedImage(null);
        showToast('Render deleted.');
      }
    } catch {
      showToast('Delete failed.');
    }
  };

  const handleUpscale = async (targetRes: '2K' | '4K' = '4K') => {
    if (!selectedImage || isUpscaling) return;
    setIsUpscaling(true);
    showToast(`Remastering to ${targetRes} Ultra Clarity...`);
    try {
      const res = await fetch('/api/vision/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedImage.id,
          targetResolution: targetRes,
          sourceImage: selectedImage.imageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.item) {
        const up = data.item as GeneratedImageItem;
        setGalleryItems((prev) => [up, ...prev]);
        setBatchItems([up]);
        setSelectedImage(up);
        showToast(`Upscaled cleanly to ${up.dimensions} (${targetRes}).`);
      } else {
        showToast(data?.error || 'AI Upscale failed.');
      }
    } catch {
      showToast('Upscale request failed.');
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleSharePublish = async () => {
    if (!selectedImage || isPublishing) {
      showToast('Generate or select an image first.');
      return;
    }
    setIsPublishing(true);
    try {
      const res = await fetch('/api/vision/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedImage.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.publishMeta?.shareUrl) {
        const fullUrl = `${window.location.origin}${data.publishMeta.shareUrl}`;
        setShareModalUrl(fullUrl);
        navigator.clipboard?.writeText(fullUrl).catch(() => {});
        showToast('Public showcase URL ready & copied!');
      } else {
        navigator.clipboard?.writeText(selectedImage.prompt).catch(() => {});
        showToast('Image prompt copied to clipboard.');
      }
    } catch {
      showToast('Share failed.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDownloadGraded = async (item: GeneratedImageItem, fmt = exportFormat) => {
    try {
      const hasDarkroomEdits =
        darkroom.brightness !== 100 ||
        darkroom.contrast !== 100 ||
        darkroom.saturation !== 100 ||
        darkroom.warmth !== 0 ||
        darkroom.sharpness !== 0 ||
        darkroom.vignette !== 0 ||
        darkroom.flipH ||
        darkroom.flipV ||
        fmt !== 'png';

      const href = hasDarkroomEdits
        ? await exportGradedImageDataUrl(item.imageUrl, darkroom, fmt)
        : item.imageUrl;

      const a = document.createElement('a');
      a.href = href;
      a.download = `raone-vision-${item.id}.${fmt}`;
      a.click();
      showToast(`Exported ${fmt.toUpperCase()} render.`);
    } catch {
      const a = document.createElement('a');
      a.href = item.imageUrl;
      a.download = `raone-vision-${item.id}.png`;
      a.click();
    }
  };

  const handleRemixItem = (item: GeneratedImageItem) => {
    setPrompt(item.prompt);
    if (item.negativePrompt) setNegativePrompt(item.negativePrompt);
    setSelectedModel(item.model);
    setSelectedStyle(item.style);
    setSelectedAspect(item.aspectRatio);
    if (item.resolution) setResolution(item.resolution);
    setCfgScale(item.cfgScale);
    setSteps(item.steps);
    setSeed(String(item.seed));
    if (item.cameraSpec) setCameraSpec(item.cameraSpec);
    showToast('Loaded full visual recipe into composer.');
  };

  const resetAllParameters = () => {
    setSelectedStyle('Cinematic Photoreal');
    setSelectedAspect('16:9');
    setResolution('1K');
    setImageCount(2);
    setCfgScale(7.5);
    setSteps(40);
    setSeed('');
    setPhotoReal(true);
    setAlchemy(true);
    setPromptMagic(true);
    setGoogleSearchGrounding(false);
    setCameraSpec({
      shotType: 'Auto',
      lens: 'Auto',
      aperture: 'Auto',
      lighting: 'Auto',
      atmosphere: 'Auto',
      colorGrade: 'Auto',
      composition: 'Auto',
    });
    setDarkroom(DEFAULT_DARKROOM);
    showToast('Reset all parameters to defaults.');
  };

  // Unobstructed Darkroom Main Preview Stage
  const previewContent = selectedImage ? (
    <div className="h-full flex flex-col p-3 md:p-5 gap-3 max-w-6xl mx-auto w-full">
      {/* Top Version Lineage Pills (Only appears when edits/upscales exist) */}
      {versionLineage.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          <span className="inline-flex items-center gap-1 text-[11px] text-[#8E918F] mr-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-[#8AB4F8]" />
            Versions:
          </span>
          {versionLineage.map((ver) => (
            <button
              key={ver.id}
              type="button"
              onClick={() => {
                setSelectedImage(ver);
                setIsCompareMode(false);
              }}
              className={`px-2.5 py-0.5 rounded-md border text-[11px] shrink-0 transition-colors ${
                selectedImage.id === ver.id
                  ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white font-medium'
                  : 'bg-[#191A1D] border-[#2B2D32] text-[#9AA0A6] hover:text-white'
              }`}
            >
              v{ver.version || 1} · {ver.operationType || 'gen'}
            </button>
          ))}
        </div>
      )}

      {/* Main Clean Image Canvas Stage */}
      <div className="flex-1 min-h-[300px] rounded-2xl bg-[#131416] border border-[#26282D] overflow-hidden flex items-center justify-center relative p-3">
        {isCompareMode && parentCompareImage ? (
          <VisionCompareSlider
            beforeUrl={parentCompareImage}
            afterUrl={selectedImage.imageUrl}
            beforeLabel={`v${Math.max(1, (selectedImage.version || 2) - 1)} Original`}
            afterLabel={`v${selectedImage.version || 2} ${selectedImage.operationType || 'Edited'}`}
            alt={selectedImage.prompt}
          />
        ) : (
          <VisionMaskCanvas
            imageUrl={selectedImage.imageUrl}
            alt={selectedImage.prompt}
            isMaskMode={isMaskMode}
            darkroom={darkroom}
            zoomPct={zoomPct}
            maskStrokeCount={maskStrokeCount}
            onMaskChange={(maskData, count) => {
              setMaskOverlayDataUrl(maskData);
              setMaskStrokeCount(count);
              if (count > 0) setComposerMode('edit');
            }}
          />
        )}

        {/* Quick Floating Zoom Micro-Controls */}
        {!isCompareMode && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#18191C]/90 backdrop-blur border border-[#2E3036] rounded-lg px-1.5 py-1 text-[11px] text-[#C4C7C5]">
            <button
              type="button"
              onClick={() => setZoomPct((z) => Math.max(50, z - 25))}
              className="p-1 hover:text-white"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 font-mono tabular-nums">{zoomPct}%</span>
            <button
              type="button"
              onClick={() => setZoomPct((z) => Math.min(200, z + 25))}
              className="p-1 hover:text-white"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomPct !== 100 && (
              <button
                type="button"
                onClick={() => setZoomPct(100)}
                className="p-1 hover:text-white"
                title="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact Stage Micro-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#18191C] border border-[#282A2E] rounded-xl px-3.5 py-2">
        <div className="flex items-center gap-2 text-xs text-[#9AA0A6] tabular-nums min-w-0">
          <span className="text-[#E3E3E3] font-medium truncate max-w-[165px]">
            {selectedImage.engineModelUsed || selectedImage.model}
          </span>
          <span>·</span>
          <span>{selectedImage.dimensions}</span>
          <span>·</span>
          <span>Seed {selectedImage.seed}</span>
          {selectedImage.upscaled && (
            <span className="px-1.5 py-0.5 rounded bg-[#8AB4F8]/15 text-[#8AB4F8] text-[10px] font-medium">
              {selectedImage.resolution || '4K'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Edit This Image Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setComposerMode('edit');
              setIsMaskMode(false);
              setIsCompareMode(false);
              showToast('Edit Mode active — describe any change on the left.');
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              composerMode === 'edit' && !isMaskMode
                ? 'bg-[#2B3340] border-[#8AB4F8]/50 text-white'
                : 'bg-[#252629] border-transparent hover:bg-[#303236] text-[#E3E3E3]'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>Edit</span>
          </button>

          {/* Mask Inpaint Brush Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isMaskMode;
              setIsMaskMode(next);
              setIsCompareMode(false);
              if (next) {
                setComposerMode('edit');
                showToast('Paint a region on the image, then describe what to replace/add.');
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isMaskMode
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                : 'bg-[#252629] border-transparent hover:bg-[#303236] text-[#E3E3E3]'
            }`}
          >
            <Brush className="w-3.5 h-3.5" />
            <span>{maskStrokeCount > 0 ? `Mask (${maskStrokeCount})` : 'Mask Brush'}</span>
          </button>

          {/* Before / After Compare Toggle */}
          {parentCompareImage && (
            <button
              type="button"
              onClick={() => {
                setIsCompareMode((p) => !p);
                setIsMaskMode(false);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isCompareMode
                  ? 'bg-[#2B3340] border-[#8AB4F8]/50 text-white'
                  : 'bg-[#252629] border-transparent hover:bg-[#303236] text-[#E3E3E3]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span>Compare</span>
            </button>
          )}

          {/* 4K Upscale */}
          <button
            type="button"
            onClick={() => handleUpscale('4K')}
            disabled={isUpscaling}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs font-medium text-[#E3E3E3] disabled:opacity-50"
          >
            {isUpscaling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8AB4F8]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-[#8AB4F8]" />
            )}
            <span>4K Upscale</span>
          </button>

          {/* Copy Prompt */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(selectedImage.prompt);
              setCopiedId(selectedImage.id);
              setTimeout(() => setCopiedId(null), 1500);
            }}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
            title="Copy Prompt"
          >
            {copiedId === selectedImage.id ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Favorite */}
          <button
            type="button"
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

          {/* Export Format + Download */}
          <div className="inline-flex items-center rounded-lg overflow-hidden bg-[#2B2D30] border border-[#3A3C42]">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
              className="bg-transparent text-[11px] text-[#C4C7C5] pl-2 pr-1 py-1.5 focus:outline-none uppercase"
              title="Export format"
            >
              <option value="png" className="bg-[#1E1F20]">PNG</option>
              <option value="jpeg" className="bg-[#1E1F20]">JPG</option>
              <option value="webp" className="bg-[#1E1F20]">WEBP</option>
            </select>
            <button
              type="button"
              onClick={() => handleDownloadGraded(selectedImage)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#32353B] hover:bg-[#3D4048] text-xs font-medium text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleDeleteImage(selectedImage.id)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-red-950/60 text-[#9AA0A6] hover:text-red-400"
            title="Delete render"
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
              type="button"
              onClick={() => {
                setSelectedImage(item);
                setIsCompareMode(false);
              }}
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

  // </> Recipe Inspector Tab
  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white">Compiled Generation Recipe & Telemetry</span>
          <div className="flex items-center gap-2">
            {selectedImage && (
              <button
                type="button"
                onClick={() => handleRemixItem(selectedImage)}
                className="px-2.5 py-1 rounded-md bg-[#262930] hover:bg-[#31353D] text-[11px] text-[#8AB4F8]"
              >
                Load into Composer
              </button>
            )}
            <span className="text-[11px] text-[#8E918F] tabular-nums">{tokens} / 150 Credits</span>
          </div>
        </div>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto max-h-[380px]">
          {JSON.stringify(
            selectedImage || {
              composerMode,
              model: selectedModel,
              style: selectedStyle,
              aspectRatio: selectedAspect,
              resolution,
              cameraSpec,
              cfgScale,
              steps,
              photoReal,
              alchemy,
              promptMagic,
              googleSearchGrounding,
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
          <span>RaOne Vision Multimodal Synthesis Engine</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. Nano Banana 2.1 & Flash Lite Routing</div>
            Fast 1K drafts route to Gemini 3.1 Flash Image; 2K/4K Ultra, ultra-wide ratios, Web Grounding, and Mask Edits route to Nano Banana 2.1.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. Canvas Brush Mask Inpainting</div>
            HTML5 dual-layer canvas paints target edits onto source pixels cleanly without leaving the stage.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">3. Bilingual 2-Word Prompt Architect</div>
            Converts short English or Singlish descriptions into multi-layered lens, lighting, and negative directives.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">4. Tenant-Isolated Binary Asset Store</div>
            High-res PNG/JPEG assets stream via immutable asset URLs while keeping version lineage lightweight.
          </div>
        </div>
      </div>
    </div>
  );

  // Files Gallery Tab
  const visibleGallery = galleryItems.filter((item) => {
    const matchFilter =
      filesFilter === 'all'
        ? true
        : filesFilter === 'favorites'
        ? Boolean(item.isFavorite)
        : filesFilter === 'edited'
        ? Boolean(item.operationType && item.operationType !== 'generate')
        : !item.operationType || item.operationType === 'generate';

    const matchSearch =
      !fileSearch.trim() ||
      item.prompt.toLowerCase().includes(fileSearch.toLowerCase()) ||
      item.model.toLowerCase().includes(fileSearch.toLowerCase()) ||
      item.style.toLowerCase().includes(fileSearch.toLowerCase());

    return matchFilter && matchSearch;
  });

  const filesContent = (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          {[
            { id: 'all' as const, label: `All (${galleryItems.length})` },
            { id: 'generated' as const, label: 'Created' },
            { id: 'edited' as const, label: 'Edited' },
            { id: 'favorites' as const, label: `Favorites (${galleryItems.filter((i) => i.isFavorite).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilesFilter(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filesFilter === tab.id ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
          <input
            type="text"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="Search prompts, styles, models..."
            className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none focus:border-[#4A4D54] w-60"
          />
        </div>
      </div>

      {visibleGallery.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No renders match this filter yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visibleGallery.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedImage(item);
                setBatchItems([item]);
                setIsCompareMode(false);
                setIsMaskMode(false);
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
                {item.version && item.version > 1 && (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-medium text-[#8AB4F8]">
                    v{item.version} · {item.operationType}
                  </span>
                )}
                <button
                  type="button"
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
              <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                <p className="text-xs text-[#E3E3E3] line-clamp-2">{item.prompt}</p>
                <div className="flex items-center justify-between text-[11px] text-[#8E918F] tabular-nums pt-1">
                  <span className="truncate">{item.style}</span>
                  <span>{item.dimensions}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Collapsible 8-Category Controls Drawer (Hidden cleanly until Edit/Controls opened)
  const editDrawerContent = (
    <VisionParameterDrawer
      tokens={tokens}
      onResetTokens={() => setTokens(150)}
      selectedStyle={selectedStyle}
      onSelectStyle={setSelectedStyle}
      selectedAspect={selectedAspect}
      onSelectAspect={setSelectedAspect}
      resolution={resolution}
      onResolutionChange={setResolution}
      imageCount={imageCount}
      onImageCountChange={setImageCount}
      cameraSpec={cameraSpec}
      onCameraSpecChange={(patch) => setCameraSpec((prev) => ({ ...prev, ...patch }))}
      cfgScale={cfgScale}
      onCfgScaleChange={setCfgScale}
      steps={steps}
      onStepsChange={setSteps}
      seed={seed}
      onSeedChange={setSeed}
      negativePrompt={negativePrompt}
      onNegativePromptChange={setNegativePrompt}
      photoReal={photoReal}
      onPhotoRealChange={setPhotoReal}
      alchemy={alchemy}
      onAlchemyChange={setAlchemy}
      promptMagic={promptMagic}
      onPromptMagicChange={setPromptMagic}
      googleSearchGrounding={googleSearchGrounding}
      onGoogleSearchGroundingChange={setGoogleSearchGrounding}
      editOperation={editOperation}
      onEditOperationChange={setEditOperation}
      preservationStrength={preservationStrength}
      onPreservationStrengthChange={setPreservationStrength}
      darkroom={darkroom}
      onDarkroomChange={(patch) => setDarkroom((prev) => ({ ...prev, ...patch }))}
      onResetDarkroom={() => setDarkroom(DEFAULT_DARKROOM)}
      onResetAllParameters={resetAllParameters}
    />
  );

  // "+" Quick Attach / Enhancer / Starter Templates Popover
  const composerAddContent = (
    <div className="space-y-3">
      {/* Hidden File Inputs */}
      <input
        ref={uploadSourceRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleSourceFileUpload}
        className="hidden"
      />
      <input
        ref={uploadRefImgRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleReferenceFileUpload}
        className="hidden"
      />

      {/* Quick Mode + Upload Actions */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => uploadSourceRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Upload Photo to Edit</span>
        </button>

        <button
          type="button"
          onClick={() => uploadRefImgRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Attach Reference ({referenceImages.length}/3)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const tpl = BEGINNER_TEMPLATES[Math.floor(Math.random() * BEGINNER_TEMPLATES.length)];
            setPrompt(tpl.prompt);
            setSelectedStyle(tpl.style);
            setSelectedAspect(tpl.aspect);
            setComposerMode('generate');
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-amber-400" />
          <span>Random Idea</span>
        </button>
      </div>

      {/* Prompt Enhancer Bar */}
      <div className="p-2.5 rounded-xl bg-[#131416] border border-[#2C2D30] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#E3E3E3] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#8AB4F8]" />
            Smart Prompt Enhancer
          </span>
          <button
            type="button"
            onClick={handleEnhancePrompt}
            disabled={!prompt.trim() || isEnhancing}
            className="px-2.5 py-1 rounded-md bg-[#8AB4F8] hover:bg-[#A0C3FA] text-[#111214] text-[11px] font-semibold disabled:opacity-40"
          >
            {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {ENHANCER_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEnhancerMode(m.id)}
              title={m.hint}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                enhancerMode === m.id
                  ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                  : 'bg-[#1B1C1E] border-[#2C2D30] text-[#9AA0A6] hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Style & Aspect Select */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedStyle}
          onChange={(e) => setSelectedStyle(e.target.value)}
          className="bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-[#E3E3E3]"
        >
          {ALL_STYLE_PRESETS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={selectedAspect}
          onChange={(e) => setSelectedAspect(e.target.value)}
          className="bg-[#131314] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-[#E3E3E3]"
        >
          {ASPECT_RATIO_OPTIONS.map((a) => (
            <option key={a.id} value={a.id}>{a.id} ({a.dim})</option>
          ))}
        </select>
      </div>

      {/* Beginner 1-Click Templates */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[#8E918F] mb-1">
          Quick Starter Ideas
        </div>
        <div className="flex flex-wrap gap-1">
          {BEGINNER_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => {
                setPrompt(tpl.prompt);
                setSelectedStyle(tpl.style);
                setSelectedAspect(tpl.aspect);
                setComposerMode('generate');
              }}
              className="px-2 py-1 rounded bg-[#1A1B1E] hover:bg-[#26282E] border border-[#2C2D30] text-[10px] text-[#C4C7C5]"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Compact Composer Footer Bar (Mode Toggle + Inline Enhance Pill + Attached Ref Chips)
  const composerExtraFooter = (
    <div className="space-y-2 mb-2">
      {/* Inline Enhanced Prompt Preview Card */}
      {enhancedPreview && (
        <div className="p-2.5 rounded-xl bg-[#181C24] border border-[#8AB4F8]/40 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8AB4F8] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Enhanced by {enhancedPreview.provider}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={applyEnhancedPrompt}
                className="px-2 py-0.5 rounded bg-[#8AB4F8] text-[#111214] font-semibold text-[10px]"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setEnhancedPreview(null)}
                className="p-0.5 text-[#8E918F] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="text-[#E3E3E3] leading-relaxed text-[11px]">{enhancedPreview.enhanced}</p>
        </div>
      )}

      {/* Active Mode Pills + Quick Inline Enhance Button */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-1 bg-[#16171A] p-0.5 rounded-lg border border-[#2C2D32]">
          <button
            type="button"
            onClick={() => setComposerMode('generate')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              composerMode === 'generate'
                ? 'bg-[#2B2D30] text-white font-medium'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Create
          </button>
          <button
            type="button"
            disabled={!activeEditBaseUrl}
            onClick={() => setComposerMode('edit')}
            title={activeEditBaseUrl ? 'Edit active/uploaded image with text' : 'Generate or upload an image first'}
            className={`px-2 py-0.5 rounded-md transition-colors disabled:opacity-35 ${
              composerMode === 'edit'
                ? 'bg-[#2B3340] text-[#8AB4F8] font-medium'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            {maskStrokeCount > 0 ? `Inpaint (${maskStrokeCount})` : 'Edit Active'}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleEnhancePrompt}
            disabled={!prompt.trim() || isEnhancing}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1B1D22] hover:bg-[#252830] border border-[#30333B] text-[11px] text-[#8AB4F8] disabled:opacity-40"
            title="Expand short keywords into a studio-grade prompt"
          >
            {isEnhancing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            <span>Enhance</span>
          </button>
          <button
            type="button"
            onClick={() => uploadSourceRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1B1D22] hover:bg-[#252830] border border-[#30333B] text-[11px] text-[#C4C7C5]"
            title="Upload photo to edit"
          >
            <Upload className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Reference / Edit Source Chips */}
      {(referenceImages.length > 0 || (composerMode === 'edit' && activeEditBaseUrl)) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {composerMode === 'edit' && activeEditBaseUrl && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2B3340] border border-[#8AB4F8]/40 text-[#E3E3E3]">
              <Brush className="w-3 h-3 text-[#8AB4F8]" />
              Editing {maskStrokeCount > 0 ? 'Painted Mask Region' : selectedImage?.id?.startsWith('upload-') ? 'Uploaded Photo' : 'Stage Render'}
              <button
                type="button"
                onClick={() => {
                  setComposerMode('generate');
                  setUploadedSourceImage(null);
                  setIsMaskMode(false);
                }}
                className="ml-0.5 text-[#8E918F] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {referenceImages.map((_, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E2420] border border-emerald-500/30 text-emerald-200"
            >
              Ref #{idx + 1}
              <button
                type="button"
                onClick={() => setReferenceImages((prev) => prev.filter((__, i) => i !== idx))}
                className="text-emerald-300/70 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // Header Center Resolution/Web Pill
  const headerCenterExtra = (
    <div className="flex items-center gap-1.5 mr-1">
      <button
        type="button"
        onClick={() => setResolution((r) => (r === '1K' ? '2K' : r === '2K' ? '4K' : '1K'))}
        className="px-2 py-0.5 rounded bg-[#25272D] hover:bg-[#30333B] text-[10px] font-mono text-[#8AB4F8] border border-[#353840]"
        title="Click to cycle output resolution (1K / 2K / 4K)"
      >
        {resolution}
      </button>
      {googleSearchGrounding && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-[10px] text-emerald-300"
          title="Web & Image Grounding enabled"
        >
          <Globe className="w-2.5 h-2.5" />
          Web
        </span>
      )}
    </div>
  );

  // Live Streaming Progress Card while generating/editing
  const streamingFeedCard = isGenerating ? (
    <div className="p-3 rounded-xl bg-[#1A1C20] border border-[#2E323A] text-xs space-y-2">
      <div className="flex items-center gap-2 text-[#E3E3E3] font-medium">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8AB4F8]" />
        <span>
          {composerMode === 'edit'
            ? maskOverlayDataUrl
              ? 'Applying mask-guided generative inpaint...'
              : 'Synthesizing image edit...'
            : `Synthesizing ${imageCount} render(s) at ${resolution} (${selectedAspect})...`}
        </span>
      </div>
      <div className="text-[11px] text-[#8E918F]">
        Style: {selectedStyle} · Engine: {selectedModel}
      </div>
    </div>
  ) : null;

  // Share Modal Overlay
  const modalOverlay = shareModalUrl ? (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#18191C] border border-[#2E3138] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#8AB4F8]" />
            Share Render Showcase
          </h3>
          <button
            type="button"
            onClick={() => setShareModalUrl(null)}
            className="p-1 rounded-lg text-[#8E918F] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#9AA0A6]">
          Anyone with this link can view the full artwork, prompt recipe, and download the render.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareModalUrl}
            className="flex-1 bg-[#111214] border border-[#2C2E34] rounded-lg px-3 py-2 text-xs text-[#E3E3E3] font-mono focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(shareModalUrl).catch(() => {});
              showToast('Copied showcase link.');
            }}
            className="px-3 py-2 rounded-lg bg-[#2B2D32] hover:bg-[#383B42] text-xs text-white"
          >
            Copy
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <a
            href={shareModalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#8AB4F8] text-[#111214] text-xs font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Showcase
          </a>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Vision Studio"
      workspaceTitle={
        selectedImage ? selectedImage.prompt.slice(0, 56) : 'Untitled Workspace'
      }
      modelOptions={VISION_MODELS}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={handleSubmitPrompt}
      isGenerating={isGenerating}
      turns={turns}
      onResetWorkspace={() => {
        setSelectedImage(null);
        setUploadedSourceImage(null);
        setBatchItems([]);
        setTurns([]);
        setPrompt('');
        setReferenceImages([]);
        setMaskOverlayDataUrl(null);
        setMaskStrokeCount(0);
        setIsMaskMode(false);
        setIsCompareMode(false);
        setComposerMode('generate');
        setRightTab('preview');
        showToast('Started fresh Vision workspace.');
      }}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={
        selectedImage
          ? `/vision/${selectedImage.id}${composerMode === 'edit' ? '/edit' : ''}`
          : '/'
      }
      onRefresh={fetchHistory}
      onRemix={() => {
        if (selectedImage) {
          handleRemixItem(selectedImage);
        } else {
          const tpl = BEGINNER_TEMPLATES[0];
          setPrompt(tpl.prompt);
          setSelectedStyle(tpl.style);
          setSelectedAspect(tpl.aspect);
          showToast('Sample studio prompt loaded.');
        }
      }}
      onShare={handleSharePublish}
      onPublish={() => {
        if (selectedImage) {
          handleDownloadGraded(selectedImage);
        } else {
          showToast('Generate, upload, or select an image first.');
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
      composerExtraFooter={composerExtraFooter}
      headerCenterExtra={headerCenterExtra}
      streamingFeedCard={streamingFeedCard}
      modalOverlay={modalOverlay}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Describe any image (even 2 words!) or upload a photo to edit effortlessly."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
    />
  );
};
