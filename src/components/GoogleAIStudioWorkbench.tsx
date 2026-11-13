import React, { useState, useEffect } from 'react';
import {
  Plus,
  Play,
  Copy,
  Check,
  Trash2,
  Download,
  ExternalLink,
  Search,
  LayoutGrid,
  Sparkles,
  Key,
  Terminal,
  Laptop,
  Monitor,
  Tablet,
  Smartphone,
  Gamepad2,
  Box,
  Glasses,
  Loader2,
} from 'lucide-react';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
  ViewportSize,
} from './UnifiedStudioWorkspace';

export interface StudioApp {
  id: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  tag?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  code: string;
  files?: {
    'index.html': string;
    'app.js'?: string;
    'styles.css'?: string;
    'architecture.md'?: string;
    'schema.json'?: string;
    [key: string]: string | undefined;
  };
  agentSteps?: Array<{
    step: number;
    phase: string;
    title: string;
    status: 'complete' | 'in_progress' | 'pending';
    details: string;
    timestamp: string;
  }>;
}

interface GoogleAIStudioWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
}

const CODE_MODES = [
  { id: 'Default mode', label: 'Default', description: 'Balanced full-stack SPA synthesis' },
  { id: 'Prototype mode', label: 'Prototype', description: 'Rapid interactive UI & layout prototyping' },
  { id: 'Fullstack mode', label: 'Fullstack', description: 'Multi-file architecture, schema & persistence' },
  { id: 'Mobile mode', label: 'Mobile', description: 'Responsive mobile-first touch interface' },
];

export const GoogleAIStudioWorkbench: React.FC<GoogleAIStudioWorkbenchProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  // Empty Workspace by default
  const [prompt, setPrompt] = useState<string>('');
  const [selectedBuildMode, setSelectedBuildMode] = useState<string>('Default mode');
  const [isBuildingApp, setIsBuildingApp] = useState<boolean>(false);
  const [builtApp, setBuiltApp] = useState<StudioApp | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);

  const [activeFileTab, setActiveFileTab] = useState<
    'index.html' | 'app.js' | 'styles.css' | 'architecture.md' | 'schema.json'
  >('index.html');
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [savedApps, setSavedApps] = useState<StudioApp[]>([]);
  const [galleryApps, setGalleryApps] = useState<StudioApp[]>([]);
  const [filesFilter, setFilesFilter] = useState<'my' | 'gallery'>('my');
  const [fileSearch, setFileSearch] = useState<string>('');

  // Gemini API Key State
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [isGeminiActive, setIsGeminiActive] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/keys')
      .then((res) => res.json())
      .then((data) => {
        if (data?.geminiConfigured) setIsGeminiActive(true);
      })
      .catch(() => {});

    const cachedKey = localStorage.getItem('raone_gemini_api_key');
    if (cachedKey) {
      setGeminiKeyInput(cachedKey);
      setIsGeminiActive(true);
    }

    fetch('/api/studio/apps')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedApps(data);
      })
      .catch(() => {});

    fetch('/api/studio/gallery')
      .then((res) => res.json())
      .then((data) => {
        if (data?.gallery && Array.isArray(data.gallery)) {
          setGalleryApps(data.gallery);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const handleSaveGeminiKey = async () => {
    const key = geminiKeyInput.trim();
    if (!key) return;
    setIsTestingKey(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: key }),
      });
      const data = await res.json();
      if (data?.success) {
        localStorage.setItem('raone_gemini_api_key', key);
        setIsGeminiActive(true);
        showToast('Gemini API Key connected.');
      } else {
        showToast(data?.error || 'Failed to verify key.');
      }
    } catch (err: any) {
      showToast('Error saving key: ' + err.message);
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSubmitPrompt = async (overridePrompt?: string, category = 'general') => {
    const finalPrompt = (overridePrompt ?? prompt).trim();
    if (!finalPrompt || isBuildingApp) return;

    const startMs = Date.now();
    if (!overridePrompt) setPrompt('');

    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: finalPrompt },
    ]);
    setIsBuildingApp(true);
    setAgentLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Running ${selectedBuildMode} for: "${finalPrompt}"`,
    ]);

    try {
      if (!builtApp) {
        const activeKey = localStorage.getItem('raone_gemini_api_key') || undefined;
        const res = await fetch('/api/studio/build-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: finalPrompt,
            mode: selectedBuildMode,
            category,
            geminiApiKey: activeKey,
          }),
        });
        const data = await res.json();
        const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
        if (data?.app) {
          setBuiltApp(data.app);
          setSavedApps((prev) => [data.app, ...prev]);
          setIframeKey((prev) => prev + 1);
          setRightTab('preview');
          setAgentLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Built "${data.app.title}" in ${elapsed}.`,
          ]);
          setTurns((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              modelLabel: 'RaOne Code Engine',
              durationSec: elapsed,
              content: `Built "${data.app.title}". Preview is live on the right canvas.`,
              details: [
                data.app.description || 'Interactive HTML5, Tailwind & ES6 runtime.',
                `Mode: ${selectedBuildMode}`,
              ],
            },
          ]);
          showToast('Application built successfully.');
        } else {
          showToast(data?.error || 'Could not build application.');
        }
      } else {
        const res = await fetch('/api/studio/refine-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app: builtApp,
            refinementPrompt: finalPrompt,
          }),
        });
        const data = await res.json();
        const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
        if (data?.app) {
          setBuiltApp(data.app);
          setSavedApps((prev) =>
            prev.map((a) => (a.id === data.app.id ? data.app : a))
          );
          setIframeKey((prev) => prev + 1);
          setRightTab('preview');
          setAgentLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Refined "${data.app.title}" in ${elapsed}.`,
          ]);
          setTurns((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              modelLabel: 'RaOne Code Engine',
              durationSec: elapsed,
              content: `Updated "${data.app.title}" with requested changes.`,
            },
          ]);
          showToast('Application updated.');
        }
      }
    } catch (err: any) {
      showToast('Build error: ' + err.message);
    } finally {
      setIsBuildingApp(false);
    }
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/studio/apps/${id}`, { method: 'DELETE' });
      setSavedApps((prev) => prev.filter((a) => a.id !== id));
      if (builtApp?.id === id) setBuiltApp(null);
      showToast('Application deleted.');
    } catch {
      showToast('Failed to delete application.');
    }
  };

  const handleDownloadApp = (app: StudioApp) => {
    const blob = new Blob([app.code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded HTML bundle.');
  };

  const handleResetWorkspace = () => {
    setBuiltApp(null);
    setTurns([]);
    setPrompt('');
    setRightTab('preview');
    showToast('Started empty workspace.');
  };

  const previewContent = builtApp ? (
    <div className="h-full w-full flex flex-col bg-[#0E0F10]">
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-200 rounded-xl overflow-hidden border border-[#282A2E] bg-black ${
            viewport === 'mobile'
              ? 'w-[375px]'
              : viewport === 'tablet'
              ? 'w-[768px]'
              : viewport === 'laptop'
              ? 'w-[1024px]'
              : 'w-full'
          }`}
        >
          <iframe
            key={iframeKey}
            title={builtApp.title}
            srcDoc={builtApp.code}
            sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-downloads"
            className="w-full h-full border-none bg-black"
          />
        </div>
      </div>
    </div>
  ) : null;

  const codeContent = builtApp ? (
    <div className="h-full flex flex-col bg-[#0E0F10]">
      <div className="h-10 px-3 bg-[#161719] border-b border-[#252629] flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          {(
            ['index.html', 'app.js', 'styles.css', 'architecture.md', 'schema.json'] as const
          ).map((file) => (
            <button
              key={file}
              onClick={() => setActiveFileTab(file)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap ${
                activeFileTab === file
                  ? 'bg-[#2B2D30] text-white'
                  : 'text-[#8E918F] hover:text-white hover:bg-[#1E1F20]'
              }`}
            >
              {file}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const codeToCopy = builtApp.files?.[activeFileTab] || builtApp.code;
              navigator.clipboard.writeText(codeToCopy);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 1800);
              showToast('Copied file contents.');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1E1F20] hover:bg-[#2B2D30] border border-[#323438] text-xs text-[#E3E3E3]"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={() => handleDownloadApp(builtApp)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2B2D30] hover:bg-[#36383D] text-xs text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export HTML</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-xs text-[#D4D7DD] leading-relaxed chat-scroll-area select-text">
        <pre className="whitespace-pre-wrap">
          <code>
            {builtApp.files?.[activeFileTab] ||
              (activeFileTab === 'index.html' ? builtApp.code : '// No extra file content')}
          </code>
        </pre>
      </div>
    </div>
  ) : (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-[#E3E3E3] mb-1">No active source code</p>
      <p className="text-xs text-[#8E918F] max-w-sm">
        Build a new application using the prompt box on the left or open an existing app from Files.
      </p>
    </div>
  );

  const visibleApps = (filesFilter === 'my' ? savedApps : galleryApps).filter(
    (app) =>
      !fileSearch.trim() ||
      app.title.toLowerCase().includes(fileSearch.toLowerCase()) ||
      app.description?.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filesContent = (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          <button
            onClick={() => setFilesFilter('my')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filesFilter === 'my' ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            My Apps ({savedApps.length})
          </button>
          <button
            onClick={() => setFilesFilter('gallery')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filesFilter === 'gallery'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Gallery ({galleryApps.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
          <input
            type="text"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="Search apps..."
            className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none focus:border-[#4A4D54] w-56"
          />
        </div>
      </div>

      {visibleApps.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No apps found in this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleApps.map((app) => (
            <div
              key={app.id}
              onClick={() => {
                setBuiltApp(app);
                setIframeKey((k) => k + 1);
                setRightTab('preview');
              }}
              className="p-4 rounded-xl bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] text-[#8E918F] truncate">
                    {app.tag || app.category || 'Application'}
                  </span>
                  {filesFilter === 'my' && (
                    <button
                      onClick={(e) => handleDeleteApp(app.id, e)}
                      className="p-1 rounded text-[#8E918F] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete app"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <h4 className="text-sm font-medium text-white truncate">{app.title}</h4>
                <p className="text-xs text-[#8E918F] mt-1 line-clamp-2 leading-relaxed">
                  {app.description}
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[#252629] flex items-center justify-between text-[11px] text-[#8E918F]">
                <span className="tabular-nums">
                  {new Date(app.createdAt || Date.now()).toLocaleDateString()}
                </span>
                <span className="text-[#8AB4F8] font-medium">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editDrawerContent = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Viewport Size
        </label>
        <div className="grid grid-cols-4 gap-1 bg-[#1B1C1E] p-1 rounded-lg border border-[#2C2D30]">
          {[
            { id: 'desktop', Icon: Monitor },
            { id: 'laptop', Icon: Laptop },
            { id: 'tablet', Icon: Tablet },
            { id: 'mobile', Icon: Smartphone },
          ].map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setViewport(id as ViewportSize)}
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

      {builtApp && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#C4C7C5] block">
            Quick Refactor Actions
          </label>
          {[
            'Add Dark/Light Theme Toggle',
            'Add Export to CSV',
            'Add Realtime Search & Filter',
            'Improve responsive mobile layout',
          ].map((action) => (
            <button
              key={action}
              onClick={() => handleSubmitPrompt(action)}
              disabled={isBuildingApp}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#1E1F20] hover:bg-[#28292C] border border-[#2F3135] text-xs text-[#E3E3E3] transition-colors disabled:opacity-50"
            >
              + {action}
            </button>
          ))}
          <button
            onClick={() => handleDownloadApp(builtApp)}
            className="w-full mt-2 py-2 rounded-lg bg-[#2B2D30] hover:bg-[#35373C] text-xs font-medium text-white flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download HTML Bundle</span>
          </button>
        </div>
      )}

      {!builtApp && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#C4C7C5] block">
            Starter Templates
          </label>
          {[
            { label: 'Arcade 2D Game', icon: Gamepad2, p: 'Retro Cyberpunk Space Shooter 2D Arcade Game' },
            { label: 'Three.js 3D Scene', icon: Box, p: 'Three.js 3D Orbital Solar Simulation with planetary controls' },
            { label: 'WebXR Showcase', icon: Glasses, p: 'WebXR Spatial 3D Product Showcase' },
          ].map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.label}
                onClick={() => handleSubmitPrompt(tpl.p, tpl.label)}
                disabled={isBuildingApp}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E1F20] hover:bg-[#28292C] border border-[#2F3135] text-xs text-[#E3E3E3] transition-colors text-left"
              >
                <Icon className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0" />
                <span>{tpl.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const composerAddContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            const lucky = [
              'Interactive Solar System 3D with planetary orbits & camera zoom',
              'Kanban Productivity Board with drag and drop cards & local storage',
              'Personal Expense & Budget Tracker with interactive charts',
            ];
            const picked = lucky[Math.floor(Math.random() * lucky.length)];
            setPrompt(picked);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Insert Sample Prompt</span>
        </button>
      </div>
      <div className="text-[11px] text-[#8E918F]">
        Tip: When an app is open on the right, new prompts refine and recompile that app automatically. Click + at the top left to start a fresh app.
      </div>
    </div>
  );

  const settingsContent = (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-white flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-[#8AB4F8]" />
            Gemini API Key
          </span>
          <span className="text-[11px] text-[#9AA0A6]">
            {isGeminiActive ? 'Connected' : 'Not set'}
          </span>
        </div>
        <input
          type="password"
          value={geminiKeyInput}
          onChange={(e) => setGeminiKeyInput(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#8AB4F8]"
        />
        <div className="flex items-center justify-between pt-1">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[#8AB4F8] hover:underline flex items-center gap-1"
          >
            <span>Get key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={handleSaveGeminiKey}
            disabled={isTestingKey || !geminiKeyInput.trim()}
            className="px-3 py-1 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1"
          >
            {isTestingKey && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );

  const diagnosticsContent = (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-white">
          <Terminal className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Build Telemetry</span>
        </div>
        <div className="text-[11px] text-[#9AA0A6]">
          Engine: {selectedBuildMode} · Status: {isBuildingApp ? 'Compiling' : 'Idle'}
        </div>
      </div>
      {builtApp?.agentSteps && (
        <div className="space-y-1.5">
          {builtApp.agentSteps.map((step, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-[#1E1F20] border border-[#2C2D30] text-[11px]"
            >
              <div className="font-medium text-white">{step.phase}: {step.title}</div>
              <div className="text-[#8E918F] mt-0.5">{step.details}</div>
            </div>
          ))}
        </div>
      )}
      {agentLogs.length > 0 && (
        <div className="p-2.5 rounded-lg bg-[#0E0F10] border border-[#252629] font-mono text-[11px] text-[#9AA0A6] space-y-1 max-h-48 overflow-y-auto">
          {agentLogs.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Code Studio"
      workspaceTitle={builtApp ? builtApp.title : 'Untitled Workspace'}
      modelOptions={CODE_MODES}
      selectedModel={selectedBuildMode}
      onSelectModel={setSelectedBuildMode}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={() => handleSubmitPrompt()}
      isGenerating={isBuildingApp}
      turns={turns}
      onResetWorkspace={handleResetWorkspace}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={builtApp ? `/${builtApp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '/'}
      viewport={viewport}
      onViewportChange={setViewport}
      onRefresh={() => {
        setIframeKey((k) => k + 1);
      }}
      onRemix={() => {
        if (builtApp) {
          setPrompt(`Create a fresh variation of ${builtApp.title}: ${builtApp.description}`);
          showToast('Prompt loaded for remix.');
        } else {
          showToast('Build or select an app first to remix.');
        }
      }}
      onShare={() => {
        if (builtApp) {
          navigator.clipboard?.writeText(builtApp.code).catch(() => {});
          showToast('App HTML source copied to clipboard.');
        } else {
          navigator.clipboard?.writeText(window.location.href).catch(() => {});
          showToast('Workspace link copied.');
        }
      }}
      onPublish={() => {
        if (builtApp) {
          handleDownloadApp(builtApp);
        } else {
          showToast('Generate an application first to publish/export.');
        }
      }}
      publishLabel="Publish"
      filesCount={savedApps.length + galleryApps.length}
      hasActiveItem={!!builtApp}
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      diagnosticsContent={diagnosticsContent}
      settingsContent={settingsContent}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Describe an app on the left to build, or browse saved applications."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
    />
  );
};
