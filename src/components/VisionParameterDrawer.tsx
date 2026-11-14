import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  RotateCcw,
  Zap,
  Palette,
  Maximize,
  Camera,
  Sun,
  Sparkles,
  Sliders,
  Brush,
  SunMedium,
} from 'lucide-react';
import type { VisionCameraSpec, VisionDarkroomAdjustments } from '../types/index.ts';
import {
  STYLE_GROUPS,
  ASPECT_RATIO_OPTIONS,
  RESOLUTION_TIERS,
  CAMERA_SHOTS,
  LENS_OPTIONS,
  APERTURE_OPTIONS,
  LIGHTING_PRESETS,
  ATMOSPHERE_PRESETS,
  COLOR_GRADES,
  COMPOSITION_RULES,
  EDIT_OPERATIONS,
} from '../data/visionPresets.ts';

interface VisionParameterDrawerProps {
  tokens: number;
  onResetTokens: () => void;
  selectedStyle: string;
  onSelectStyle: (v: string) => void;
  selectedAspect: string;
  onSelectAspect: (v: string) => void;
  resolution: '1K' | '2K' | '4K';
  onResolutionChange: (v: '1K' | '2K' | '4K') => void;
  imageCount: number;
  onImageCountChange: (v: number) => void;
  cameraSpec: VisionCameraSpec;
  onCameraSpecChange: (patch: Partial<VisionCameraSpec>) => void;
  cfgScale: number;
  onCfgScaleChange: (v: number) => void;
  steps: number;
  onStepsChange: (v: number) => void;
  seed: string;
  onSeedChange: (v: string) => void;
  negativePrompt: string;
  onNegativePromptChange: (v: string) => void;
  photoReal: boolean;
  onPhotoRealChange: (v: boolean) => void;
  alchemy: boolean;
  onAlchemyChange: (v: boolean) => void;
  promptMagic: boolean;
  onPromptMagicChange: (v: boolean) => void;
  googleSearchGrounding: boolean;
  onGoogleSearchGroundingChange: (v: boolean) => void;
  editOperation: string;
  onEditOperationChange: (v: string) => void;
  preservationStrength: number;
  onPreservationStrengthChange: (v: number) => void;
  darkroom: VisionDarkroomAdjustments;
  onDarkroomChange: (patch: Partial<VisionDarkroomAdjustments>) => void;
  onResetDarkroom: () => void;
  onResetAllParameters: () => void;
}

type CategoryKey =
  | 'style'
  | 'canvas'
  | 'camera'
  | 'lighting'
  | 'color'
  | 'engine'
  | 'editing'
  | 'darkroom';

export const VisionParameterDrawer: React.FC<VisionParameterDrawerProps> = ({
  tokens,
  onResetTokens,
  selectedStyle,
  onSelectStyle,
  selectedAspect,
  onSelectAspect,
  resolution,
  onResolutionChange,
  imageCount,
  onImageCountChange,
  cameraSpec,
  onCameraSpecChange,
  cfgScale,
  onCfgScaleChange,
  steps,
  onStepsChange,
  seed,
  onSeedChange,
  negativePrompt,
  onNegativePromptChange,
  photoReal,
  onPhotoRealChange,
  alchemy,
  onAlchemyChange,
  promptMagic,
  onPromptMagicChange,
  googleSearchGrounding,
  onGoogleSearchGroundingChange,
  editOperation,
  onEditOperationChange,
  preservationStrength,
  onPreservationStrengthChange,
  darkroom,
  onDarkroomChange,
  onResetDarkroom,
  onResetAllParameters,
}) => {
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<CategoryKey, boolean>>({
    style: true,
    canvas: true,
    camera: false,
    lighting: false,
    color: false,
    engine: false,
    editing: false,
    darkroom: false,
  });

  const toggleCategory = (key: CategoryKey) => {
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const q = search.trim().toLowerCase();
  const matches = (keywords: string) => !q || keywords.toLowerCase().includes(q);

  const renderSectionHeader = (
    key: CategoryKey,
    icon: React.ReactNode,
    title: string,
    activeSummary?: string
  ) => {
    const isOpen = q ? true : openCategories[key];
    return (
      <button
        type="button"
        onClick={() => toggleCategory(key)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#1E2024] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#8AB4F8] shrink-0">{icon}</span>
          <span className="text-xs font-medium text-[#E3E3E3] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {activeSummary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#25272D] text-[#9AA0A6] max-w-[96px] truncate">
              {activeSummary}
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#8E918F]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#8E918F]" />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Fast Token Counter */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E1F20] border border-[#2C2D30] text-xs">
        <span className="flex items-center gap-1.5 text-[#E3E3E3]">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="tabular-nums">{tokens} / 150 Credits</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetTokens}
            className="text-[11px] text-[#8AB4F8] hover:underline"
          >
            Replenish
          </button>
          <button
            type="button"
            onClick={onResetAllParameters}
            className="inline-flex items-center gap-1 text-[11px] text-[#9AA0A6] hover:text-white"
            title="Reset all image parameters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Parameter Quick Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter parameters (lens, 4K, neon, bokeh...)"
          className="w-full bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none focus:border-[#4A4D54]"
        />
      </div>

      {/* 1. Style & Aesthetic Category */}
      {matches('style medium aesthetic photoreal anime 3d art cyberpunk editorial') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader('style', <Palette className="w-3.5 h-3.5" />, '1. Style & Medium', selectedStyle)}
          {(q || openCategories.style) && (
            <div className="px-3 pb-3 pt-1 border-t border-[#24262B] space-y-2.5">
              {STYLE_GROUPS.map((grp) => (
                <div key={grp.group}>
                  <div className="text-[10px] uppercase tracking-wider text-[#8E918F] mb-1">
                    {grp.group}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {grp.styles.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => onSelectStyle(st)}
                        className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                          selectedStyle === st
                            ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                            : 'bg-[#1E1F23] border-[#2C2E35] text-[#B4B8BF] hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Canvas, Aspect Ratio & Resolution Category */}
      {matches('aspect ratio resolution size 1k 2k 4k dimensions batch count') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'canvas',
            <Maximize className="w-3.5 h-3.5" />,
            '2. Aspect Ratio & Quality',
            `${selectedAspect} · ${resolution}`
          )}
          {(q || openCategories.canvas) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-3">
              <div>
                <div className="text-[11px] text-[#C4C7C5] mb-1.5">Resolution Tier</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RESOLUTION_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onResolutionChange(tier.id)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        resolution === tier.id
                          ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                          : 'bg-[#1E1F23] border-[#2C2E35] text-[#9AA0A6] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-medium">{tier.label}</div>
                      <div className="text-[9px] opacity-75">{tier.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-[#C4C7C5] mb-1.5">Aspect Ratio</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ASPECT_RATIO_OPTIONS.map((ar) => (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => onSelectAspect(ar.id)}
                      className={`px-2 py-1.5 rounded-lg border text-left transition-colors flex items-center justify-between ${
                        selectedAspect === ar.id
                          ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                          : 'bg-[#1E1F23] border-[#2C2E35] text-[#9AA0A6] hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-mono font-medium">{ar.label}</span>
                      <span className="text-[10px] opacity-75 truncate">{ar.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-[#C4C7C5] mb-1">Batch Count</div>
                <div className="grid grid-cols-4 gap-1 bg-[#131416] p-1 rounded-lg border border-[#2C2D30]">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onImageCountChange(num)}
                      className={`py-1 rounded text-xs font-medium tabular-nums ${
                        imageCount === num
                          ? 'bg-[#2B2D30] text-white'
                          : 'text-[#8E918F] hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Camera, Lens & Composition Category */}
      {matches('camera lens shot framing bokeh aperture depth composition portrait macro drone') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'camera',
            <Camera className="w-3.5 h-3.5" />,
            '3. Camera, Lens & Framing',
            cameraSpec.lens && cameraSpec.lens !== 'Auto' ? cameraSpec.lens : 'Auto'
          )}
          {(q || openCategories.camera) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-2.5">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Shot Type / Angle</label>
                <select
                  value={cameraSpec.shotType || 'Auto'}
                  onChange={(e) => onCameraSpecChange({ shotType: e.target.value })}
                  className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {CAMERA_SHOTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Focal Length / Lens</label>
                <select
                  value={cameraSpec.lens || 'Auto'}
                  onChange={(e) => onCameraSpecChange({ lens: e.target.value })}
                  className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {LENS_OPTIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#9AA0A6] block mb-1">Aperture</label>
                  <select
                    value={cameraSpec.aperture || 'Auto'}
                    onChange={(e) => onCameraSpecChange({ aperture: e.target.value })}
                    className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {APERTURE_OPTIONS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#9AA0A6] block mb-1">Composition</label>
                  <select
                    value={cameraSpec.composition || 'Auto'}
                    onChange={(e) => onCameraSpecChange({ composition: e.target.value })}
                    className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {COMPOSITION_RULES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Lighting & Atmosphere Category */}
      {matches('lighting sun neon golden hour softbox rim atmosphere mist fog rain') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'lighting',
            <Sun className="w-3.5 h-3.5" />,
            '4. Lighting & Atmosphere',
            cameraSpec.lighting && cameraSpec.lighting !== 'Auto' ? cameraSpec.lighting : 'Auto'
          )}
          {(q || openCategories.lighting) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-2.5">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Lighting Setup</label>
                <select
                  value={cameraSpec.lighting || 'Auto'}
                  onChange={(e) => onCameraSpecChange({ lighting: e.target.value })}
                  className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {LIGHTING_PRESETS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Atmosphere & Weather</label>
                <select
                  value={cameraSpec.atmosphere || 'Auto'}
                  onChange={(e) => onCameraSpecChange({ atmosphere: e.target.value })}
                  className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {ATMOSPHERE_PRESETS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Color Palette & Film Grading Category */}
      {matches('color grade film kodak portra teal orange noir monochrome pastel') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'color',
            <Sparkles className="w-3.5 h-3.5" />,
            '5. Color & Film Grading',
            cameraSpec.colorGrade && cameraSpec.colorGrade !== 'Auto' ? cameraSpec.colorGrade : 'Auto'
          )}
          {(q || openCategories.color) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-1.5">
              {COLOR_GRADES.map((cg) => (
                <button
                  key={cg}
                  type="button"
                  onClick={() => onCameraSpecChange({ colorGrade: cg })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    (cameraSpec.colorGrade || 'Auto') === cg
                      ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                      : 'bg-[#131416] border-[#26282E] text-[#B4B8BF] hover:text-white'
                  }`}
                >
                  {cg}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Engine, Seed & Search Grounding Category */}
      {matches('cfg steps seed negative prompt grounding search photoreal alchemy prompt magic') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'engine',
            <Sliders className="w-3.5 h-3.5" />,
            '6. Engine, Seed & Grounding',
            seed ? `Seed #${seed}` : `CFG ${cfgScale}`
          )}
          {(q || openCategories.engine) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-3">
              <div className="space-y-2 p-2.5 rounded-lg bg-[#131416] border border-[#26282E]">
                {[
                  { label: 'PhotoReal Optics', val: photoReal, set: onPhotoRealChange },
                  { label: 'Alchemy HDR Boost', val: alchemy, set: onAlchemyChange },
                  { label: 'Prompt Magic Auto-Bias', val: promptMagic, set: onPromptMagicChange },
                  {
                    label: 'Web & Image Grounding',
                    val: googleSearchGrounding,
                    set: onGoogleSearchGroundingChange,
                  },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between text-xs">
                    <span className="text-[#E3E3E3]">{t.label}</span>
                    <button
                      type="button"
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
                  <span className="text-[#C4C7C5]">CFG Adherence</span>
                  <span className="font-mono text-[#8AB4F8] tabular-nums">{cfgScale}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={0.5}
                  value={cfgScale}
                  onChange={(e) => onCfgScaleChange(Number(e.target.value))}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#C4C7C5]">Refinement Steps</span>
                  <span className="font-mono text-[#8AB4F8] tabular-nums">{steps}</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={60}
                  step={5}
                  value={steps}
                  onChange={(e) => onStepsChange(Number(e.target.value))}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[#C4C7C5]">Seed Lock</label>
                  <button
                    type="button"
                    onClick={() => onSeedChange('')}
                    className="text-[11px] text-[#8AB4F8] hover:underline"
                  >
                    Randomize
                  </button>
                </div>
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => onSeedChange(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Random every run"
                  className="w-full bg-[#131416] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#C4C7C5] block mb-1">Negative Prompt</label>
                <textarea
                  rows={2}
                  value={negativePrompt}
                  onChange={(e) => onNegativePromptChange(e.target.value)}
                  className="w-full bg-[#131416] border border-[#2F3135] rounded-lg p-2 text-xs text-[#E3E3E3] focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Image Edit & Mask Conditioning Category */}
      {matches('edit inpaint mask background remove restyle outpaint preservation strength') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'editing',
            <Brush className="w-3.5 h-3.5" />,
            '7. Edit & Inpaint Strategy',
            `${preservationStrength}% Keep`
          )}
          {(q || openCategories.editing) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                {EDIT_OPERATIONS.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => onEditOperationChange(op.id)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      editOperation === op.id
                        ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                        : 'bg-[#131416] border-[#26282E] text-[#B4B8BF] hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] font-medium">{op.label}</div>
                    <div className="text-[9px] text-[#8E918F] leading-tight mt-0.5">{op.desc}</div>
                  </button>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#C4C7C5]">Source Preservation</span>
                  <span className="font-mono text-[#8AB4F8] tabular-nums">{preservationStrength}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={95}
                  step={5}
                  value={preservationStrength}
                  onChange={(e) => onPreservationStrengthChange(Number(e.target.value))}
                  className="w-full accent-[#8AB4F8]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Client GPU Darkroom Color Adjust Category (0 AI Credits) */}
      {matches('darkroom brightness contrast saturation warmth sharpness vignette flip color filter') && (
        <div className="rounded-xl border border-[#282A2F] bg-[#18191C] overflow-hidden">
          {renderSectionHeader(
            'darkroom',
            <SunMedium className="w-3.5 h-3.5" />,
            '8. Darkroom Color Adjust',
            'Instant'
          )}
          {(q || openCategories.darkroom) && (
            <div className="px-3 pb-3 pt-2 border-t border-[#24262B] space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-[#8E918F]">
                <span>Real-time live preview (0 credits)</span>
                <button
                  type="button"
                  onClick={onResetDarkroom}
                  className="text-[#8AB4F8] hover:underline"
                >
                  Reset
                </button>
              </div>
              {[
                { label: 'Brightness', key: 'brightness' as const, min: 50, max: 150, val: darkroom.brightness, unit: '%' },
                { label: 'Contrast', key: 'contrast' as const, min: 50, max: 150, val: darkroom.contrast, unit: '%' },
                { label: 'Saturation', key: 'saturation' as const, min: 0, max: 200, val: darkroom.saturation, unit: '%' },
                { label: 'Warmth', key: 'warmth' as const, min: -40, max: 40, val: darkroom.warmth, unit: '' },
                { label: 'Crispness', key: 'sharpness' as const, min: 0, max: 80, val: darkroom.sharpness, unit: '' },
                { label: 'Vignette', key: 'vignette' as const, min: 0, max: 80, val: darkroom.vignette, unit: '%' },
              ].map((s) => (
                <div key={s.key}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-[#C4C7C5]">{s.label}</span>
                    <span className="font-mono text-[#8AB4F8] tabular-nums">
                      {s.val}{s.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    value={s.val}
                    onChange={(e) => onDarkroomChange({ [s.key]: Number(e.target.value) })}
                    className="w-full accent-[#8AB4F8]"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onDarkroomChange({ flipH: !darkroom.flipH })}
                  className={`py-1 rounded-md border text-[11px] ${
                    darkroom.flipH
                      ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                      : 'bg-[#131416] border-[#2C2E35] text-[#B4B8BF]'
                  }`}
                >
                  Flip Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => onDarkroomChange({ flipV: !darkroom.flipV })}
                  className={`py-1 rounded-md border text-[11px] ${
                    darkroom.flipV
                      ? 'bg-[#2B3340] border-[#8AB4F8]/60 text-white'
                      : 'bg-[#131416] border-[#2C2E35] text-[#B4B8BF]'
                  }`}
                >
                  Flip Vertical
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
