import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Check,
  Trash2,
  Download,
  ExternalLink,
  Search,
  LayoutGrid,
  Sparkles,
  Key,
  Terminal,
  Loader2,
  Cpu,
  AlertTriangle,
  Wrench,
  Crosshair,
  Paperclip,
  X,
  GitFork,
  Globe,
  Copy,
  FolderArchive,
  History,
  Wifi,
  Wand2,
  ShieldCheck,
  Rocket,
} from 'lucide-react';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
  ViewportSize,
} from './UnifiedStudioWorkspace';
import { StudioCodeEditor } from './StudioCodeEditor';
import { StudioConfigDrawer } from './StudioConfigDrawer';
import { StudioAuditDrawer } from './StudioAuditDrawer';
import { StudioDeployModal } from './StudioDeployModal';
import {
  DEFAULT_PROJECT_CONFIG,
  CATEGORY_CATALOG,
  type StudioProjectConfig,
  type StudioAuditReport,
  type StudioDependencyItem,
  type PromptEnhanceDepth,
  type DeployTargetId,
} from '../types/studio';
import {
  bundleFilesToHtml,
  injectPreviewTelemetry,
  buildLocalDirectStudioPrompt,
  createProjectZipBlob,
  type StudioAttachmentPayload,
} from '../utils/studioCompiler';
import { parseSseBuffer, flushSseBuffer } from '../utils/sseParser';
import {
  readLocalLlmConfig,
  saveLocalLlmConfig,
  probeBrowserLocalServers,
  streamLocalLlmFromBrowser,
  type LocalLlmConfig,
} from '../utils/localLlmClient';

export interface StudioVersionSnapshot {
  version: number;
  prompt: string;
  mode: string;
  providerUsed: string;
  modelUsed: string;
  createdAt: string;
  code: string;
  files: Record<string, string>;
}

export interface StudioApp {
  id: string;
  title: string;
  description: string;
  category: string;
  mode?: string;
  framework?: string;
  providerUsed?: string;
  modelUsed?: string;
  icon?: string;
  tag?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  code: string;
  files?: Record<string, string | undefined>;
  projectConfig?: StudioProjectConfig;
  auditReport?: StudioAuditReport;
  dependencies?: StudioDependencyItem[];
  envVariables?: string[];
  turns?: WorkspaceTurn[];
  versions?: StudioVersionSnapshot[];
  currentVersion?: number;
  publishMeta?: {
    isPublished: boolean;
    shareId?: string;
    shareUrl?: string;
    publishedAt?: string;
  };
  diagnostics?: {
    syntaxOk: boolean;
    errors: string[];
    warnings: string[];
    bundleBytes: number;
    fileCount: number;
    validatedAt: string;
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
  { id: 'Default mode', label: 'Default', description: 'Balanced interactive SPA synthesis' },
  { id: 'Prototype mode', label: 'Prototype', description: 'Multi-screen clickable UX journeys' },
  { id: 'Fullstack mode', label: 'Fullstack', description: 'REST API bridge, schema & inspector' },
  { id: 'Mobile mode', label: 'Mobile', description: '375px mobile-first touch interface' },
];

type StudioBrainOption = {
  id: string;
  label: string;
  provider: string;
};

const STUDIO_BRAINS: StudioBrainOption[] = [
  { id: 'auto', label: 'Auto (Cloud Priority)', provider: 'auto' },
  { id: 'gemini', label: 'Google Gemini', provider: 'gemini' },
  { id: 'groq', label: 'Groq LPU (Llama)', provider: 'groq' },
  { id: 'openai', label: 'OpenAI GPT-4o', provider: 'openai' },
  { id: 'deepseek', label: 'DeepSeek', provider: 'deepseek' },
  { id: 'anthropic', label: 'Anthropic Claude', provider: 'anthropic' },
  { id: 'local_direct', label: 'Local llama.cpp (Browser Direct)', provider: 'local_direct' },
  { id: 'local', label: 'Local llama.cpp (Backend Proxy)', provider: 'local' },
];

export const GoogleAIStudioWorkbench: React.FC<GoogleAIStudioWorkbenchProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  // Workspace Core State
  const [prompt, setPrompt] = useState<string>('');
  const [selectedBuildMode, setSelectedBuildMode] = useState<string>('Default mode');
  const [selectedBrain, setSelectedBrain] = useState<string>('auto');
  const [isBuildingApp, setIsBuildingApp] = useState<boolean>(false);
  const [builtApp, setBuiltApp] = useState<StudioApp | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);

  // Live SSE Streaming Status State
  const [streamPhase, setStreamPhase] = useState<string>('');
  const [streamDetail, setStreamDetail] = useState<string>('');
  const [streamChars, setStreamChars] = useState<number>(0);

  // Editable Multi-File IDE State
  const [activeFileTab, setActiveFileTab] = useState<string>('index.html');
  const [draftFiles, setDraftFiles] = useState<Record<string, string | undefined>>({});
  const [isCodeDirty, setIsCodeDirty] = useState<boolean>(false);
  const [isSavingCode, setIsSavingCode] = useState<boolean>(false);

  // Preview Sandbox & Telemetry State
  const [iframeKey, setIframeKey] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [isAutoFixing, setIsAutoFixing] = useState<boolean>(false);
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);
  const [selectedElementContext, setSelectedElementContext] = useState<string | null>(null);

  // Attachments & Saved Apps
  const [attachments, setAttachments] = useState<StudioAttachmentPayload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [savedApps, setSavedApps] = useState<StudioApp[]>([]);
  const [galleryApps, setGalleryApps] = useState<StudioApp[]>([]);
  const [filesFilter, setFilesFilter] = useState<'my' | 'gallery'>('my');
  const [fileSearch, setFileSearch] = useState<string>('');

  // Share / Publish / Deploy Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Silicon Valley Code Studio Config, Enhancer, Audit & Dependency State
  const [projectConfig, setProjectConfig] = useState<StudioProjectConfig>(DEFAULT_PROJECT_CONFIG);
  const [enhanceDepth, setEnhanceDepth] = useState<PromptEnhanceDepth>('fullstack');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isFixingAudit, setIsFixingAudit] = useState<boolean>(false);
  const [isSyncingDeps, setIsSyncingDeps] = useState<boolean>(false);

  // Keys & Local llama.cpp Config State
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [providerStatus, setProviderStatus] = useState<Record<string, boolean>>({});
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [localCfg, setLocalCfg] = useState<LocalLlmConfig>(() => readLocalLlmConfig());
  const [isProbingLocal, setIsProbingLocal] = useState<boolean>(false);
  const [detectedLocalModels, setDetectedLocalModels] = useState<string[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  // Load keys, saved apps, gallery, and local config when studio opens
  useEffect(() => {
    if (!isOpen) return;

    setLocalCfg(readLocalLlmConfig());

    fetch('/api/keys')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setProviderStatus({
            gemini: Boolean(data.geminiConfigured),
            groq: Boolean(data.groqConfigured),
            openai: Boolean(data.openAiConfigured),
            anthropic: Boolean(data.anthropicConfigured),
            deepseek: Boolean(data.deepSeekConfigured),
            local: Boolean(data.localLlmConfigured),
          });
        }
      })
      .catch(() => {});

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

  // Sync draftFiles when builtApp updates
  useEffect(() => {
    if (!builtApp) {
      setDraftFiles({});
      setIsCodeDirty(false);
      return;
    }
    const baseFiles: Record<string, string | undefined> = {
      'index.html': builtApp.files?.['index.html'] || builtApp.code,
      'styles.css': builtApp.files?.['styles.css'] || '/* Custom CSS */',
      'app.js': builtApp.files?.['app.js'] || '// Application logic',
      ...(builtApp.files || {}),
    };
    setDraftFiles(baseFiles);
    if (!baseFiles[activeFileTab]) {
      setActiveFileTab('index.html');
    }
    setIsCodeDirty(false);
  }, [builtApp]);

  // Listen to preview iframe postMessage events (runtime errors, console errors, click-to-inspect)
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (ev: MessageEvent) => {
      const data = ev?.data;
      if (!data || data.source !== 'raone-preview') return;

      if (data.type === 'runtime_error' || data.type === 'console_error') {
        const msg = String(data.message || 'Unknown preview runtime error').trim();
        if (!msg) return;
        setRuntimeErrors((prev) => (prev.includes(msg) ? prev : [...prev, msg].slice(-12)));
        setAgentLogs((prev) => [...prev, `[Sandbox Error] ${msg}`]);
      } else if (data.type === 'element_selected') {
        const desc = `${data.selector || data.tagName}${data.textSnippet ? ` ("${data.textSnippet}")` : ''}`;
        setSelectedElementContext(desc);
        setIsInspectMode(false);
        showToast(`Selected element: ${desc}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  // Toggle element inspector inside live iframe without reloading it
  useEffect(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'raone-toggle-inspect', enabled: isInspectMode },
        '*'
      );
    } catch {
      // ignore cross-frame init race
    }
  }, [isInspectMode]);

  const handleSelectMode = (nextMode: string) => {
    setSelectedBuildMode(nextMode);
    if (nextMode === 'Mobile mode') {
      setViewport('mobile');
    } else if (viewport === 'mobile') {
      setViewport('desktop');
    }
  };

  const openSavedOrGalleryApp = (app: StudioApp) => {
    setBuiltApp(app);
    if (app.projectConfig) {
      setProjectConfig(app.projectConfig);
    }
    setTurns(Array.isArray(app.turns) ? app.turns : []);
    if (app.mode) handleSelectMode(app.mode);
    setRuntimeErrors([]);
    setSelectedElementContext(null);
    setIframeKey((k) => k + 1);
    setRightTab('preview');
  };

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
      if (res.ok && data?.success) {
        setGeminiKeyInput('');
        setProviderStatus((p) => ({ ...p, gemini: true }));
        showToast('Gemini API Key encrypted & saved to your account.');
      } else {
        showToast(data?.error || 'Sign in required or key invalid.');
      }
    } catch (err: any) {
      showToast('Error saving key: ' + err.message);
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleProbeAndSaveLocal = async () => {
    setIsProbingLocal(true);
    try {
      const results = await probeBrowserLocalServers(localCfg.baseUrl, localCfg.apiKey);
      const online = results.find((r) => r.online);
      const saved = saveLocalLlmConfig({
        ...localCfg,
        enabled: true,
        baseUrl: online ? online.baseUrl : localCfg.baseUrl,
        modelId: localCfg.modelId || online?.models?.[0] || 'local-model',
      });
      setLocalCfg(saved);
      if (online) {
        setDetectedLocalModels(online.models);
        showToast(`Connected to ${online.label} (${online.models.length} model(s))`);
      } else {
        showToast('Saved local config. Ensure llama-server --cors-allow-origin "*" is running.');
      }
    } finally {
      setIsProbingLocal(false);
    }
  };

  const handleAttachmentPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).slice(0, 3).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        if (!result) return;
        setAttachments((prev) => [
          ...prev.slice(-2),
          {
            name: file.name,
            mimeType: file.type || (isImage ? 'image/png' : 'text/plain'),
            kind: isImage ? 'image' : 'text',
            data: result,
          },
        ]);
        showToast(`Attached ${file.name}`);
      };
      if (isImage) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
    e.target.value = '';
  };

  const handleSubmitPrompt = async (overridePrompt?: string, category = 'general') => {
    const finalPrompt = (overridePrompt ?? prompt).trim();
    if (!finalPrompt || isBuildingApp) return;

    const startMs = Date.now();
    if (!overridePrompt) setPrompt('');

    const userTurn: WorkspaceTurn = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: selectedElementContext
        ? `[Target: ${selectedElementContext}] ${finalPrompt}`
        : finalPrompt,
    };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setIsBuildingApp(true);
    setStreamPhase('Initializing');
    setStreamDetail(`Preparing ${selectedBuildMode} build pipeline...`);
    setStreamChars(0);
    setRuntimeErrors([]);
    setAgentLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Running ${selectedBuildMode} (${selectedBrain}): "${finalPrompt}"`,
    ]);

    try {
      // Path 1: Client-side Browser Direct Local llama.cpp
      if (selectedBrain === 'local_direct') {
        const cfg = readLocalLlmConfig();
        setStreamPhase('Local llama.cpp (Browser Direct)');
        setStreamDetail(`Streaming directly from ${cfg.baseUrl}...`);
        const directPrompt = buildLocalDirectStudioPrompt({
          prompt: finalPrompt,
          mode: selectedBuildMode,
          existingCode: builtApp?.code,
          selectedElementContext: selectedElementContext || undefined,
          attachments,
        });

        const out = await streamLocalLlmFromBrowser({
          config: cfg,
          prompt: directPrompt,
          messages: [],
          onChunk: (acc) => {
            setStreamChars(acc.length);
          },
        });

        setStreamPhase('Validating & Saving');
        const persistRes = await fetch('/api/studio/apps/persist-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: out.text,
            prompt: finalPrompt,
            mode: selectedBuildMode,
            category,
            modelUsed: out.meta?.verifiedModel || cfg.modelId || 'local-llama-cpp',
            existingApp: builtApp || undefined,
            isRefinement: Boolean(builtApp),
            turns: [
              ...nextTurns,
              {
                id: `a_${Date.now()}`,
                role: 'assistant',
                modelLabel: `Local llama.cpp (${out.meta?.verifiedModel || 'Direct'})`,
                durationSec: `${((Date.now() - startMs) / 1000).toFixed(1)}s`,
                content: builtApp
                  ? `Updated "${builtApp.title}" locally via llama.cpp.`
                  : 'Built new application locally via Browser Direct llama.cpp.',
              },
            ],
            projectConfig,
          }),
        });
        const persistData = await persistRes.json();
        if (persistData?.app) {
          setBuiltApp(persistData.app);
          setTurns(persistData.app.turns || nextTurns);
          setSavedApps((prev) => [
            persistData.app,
            ...prev.filter((a) => a.id !== persistData.app.id),
          ]);
          setIframeKey((k) => k + 1);
          setRightTab('preview');
          setSelectedElementContext(null);
          setAttachments([]);
          showToast('Local llama.cpp build complete.');
        }
        return;
      }

      // Path 2: Silicon Valley Grade Backend SSE Streaming Build / Refine
      const isRefine = Boolean(builtApp);
      const endpoint = isRefine ? '/api/studio/refine-app/stream' : '/api/studio/build-app/stream';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRefine
            ? {
                app: builtApp,
                refinementPrompt: finalPrompt,
                mode: selectedBuildMode,
                provider: selectedBrain,
                selectedElementContext,
                attachments,
                turns: nextTurns,
                projectConfig,
              }
            : {
                prompt: finalPrompt,
                mode: selectedBuildMode,
                category: projectConfig.category || category,
                provider: selectedBrain,
                attachments,
                turns: nextTurns,
                projectConfig,
              }
        ),
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error || `Server error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalApp: StudioApp | null = null;
      let streamErrorMsg = '';

      const handleEvt = (evt: any) => {
        if (!evt || typeof evt !== 'object') return;
        if (evt.type === 'phase') {
          setStreamPhase(evt.phase || 'Compiling');
          setStreamDetail(evt.detail || '');
        } else if (evt.type === 'delta') {
          setStreamChars(Number(evt.chars || 0));
        } else if (evt.type === 'complete' && evt.app) {
          finalApp = evt.app;
        } else if (evt.type === 'error') {
          streamErrorMsg = evt.error || 'Stream error';
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBuffer(buffer);
        buffer = parsed.rest;
        parsed.events.forEach((e) => e.json && handleEvt(e.json));
      }
      flushSseBuffer(buffer).forEach((e) => e.json && handleEvt(e.json));

      if (streamErrorMsg) throw new Error(streamErrorMsg);
      if (!finalApp) throw new Error('Build stream ended without a compiled project.');

      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      const appResult = finalApp as StudioApp;
      const assistantTurn: WorkspaceTurn = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        modelLabel: `${appResult.providerUsed || 'RaOne'} · ${appResult.modelUsed || 'Code Engine'}`,
        durationSec: elapsed,
        content: isRefine
          ? `Updated "${appResult.title}" (v${appResult.currentVersion || 1}).`
          : `Built "${appResult.title}". Preview is live on the right canvas.`,
        details: [
          `Mode: ${appResult.mode || selectedBuildMode}`,
          `Files: ${Object.keys(appResult.files || {}).length} · Syntax: ${appResult.diagnostics?.syntaxOk !== false ? 'Verified' : 'Check warnings'}`,
        ],
      };

      const completedTurns = [...nextTurns, assistantTurn];
      appResult.turns = completedTurns;

      // Sync final turns to server in background so reopening app restores full conversation
      fetch(`/api/studio/apps/${appResult.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: completedTurns }),
      }).catch(() => {});

      setBuiltApp(appResult);
      setTurns(completedTurns);
      setSavedApps((prev) => [appResult, ...prev.filter((a) => a.id !== appResult.id)]);
      setIframeKey((k) => k + 1);
      setRightTab('preview');
      setSelectedElementContext(null);
      setAttachments([]);
      setAgentLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ${isRefine ? 'Refined' : 'Built'} "${appResult.title}" in ${elapsed} (${appResult.providerUsed}/${appResult.modelUsed}).`,
      ]);
      showToast(isRefine ? `Updated to v${appResult.currentVersion || 2}.` : 'Application built & verified.');
    } catch (err: any) {
      setAgentLogs((prev) => [...prev, `[Error] ${err.message}`]);
      showToast('Build error: ' + err.message);
    } finally {
      setIsBuildingApp(false);
      setStreamPhase('');
      setStreamDetail('');
    }
  };

  const handleAutoFixErrors = async () => {
    if (!builtApp || runtimeErrors.length === 0 || isAutoFixing) return;
    setIsAutoFixing(true);
    const errorsSnapshot = [...runtimeErrors];
    setAgentLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Running 1-Click AI Auto-Fix for ${errorsSnapshot.length} error(s)...`,
    ]);

    try {
      const res = await fetch('/api/studio/fix-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: builtApp,
          errors: errorsSnapshot,
          provider: selectedBrain === 'local_direct' ? 'auto' : selectedBrain,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.app) {
        throw new Error(data?.error || 'Could not auto-fix runtime errors.');
      }

      const fixedApp: StudioApp = data.app;
      const fixTurn: WorkspaceTurn = {
        id: `a_fix_${Date.now()}`,
        role: 'assistant',
        modelLabel: 'RaOne Auto-Heal Engine',
        content: `Patched ${errorsSnapshot.length} runtime issue(s) and updated to v${fixedApp.currentVersion || 2}.`,
        details: errorsSnapshot.slice(0, 3),
      };
      const updatedTurns = [...turns, fixTurn];
      fixedApp.turns = updatedTurns;
      fetch(`/api/studio/apps/${fixedApp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: updatedTurns }),
      }).catch(() => {});

      setBuiltApp(fixedApp);
      setTurns(updatedTurns);
      setSavedApps((prev) => [fixedApp, ...prev.filter((a) => a.id !== fixedApp.id)]);
      setRuntimeErrors([]);
      setIframeKey((k) => k + 1);
      showToast('Runtime error fixed and preview reloaded.');
    } catch (err: any) {
      showToast(err.message || 'Auto-fix failed.');
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleApplyManualCode = async () => {
    if (!builtApp) return;
    setIsSavingCode(true);
    try {
      const compiledHtml = bundleFilesToHtml(draftFiles);
      const res = await fetch(`/api/studio/apps/${builtApp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: draftFiles,
          code: compiledHtml,
          turns,
        }),
      });
      const data = await res.json();
      const updatedApp = data?.app || { ...builtApp, files: draftFiles, code: compiledHtml };
      setBuiltApp(updatedApp);
      setSavedApps((prev) => prev.map((a) => (a.id === updatedApp.id ? updatedApp : a)));
      setIsCodeDirty(false);
      setRuntimeErrors([]);
      setIframeKey((k) => k + 1);
      setRightTab('preview');
      showToast('Compiled & saved edits to live preview.');
    } catch (err: any) {
      showToast('Failed to save code edits: ' + err.message);
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!builtApp?.versions) return;
    const snap = builtApp.versions.find((v) => v.version === versionNumber);
    if (!snap) return;

    try {
      const res = await fetch(`/api/studio/apps/${builtApp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: snap.files,
          code: snap.code,
          currentVersion: snap.version,
        }),
      });
      const data = await res.json();
      const restored = data?.app || {
        ...builtApp,
        files: snap.files,
        code: snap.code,
        currentVersion: snap.version,
      };
      setBuiltApp(restored);
      setSavedApps((prev) => prev.map((a) => (a.id === restored.id ? restored : a)));
      setRuntimeErrors([]);
      setIframeKey((k) => k + 1);
      showToast(`Restored snapshot v${snap.version}.`);
    } catch {
      showToast('Failed to restore version.');
    }
  };

  const handleRemixApp = async (targetApp?: StudioApp, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const appToFork = targetApp || builtApp;
    if (!appToFork) {
      showToast('Build or select an app first to remix.');
      return;
    }
    try {
      const res = await fetch(`/api/studio/apps/${appToFork.id}/remix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appToFork }),
      });
      const data = await res.json();
      if (res.ok && data?.app) {
        const forked: StudioApp = data.app;
        setSavedApps((prev) => [forked, ...prev]);
        openSavedOrGalleryApp(forked);
        showToast(`Remixed "${appToFork.title}" into your workspace.`);
      } else {
        showToast(data?.error || 'Could not remix app.');
      }
    } catch (err: any) {
      showToast('Remix error: ' + err.message);
    }
  };

  const handlePublishApp = async () => {
    if (!builtApp) {
      showToast('Generate an application first to publish.');
      return;
    }
    setIsPublishing(true);
    setIsPublishModalOpen(true);
    try {
      const res = await fetch(`/api/studio/apps/${builtApp.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: builtApp }),
      });
      const data = await res.json();
      if (res.ok && data?.app) {
        setBuiltApp(data.app);
        setSavedApps((prev) => prev.map((a) => (a.id === data.app.id ? data.app : a)));
        showToast('Published live preview snapshot.');
      } else {
        showToast(data?.error || 'Publish failed.');
      }
    } catch (err: any) {
      showToast('Publish error: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/studio/apps/${id}`, { method: 'DELETE' });
      setSavedApps((prev) => prev.filter((a) => a.id !== id));
      if (builtApp?.id === id) {
        setBuiltApp(null);
        setTurns([]);
      }
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

  const handleDownloadZip = (app: StudioApp) => {
    const filesMap = isCodeDirty ? draftFiles : app.files || { 'index.html': app.code };
    const blob = createProjectZipBlob(app.title, filesMap);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_project.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded multi-file project ZIP.');
  };

  const handleResetWorkspace = () => {
    setBuiltApp(null);
    setTurns([]);
    setPrompt('');
    setRuntimeErrors([]);
    setSelectedElementContext(null);
    setAttachments([]);
    setIsInspectMode(false);
    setRightTab('preview');
    showToast('Started empty workspace.');
  };

  // Prompt Enhancer (2 words -> Professional Silicon Valley PRD prompt)
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const res = await fetch('/api/studio/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          depth: enhanceDepth,
          projectConfig,
          provider: selectedBrain === 'local_direct' ? 'auto' : selectedBrain,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        showToast(`Enhanced prompt (${data.providerUsed || enhanceDepth})`);
      } else {
        showToast(data?.error || 'Could not enhance prompt.');
      }
    } catch (err: any) {
      showToast('Enhance error: ' + err.message);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Dependency Sync & Manifest Generator
  const handleSyncDependencies = async (addPackage?: string, removePackage?: string) => {
    setIsSyncingDeps(true);
    try {
      const filesMap = isCodeDirty ? draftFiles : builtApp?.files || {};
      const res = await fetch('/api/studio/dependencies/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filesMap,
          projectConfig,
          addPackage,
          removePackage,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (data.updatedConfig) setProjectConfig(data.updatedConfig);
        if (builtApp) {
          const mergedFiles: Record<string, string | undefined> = {
            ...filesMap,
            ...(data.generatedManifests || {}),
          };
          const updated: StudioApp = {
            ...builtApp,
            files: mergedFiles,
            dependencies: data.dependencies,
            envVariables: data.envVariables,
            projectConfig: data.updatedConfig || projectConfig,
          };
          setBuiltApp(updated);
          setDraftFiles(mergedFiles);
        }
        showToast(
          addPackage
            ? `Added "${addPackage}" & synced manifest.`
            : removePackage
            ? `Removed "${removePackage}" from manifest.`
            : `Synced ${data.dependencies?.length || 0} dependencies.`
        );
      }
    } catch (err: any) {
      showToast('Dependency sync error: ' + err.message);
    } finally {
      setIsSyncingDeps(false);
    }
  };

  // Full Security / Syntax / Performance / SEO Audit
  const handleRunFullAudit = async () => {
    if (!builtApp || isAuditing) return;
    setIsAuditing(true);
    try {
      const filesMap = isCodeDirty ? draftFiles : builtApp.files || {};
      const res = await fetch('/api/studio/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: builtApp,
          files: filesMap,
          code: isCodeDirty ? bundleFilesToHtml(draftFiles) : builtApp.code,
          projectConfig,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.auditReport) {
        setBuiltApp((prev) =>
          prev
            ? {
                ...prev,
                auditReport: data.auditReport,
                dependencies: data.dependencies || prev.dependencies,
                envVariables: data.envVariables || prev.envVariables,
              }
            : prev
        );
        showToast(`Audit complete: ${data.auditReport.score}/100`);
      }
    } catch (err: any) {
      showToast('Audit failed: ' + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  // 1-Click AI Audit Remediation
  const handleAutoFixAudit = async () => {
    if (!builtApp || isFixingAudit) return;
    setIsFixingAudit(true);
    try {
      const res = await fetch('/api/studio/audit/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: builtApp,
          auditReport: builtApp.auditReport,
          projectConfig,
          provider: selectedBrain === 'local_direct' ? 'auto' : selectedBrain,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.app) {
        throw new Error(data?.error || 'Audit auto-fix failed.');
      }
      const fixedApp: StudioApp = data.app;
      setBuiltApp(fixedApp);
      setSavedApps((prev) => [fixedApp, ...prev.filter((a) => a.id !== fixedApp.id)]);
      setIframeKey((k) => k + 1);
      showToast(`Audit issues remediated (Score: ${fixedApp.auditReport?.score ?? 100}/100).`);
    } catch (err: any) {
      showToast(err.message || 'Auto-fix audit failed.');
    } finally {
      setIsFixingAudit(false);
    }
  };

  // Firebase / Google Cloud Run / GitHub Artifact Synthesis & Repo Push
  const handlePrepareDeployArtifacts = async (opts: {
    target: DeployTargetId;
    firebaseProjectId?: string;
    gcpRegion?: string;
    cloudRunService?: string;
    githubRepo?: string;
    githubBranch?: string;
  }) => {
    if (!builtApp) return null;
    try {
      const res = await fetch('/api/studio/deploy/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: builtApp,
          ...opts,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.app) {
        setBuiltApp(data.app);
        setSavedApps((prev) => [data.app, ...prev.filter((a) => a.id !== data.app.id)]);
        showToast(`Generated ${opts.target.toUpperCase()} deployment artifacts.`);
        return {
          commands: data.artifacts?.commands || [],
          checklist: data.artifacts?.checklist || [],
        };
      }
      showToast(data?.error || 'Failed to prepare deployment files.');
      return null;
    } catch (err: any) {
      showToast('Deploy prep error: ' + err.message);
      return null;
    }
  };

  const handlePushToGitHub = async (opts: { repo: string; branch: string; token: string }) => {
    if (!builtApp) return null;
    try {
      const res = await fetch('/api/studio/deploy/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: builtApp,
          ...opts,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'GitHub push failed.');
      }
      showToast(`Pushed ${data.pushedCount} files to ${data.repo}.`);
      return { repoUrl: data.repoUrl, pushedCount: data.pushedCount };
    } catch (err: any) {
      showToast(err.message || 'GitHub push error.');
      return null;
    }
  };

  // Inject runtime error & element-inspect bridge into preview srcDoc cleanly
  const instrumentedPreviewHtml = useMemo(() => {
    if (!builtApp?.code) return '';
    return injectPreviewTelemetry(builtApp.code, isInspectMode);
  }, [builtApp?.code, iframeKey]);

  const previewContent = builtApp ? (
    <div className="h-full w-full flex flex-col bg-[#0E0F10] relative">
      {/* Runtime Error Auto-Heal Bar */}
      {runtimeErrors.length > 0 && (
        <div className="px-3 py-2 bg-red-950/70 border-b border-red-800/70 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-red-200 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="truncate font-mono">{runtimeErrors[runtimeErrors.length - 1]}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleAutoFixErrors}
              disabled={isAutoFixing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-400 text-white font-medium text-[11px] whitespace-nowrap disabled:opacity-60"
            >
              {isAutoFixing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wrench className="w-3 h-3" />
              )}
              <span>{isAutoFixing ? 'Fixing...' : 'Fix with AI'}</span>
            </button>
            <button
              onClick={() => setRuntimeErrors([])}
              className="p-1 rounded text-red-300 hover:text-white"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Element Inspect Helper Bar */}
      {isInspectMode && (
        <div className="px-3 py-1.5 bg-[#1B2333] border-b border-[#2D3C58] flex items-center justify-between text-xs text-[#C2D7FA] shrink-0">
          <div className="flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>Inspect mode active — click any element inside the preview to target it in your next prompt.</span>
          </div>
          <button
            onClick={() => setIsInspectMode(false)}
            className="text-[11px] text-[#8AB4F8] hover:underline whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}

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
            ref={iframeRef}
            key={iframeKey}
            title={builtApp.title}
            srcDoc={instrumentedPreviewHtml}
            sandbox="allow-scripts allow-modals allow-forms allow-downloads"
            className="w-full h-full border-none bg-black"
          />
        </div>
      </div>
    </div>
  ) : null;

  const codeContent = builtApp ? (
    <StudioCodeEditor
      title={builtApp.title}
      files={draftFiles}
      activeFile={activeFileTab}
      onSelectFile={setActiveFileTab}
      onChangeFile={(fname, val) => {
        setDraftFiles((prev) => ({ ...prev, [fname]: val }));
        setIsCodeDirty(true);
      }}
      onCreateFile={(fname) => {
        setDraftFiles((prev) => ({
          ...prev,
          [fname]: prev[fname] ?? `// ${fname}\n`,
        }));
        setActiveFileTab(fname);
        setIsCodeDirty(true);
      }}
      onApplyAndSave={handleApplyManualCode}
      onDownloadHtml={() => handleDownloadApp(builtApp)}
      onDownloadZip={() => handleDownloadZip(builtApp)}
      isDirty={isCodeDirty}
      isSaving={isSavingCode}
    />
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
              onClick={() => openSavedOrGalleryApp(app)}
              className="p-4 rounded-xl bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] text-[#8E918F]">
                  <span className="truncate">
                    {app.mode || app.tag || app.category || 'App'}
                    {app.versions && app.versions.length > 1 ? ` · v${app.versions.length}` : ''}
                    {app.publishMeta?.isPublished ? ' · Published' : ''}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleRemixApp(app, e)}
                      className="p-1 rounded text-[#8E918F] hover:text-[#8AB4F8] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remix (Fork) app"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                    </button>
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
                </div>
                <h4 className="text-sm font-medium text-white truncate">{app.title}</h4>
                <p className="text-xs text-[#8E918F] mt-1 line-clamp-2 leading-relaxed">
                  {app.description}
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[#252629] flex items-center justify-between text-[11px] text-[#8E918F]">
                <span className="tabular-nums">
                  {app.modelUsed || new Date(app.createdAt || Date.now()).toLocaleDateString()}
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
    <StudioConfigDrawer
      config={projectConfig}
      onChangeConfig={setProjectConfig}
      viewport={viewport}
      onViewportChange={setViewport}
      hasBuiltApp={Boolean(builtApp)}
      isBuildingApp={isBuildingApp}
      isInspectMode={isInspectMode}
      onToggleInspectMode={() => {
        setRightTab('preview');
        setIsInspectMode((prev) => !prev);
      }}
      onQuickRefine={(action) => handleSubmitPrompt(action)}
      onQuickTemplate={(p, label) => handleSubmitPrompt(p, label)}
      dependencies={builtApp?.dependencies || []}
      onSyncDependencies={handleSyncDependencies}
      isSyncingDeps={isSyncingDeps}
      onDownloadZip={builtApp ? () => handleDownloadZip(builtApp) : undefined}
      onDownloadHtml={builtApp ? () => handleDownloadApp(builtApp) : undefined}
    />
  );

  const composerAddContent = (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-medium text-[#9AA0A6] block mb-1.5">
          AI Brain / Provider Route
        </label>
        <select
          value={selectedBrain}
          onChange={(e) => setSelectedBrain(e.target.value)}
          className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-[#E3E3E3] focus:outline-none focus:border-[#8AB4F8]"
        >
          {STUDIO_BRAINS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.json,.md,.txt,.ts,.tsx,.js,.css,.html"
          multiple
          onChange={handleAttachmentPick}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Paperclip className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Attach Screenshot / Spec</span>
        </button>

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
        Attach a UI mockup image, JSON schema, or spec text — or switch brains between Cloud (Gemini/Groq/OpenAI) and Local llama.cpp.
      </div>
    </div>
  );

  const settingsContent = (
    <div className="space-y-4">
      {/* Brain Selection */}
      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-white flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#8AB4F8]" />
            Active AI Compiler Brain
          </span>
        </div>
        <select
          value={selectedBrain}
          onChange={(e) => setSelectedBrain(e.target.value)}
          className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
        >
          {STUDIO_BRAINS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-[#8E918F] leading-relaxed">
          Connected: {[
            providerStatus.gemini && 'Gemini',
            providerStatus.groq && 'Groq',
            providerStatus.openai && 'OpenAI',
            providerStatus.deepseek && 'DeepSeek',
            (providerStatus.local || localCfg.baseUrl) && 'llama.cpp',
          ]
            .filter(Boolean)
            .join(' · ') || 'Deterministic Synthesizer Fallback'}
        </div>
      </div>

      {/* Gemini Key */}
      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-white flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-[#8AB4F8]" />
            Gemini API Key
          </span>
          <span className="text-[11px] text-[#9AA0A6]">
            {providerStatus.gemini ? 'Connected' : 'Not set'}
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

      {/* Local llama.cpp Studio Connector */}
      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-white flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-[#8AB4F8]" />
            Local llama.cpp Engine
          </span>
          <span className="text-[11px] text-[#9AA0A6]">{localCfg.transport}</span>
        </div>
        <input
          type="text"
          value={localCfg.baseUrl}
          onChange={(e) => setLocalCfg((p) => ({ ...p, baseUrl: e.target.value }))}
          placeholder="http://127.0.0.1:8080/v1"
          className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#8AB4F8]"
        />
        <input
          type="text"
          value={localCfg.modelId}
          onChange={(e) => setLocalCfg((p) => ({ ...p, modelId: e.target.value }))}
          placeholder="Model ID (e.g. qwen2.5-coder-7b)"
          className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#8AB4F8]"
        />
        {detectedLocalModels.length > 0 && (
          <div className="text-[11px] text-emerald-400 truncate">
            Detected: {detectedLocalModels.join(', ')}
          </div>
        )}
        <button
          onClick={handleProbeAndSaveLocal}
          disabled={isProbingLocal}
          className="w-full py-1.5 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white flex items-center justify-center gap-1.5"
        >
          {isProbingLocal && <Loader2 className="w-3 h-3 animate-spin" />}
          <span>Detect & Save Local Server</span>
        </button>
      </div>
    </div>
  );

  const diagnosticsContent = (
    <StudioAuditDrawer
      hasBuiltApp={Boolean(builtApp)}
      selectedBuildMode={selectedBuildMode}
      providerUsed={builtApp?.providerUsed}
      selectedBrain={selectedBrain}
      diagnostics={builtApp?.diagnostics}
      auditReport={builtApp?.auditReport}
      envVariables={builtApp?.envVariables}
      runtimeErrors={runtimeErrors}
      isAutoFixing={isAutoFixing}
      isAuditing={isAuditing}
      isFixingAudit={isFixingAudit}
      onAutoFixRuntime={handleAutoFixErrors}
      onRunFullAudit={handleRunFullAudit}
      onAutoFixAudit={handleAutoFixAudit}
      agentSteps={builtApp?.agentSteps}
      agentLogs={agentLogs}
    />
  );

  // Version Switcher Pill rendered cleanly in header when versions exist
  const headerVersionControl =
    builtApp?.versions && builtApp.versions.length > 0 ? (
      <div className="inline-flex items-center gap-1 bg-[#1B1C1E] border border-[#2C2D30] rounded-lg px-2 py-0.5 shrink-0">
        <History className="w-3 h-3 text-[#8E918F]" />
        <select
          value={builtApp.currentVersion || builtApp.versions[builtApp.versions.length - 1].version}
          onChange={(e) => handleRestoreVersion(Number(e.target.value))}
          className="bg-transparent text-[11px] font-mono text-[#E3E3E3] focus:outline-none tabular-nums cursor-pointer"
          title="Switch or rollback version snapshot"
        >
          {builtApp.versions.map((v) => (
            <option key={v.version} value={v.version} className="bg-[#1B1C1E] text-white">
              v{v.version}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  // Live SSE streaming progress card in left feed
  const streamingFeedCard = (
    <div className="rounded-xl bg-[#191A1C] border border-[#2D3036] p-3 space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-white">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8AB4F8]" />
          <span>{streamPhase || 'Compiling...'}</span>
        </span>
        {streamChars > 0 && (
          <span className="font-mono text-[11px] text-[#8AB4F8] tabular-nums">
            {(streamChars / 1024).toFixed(1)} KB
          </span>
        )}
      </div>
      {streamDetail && <p className="text-[11px] text-[#9AA0A6] leading-relaxed">{streamDetail}</p>}
    </div>
  );

  // Attached context chips above composer
  const composerExtraFooter =
    attachments.length > 0 || selectedElementContext ? (
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {selectedElementContext && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1F2A3C] border border-[#354B70] text-[11px] text-[#C2D7FA] max-w-full">
            <Crosshair className="w-3 h-3 shrink-0 text-[#8AB4F8]" />
            <span className="truncate font-mono">{selectedElementContext}</span>
            <button
              onClick={() => setSelectedElementContext(null)}
              className="text-[#8AB4F8] hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {attachments.map((att, idx) => (
          <div
            key={`${att.name}_${idx}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E1F20] border border-[#323438] text-[11px] text-[#E3E3E3] max-w-full"
          >
            <Paperclip className="w-3 h-3 shrink-0 text-[#8AB4F8]" />
            <span className="truncate">{att.name}</span>
            <button
              onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
              className="text-[#9AA0A6] hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const publishModal = builtApp ? (
    <StudioDeployModal
      isOpen={isPublishModalOpen}
      onClose={() => setIsPublishModalOpen(false)}
      appTitle={builtApp.title}
      config={projectConfig}
      publishMeta={builtApp.publishMeta}
      isPublishing={isPublishing}
      onPublishLiveSnapshot={handlePublishApp}
      onPrepareDeployArtifacts={handlePrepareDeployArtifacts}
      onPushToGitHub={handlePushToGitHub}
      onDownloadZip={() => handleDownloadZip(builtApp)}
      onDownloadHtml={() => handleDownloadApp(builtApp)}
    />
  ) : null;

  const activeCategoryLabel =
    CATEGORY_CATALOG.find((c) => c.id === projectConfig.category)?.label || projectConfig.category;

  const composerInlineActions = (
    <div className="flex items-center gap-1">
      <button
        onClick={handleEnhancePrompt}
        disabled={isEnhancingPrompt || !prompt.trim()}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#252629] hover:bg-[#303238] border border-[#35373B] text-[11px] font-medium text-[#E3E3E3] disabled:opacity-40 transition-colors whitespace-nowrap"
        title="Expand brief prompt into a full architectural PRD specification"
      >
        {isEnhancingPrompt ? (
          <Loader2 className="w-3 h-3 animate-spin text-[#8AB4F8]" />
        ) : (
          <Wand2 className="w-3 h-3 text-[#8AB4F8]" />
        )}
        <span>{isEnhancingPrompt ? 'Enhancing' : 'Enhance'}</span>
      </button>

      <select
        value={enhanceDepth}
        onChange={(e) => setEnhanceDepth(e.target.value as PromptEnhanceDepth)}
        className="bg-[#1B1C1E] border border-[#303236] rounded-lg px-1.5 py-1 text-[11px] text-[#9AA0A6] focus:outline-none focus:border-[#8AB4F8]"
        title="Prompt enhancement depth"
      >
        <option value="quick">Quick</option>
        <option value="fullstack">PRD</option>
        <option value="enterprise">Enterprise</option>
      </select>
    </div>
  );

  const extraToolbarActions = builtApp ? (
    <div className="hidden lg:flex items-center gap-1.5">
      {builtApp.auditReport && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1B1C1E] border border-[#2C2D30] text-[11px] font-mono tabular-nums ${
            builtApp.auditReport.score >= 85
              ? 'text-emerald-400'
              : builtApp.auditReport.score >= 60
              ? 'text-amber-400'
              : 'text-red-400'
          }`}
          title="Security, Syntax & Production Readiness Score"
        >
          <ShieldCheck className="w-3 h-3" />
          <span>{builtApp.auditReport.score}/100</span>
        </span>
      )}
      <button
        onClick={() => setIsPublishModalOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E1F20] hover:bg-[#28292C] border border-[#323438] text-xs font-medium text-[#E3E3E3] whitespace-nowrap"
        title="Deploy to Firebase, Google Cloud Run or GitHub"
      >
        <Rocket className="w-3.5 h-3.5 text-[#8AB4F8]" />
        <span>Deploy</span>
      </button>
    </div>
  ) : (
    <span className="hidden lg:inline-flex items-center px-2 py-1 rounded-lg bg-[#1B1C1E] border border-[#2C2D30] text-[11px] text-[#9AA0A6] whitespace-nowrap">
      {activeCategoryLabel} · {projectConfig.frontendFramework}
    </span>
  );

  const auditCriticalCount = builtApp?.auditReport?.criticalCount || 0;

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne Code Studio"
      workspaceTitle={builtApp ? builtApp.title : `${activeCategoryLabel} · Ready`}
      headerCenterExtra={headerVersionControl}
      extraToolbarActions={extraToolbarActions}
      modelOptions={CODE_MODES}
      selectedModel={selectedBuildMode}
      onSelectModel={handleSelectMode}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={() => handleSubmitPrompt()}
      isGenerating={isBuildingApp}
      streamingFeedCard={streamingFeedCard}
      composerInlineActions={composerInlineActions}
      composerExtraFooter={composerExtraFooter}
      turns={turns}
      onResetWorkspace={handleResetWorkspace}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={builtApp ? `/${builtApp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '/'}
      viewport={viewport}
      onViewportChange={setViewport}
      onRefresh={() => {
        setRuntimeErrors([]);
        setIframeKey((k) => k + 1);
      }}
      onRemix={() => handleRemixApp()}
      onShare={() => {
        if (builtApp) {
          setIsPublishModalOpen(true);
        } else {
          navigator.clipboard?.writeText(window.location.href).catch(() => {});
          showToast('Workspace link copied.');
        }
      }}
      onPublish={() => {
        if (builtApp) {
          setIsPublishModalOpen(true);
        } else {
          handlePublishApp();
        }
      }}
      publishLabel={builtApp?.publishMeta?.isPublished ? 'Deploy / Live' : 'Publish'}
      filesCount={savedApps.length + galleryApps.length}
      hasActiveItem={!!builtApp}
      diagnosticsBadgeCount={
        runtimeErrors.length + (builtApp?.diagnostics?.errors?.length || 0) + auditCriticalCount
      }
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      diagnosticsContent={diagnosticsContent}
      settingsContent={settingsContent}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Type even 2 words and click Enhance, choose any Category/Stack in Edit, and generate."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
      modalOverlay={publishModal}
    />
  );
};
