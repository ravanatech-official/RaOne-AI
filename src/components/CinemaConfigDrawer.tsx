import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Sliders,
  Camera,
  Aperture,
  Sun,
  Volume2,
  Image as ImageIcon,
  Film,
  Lock,
  Unlock,
  RotateCcw,
  Dices,
  Upload,
  X,
} from 'lucide-react';
import {
  DEFAULT_CINEMA_CONFIG,
  type CinemaConfig,
  type CinemaEditPreset,
  type CinemaEnhancerMode,
  type CinemaGenerationMode,
  type CinemaResolutionTier,
} from '../types/cinema.ts';

interface CinemaConfigDrawerProps {
  config: CinemaConfig;
  onChange: (next: CinemaConfig) => void;
  startKeyframe: string | null;
  endKeyframe: string | null;
  storyboardRefs: string[];
  onStartKeyframeChange: (val: string | null) => void;
  onEndKeyframeChange: (val: string | null) => void;
  onStoryboardRefsChange: (refs: string[]) => void;
  onUploadSourceVideo: (file: File) => void;
  hasSelectedVideo: boolean;
}

const CAMERA_MOTIONS = [
  'Fly Through Forward',
  'Dolly In Dramatic',
  'Dolly Out Reveal',
  'Pan Right & Tilt Up',
  'Pan Left Smooth',
  'Orbit 360',
  'FPV Drone Swoop',
  'Crane Up High Angle',
  'Tilt Down Grounding',
  'Handheld Documentary',
  'Whip Pan Dynamic',
  'Static Camera (Tripod)',
];

const VISUAL_STYLES = [
  'Photorealistic Cinema',
  'Blockbuster Sci-Fi VFX',
  'Neo-Noir Thriller',
  'Theatrical Anime Sakuga',
  'Commercial Product Macro',
  'Luxury Automotive Shoot',
  'Aerial National Geographic',
  'Hyper-Real 3D Octane',
  'Stop-Motion Claymation',
  'Retro 80s VHS Cinema',
];

const LIGHTING_PRESETS = [
  'Volumetric Golden Hour',
  'Moody Chiaroscuro',
  'Cyberpunk Rain Neon',
  'Soft Overcast Daylight',
  'Studio High-Key Softbox',
  'Dramatic Rim & Silhouette',
  'Candlelight Warm Practical',
  'Blue Hour Twilight',
];

const COLOR_LUTS = [
  'Kodak 2383 Film Print',
  'Teal & Orange Blockbuster',
  'Neutral Natural Log',
  'Bleach Bypass Silver',
  'Warm Amber Nostalgia',
  'Crisp Commercial Clean',
  'Vivid Anime HDR',
  'High-Contrast Monochrome',
];

const WEATHER_OPTIONS = [
  'None / Clear',
  'Light Rain & Wet Reflections',
  'Volumetric Valley Mist',
  'Snowfall & Cold Breath',
  'Floating Embers & Sparks',
  'Desert Dust & Heat Haze',
  'Golden Dust Motes',
];

const EDIT_PRESETS: Array<{ id: CinemaEditPreset; label: string }> = [
  { id: 'custom', label: 'Custom Prompt Edit' },
  { id: 'restyle', label: 'Visual Restyle' },
  { id: 'object_swap', label: 'Object Replace' },
  { id: 'background_replace', label: 'Background Swap' },
  { id: 'weather_lighting', label: 'Weather / Lighting' },
  { id: 'character_swap', label: 'Character Swap' },
];

type SectionId = 'mode' | 'media' | 'camera' | 'optics' | 'look' | 'audio' | 'continuity';

export const CinemaConfigDrawer: React.FC<CinemaConfigDrawerProps> = ({
  config,
  onChange,
  startKeyframe,
  endKeyframe,
  storyboardRefs,
  onStartKeyframeChange,
  onEndKeyframeChange,
  onStoryboardRefsChange,
  onUploadSourceVideo,
  hasSelectedVideo,
}) => {
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    mode: true,
    media: false,
    camera: true,
    optics: false,
    look: false,
    audio: false,
    continuity: false,
  });

  const startRefInput = useRef<HTMLInputElement>(null);
  const endRefInput = useRef<HTMLInputElement>(null);
  const storyRefInput = useRef<HTMLInputElement>(null);
  const videoUploadInput = useRef<HTMLInputElement>(null);

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const readAsDataUrl = (file: File, cb: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') cb(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const renderAccordionHeader = (
    id: SectionId,
    title: string,
    icon: React.ReactNode,
    summary?: string
  ) => {
    const open = openSections[id];
    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-[#1A1B1E] hover:bg-[#202226] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#8AB4F8] shrink-0">{icon}</span>
          <span className="text-xs font-medium text-[#E3E3E3] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {summary && !open && (
            <span className="text-[11px] text-[#8E918F] max-w-[120px] truncate tabular-nums">
              {summary}
            </span>
          )}
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#8E918F]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#8E918F]" />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3 text-xs">
      {/* Hidden File Pickers */}
      <input
        ref={startRefInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            readAsDataUrl(f, (url) => {
              onStartKeyframeChange(url);
              if (config.mode === 'text-to-video') {
                onChange({ ...config, mode: 'image-to-video' });
              }
            });
          }
        }}
      />
      <input
        ref={endRefInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            readAsDataUrl(f, (url) => {
              onEndKeyframeChange(url);
              if (config.mode === 'text-to-video') {
                onChange({ ...config, mode: 'image-to-video' });
              }
            });
          }
        }}
      />
      <input
        ref={storyRefInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []).slice(0, 6 - storyboardRefs.length);
          files.forEach((f) => {
            readAsDataUrl(f, (url) => {
              onStoryboardRefsChange([...storyboardRefs, url].slice(0, 6));
            });
          });
        }}
      />
      <input
        ref={videoUploadInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadSourceVideo(f);
        }}
      />

      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] text-[#8E918F]">
          Category Controls · Non-blocking Studio Drawer
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_CINEMA_CONFIG)}
          className="inline-flex items-center gap-1 text-[11px] text-[#9AA0A6] hover:text-white transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Generation / Edit Mode */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'mode',
          '01. Workflow Mode & Edit Preset',
          <Sliders className="w-3.5 h-3.5" />,
          config.mode
        )}
        {openSections.mode && (
          <div className="p-3 space-y-3 border-t border-[#252629]">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'text-to-video', label: 'Text to Video' },
                  { id: 'image-to-video', label: 'Image / Keyframe' },
                  { id: 'video-edit', label: 'Text-to-Video Edit' },
                  { id: 'storyboard', label: 'Storyboard Multi' },
                ] as Array<{ id: CinemaGenerationMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ ...config, mode: m.id })}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors whitespace-nowrap truncate ${
                    config.mode === m.id
                      ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                      : 'bg-[#1B1C1E] border-[#2C2D30] text-[#9AA0A6] hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {config.mode === 'video-edit' && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="text-[11px] text-[#9AA0A6] block mb-1">
                    Video Edit Operation Preset
                  </label>
                  <select
                    value={config.edit.preset}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        edit: { ...config.edit, preset: e.target.value as CinemaEditPreset },
                      })
                    }
                    className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {EDIT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9AA0A6]">Original Motion Preservation</span>
                    <span className="font-mono text-[#8AB4F8] tabular-nums">
                      {config.edit.preservationStrength}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={config.edit.preservationStrength}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        edit: { ...config.edit, preservationStrength: Number(e.target.value) },
                      })
                    }
                    className="w-full accent-[#8AB4F8]"
                  />
                </div>

                {!hasSelectedVideo && (
                  <button
                    type="button"
                    onClick={() => videoUploadInput.current?.click()}
                    className="w-full py-2 rounded-lg border border-dashed border-[#3C3F46] bg-[#1B1C1E] hover:bg-[#232529] text-xs text-[#C4C7C5] flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#8AB4F8]" />
                    <span>Upload Video to Edit (MP4 / WebM)</span>
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">
                Prompt Enhancer Director Profile
              </label>
              <select
                value={config.enhancerMode}
                onChange={(e) =>
                  onChange({ ...config, enhancerMode: e.target.value as CinemaEnhancerMode })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="auto">Auto Balanced Director</option>
                <option value="hollywood">Hollywood 70mm Blockbuster</option>
                <option value="commercial">Luxury Commercial Studio</option>
                <option value="anime">Theatrical Anime Cinema</option>
                <option value="drone_doc">Aerial Drone Documentary</option>
                <option value="scifi_vfx">Sci-Fi & Physics VFX</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. Keyframes & Storyboard */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'media',
          '02. Keyframes, Storyboard & Upload',
          <ImageIcon className="w-3.5 h-3.5" />,
          startKeyframe || storyboardRefs.length > 0 ? 'Attached' : 'None'
        )}
        {openSections.media && (
          <div className="p-3 space-y-3 border-t border-[#252629]">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-[#1B1C1E] border border-[#2C2D30]">
                <div className="text-[11px] text-[#9AA0A6] mb-1.5">Start Frame</div>
                {startKeyframe ? (
                  <div className="relative">
                    <img
                      src={startKeyframe}
                      alt="Start keyframe"
                      className="w-full h-16 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => onStartKeyframeChange(null)}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/75 text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRefInput.current?.click()}
                    className="w-full h-16 rounded border border-dashed border-[#383A40] flex flex-col items-center justify-center gap-1 text-[11px] text-[#8E918F] hover:text-white"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Start</span>
                  </button>
                )}
              </div>

              <div className="p-2 rounded-lg bg-[#1B1C1E] border border-[#2C2D30]">
                <div className="text-[11px] text-[#9AA0A6] mb-1.5">End Frame (Morph)</div>
                {endKeyframe ? (
                  <div className="relative">
                    <img
                      src={endKeyframe}
                      alt="End keyframe"
                      className="w-full h-16 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => onEndKeyframeChange(null)}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/75 text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => endRefInput.current?.click()}
                    className="w-full h-16 rounded border border-dashed border-[#383A40] flex flex-col items-center justify-center gap-1 text-[11px] text-[#8E918F] hover:text-white"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload End</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#9AA0A6]">
                  Storyboard Reference Images ({storyboardRefs.length}/6)
                </span>
                {storyboardRefs.length < 6 && (
                  <button
                    type="button"
                    onClick={() => storyRefInput.current?.click()}
                    className="text-[11px] text-[#8AB4F8] hover:underline"
                  >
                    + Add Refs
                  </button>
                )}
              </div>
              {storyboardRefs.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {storyboardRefs.map((ref, idx) => (
                    <div key={idx} className="relative">
                      <img src={ref} alt={`Ref ${idx + 1}`} className="w-full h-12 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() =>
                          onStoryboardRefsChange(storyboardRefs.filter((_, i) => i !== idx))
                        }
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/75 text-white"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => videoUploadInput.current?.click()}
              className="w-full py-2 rounded-lg bg-[#1E1F20] hover:bg-[#27292D] border border-[#323438] text-xs text-[#E3E3E3] flex items-center justify-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span>Upload Custom Video for AI Editing</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Camera Rig & Motion */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'camera',
          '03. Camera Rig & Motion Dynamics',
          <Camera className="w-3.5 h-3.5" />,
          config.camera.trajectory
        )}
        {openSections.camera && (
          <div className="p-3 space-y-3 border-t border-[#252629]">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Camera Trajectory</label>
              <select
                value={config.camera.trajectory}
                onChange={(e) =>
                  onChange({
                    ...config,
                    camera: { ...config.camera, trajectory: e.target.value },
                  })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {CAMERA_MOTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#9AA0A6]">Motion Strength</span>
                <span className="font-mono text-[#8AB4F8] tabular-nums">
                  {config.camera.motionStrength} / 10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={config.camera.motionStrength}
                onChange={(e) =>
                  onChange({
                    ...config,
                    camera: { ...config.camera, motionStrength: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#8AB4F8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Speed</label>
                <select
                  value={config.camera.speed}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      camera: { ...config.camera, speed: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="Slow">Slow</option>
                  <option value="Natural">Natural</option>
                  <option value="Dynamic">Dynamic</option>
                  <option value="Hyper">Hyper</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Stabilizer Rig</label>
                <select
                  value={config.camera.stabilization}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      camera: { ...config.camera, stabilization: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="Gimbal">Gimbal</option>
                  <option value="Steadicam">Steadicam</option>
                  <option value="Tripod">Tripod</option>
                  <option value="Handheld">Handheld</option>
                  <option value="FPV Drone">FPV Drone</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Lens, Optics & Output Format */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'optics',
          '04. Lens, Optics & Output Specs',
          <Aperture className="w-3.5 h-3.5" />,
          `${config.aspectRatio} · ${config.duration}s · ${config.resolution}`
        )}
        {openSections.optics && (
          <div className="p-3 space-y-3 border-t border-[#252629]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Focal Length</label>
                <select
                  value={config.camera.focalLength}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      camera: { ...config.camera, focalLength: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="14mm Ultra-Wide">14mm Ultra-Wide</option>
                  <option value="24mm Wide">24mm Wide</option>
                  <option value="35mm Cinema">35mm Cinema</option>
                  <option value="50mm Natural">50mm Natural</option>
                  <option value="85mm Portrait">85mm Portrait</option>
                  <option value="135mm Telephoto">135mm Telephoto</option>
                  <option value="Anamorphic 2x">Anamorphic 2x</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Aperture (DOF)</label>
                <select
                  value={config.camera.aperture}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      camera: { ...config.camera, aperture: e.target.value as any },
                    })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="f/1.4 Shallow DOF">f/1.4 Shallow DOF</option>
                  <option value="f/2.8 Cinematic">f/2.8 Cinematic</option>
                  <option value="f/5.6 Balanced">f/5.6 Balanced</option>
                  <option value="f/11 Deep Focus">f/11 Deep Focus</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Aspect Ratio</label>
              <div className="grid grid-cols-5 gap-1">
                {(['16:9', '9:16', '1:1', '4:3', '21:9'] as const).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => onChange({ ...config, aspectRatio: ar })}
                    className={`py-1.5 rounded-lg border text-[11px] tabular-nums ${
                      config.aspectRatio === ar
                        ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                        : 'bg-[#1B1C1E] border-[#2C2D30] text-[#8E918F] hover:text-white'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Resolution</label>
                <select
                  value={config.resolution}
                  onChange={(e) =>
                    onChange({ ...config, resolution: e.target.value as CinemaResolutionTier })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="360p">360p Fast Draft</option>
                  <option value="720p">720p HD Studio</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="4k">4K Ultra Master</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Frame Rate</label>
                <select
                  value={config.fps}
                  onChange={(e) =>
                    onChange({ ...config, fps: Number(e.target.value) as 24 | 30 | 60 })
                  }
                  className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value={24}>24 fps (Film)</option>
                  <option value={30}>30 fps (Smooth)</option>
                  <option value={60}>60 fps (Optical Flow)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#9AA0A6]">Clip Duration</span>
                <span className="font-mono text-[#8AB4F8] tabular-nums">{config.duration}s</span>
              </div>
              <input
                type="range"
                min="3"
                max={endKeyframe ? 10 : 15}
                step="1"
                value={Math.min(config.duration, endKeyframe ? 10 : 15)}
                onChange={(e) => onChange({ ...config, duration: Number(e.target.value) })}
                className="w-full accent-[#8AB4F8]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. Lighting, Color Grade & Weather */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'look',
          '05. Lighting, Style & Color LUT',
          <Sun className="w-3.5 h-3.5" />,
          config.look.visualStyle
        )}
        {openSections.look && (
          <div className="p-3 space-y-2.5 border-t border-[#252629]">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Visual Style</label>
              <select
                value={config.look.visualStyle}
                onChange={(e) =>
                  onChange({ ...config, look: { ...config.look, visualStyle: e.target.value } })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {VISUAL_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Lighting Setup</label>
              <select
                value={config.look.lighting}
                onChange={(e) =>
                  onChange({ ...config, look: { ...config.look, lighting: e.target.value } })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {LIGHTING_PRESETS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Color Grading LUT</label>
              <select
                value={config.look.colorGrade}
                onChange={(e) =>
                  onChange({ ...config, look: { ...config.look, colorGrade: e.target.value } })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {COLOR_LUTS.map((lut) => (
                  <option key={lut} value={lut}>
                    {lut}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Weather & Particles</label>
              <select
                value={config.look.weatherParticles}
                onChange={(e) =>
                  onChange({
                    ...config,
                    look: { ...config.look, weatherParticles: e.target.value },
                  })
                }
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 6. Audio, Foley & Soundtrack */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'audio',
          '06. Audio, Foley & Lyria Soundtrack',
          <Volume2 className="w-3.5 h-3.5" />,
          config.audio.audioMode
        )}
        {openSections.audio && (
          <div className="p-3 space-y-2.5 border-t border-[#252629]">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'native', label: 'Native AI Sound' },
                  { id: 'lyria_score', label: 'Lyria Music Score' },
                  { id: 'ambient_foley', label: 'Ambient Foley' },
                  { id: 'muted', label: 'Silent Video' },
                ] as const
              ).map((am) => (
                <button
                  key={am.id}
                  type="button"
                  onClick={() =>
                    onChange({ ...config, audio: { ...config.audio, audioMode: am.id } })
                  }
                  className={`py-1.5 px-2 rounded-lg border text-[11px] ${
                    config.audio.audioMode === am.id
                      ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                      : 'bg-[#1B1C1E] border-[#2C2D30] text-[#9AA0A6]'
                  }`}
                >
                  {am.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={config.audio.audioPrompt}
              onChange={(e) =>
                onChange({ ...config, audio: { ...config.audio, audioPrompt: e.target.value } })
              }
              placeholder="Soundtrack / Foley cue (e.g. deep Hans Zimmer brass, heavy rain)..."
              className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#6E7075] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 7. Continuity, Seed & Negative Prompt */}
      <div className="rounded-xl border border-[#282A2E] overflow-hidden bg-[#151618]">
        {renderAccordionHeader(
          'continuity',
          '07. Seed Lock & Negative Prompt',
          <Lock className="w-3.5 h-3.5" />,
          `Seed ${config.seed}`
        )}
        {openSections.continuity && (
          <div className="p-3 space-y-2.5 border-t border-[#252629]">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={config.seed}
                onChange={(e) => onChange({ ...config, seed: Number(e.target.value) || 0 })}
                className="flex-1 bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white tabular-nums"
              />
              <button
                type="button"
                onClick={() => onChange({ ...config, seedLocked: !config.seedLocked })}
                className={`p-1.5 rounded-lg border ${
                  config.seedLocked
                    ? 'bg-[#2B2D30] border-[#8AB4F8]/50 text-[#8AB4F8]'
                    : 'bg-[#1B1C1E] border-[#2F3135] text-[#9AA0A6]'
                }`}
                title={config.seedLocked ? 'Seed locked' : 'Lock seed'}
              >
                {config.seedLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...config, seed: Math.floor(Math.random() * 9000000) + 100000 })
                }
                className="p-1.5 rounded-lg bg-[#1B1C1E] border border-[#2F3135] text-[#9AA0A6] hover:text-white"
                title="Randomize seed"
              >
                <Dices className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Negative Prompt</label>
              <textarea
                rows={2}
                value={config.negativePrompt}
                onChange={(e) => onChange({ ...config, negativePrompt: e.target.value })}
                className="w-full bg-[#1B1C1E] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#6E7075] focus:outline-none resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
