import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Cpu,
  SlidersHorizontal,
  Plug,
  Package,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Crosshair,
  Plus,
  Trash2,
  RefreshCw,
  FolderArchive,
  Download,
} from 'lucide-react';
import {
  CATEGORY_CATALOG,
  INTEGRATION_OPTIONS,
  type StudioProjectConfig,
  type StudioDependencyItem,
  type ProjectCategoryId,
  type FrontendFrameworkId,
  type BackendRuntimeId,
  type DatabaseEngineId,
  type ScriptLanguageId,
  type AuthProviderId,
  type PaymentProviderId,
  type IntegrationToolId,
} from '../types/studio';
import type { ViewportSize } from './UnifiedStudioWorkspace';

interface StudioConfigDrawerProps {
  config: StudioProjectConfig;
  onChangeConfig: (updater: (prev: StudioProjectConfig) => StudioProjectConfig) => void;
  viewport: ViewportSize;
  onViewportChange: (vp: ViewportSize) => void;
  hasBuiltApp: boolean;
  isBuildingApp: boolean;
  isInspectMode: boolean;
  onToggleInspectMode: () => void;
  onQuickRefine: (instruction: string) => void;
  onQuickTemplate: (prompt: string, label: string) => void;
  dependencies: StudioDependencyItem[];
  onSyncDependencies: (addPkg?: string, removePkg?: string) => void;
  isSyncingDeps: boolean;
  onDownloadZip?: () => void;
  onDownloadHtml?: () => void;
}

type SectionKey = 'category' | 'stack' | 'coding' | 'tools' | 'deps' | 'preview';

export const StudioConfigDrawer: React.FC<StudioConfigDrawerProps> = ({
  config,
  onChangeConfig,
  viewport,
  onViewportChange,
  hasBuiltApp,
  isBuildingApp,
  isInspectMode,
  onToggleInspectMode,
  onQuickRefine,
  onQuickTemplate,
  dependencies,
  onSyncDependencies,
  isSyncingDeps,
  onDownloadZip,
  onDownloadHtml,
}) => {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    category: true,
    stack: false,
    coding: false,
    tools: false,
    deps: false,
    preview: true,
  });
  const [newPkgInput, setNewPkgInput] = useState('');

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectCategory = (catId: ProjectCategoryId) => {
    const meta = CATEGORY_CATALOG.find((c) => c.id === catId);
    onChangeConfig((prev) => ({
      ...prev,
      category: catId,
      ...(meta?.recommendedPreset || {}),
    }));
  };

  const toggleIntegration = (toolId: IntegrationToolId) => {
    onChangeConfig((prev) => {
      const exists = prev.integrations.includes(toolId);
      return {
        ...prev,
        integrations: exists
          ? prev.integrations.filter((t) => t !== toolId)
          : [...prev.integrations, toolId],
      };
    });
  };

  const renderAccordionHeader = (
    key: SectionKey,
    title: string,
    summary: string,
    Icon: React.ComponentType<{ className?: string }>
  ) => (
    <button
      onClick={() => toggleSection(key)}
      className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[#1E1F20] transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-medium text-[#E3E3E3] truncate">{title}</div>
          <div className="text-[11px] text-[#8E918F] truncate">{summary}</div>
        </div>
      </div>
      {openSections[key] ? (
        <ChevronDown className="w-3.5 h-3.5 text-[#8E918F] shrink-0" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 text-[#8E918F] shrink-0" />
      )}
    </button>
  );

  const activeCategoryObj = CATEGORY_CATALOG.find((c) => c.id === config.category);

  return (
    <div className="space-y-2.5 select-none">
      {/* 1. Project Category Accordion */}
      <div className="rounded-xl border border-[#2A2B2F] bg-[#18191B] overflow-hidden">
        {renderAccordionHeader(
          'category',
          '1. Project Category & Output',
          activeCategoryObj?.label || config.category,
          Layers
        )}
        {openSections.category && (
          <div className="px-3 pb-3 pt-1 border-t border-[#252629] grid grid-cols-1 gap-1.5">
            {CATEGORY_CATALOG.map((item) => {
              const active = config.category === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectCategory(item.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${
                    active
                      ? 'bg-[#222B3A] border-[#4A6B9C] text-white'
                      : 'bg-[#141517] border-[#26282C] text-[#C4C7C5] hover:border-[#3A3D44]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{item.label}</span>
                    {!hasBuiltApp && active && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickTemplate(item.samplePrompt, item.label);
                        }}
                        className="text-[10px] text-[#8AB4F8] hover:underline cursor-pointer"
                      >
                        Build sample
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8E918F] mt-0.5">{item.shortDesc}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Tech Stack & Frameworks Accordion */}
      <div className="rounded-xl border border-[#2A2B2F] bg-[#18191B] overflow-hidden">
        {renderAccordionHeader(
          'stack',
          '2. Frameworks, Runtime & Database',
          `${config.frontendFramework} · ${config.backendRuntime} · ${config.database}`,
          Cpu
        )}
        {openSections.stack && (
          <div className="px-3 pb-3 pt-2 border-t border-[#252629] space-y-2.5 text-xs">
            <div>
              <label className="text-[11px] text-[#9AA0A6] block mb-1">Frontend Framework</label>
              <select
                value={config.frontendFramework}
                onChange={(e) =>
                  onChangeConfig((p) => ({ ...p, frontendFramework: e.target.value as FrontendFrameworkId }))
                }
                className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
              >
                <option value="react_vite">React + Vite + Tailwind</option>
                <option value="vanilla_tailwind">HTML5 + Tailwind + ES6</option>
                <option value="nextjs">Next.js App Router</option>
                <option value="vue_vite">Vue 3 + Vite</option>
                <option value="canvas_threejs">Three.js / Canvas Engine</option>
                <option value="none">None (Backend / CLI only)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Backend Runtime</label>
                <select
                  value={config.backendRuntime}
                  onChange={(e) =>
                    onChangeConfig((p) => ({ ...p, backendRuntime: e.target.value as BackendRuntimeId }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="none">Client-Only</option>
                  <option value="node_express">Node + Express</option>
                  <option value="node_fastify">Node + Fastify</option>
                  <option value="python_fastapi">Python + FastAPI</option>
                  <option value="go_gin">Go + Gin</option>
                  <option value="edge_worker">Edge Worker</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Database Engine</label>
                <select
                  value={config.database}
                  onChange={(e) =>
                    onChangeConfig((p) => ({ ...p, database: e.target.value as DatabaseEngineId }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="localstorage">LocalStorage / IndexedDB</option>
                  <option value="firestore">Firebase Firestore</option>
                  <option value="postgresql">PostgreSQL (Drizzle)</option>
                  <option value="sqlite">SQLite</option>
                  <option value="supabase">Supabase Postgres</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Auth Provider</label>
                <select
                  value={config.authProvider}
                  onChange={(e) =>
                    onChangeConfig((p) => ({ ...p, authProvider: e.target.value as AuthProviderId }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="none">No Auth</option>
                  <option value="firebase_auth">Firebase Auth</option>
                  <option value="jwt_custom">JWT + Sessions</option>
                  <option value="oauth2">OAuth 2.0</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Payments</label>
                <select
                  value={config.paymentProvider}
                  onChange={(e) =>
                    onChangeConfig((p) => ({ ...p, paymentProvider: e.target.value as PaymentProviderId }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="none">None</option>
                  <option value="stripe">Stripe Subscriptions</option>
                  <option value="lemonsqueezy">Lemon Squeezy</option>
                </select>
              </div>
            </div>

            {config.category === 'script_cli' && (
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Script / CLI Language</label>
                <select
                  value={config.scriptLanguage}
                  onChange={(e) =>
                    onChangeConfig((p) => ({ ...p, scriptLanguage: e.target.value as ScriptLanguageId }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="python">Python 3.12</option>
                  <option value="typescript">Node.js + TypeScript</option>
                  <option value="javascript">Node.js (ES6)</option>
                  <option value="go">Go (Golang)</option>
                  <option value="rust">Rust (Cargo)</option>
                  <option value="bash">Bash Shell</option>
                  <option value="sql">SQL Analytics / DDL</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Coding Parameters Accordion */}
      <div className="rounded-xl border border-[#2A2B2F] bg-[#18191B] overflow-hidden">
        {renderAccordionHeader(
          'coding',
          '3. Coding Parameters & Quality',
          `${config.codingParams.architecturePattern} · ${config.codingParams.themeMode}`,
          SlidersHorizontal
        )}
        {openSections.coding && (
          <div className="px-3 pb-3 pt-2 border-t border-[#252629] space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">Architecture</label>
                <select
                  value={config.codingParams.architecturePattern}
                  onChange={(e) =>
                    onChangeConfig((p) => ({
                      ...p,
                      codingParams: {
                        ...p.codingParams,
                        architecturePattern: e.target.value as 'modular_clean' | 'mvc_layered' | 'single_bundle',
                      },
                    }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="modular_clean">Modular Clean</option>
                  <option value="mvc_layered">MVC Layered</option>
                  <option value="single_bundle">Single Bundle</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#9AA0A6] block mb-1">UI Theme</label>
                <select
                  value={config.codingParams.themeMode}
                  onChange={(e) =>
                    onChangeConfig((p) => ({
                      ...p,
                      codingParams: {
                        ...p.codingParams,
                        themeMode: e.target.value as 'dark' | 'light' | 'system_toggle',
                      },
                    }))
                  }
                  className="w-full bg-[#121315] border border-[#2F3135] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                >
                  <option value="dark">Dark Slate</option>
                  <option value="light">Clean Light</option>
                  <option value="system_toggle">Theme Toggle</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['strictTypeScript', 'Strict TypeScript'],
                  ['responsiveMobileFirst', 'Mobile-First'],
                  ['securityHardening', 'Security Hardened'],
                  ['includeSeoMeta', 'SEO Meta & OG'],
                  ['includeUnitTests', 'Generate Unit Tests'],
                  ['includePwaManifest', 'PWA Offline Support'],
                ] as const
              ).map(([field, label]) => (
                <label
                  key={field}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#141517] border border-[#26282C] cursor-pointer hover:border-[#3A3D44]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(config.codingParams[field])}
                    onChange={(e) =>
                      onChangeConfig((p) => ({
                        ...p,
                        codingParams: {
                          ...p.codingParams,
                          [field]: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-[#4A4D54] accent-[#8AB4F8]"
                  />
                  <span className="text-[11px] text-[#D4D7DD] truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Tools & 3rd-Party Integrations Accordion */}
      <div className="rounded-xl border border-[#2A2B2F] bg-[#18191B] overflow-hidden">
        {renderAccordionHeader(
          'tools',
          '4. Tools & 3rd-Party Platforms',
          config.integrations.length > 0 ? `${config.integrations.length} active` : 'None selected',
          Plug
        )}
        {openSections.tools && (
          <div className="px-3 pb-3 pt-2 border-t border-[#252629] space-y-1.5">
            {INTEGRATION_OPTIONS.map((tool) => {
              const checked = config.integrations.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleIntegration(tool.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                    checked
                      ? 'bg-[#222B3A] border-[#4A6B9C] text-white'
                      : 'bg-[#141517] border-[#26282C] text-[#C4C7C5] hover:border-[#3A3D44]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{tool.label}</div>
                    <div className="text-[11px] text-[#8E918F] truncate">{tool.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="accent-[#8AB4F8] pointer-events-none shrink-0"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Dependencies & Packages Accordion */}
      <div className="rounded-xl border border-[#2A2B2F] bg-[#18191B] overflow-hidden">
        {renderAccordionHeader(
          'deps',
          '5. Dependencies & Packages',
          `${dependencies.length} resolved`,
          Package
        )}
        {openSections.deps && (
          <div className="px-3 pb-3 pt-2 border-t border-[#252629] space-y-2.5 text-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPkgInput.trim()) return;
                onSyncDependencies(newPkgInput.trim());
                setNewPkgInput('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={newPkgInput}
                onChange={(e) => setNewPkgInput(e.target.value)}
                placeholder="Add package (e.g. zod, axios, pandas)"
                className="flex-1 bg-[#121315] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#8AB4F8]"
              />
              <button
                type="submit"
                disabled={isSyncingDeps || !newPkgInput.trim()}
                className="p-1.5 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-white disabled:opacity-50"
                title="Add package & sync manifest"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSyncDependencies()}
                disabled={isSyncingDeps}
                className="p-1.5 rounded-lg bg-[#1E1F20] hover:bg-[#2B2D30] border border-[#2F3135] text-[#C4C7C5]"
                title="Re-scan imports & sync package.json"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDeps ? 'animate-spin' : ''}`} />
              </button>
            </form>

            {dependencies.length === 0 ? (
              <p className="text-[11px] text-[#8E918F]">
                No external packages required yet. Generate a project or add packages above.
              </p>
            ) : (
              <div className="space-y-1 max-h-44 overflow-y-auto chat-scroll-area">
                {dependencies.map((dep) => (
                  <div
                    key={`${dep.ecosystem}:${dep.name}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#141517] border border-[#26282C] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-white truncate">
                        {dep.name} <span className="text-[#8E918F]">{dep.version}</span>
                      </div>
                      <div className="text-[10px] text-[#8E918F]">
                        {dep.ecosystem} · {dep.source}
                      </div>
                    </div>
                    {dep.source === 'manual' && (
                      <button
                        onClick={() => onSyncDependencies(undefined, dep.name)}
                        className="p-1 rounded text-[#8E918F] hover:text-red-400"
                        title="Remove package"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview & Quick Refactor Tools */}
      <div className="rounded-xl border border-[#2A2B2F] bg-[#18191B] p-3 space-y-3">
        <div>
          <label className="text-[11px] font-medium text-[#C4C7C5] block mb-1.5">
            Preview Viewport
          </label>
          <div className="grid grid-cols-4 gap-1 bg-[#131416] p-1 rounded-lg border border-[#282A2E]">
            {[
              { id: 'desktop', Icon: Monitor },
              { id: 'laptop', Icon: Laptop },
              { id: 'tablet', Icon: Tablet },
              { id: 'mobile', Icon: Smartphone },
            ].map(({ id, Icon }) => (
              <button
                key={id}
                onClick={() => onViewportChange(id as ViewportSize)}
                className={`py-1.5 rounded flex items-center justify-center transition-colors ${
                  viewport === id
                    ? 'bg-[#2B2D30] text-white'
                    : 'text-[#8E918F] hover:text-white'
                }`}
                title={id}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {hasBuiltApp && (
          <div className="space-y-1.5">
            <button
              onClick={onToggleInspectMode}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                isInspectMode
                  ? 'bg-[#1F2A3C] border-[#8AB4F8] text-white'
                  : 'bg-[#141517] hover:bg-[#1E1F20] border-[#2C2D30] text-[#E3E3E3]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>{isInspectMode ? 'Inspecting Preview...' : 'Click-to-Target Element'}</span>
              </span>
            </button>

            {[
              'Add Dark/Light Theme Toggle',
              'Add Export to CSV & JSON',
              'Add Unit Tests & Error Boundaries',
            ].map((action) => (
              <button
                key={action}
                onClick={() => onQuickRefine(action)}
                disabled={isBuildingApp}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#141517] hover:bg-[#1E1F20] border border-[#2C2D30] text-[11px] text-[#D4D7DD] transition-colors disabled:opacity-50"
              >
                + {action}
              </button>
            ))}

            {(onDownloadZip || onDownloadHtml) && (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {onDownloadZip && (
                  <button
                    onClick={onDownloadZip}
                    className="py-1.5 rounded-lg bg-[#2B2D30] hover:bg-[#35373C] text-xs font-medium text-white flex items-center justify-center gap-1.5"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Export ZIP</span>
                  </button>
                )}
                {onDownloadHtml && (
                  <button
                    onClick={onDownloadHtml}
                    className="py-1.5 rounded-lg bg-[#252629] hover:bg-[#323438] text-xs font-medium text-white flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>HTML</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
