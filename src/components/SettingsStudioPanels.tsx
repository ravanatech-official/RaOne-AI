import React, { useRef, useState } from 'react';
import {
  RotateCcw,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ExternalLink,
  ShieldCheck,
  PlugZap,
  Server,
} from 'lucide-react';
import type {
  SettingsSectionId,
  UniversalDiagnosticsSnapshot,
  UniversalSettingsProfile,
} from '../types/settings.ts';
import {
  ALL_STYLE_PRESETS,
  ASPECT_RATIO_OPTIONS,
  ENHANCER_MODES as VISION_ENHANCER_MODES,
  RESOLUTION_TIERS,
  VISION_MODELS,
} from '../data/visionPresets.ts';

interface SettingsStudioPanelsProps {
  activeTab: SettingsSectionId;
  settings: UniversalSettingsProfile;
  onChangeSettings: (updater: (prev: UniversalSettingsProfile) => UniversalSettingsProfile) => void;
  onResetSection: (section: SettingsSectionId | 'all') => Promise<void>;
  diagnostics: UniversalDiagnosticsSnapshot | null;
  diagnosticsLoading: boolean;
  onRefreshDiagnostics: () => void;
  onExportProfile: () => void;
  onImportProfileFile: (file: File) => Promise<void>;
  onOpenLibrary?: () => void;
  onOpenPlugins?: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
      checked ? 'bg-[#8AB4F8]' : 'bg-[#2C2E33]'
    }`}
  >
    <span
      className={`w-4 h-4 rounded-full bg-[#0E0F10] transform transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const SectionHeader: React.FC<{
  title: string;
  subtitle: string;
  onReset?: () => void;
}> = ({ title, subtitle, onReset }) => (
  <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#252629]">
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-[11px] text-[#9AA0A6] mt-0.5">{subtitle}</p>
    </div>
    {onReset && (
      <button
        type="button"
        onClick={onReset}
        className="px-2.5 py-1.5 rounded-lg border border-[#2C2E33] bg-[#141517] hover:bg-[#1E1F22] text-[11px] text-[#C4C7C5] hover:text-white flex items-center gap-1.5 shrink-0 transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Reset Section</span>
      </button>
    )}
  </div>
);

export const SettingsStudioPanels: React.FC<SettingsStudioPanelsProps> = ({
  activeTab,
  settings,
  onChangeSettings,
  onResetSection,
  diagnostics,
  diagnosticsLoading,
  onRefreshDiagnostics,
  onExportProfile,
  onImportProfileFile,
  onOpenLibrary,
  onOpenPlugins,
}) => {
  const importRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);

  const code = settings.studioDefaults.code;
  const vision = settings.studioDefaults.vision;
  const cinema = settings.studioDefaults.cinema;
  const music = settings.studioDefaults.music;
  const doc = settings.studioDefaults.document;
  const filesLib = settings.libraries.files;
  const pluginsLib = settings.libraries.plugins;

  // =========================================================================
  // 1. CODE STUDIO DEFAULTS
  // =========================================================================
  if (activeTab === 'code_studio') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Code Studio Defaults"
          subtitle="Default architectural stack, coding guardrails, and deployment targets applied when opening Code Studio."
          onReset={() => onResetSection('code_studio')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Project Category</label>
            <select
              value={code.category}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    code: { ...p.studioDefaults.code, category: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="webapp">Web App (SPA)</option>
              <option value="website">Website / Landing</option>
              <option value="saas">SaaS Platform</option>
              <option value="micro_saas">Micro-SaaS</option>
              <option value="fullstack">Full-Stack Software</option>
              <option value="api_service">API / Microservice</option>
              <option value="browser_extension">Browser Extension (MV3)</option>
              <option value="script_cli">Script / CLI Tool</option>
              <option value="mobile_pwa">Mobile App / PWA</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Frontend Framework</label>
            <select
              value={code.frontendFramework}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    code: { ...p.studioDefaults.code, frontendFramework: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="react_vite">React + Vite + Tailwind</option>
              <option value="nextjs">Next.js App Router</option>
              <option value="vanilla_tailwind">HTML5 + Tailwind CSS</option>
              <option value="vue_vite">Vue 3 + Vite</option>
              <option value="canvas_threejs">Three.js / WebGL Canvas</option>
              <option value="none">No Frontend (API / CLI)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Backend Runtime</label>
            <select
              value={code.backendRuntime}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    code: { ...p.studioDefaults.code, backendRuntime: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="node_express">Node.js + Express (TS)</option>
              <option value="node_fastify">Node.js + Fastify</option>
              <option value="python_fastapi">Python + FastAPI</option>
              <option value="go_gin">Go + Gin</option>
              <option value="edge_worker">Cloudflare / Edge Worker</option>
              <option value="none">Frontend Only (None)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Database Engine</label>
            <select
              value={code.database}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    code: { ...p.studioDefaults.code, database: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="localstorage">Browser LocalStorage</option>
              <option value="firestore">Firebase Firestore</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="supabase">Supabase Postgres</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Prompt Enhancer Depth</label>
            <select
              value={code.enhanceDepth}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    code: { ...p.studioDefaults.code, enhanceDepth: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="quick">Quick MVP</option>
              <option value="fullstack">Full-Stack Production</option>
              <option value="enterprise">Enterprise Architecture</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Preferred Deploy Target</label>
            <select
              value={code.deployTarget}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    code: { ...p.studioDefaults.code, deployTarget: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="raone_live">RaOne Instant Live URL</option>
              <option value="firebase">Firebase Hosting & Firestore</option>
              <option value="cloud_run">Google Cloud Run</option>
              <option value="github">GitHub Repository Push</option>
            </select>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="text-xs font-semibold text-white">Engineering & Compliance Flags</div>
          {(
            [
              ['strictTypeScript', 'Strict TypeScript types across generated modules'],
              ['securityHardening', 'Security hardening (CSP, input validation, XSS guards)'],
              ['responsiveMobileFirst', 'Mobile-first responsive layout rules'],
              ['includeSeoMeta', 'Auto-generate SEO & OpenGraph metadata'],
              ['includePwaManifest', 'Include PWA Manifest & offline worker'],
              ['includeUnitTests', 'Scaffold automated unit test suite'],
              ['includeDocker', 'Generate multi-stage production Dockerfile'],
              ['includeCiCd', 'Generate GitHub Actions CI/CD workflow'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#C4C7C5]">{label}</span>
              <ToggleSwitch
                checked={Boolean(code.codingParams[key])}
                onChange={(val) =>
                  onChangeSettings((p) => ({
                    ...p,
                    studioDefaults: {
                      ...p.studioDefaults,
                      code: {
                        ...p.studioDefaults.code,
                        codingParams: { ...p.studioDefaults.code.codingParams, [key]: val },
                      },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. VISION STUDIO DEFAULTS
  // =========================================================================
  if (activeTab === 'vision_studio') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Vision Studio Defaults"
          subtitle="Default image model, resolution, sampler settings, and darkroom export profile."
          onReset={() => onResetSection('vision_studio')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Vision Model</label>
            <select
              value={vision.model}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, model: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              {VISION_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Visual Style</label>
            <select
              value={vision.style}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, style: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              {ALL_STYLE_PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Aspect Ratio</label>
            <select
              value={vision.aspectRatio}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, aspectRatio: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              {ASPECT_RATIO_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.tag} · {a.dim})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Resolution Tier</label>
            <select
              value={vision.resolution}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, resolution: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              {RESOLUTION_TIERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.badge})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Prompt Enhancer Preset</label>
            <select
              value={vision.enhancerMode}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, enhancerMode: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              {VISION_ENHANCER_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.hint}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Preferred Export Format</label>
            <select
              value={vision.exportFormat}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, exportFormat: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="png">Lossless PNG</option>
              <option value="jpeg">High-Quality JPEG</option>
              <option value="webp">Modern WebP</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">
              Images per Batch ({vision.imageCount})
            </label>
            <input
              type="range"
              min={1}
              max={4}
              value={vision.imageCount}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, imageCount: Number(e.target.value) },
                  },
                }))
              }
              className="w-full accent-[#8AB4F8]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">
              Default Guidance CFG ({vision.cfgScale})
            </label>
            <input
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={vision.cfgScale}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    vision: { ...p.studioDefaults.vision, cfgScale: Number(e.target.value) },
                  },
                }))
              }
              className="w-full accent-[#8AB4F8]"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="text-xs font-semibold text-white">Pipeline Enhancements</div>
          {(
            [
              ['photoReal', 'PhotoReal Engine (natural skin textures & lighting)'],
              ['alchemy', 'Alchemy Pipeline (higher micro-detail fidelity)'],
              ['promptMagic', 'Prompt Magic (semantic weight amplification)'],
              ['googleSearchGrounding', 'Google Search Visual Grounding'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#C4C7C5]">{label}</span>
              <ToggleSwitch
                checked={Boolean(vision[key])}
                onChange={(val) =>
                  onChangeSettings((p) => ({
                    ...p,
                    studioDefaults: {
                      ...p.studioDefaults,
                      vision: { ...p.studioDefaults.vision, [key]: val },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Negative Prompt</label>
          <textarea
            rows={2}
            value={vision.negativePrompt}
            onChange={(e) =>
              onChangeSettings((p) => ({
                ...p,
                studioDefaults: {
                  ...p.studioDefaults,
                  vision: { ...p.studioDefaults.vision, negativePrompt: e.target.value },
                },
              }))
            }
            className="w-full bg-[#131416] border border-[#252629] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. CINEMA STUDIO DEFAULTS
  // =========================================================================
  if (activeTab === 'cinema_studio') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Cinema Studio Defaults"
          subtitle="Default video diffusion model, FPS, resolution, camera rig, and film stock settings."
          onReset={() => onResetSection('cinema_studio')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Video Engine</label>
            <select
              value={cinema.model}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: { ...p.studioDefaults.cinema, model: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="Google Veo 2 (Gemini Omni)">Veo 2 · Gemini Omni</option>
              <option value="OpenAI Sora Turbo">Sora Turbo Profile</option>
              <option value="Runway Gen-3 Alpha">Runway Gen-3 Profile</option>
              <option value="Kling AI 1.5 Pro">Kling 1.5 Physics</option>
              <option value="Luma Dream Machine 2.0">Luma Dream 2.0</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Enhancer Mode</label>
            <select
              value={cinema.enhancerMode}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: { ...p.studioDefaults.cinema, enhancerMode: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="auto">Auto Cinema</option>
              <option value="hollywood">Hollywood Anamorphic</option>
              <option value="commercial">Commercial Packshot</option>
              <option value="anime">Anime & Stylized Motion</option>
              <option value="drone_doc">Aerial Drone Documentary</option>
              <option value="scifi_vfx">Sci-Fi VFX / CGI</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Output Resolution</label>
            <select
              value={cinema.resolution}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: { ...p.studioDefaults.cinema, resolution: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="360p">360p Draft</option>
              <option value="720p">720p HD</option>
              <option value="1080p">1080p Full HD</option>
              <option value="4k">4K Cinema Master</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Frame Rate (FPS)</label>
            <select
              value={cinema.fps}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: { ...p.studioDefaults.cinema, fps: Number(e.target.value) as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value={24}>24 fps (Cinema Film)</option>
              <option value={30}>30 fps (Broadcast Smooth)</option>
              <option value={60}>60 fps (Ultra-Smooth Motion)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Aspect Ratio</label>
            <select
              value={cinema.aspectRatio}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: { ...p.studioDefaults.cinema, aspectRatio: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="16:9">16:9 Widescreen</option>
              <option value="9:16">9:16 Vertical / Reels</option>
              <option value="21:9">21:9 CinemaScope</option>
              <option value="4:3">4:3 Classic Academy</option>
              <option value="1:1">1:1 Square</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Clip Duration ({cinema.duration}s)</label>
            <input
              type="range"
              min={3}
              max={15}
              value={cinema.duration}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: { ...p.studioDefaults.cinema, duration: Number(e.target.value) },
                  },
                }))
              }
              className="w-full accent-[#8AB4F8]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Film Stock & Look</label>
            <select
              value={cinema.look.filmStock}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: {
                      ...p.studioDefaults.cinema,
                      look: { ...p.studioDefaults.cinema.look, filmStock: e.target.value as any },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="Kodak Vision3 35mm">Kodak Vision3 35mm</option>
              <option value="IMAX 70mm">IMAX 70mm</option>
              <option value="Clean Digital 8K">Clean Digital 8K</option>
              <option value="Anamorphic Teal & Orange">Anamorphic Teal & Orange</option>
              <option value="16mm Vintage Grain">16mm Vintage Grain</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Camera Stabilization</label>
            <select
              value={cinema.camera.stabilization}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: {
                      ...p.studioDefaults.cinema,
                      camera: { ...p.studioDefaults.cinema.camera, stabilization: e.target.value as any },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="Gimbal">3-Axis Gimbal</option>
              <option value="Steadicam">Steadicam Flow</option>
              <option value="Tripod">Locked Tripod</option>
              <option value="FPV Drone">FPV Cinewhoop Drone</option>
              <option value="Handheld">Dynamic Handheld</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Audio Synchronization Mode</label>
            <select
              value={cinema.audio.audioMode}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: {
                      ...p.studioDefaults.cinema,
                      audio: { ...p.studioDefaults.cinema.audio, audioMode: e.target.value as any },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="native">Native Omni Audio</option>
              <option value="lyria_score">Lyria Original Score</option>
              <option value="ambient_foley">Ambient Foley Soundscape</option>
              <option value="muted">Silent / Video Only</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Camera Focal Length</label>
            <select
              value={cinema.camera.focalLength}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    cinema: {
                      ...p.studioDefaults.cinema,
                      camera: { ...p.studioDefaults.cinema.camera, focalLength: e.target.value as any },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
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
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. MUSIC STUDIO DEFAULTS
  // =========================================================================
  if (activeTab === 'music_studio') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Music Studio Defaults"
          subtitle="Default synthesis engine, vocal direction, BPM, mastering (-14 LUFS), and cover art settings."
          onReset={() => onResetSection('music_studio')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Synthesis Model</label>
            <select
              value={music.model}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: { ...p.studioDefaults.music, model: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="Google Lyria 3 Pro (Full Track)">Lyria 3 Pro (Full Track)</option>
              <option value="Google Lyria 3 Clip (Fast 30s)">Lyria 3 Clip (30s Hook)</option>
              <option value="Suno v4 Profile (Lyria Bridged)">Suno v4 Arrangement</option>
              <option value="Udio 130 Clarity Profile">Udio 130 Clarity</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Vocal Language</label>
            <select
              value={music.vocal.language}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: {
                      ...p.studioDefaults.music,
                      vocal: { ...p.studioDefaults.music.vocal, language: e.target.value as any },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="English">English</option>
              <option value="Sinhala (සිංහල)">Sinhala (සිංහල)</option>
              <option value="Singlish">Singlish</option>
              <option value="Tamil / Bilingual">Tamil / Bilingual</option>
              <option value="Instrumental">Instrumental Only</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Primary Genre</label>
            <input
              type="text"
              value={music.primaryGenre}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: { ...p.studioDefaults.music, primaryGenre: e.target.value },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default BPM ({music.bpm})</label>
            <input
              type="range"
              min={50}
              max={200}
              value={music.bpm}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: { ...p.studioDefaults.music, bpm: Number(e.target.value) },
                  },
                }))
              }
              className="w-full accent-[#8AB4F8]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Mastering Preset</label>
            <select
              value={music.production.masteringPreset}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: {
                      ...p.studioDefaults.music,
                      production: {
                        ...p.studioDefaults.music.production,
                        masteringPreset: e.target.value as any,
                      },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="Radio -14 LUFS">Radio -14 LUFS</option>
              <option value="Club Sub Heavy">Club Sub Heavy</option>
              <option value="Audiophile Dynamic">Audiophile Dynamic</option>
              <option value="Lo-Fi Dusty Tape">Lo-Fi Dusty Tape</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Export Audio Format</label>
            <select
              value={music.production.outputFormat}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: {
                      ...p.studioDefaults.music,
                      production: {
                        ...p.studioDefaults.music.production,
                        outputFormat: e.target.value as any,
                      },
                    },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="mp3">MP3 320kbps</option>
              <option value="wav">Lossless WAV 48kHz</option>
            </select>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Auto-normalize loudness to -14 LUFS on master/DSP edits</span>
            <ToggleSwitch
              checked={music.dsp.normalizeLufs}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: { ...p.studioDefaults.music, dsp: { ...p.studioDefaults.music.dsp, normalizeLufs: val } },
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Auto-generate album cover artwork with tracks</span>
            <ToggleSwitch
              checked={music.production.generateCoverArt}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    music: {
                      ...p.studioDefaults.music,
                      production: { ...p.studioDefaults.music.production, generateCoverArt: val },
                    },
                  },
                }))
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. DOCUMENT STUDIO DEFAULTS
  // =========================================================================
  if (activeTab === 'document_studio') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Document Studio Defaults"
          subtitle="Default document format, language, citation standard, organization branding, and audio briefing voice."
          onReset={() => onResetSection('document_studio')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Document Category</label>
            <select
              value={doc.category}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: { ...p.studioDefaults.document, category: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="report">Executive Report</option>
              <option value="presentation">Slide Presentation</option>
              <option value="spreadsheet">Financial Model</option>
              <option value="technical_prd">Technical PRD</option>
              <option value="contract">Legal Contract</option>
              <option value="notebook">Research Notebook</option>
              <option value="sop_runbook">SOP / Runbook</option>
              <option value="study_guide">Study Guide</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Writing Language</label>
            <select
              value={doc.language}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: { ...p.studioDefaults.document, language: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="English">English</option>
              <option value="Sinhala (සිංහල)">Sinhala (සිංහල)</option>
              <option value="Singlish">Singlish</option>
              <option value="Bilingual (EN + සිංහල)">Bilingual (EN + සිංහල)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Tone Profile</label>
            <select
              value={doc.tone}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: { ...p.studioDefaults.document, tone: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="executive">Executive Crisp</option>
              <option value="technical">Technical Engineering</option>
              <option value="academic">Academic Rigorous</option>
              <option value="legal_formal">Legal Formal</option>
              <option value="persuasive">Investor / Persuasive</option>
              <option value="friendly_clear">Clear & Accessible</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Citation Standard</label>
            <select
              value={doc.citationStyle}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: { ...p.studioDefaults.document, citationStyle: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="Inline">Inline Source IDs</option>
              <option value="APA 7">APA 7th Edition</option>
              <option value="IEEE">IEEE Citations</option>
              <option value="MLA">MLA Format</option>
              <option value="None">None</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Organization / Company Branding</label>
            <input
              type="text"
              value={doc.branding.companyName}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: {
                      ...p.studioDefaults.document,
                      branding: { ...p.studioDefaults.document.branding, companyName: e.target.value },
                    },
                  },
                }))
              }
              placeholder="e.g., RavanaTec Holdings"
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Author Name</label>
            <input
              type="text"
              value={doc.branding.authorName}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: {
                      ...p.studioDefaults.document,
                      branding: { ...p.studioDefaults.document.branding, authorName: e.target.value },
                    },
                  },
                }))
              }
              placeholder="e.g., Chief Architect"
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Strict Source Grounding (cite only uploaded files when attached)</span>
            <ToggleSwitch
              checked={doc.strictSourceGrounding}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: { ...p.studioDefaults.document, strictSourceGrounding: val },
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Include Executive Summary & Comparison Tables by default</span>
            <ToggleSwitch
              checked={doc.structure.includeExecutiveSummary}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  studioDefaults: {
                    ...p.studioDefaults,
                    document: {
                      ...p.studioDefaults.document,
                      structure: {
                        ...p.studioDefaults.document.structure,
                        includeExecutiveSummary: val,
                        includeComparisonTables: val,
                      },
                    },
                  },
                }))
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 6. FILES LIBRARY GOVERNANCE
  // =========================================================================
  if (activeTab === 'files_library') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Files Library Governance"
          subtitle="Cross-studio asset indexing, default view/sort layout, ZIP packaging rules, and trash retention."
          onReset={() => onResetSection('files_library')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default View Mode</label>
            <select
              value={filesLib.defaultViewMode}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    files: { ...p.libraries.files, defaultViewMode: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="grid">Visual Thumbnail Grid</option>
              <option value="list">Dense Table List</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Default Sort Order</label>
            <select
              value={filesLib.defaultSortMode}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    files: { ...p.libraries.files, defaultSortMode: e.target.value as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="size">Largest File Size</option>
              <option value="title">Alphabetical (Title)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#9AA0A6] block mb-1.5">Soft-Delete Trash Retention</label>
            <select
              value={filesLib.trashRetentionDays}
              onChange={(e) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    files: { ...p.libraries.files, trashRetentionDays: Number(e.target.value) as any },
                  },
                }))
              }
              className="w-full bg-[#131416] border border-[#252629] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
            >
              <option value={7}>7 Days before manual purge</option>
              <option value={30}>30 Days (Standard)</option>
              <option value={90}>90 Days Extended Archive</option>
              <option value={0}>Keep Forever until Purged</option>
            </select>
          </div>

          <div className="flex items-end">
            {onOpenLibrary && (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="w-full py-2 px-3 rounded-lg bg-[#1E1F22] hover:bg-[#2C2E33] border border-[#2C2E33] text-xs font-medium text-white flex items-center justify-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>Open RaOne Files Library</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="text-xs font-semibold text-white">Packaging & Vault Rules</div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Include JSON metadata manifest when bundling bulk ZIP archives</span>
            <ToggleSwitch
              checked={filesLib.zipIncludeMetadataJson}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    files: { ...p.libraries.files, zipIncludeMetadataJson: val },
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Enable Gemini Vision OCR fallback when indexing scanned PDFs/images</span>
            <ToggleSwitch
              checked={filesLib.ocrFallbackOnUpload}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    files: { ...p.libraries.files, ocrFallbackOnUpload: val },
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Ask confirmation before moving items into Vault Trash</span>
            <ToggleSwitch
              checked={filesLib.confirmBeforeTrash}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    files: { ...p.libraries.files, confirmBeforeTrash: val },
                  },
                }))
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 7. PLUGINS LIBRARY POLICY & AUTOMATION
  // =========================================================================
  if (activeTab === 'plugins_library') {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="RaOne Plugins Library Governance"
          subtitle="Encrypted vault security rules, 2-way BYOK synchronization, and cross-studio webhook triggers."
          onReset={() => onResetSection('plugins_library')}
        />

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Encrypted 3rd-Party Connector Vault</span>
            </div>
            <p className="text-[11px] text-[#9AA0A6] mt-0.5 tabular-nums">
              {diagnostics
                ? `${diagnostics.vaults.pluginsConnected} connected · ${diagnostics.vaults.pluginsEnabled} active · ${diagnostics.vaults.pluginsTotal} available`
                : 'Manage GitHub, Firebase, Vercel, Notion, Hugging Face, ElevenLabs & Custom REST APIs.'}
            </p>
          </div>
          {onOpenPlugins && (
            <button
              type="button"
              onClick={onOpenPlugins}
              className="px-3.5 py-2 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <PlugZap className="w-3.5 h-3.5" />
              <span>Open Plugins Library</span>
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="text-xs font-semibold text-white">Security & Synchronization</div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Enforce strict public-HTTPS SSRF block on all external plugin calls</span>
            <ToggleSwitch
              checked={pluginsLib.enforceStrictSsrf}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    plugins: { ...p.libraries.plugins, enforceStrictSsrf: val },
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#C4C7C5]">Auto-sync AI Model plugin keys with tenant BYOK vault</span>
            <ToggleSwitch
              checked={pluginsLib.autoSyncByokKeys}
              onChange={(val) =>
                onChangeSettings((p) => ({
                  ...p,
                  libraries: {
                    ...p.libraries,
                    plugins: { ...p.libraries.plugins, autoSyncByokKeys: val },
                  },
                }))
              }
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div className="text-xs font-semibold text-white">Automatic Studio Completion Webhooks</div>
          <p className="text-[11px] text-[#9AA0A6]">
            Trigger connected Slack/Discord webhooks when tasks finish in each studio:
          </p>
          {(
            [
              ['code', 'Code Studio — App builds & GitHub pushes'],
              ['vision', 'Vision Studio — High-res image generation batches'],
              ['cinema', 'Cinema Studio — Video renders & post-processing'],
              ['music', 'Music Studio — Song synthesis & -14 LUFS masters'],
              ['document', 'Document Studio — Executive reports & decks'],
            ] as const
          ).map(([studio, label]) => (
            <div key={studio} className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#C4C7C5]">{label}</span>
              <ToggleSwitch
                checked={Boolean(pluginsLib.autoWebhookOnComplete[studio])}
                onChange={(val) =>
                  onChangeSettings((p) => ({
                    ...p,
                    libraries: {
                      ...p.libraries,
                      plugins: {
                        ...p.libraries.plugins,
                        autoWebhookOnComplete: {
                          ...p.libraries.plugins.autoWebhookOnComplete,
                          [studio]: val,
                        },
                      },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 8. LIVE SYSTEM DIAGNOSTICS, BACKUP & FACTORY RESET
  // =========================================================================
  if (activeTab === 'diagnostics') {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#252629]">
          <div>
            <h3 className="text-sm font-semibold text-white">System Diagnostics, Backup & Reset</h3>
            <p className="text-[11px] text-[#9AA0A6] mt-0.5">
              Live worker health checks, per-studio storage utilization, portable JSON settings export/import, and factory reset.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshDiagnostics}
            disabled={diagnosticsLoading}
            className="px-3 py-1.5 rounded-lg border border-[#2C2E33] bg-[#141517] hover:bg-[#1E1F22] text-xs text-white flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
            <span>Re-scan</span>
          </button>
        </div>

        {/* Runtime Workers & Provider Readiness */}
        {diagnostics && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'FFmpeg Video/Audio', ok: diagnostics.runtime.ffmpegAvailable },
                { label: 'FFprobe Inspector', ok: diagnostics.runtime.ffprobeAvailable },
                { label: 'Gemini Engine', ok: diagnostics.providers.geminiReady },
                { label: 'Groq LPU Cloud', ok: diagnostics.providers.groqReady },
                { label: 'Local LLM Bridge', ok: diagnostics.providers.localLlmReady || diagnostics.runtime.llamaServerAvailable },
                { label: 'Plugins Connected', ok: diagnostics.vaults.pluginsConnected > 0, detail: `${diagnostics.vaults.pluginsConnected}/${diagnostics.vaults.pluginsTotal}` },
                { label: 'Credit Ledger', ok: diagnostics.vaults.creditsBalance > 0, detail: `${diagnostics.vaults.creditsBalance} cr` },
                { label: 'Active Plan', ok: true, detail: diagnostics.vaults.plan.toUpperCase() },
              ].map((card, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#131416] border border-[#252629] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <Server className="w-3.5 h-3.5 text-[#9AA0A6]" />
                    {card.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-[#5F6368]" />
                    )}
                  </div>
                  <div className="text-[11px] font-medium text-white truncate">{card.label}</div>
                  <div className="font-mono text-[10px] text-[#9AA0A6] tabular-nums">
                    {card.detail || (card.ok ? 'Online / Ready' : 'Not configured')}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-Studio Storage Analyzer */}
            <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Tenant Storage Footprint</span>
                <span className="font-mono text-[#9AA0A6] tabular-nums">
                  {diagnostics.storage.totalAssets} assets · {formatBytes(diagnostics.storage.totalBytes)}
                  {diagnostics.storage.trashedCount > 0 ? ` · ${diagnostics.storage.trashedCount} in trash` : ''}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-[11px] font-mono tabular-nums">
                {(
                  [
                    ['code', 'Code'],
                    ['vision', 'Vision'],
                    ['cinema', 'Cinema'],
                    ['music', 'Music'],
                    ['document', 'Docs'],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="p-2 rounded-lg bg-[#0E0F10] border border-[#252629]">
                    <div className="text-[#9AA0A6] text-[10px]">{label}</div>
                    <div className="text-white font-semibold">{diagnostics.storage.byStudio[k].count}</div>
                    <div className="text-[10px] text-[#8AB4F8]">
                      {formatBytes(diagnostics.storage.byStudio[k].bytes)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Portable Profile Export / Import */}
        <div className="p-4 rounded-xl bg-[#131416] border border-[#252629] space-y-3">
          <div>
            <div className="text-xs font-semibold text-white">Portable Workspace Settings Profile</div>
            <p className="text-[11px] text-[#9AA0A6]">
              Export or restore all 5 studio defaults &amp; 2 library policies as JSON (API secrets are never included).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportProfile}
              className="px-3.5 py-2 rounded-lg border border-[#2C2E33] bg-[#0E0F10] hover:bg-[#1E1F22] text-xs text-white flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span>Export Settings JSON</span>
            </button>

            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setImportBusy(true);
                try {
                  await onImportProfileFile(file);
                } finally {
                  setImportBusy(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={importBusy}
              className="px-3.5 py-2 rounded-lg border border-[#2C2E33] bg-[#0E0F10] hover:bg-[#1E1F22] text-xs text-white flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>{importBusy ? 'Importing...' : 'Import Settings JSON'}</span>
            </button>

            <button
              type="button"
              onClick={() => onResetSection('all')}
              className="ml-auto px-3.5 py-2 rounded-lg border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 text-red-300 text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Factory Reset All Settings</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
