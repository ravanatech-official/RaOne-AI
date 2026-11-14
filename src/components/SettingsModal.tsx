import React, { useState, useEffect } from 'react';
import { multiFactor } from 'firebase/auth';
import { auth, logoutUser } from '../lib/firebase';
import { resolveApiUrl } from '../utils/api';
import {
  readLocalLlmConfig,
  saveLocalLlmConfig,
  probeBrowserLocalServers,
  fetchBrowserLocalModels,
  type LocalLlmTransport,
  type BrowserDetectedEngine,
} from '../utils/localLlmClient';
import {
  X,
  Settings,
  Volume2,
  Sparkles,
  Check,
  ShieldCheck,
  Database,
  Sliders,
  CreditCard,
  Trash2,
  Download,
  AlertTriangle,
  Play,
  RotateCcw,
  ExternalLink,
  Plus,
  Eye,
  EyeOff,
  Zap,
  FileText,
  Cpu,
  RefreshCw,
  Square,
  Search,
  Code2,
  Image as ImageIcon,
  Film,
  Music,
  HardDrive,
  PlugZap,
  Activity,
} from 'lucide-react';
import {
  DEFAULT_UNIVERSAL_SETTINGS,
  type SettingsSectionId,
  type UniversalDiagnosticsSnapshot,
  type UniversalSettingsProfile,
} from '../types/settings.ts';
import {
  fetchUniversalSettings,
  resetUniversalSection,
  saveUniversalSettingsPatch,
} from '../utils/settingsClient.ts';
import { SettingsStudioPanels } from './SettingsStudioPanels.tsx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  uid?: string | null;
  isContinuousWakeListening: boolean;
  onToggleContinuousWake: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  activeProvider?: 'auto' | 'gemini' | 'groq' | 'local';
  onSelectProvider?: (provider: 'auto' | 'gemini' | 'groq' | 'local') => void;
  currentPlan?: 'free' | 'plus' | 'ultimate';
  onOpenUpgrade?: () => void;
  onClearAllChats?: () => void;
  onOpenPlugins?: () => void;
  onOpenLibrary?: () => void;
}

type NavGroupItem = {
  id: SettingsSectionId;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const NAV_GROUPS: Array<{ title: string; items: NavGroupItem[] }> = [
  {
    title: 'Core Platform',
    items: [
      { id: 'general', label: 'General & Workspace', keywords: 'theme language workspace density code archived', icon: Sliders },
      { id: 'personalization', label: 'Personalization & Memory', keywords: 'custom instructions memory bilingual sinhala', icon: Sparkles },
      { id: 'models', label: 'AI Models, Local & Keys', keywords: 'gemini groq openai anthropic deepseek comet llama gguf byok provider failover enhancer', icon: Cpu },
      { id: 'speech', label: 'Voice & Speech', keywords: 'voice speech wake word playback reduced motion', icon: Volume2 },
    ],
  },
  {
    title: '5 Studio Modules',
    items: [
      { id: 'code_studio', label: 'Code Studio Defaults', keywords: 'react nextjs express database docker tests deploy audit typescript', icon: Code2 },
      { id: 'vision_studio', label: 'Vision Studio Defaults', keywords: 'image photoreal alchemy aspect resolution cfg negative prompt', icon: ImageIcon },
      { id: 'cinema_studio', label: 'Cinema Studio Defaults', keywords: 'video veo sora kling fps 4k camera lens gimbal film stock', icon: Film },
      { id: 'music_studio', label: 'Music Studio Defaults', keywords: 'lyria suno vocal sinhala bpm mastering lufs wav mp3 cover', icon: Music },
      { id: 'document_studio', label: 'Document Studio Defaults', keywords: 'report slides prd spreadsheet grounding author tone', icon: FileText },
    ],
  },
  {
    title: '2 Libraries',
    items: [
      { id: 'files_library', label: 'Files Library Governance', keywords: 'grid list sort trash retention zip ocr vault', icon: HardDrive },
      { id: 'plugins_library', label: 'Plugins Library Policies', keywords: 'ssrf webhook sync byok connector vault', icon: PlugZap },
    ],
  },
  {
    title: 'Trust & System',
    items: [
      { id: 'datacontrols', label: 'Data & Privacy Controls', keywords: 'training history temporary chat export delete account', icon: Database },
      { id: 'security', label: 'Security & Policies', keywords: 'mfa session privacy terms safety policy aes256', icon: ShieldCheck },
      { id: 'account', label: 'Account & Subscription', keywords: 'plan billing upgrade credits', icon: CreditCard },
      { id: 'diagnostics', label: 'Diagnostics & Backup', keywords: 'ffmpeg ffprobe llama server storage footprint json export import factory reset', icon: Activity },
    ],
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'general',
  uid,
  isContinuousWakeListening,
  onToggleContinuousWake,
  selectedModel,
  onSelectModel,
  activeProvider = 'auto',
  onSelectProvider,
  currentPlan = 'free',
  onOpenUpgrade,
  onClearAllChats,
  onOpenPlugins,
  onOpenLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsSectionId>(initialSection);
  const [sectionSearch, setSectionSearch] = useState<string>('');
  const [universalProfile, setUniversalProfile] = useState<UniversalSettingsProfile>(DEFAULT_UNIVERSAL_SETTINGS);
  const [diagnostics, setDiagnostics] = useState<UniversalDiagnosticsSnapshot | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState<boolean>(false);

  // General Settings State
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<string>('auto');
  const [alwaysShowCode, setAlwaysShowCode] = useState<boolean>(true);
  const [isConfirmDeleteAllChatsOpen, setIsConfirmDeleteAllChatsOpen] = useState<boolean>(false);
  const [isArchivedChatsOpen, setIsArchivedChatsOpen] = useState<boolean>(false);

  // Personalization State
  const [aboutUser, setAboutUser] = useState<string>(
    DEFAULT_UNIVERSAL_SETTINGS.customInstructions.aboutUser
  );
  const [responseStyle, setResponseStyle] = useState<string>(
    DEFAULT_UNIVERSAL_SETTINGS.customInstructions.responseStyle
  );
  const [customInstructionsEnabled, setCustomInstructionsEnabled] = useState<boolean>(true);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [memories, setMemories] = useState<string[]>(DEFAULT_UNIVERSAL_SETTINGS.memory.items);
  const [newMemoryInput, setNewMemoryInput] = useState<string>('');
  const [isMemoryManagerOpen, setIsMemoryManagerOpen] = useState<boolean>(false);

  // Speech State
  const [selectedVoice, setSelectedVoice] = useState<string>('Breeze');
  const [speechLanguage, setSpeechLanguage] = useState<string>('auto');
  const [isPlayingSample, setIsPlayingSample] = useState<boolean>(false);

  // Data Controls State
  const [historyAndTraining, setHistoryAndTraining] = useState<boolean>(false);
  const [isConfirmDeleteAccountOpen, setIsConfirmDeleteAccountOpen] = useState<boolean>(false);

  // Security State (Read from actual Firebase enrolled multi-factor state)
  const [mfaFactorCount, setMfaFactorCount] = useState<number>(0);
  const [policiesData, setPoliciesData] = useState<any>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>('privacyPolicy');

  useEffect(() => {
    if (isOpen && activeTab === 'security' && !policiesData) {
      fetch('/api/policies')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.privacyPolicy) setPoliciesData(data);
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab, policiesData]);

  // API Keys & Provider state
  const [providerMode, setProviderMode] = useState<'auto' | 'gemini' | 'groq' | 'local'>(activeProvider);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqTesting, setGroqTesting] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [openAiKey, setOpenAiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [deepSeekKey, setDeepSeekKey] = useState('');
  const [xaiKey, setXaiKey] = useState('');
  const [cometKey, setCometKey] = useState('');
  const [cometBaseUrl, setCometBaseUrl] = useState('https://api.cometapi.com/v1');
  const [showCometKey, setShowCometKey] = useState(false);
  const [cometTesting, setCometTesting] = useState(false);
  const [cometTestResult, setCometTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Local AI Engine (llama.cpp / GGUF / Ollama / LM Studio) state
  const [localTransport, setLocalTransport] = useState<LocalLlmTransport>('browser_direct');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://127.0.0.1:8080/v1');
  const [localModelId, setLocalModelId] = useState('');
  const [localApiKey, setLocalApiKey] = useState('');
  const [localScanning, setLocalScanning] = useState(false);
  const [localTesting, setLocalTesting] = useState(false);
  const [localTestResult, setLocalTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [browserDetected, setBrowserDetected] = useState<BrowserDetectedEngine[]>([]);
  const [backendLocalStatus, setBackendLocalStatus] = useState<any>(null);
  const [selectedGgufFile, setSelectedGgufFile] = useState<string>('');
  const [llamaStarting, setLlamaStarting] = useState(false);

  const [keysConfigured, setKeysConfigured] = useState<{
    geminiConfigured: boolean;
    groqConfigured?: boolean;
    openAiConfigured: boolean;
    anthropicConfigured: boolean;
    deepSeekConfigured: boolean;
    xaiConfigured?: boolean;
    cometApiConfigured?: boolean;
    cometApiBaseUrl?: string;
  }>({
    geminiConfigured: false,
    groqConfigured: false,
    openAiConfigured: false,
    anthropicConfigured: false,
    deepSeekConfigured: false,
    xaiConfigured: false,
    cometApiConfigured: false,
    cometApiBaseUrl: 'https://api.cometapi.com/v1',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const applyProfileToState = (data: UniversalSettingsProfile) => {
    setUniversalProfile(data);
    if (data.theme) setTheme(data.theme);
    if (data.language) setLanguage(data.language);
    if (typeof data.alwaysShowCode === 'boolean') setAlwaysShowCode(data.alwaysShowCode);
    if (data.activeProvider && ['auto', 'gemini', 'groq', 'local'].includes(data.activeProvider)) {
      setProviderMode(data.activeProvider);
    }
    if (data.customInstructions) {
      setAboutUser(data.customInstructions.aboutUser || '');
      setResponseStyle(data.customInstructions.responseStyle || '');
      setCustomInstructionsEnabled(data.customInstructions.enabled ?? true);
    }
    if (data.memory) {
      setMemoryEnabled(data.memory.enabled ?? true);
      if (Array.isArray(data.memory.items)) setMemories(data.memory.items);
    }
    if (data.voice) {
      if (data.voice.selectedVoice) setSelectedVoice(data.voice.selectedVoice);
      if (data.voice.speechLanguage) setSpeechLanguage(data.voice.speechLanguage);
    }
    if (data.dataControls) {
      setHistoryAndTraining(data.dataControls.historyAndTraining ?? false);
    }
  };

  const loadDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const res = await fetch(resolveApiUrl('/api/settings/diagnostics'));
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
    } catch {
      // ignore transient error
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveTab(initialSection);
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    if (isOpen && (activeTab === 'diagnostics' || activeTab === 'plugins_library')) {
      void loadDiagnostics();
    }
  }, [isOpen, activeTab]);

  // Fetch settings & keys from Backend API on open
  useEffect(() => {
    if (isOpen) {
      setProviderMode(activeProvider);
      setGroqTestResult(null);
      setLocalTestResult(null);
      const localStored = readLocalLlmConfig(uid);
      setLocalTransport(localStored.transport);
      setLocalBaseUrl(localStored.baseUrl);
      setLocalModelId(localStored.modelId);
      setLocalApiKey(localStored.apiKey || '');

      if (auth?.currentUser) {
        try {
          setMfaFactorCount(multiFactor(auth.currentUser).enrolledFactors.length);
        } catch {
          setMfaFactorCount(0);
        }
      } else {
        setMfaFactorCount(0);
      }

      fetchUniversalSettings(true)
        .then((data) => {
          applyProfileToState(data);
        })
        .catch(() => {});

      fetch('/api/keys')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setKeysConfigured(data);
            if (data?.cometApiBaseUrl) {
              setCometBaseUrl(data.cometApiBaseUrl);
            }
          }
        })
        .catch(() => {});

      fetch('/api/local-llm/status')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success) {
            setBackendLocalStatus(data);
            if (Array.isArray(data.ggufFiles) && data.ggufFiles.length > 0 && !selectedGgufFile) {
              setSelectedGgufFile(data.ggufFiles[0].filename);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, uid]);

  if (!isOpen) return null;

  // Test CometAPI connection
  const handleTestCometApi = async () => {
    setCometTesting(true);
    setCometTestResult(null);
    try {
      const res = await fetch('/api/comet/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cometApiKey: cometKey || undefined,
          cometApiBaseUrl: cometBaseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCometTestResult({ success: true, message: data.message || 'Connected to CometAPI successfully!' });
      } else {
        setCometTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err: any) {
      setCometTestResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setCometTesting(false);
    }
  };

  // Test Groq Cloud API connection
  const handleTestGroqApi = async () => {
    setGroqTesting(true);
    setGroqTestResult(null);
    try {
      const res = await fetch('/api/groq/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groqApiKey: groqKey || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGroqTestResult({ success: true, message: data.message || 'Connected to Groq Cloud successfully!' });
      } else {
        setGroqTestResult({ success: false, message: data.error || 'Groq connection failed' });
      }
    } catch (err: any) {
      setGroqTestResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setGroqTesting(false);
    }
  };

  // Scan localhost engines (browser-direct + backend status)
  const handleScanLocalEngines = async () => {
    setLocalScanning(true);
    setLocalTestResult(null);
    try {
      const [browserEngines, backendRes] = await Promise.all([
        probeBrowserLocalServers(localBaseUrl, localApiKey || undefined),
        fetch('/api/local-llm/status')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setBrowserDetected(browserEngines);
      if (backendRes?.success) setBackendLocalStatus(backendRes);

      const firstOnline = browserEngines.find((e) => e.online);
      if (firstOnline) {
        setLocalBaseUrl(firstOnline.baseUrl);
        if (firstOnline.models.length > 0 && !localModelId) {
          setLocalModelId(firstOnline.models[0]);
        }
        setLocalTestResult({
          success: true,
          message: `Found ${firstOnline.label} (${firstOnline.models.length} model${firstOnline.models.length === 1 ? '' : 's'} ready)`,
        });
      } else {
        setLocalTestResult({
          success: false,
          message:
            'No running local server detected on ports 8080/8081/11434/1234. Start llama-server or Ollama on your PC and try again.',
        });
      }
    } catch (err: any) {
      setLocalTestResult({ success: false, message: err?.message || 'Scan failed.' });
    } finally {
      setLocalScanning(false);
    }
  };

  // Test & activate configured Local AI Engine
  const handleTestLocalLlm = async () => {
    setLocalTesting(true);
    setLocalTestResult(null);
    try {
      let models: string[] = [];
      let verifiedUrl = localBaseUrl;

      if (localTransport === 'browser_direct') {
        const start = Date.now();
        models = await fetchBrowserLocalModels(localBaseUrl, localApiKey || undefined, 3500);
        const pickedModel = localModelId || models[0] || 'local-model';
        setLocalModelId(pickedModel);
        saveLocalLlmConfig(
          {
            enabled: true,
            transport: 'browser_direct',
            baseUrl: verifiedUrl,
            modelId: pickedModel,
            apiKey: localApiKey,
          },
          uid
        );
        setLocalTestResult({
          success: true,
          message: `Browser Direct connected in ${Date.now() - start}ms! Ready model: ${pickedModel}`,
        });
      } else {
        const res = await fetch('/api/local-llm/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: localBaseUrl,
            modelId: localModelId || undefined,
            apiKey: localApiKey || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || 'Backend proxy could not reach local LLM endpoint.');
        }
        verifiedUrl = data.baseUrl || localBaseUrl;
        models = Array.isArray(data.models) ? data.models : [];
        const pickedModel = data.selectedModel || localModelId || models[0] || 'local-model';
        setLocalBaseUrl(verifiedUrl);
        setLocalModelId(pickedModel);
        saveLocalLlmConfig(
          {
            enabled: true,
            transport: 'backend_proxy',
            baseUrl: verifiedUrl,
            modelId: pickedModel,
            apiKey: localApiKey,
          },
          uid
        );
        setLocalTestResult({
          success: true,
          message: data.message || `Connected via Backend Bridge (${pickedModel})!`,
        });
      }
    } catch (err: any) {
      setLocalTestResult({
        success: false,
        message: err?.message || 'Could not reach local model server.',
      });
    } finally {
      setLocalTesting(false);
    }
  };

  // Start / Stop inbuilt managed llama-server (when running locally with llama.cpp installed)
  const handleStartManagedLlama = async () => {
    if (!selectedGgufFile) return;
    setLlamaStarting(true);
    setLocalTestResult(null);
    try {
      const res = await fetch('/api/local-llm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelFile: selectedGgufFile, port: 8081, contextSize: 4096 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to launch llama-server');
      }
      setBackendLocalStatus((prev: any) => ({ ...(prev || {}), managedProcess: data.managedProcess }));
      setLocalBaseUrl(data.managedProcess?.endpointUrl || 'http://127.0.0.1:8081/v1');
      setLocalModelId(selectedGgufFile);
      setLocalTestResult({
        success: true,
        message: `Started inbuilt llama-server with ${selectedGgufFile} on port ${data.managedProcess?.port || 8081}!`,
      });
    } catch (err: any) {
      setLocalTestResult({ success: false, message: err?.message || 'Could not start llama-server' });
    } finally {
      setLlamaStarting(false);
    }
  };

  const handleStopManagedLlama = async () => {
    setLlamaStarting(true);
    try {
      const res = await fetch('/api/local-llm/stop', { method: 'POST' });
      const data = await res.json();
      if (data?.managedProcess) {
        setBackendLocalStatus((prev: any) => ({ ...(prev || {}), managedProcess: data.managedProcess }));
      }
      setLocalTestResult({ success: true, message: 'Stopped inbuilt llama-server.' });
    } catch (err: any) {
      setLocalTestResult({ success: false, message: err?.message || 'Failed to stop llama-server' });
    } finally {
      setLlamaStarting(false);
    }
  };

  // Switch active chat streaming provider seamlessly
  const handleProviderSwitch = (nextProvider: 'auto' | 'gemini' | 'groq' | 'local') => {
    setProviderMode(nextProvider);
    if (onSelectProvider) onSelectProvider(nextProvider);
    if (nextProvider === 'groq' && !selectedModel.startsWith('raone-llama')) {
      onSelectModel('raone-llama3-70b');
    } else if (nextProvider === 'gemini' && (selectedModel.startsWith('raone-llama') || selectedModel.startsWith('local:'))) {
      onSelectModel('gemini-3.8-flash');
    } else if (nextProvider === 'local') {
      const m = localModelId ? `local:${localModelId}` : 'local:local-model';
      onSelectModel(m);
    }
  };

  // Save Settings to Backend API (deep-merge + broadcast to all 5 studios & 2 libraries)
  const handleSave = async () => {
    try {
      const payload = {
        ...universalProfile,
        theme,
        language,
        alwaysShowCode,
        activeProvider: providerMode,
        selectedModel,
        customInstructions: {
          ...universalProfile.customInstructions,
          aboutUser,
          responseStyle,
          enabled: customInstructionsEnabled,
        },
        memory: {
          enabled: memoryEnabled,
          items: memories,
        },
        voice: {
          ...universalProfile.voice,
          selectedVoice,
          speechLanguage,
          wakeWordEnabled: isContinuousWakeListening,
        },
        dataControls: {
          ...universalProfile.dataControls,
          historyAndTraining,
        },
      };

      const saveRes = await saveUniversalSettingsPatch(payload);
      if (!saveRes.ok || !saveRes.settings) {
        setStatusNotice(saveRes.error || 'Could not save settings.');
        setTimeout(() => setStatusNotice(null), 3500);
        return;
      }
      applyProfileToState(saveRes.settings);

      if (onSelectProvider) onSelectProvider(providerMode);

      // Persist Local LLM configuration per UID
      saveLocalLlmConfig(
        {
          enabled: providerMode === 'local' || Boolean(localBaseUrl),
          transport: localTransport,
          baseUrl: localBaseUrl,
          modelId: localModelId,
          apiKey: localApiKey,
        },
        uid
      );

      // Save API keys if any entered or updated (requires verified Firebase sign-in)
      const hasAnyKeyChange = Boolean(
        geminiKey || groqKey || openAiKey || anthropicKey || deepSeekKey || xaiKey || cometKey || localApiKey
      );
      const localProxyConfigChanged =
        localTransport === 'backend_proxy' &&
        Boolean(localBaseUrl) &&
        (localBaseUrl !== (keysConfigured as any).localLlmBaseUrl || localModelId !== (keysConfigured as any).localLlmModel);

      if (
        hasAnyKeyChange ||
        localProxyConfigChanged ||
        (cometBaseUrl && cometBaseUrl !== (keysConfigured.cometApiBaseUrl || 'https://api.cometapi.com/v1'))
      ) {
        const keyRes = await fetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey: geminiKey || undefined,
            groqApiKey: groqKey || undefined,
            openAiApiKey: openAiKey || undefined,
            anthropicApiKey: anthropicKey || undefined,
            deepSeekApiKey: deepSeekKey || undefined,
            xaiApiKey: xaiKey || undefined,
            cometApiKey: cometKey || undefined,
            cometApiBaseUrl: cometBaseUrl || undefined,
            ...(localTransport === 'backend_proxy'
              ? {
                  localLlmBaseUrl: localBaseUrl || undefined,
                  localLlmModel: localModelId || undefined,
                  localLlmApiKey: localApiKey || undefined,
                }
              : {}),
          }),
        });
        const keyData = await keyRes.json().catch(() => ({}));
        if (!keyRes.ok) {
          setStatusNotice(keyData?.error || 'Sign in with your account to save personal API keys.');
          setTimeout(() => setStatusNotice(null), 4000);
          return;
        }
        setGeminiKey('');
        setGroqKey('');
        setOpenAiKey('');
        setAnthropicKey('');
        setDeepSeekKey('');
        setXaiKey('');
        setCometKey('');
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusNotice(err?.message || 'Could not save settings.');
      setTimeout(() => setStatusNotice(null), 3500);
    }
  };

  const handleResetSection = async (section: SettingsSectionId | 'all') => {
    const res = await resetUniversalSection(section);
    if (res.ok && res.settings) {
      applyProfileToState(res.settings);
      setStatusNotice(
        section === 'all'
          ? 'All workspace settings restored to factory defaults.'
          : `Section "${section.replace('_', ' ')}" reset to defaults.`
      );
      setTimeout(() => setStatusNotice(null), 3000);
    } else {
      setStatusNotice(res.error || 'Could not reset section.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleExportProfile = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/user/settings/profile-export'));
      if (!res.ok) {
        setStatusNotice('Failed to export universal settings profile.');
        setTimeout(() => setStatusNotice(null), 3000);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'raone-universal-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusNotice('Portable settings profile exported (secrets omitted).');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch {
      setStatusNotice('Could not export settings JSON.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleImportProfileFile = async (file: File) => {
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const res = await fetch(resolveApiUrl('/api/user/settings/profile-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.settings) {
        setStatusNotice(data?.error || 'Invalid Universal Settings JSON file.');
        setTimeout(() => setStatusNotice(null), 3500);
        return;
      }
      applyProfileToState(data.settings);
      setStatusNotice('Universal settings profile imported & synced across all studios.');
      setTimeout(() => setStatusNotice(null), 3500);
    } catch {
      setStatusNotice('Failed to parse settings JSON file.');
      setTimeout(() => setStatusNotice(null), 3500);
    }
  };

  // Play voice sample using SpeechSynthesis
  const handlePlayVoiceSample = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsPlayingSample(true);

    const utterance = new SpeechSynthesisUtterance(
      `Hello! I'm your RaOne AI assistant using the ${selectedVoice} voice profile. How can I help you today?`
    );

    // Adjust rate and pitch based on voice flavor
    if (selectedVoice === 'Breeze') {
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
    } else if (selectedVoice === 'Cove') {
      utterance.pitch = 0.85;
      utterance.rate = 0.95;
    } else if (selectedVoice === 'Ember') {
      utterance.pitch = 0.9;
      utterance.rate = 1.05;
    } else if (selectedVoice === 'Juniper') {
      utterance.pitch = 1.15;
      utterance.rate = 1.05;
    } else if (selectedVoice === 'Sky') {
      utterance.pitch = 1.1;
      utterance.rate = 0.95;
    } else if (selectedVoice === 'Sol') {
      utterance.pitch = 0.95;
      utterance.rate = 1.0;
    } else if (selectedVoice === 'Vale') {
      utterance.pitch = 0.8;
      utterance.rate = 1.1;
    }

    utterance.onend = () => setIsPlayingSample(false);
    utterance.onerror = () => setIsPlayingSample(false);
    window.speechSynthesis.speak(utterance);
  };

  // Delete all chats action
  const handleClearAllChats = async () => {
    try {
      const res = await fetch('/api/user/settings/clear-all-chats', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusNotice(data?.error || 'Sign in required to purge server chat history.');
        setTimeout(() => setStatusNotice(null), 3500);
        return;
      }
      if (onClearAllChats) onClearAllChats();
      setIsConfirmDeleteAllChatsOpen(false);
      setStatusNotice('All chat history was permanently deleted.');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (e: any) {
      setStatusNotice(e?.message || 'Failed to clear chat history.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  // Export Data action (uses authenticated fetch -> Blob download so Bearer token is preserved)
  const handleExportData = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/user/settings/export-data'));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatusNotice(data?.error || 'Please sign in to export your account workspace.');
        setTimeout(() => setStatusNotice(null), 3500);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'raone-workspace-export.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      setStatusNotice('Workspace export downloaded.');
      setTimeout(() => setStatusNotice(null), 2500);
    } catch (err: any) {
      setStatusNotice(err?.message || 'Export failed.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  // Memory deletion
  const handleDeleteMemory = async (idx: number) => {
    const next = memories.filter((_, i) => i !== idx);
    setMemories(next);
    fetch('/api/user/settings/memory/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: idx }),
    }).catch(() => {});
  };

  const handleAddMemory = async () => {
    if (!newMemoryInput.trim()) return;
    const item = newMemoryInput.trim();
    setMemories((prev) => [...prev, item]);
    setNewMemoryInput('');
    fetch('/api/user/settings/memory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    }).catch(() => {});
  };

  const handleClearAllMemories = async () => {
    setMemories([]);
    fetch('/api/user/settings/memory/clear', { method: 'POST' }).catch(() => {});
  };

  const normalizedSearch = sectionSearch.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-5xl bg-[#161719] border border-[#252629] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Global Search */}
        <div className="h-14 px-5 border-b border-[#252629] flex items-center justify-between gap-4 shrink-0 bg-[#131416]">
          <div className="flex items-center gap-2.5 shrink-0">
            <Settings className="w-4 h-4 text-[#8AB4F8]" />
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                RaOne Universal Settings Center
              </h2>
            </div>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#9AA0A6] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              placeholder="Jump to studio, library, model, or key setting..."
              className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#5F6368] focus:outline-none focus:border-[#8AB4F8]"
            />
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22] transition-colors shrink-0"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification toast */}
        {statusNotice && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Content: Grouped Sidebar + Scrollable Architectural Workspace */}
        <div className="flex-1 flex overflow-hidden min-h-[500px]">
          {/* Left Navigation Rail */}
          <div className="w-56 sm:w-64 bg-[#111214] border-r border-[#252629] p-2.5 space-y-4 shrink-0 overflow-y-auto chat-scroll-area">
            {NAV_GROUPS.map((group) => {
              const filteredItems = group.items.filter((item) => {
                if (!normalizedSearch) return true;
                return (
                  item.label.toLowerCase().includes(normalizedSearch) ||
                  item.keywords.toLowerCase().includes(normalizedSearch) ||
                  group.title.toLowerCase().includes(normalizedSearch)
                );
              });
              if (filteredItems.length === 0) return null;
              return (
                <div key={group.title} className="space-y-0.5">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6E7075]">
                    {group.title}
                  </div>
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-lg transition-colors text-left ${
                          isActive
                            ? 'bg-[#1E1F22] text-white font-medium border border-[#2C2E33]'
                            : 'text-[#9AA0A6] hover:text-white hover:bg-[#17181B] border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#8AB4F8]' : ''}`} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.id === 'account' && (
                          <span className="font-mono text-[10px] uppercase text-[#8AB4F8]">
                            {currentPlan}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Right Tab Content Panel */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto chat-scroll-area text-xs text-[#ececec] space-y-6 bg-[#161719]">
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#252629]">
                  <div>
                    <h3 className="text-sm font-semibold text-white">General &amp; Workspace Preferences</h3>
                    <p className="text-[11px] text-[#9AA0A6] mt-0.5">Theme, language, default startup module, and UI density.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResetSection('general')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2C2E33] bg-[#141517] hover:bg-[#1E1F22] text-[11px] text-[#C4C7C5] hover:text-white flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Section</span>
                  </button>
                </div>
                {/* Theme Selector */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Theme</div>
                    <div className="text-[11px] text-[#8e8e8e]">Select interface color mode</div>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="system">System</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Language</div>
                    <div className="text-[11px] text-[#8e8e8e]">Display and interaction language</div>
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="en">English</option>
                    <option value="si">Sinhala (සිංහල)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>

                {/* Default Launch Workspace */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Default Launch Workspace</div>
                    <div className="text-[11px] text-[#8e8e8e]">Choose which workspace opens on startup</div>
                  </div>
                  <select
                    value={universalProfile.defaultWorkspace}
                    onChange={(e) =>
                      setUniversalProfile((p) => ({ ...p, defaultWorkspace: e.target.value as any }))
                    }
                    className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="chat">Unified AI Chat</option>
                    <option value="library">Files Library Vault</option>
                    <option value="plugins">Plugins Library Vault</option>
                    <option value="code_studio">RaOne Code Studio</option>
                    <option value="vision_studio">RaOne Vision Studio</option>
                    <option value="cinema_studio">RaOne Cinema Studio</option>
                    <option value="music_studio">RaOne Music Studio</option>
                    <option value="document_studio">RaOne Document Studio</option>
                  </select>
                </div>

                {/* Compact Layout Density */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Compact UI Density</div>
                    <div className="text-[11px] text-[#8e8e8e]">Reduce padding across lists and studios</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setUniversalProfile((p) => ({ ...p, compactDensity: !p.compactDensity }))
                    }
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      universalProfile.compactDensity ? 'bg-[#8AB4F8]' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        universalProfile.compactDensity ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Always Show Code Toggle */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Always show code when using data analyst</div>
                    <div className="text-[11px] text-[#8e8e8e]">Display generated Python and query execution blocks</div>
                  </div>
                  <button
                    onClick={() => setAlwaysShowCode(!alwaysShowCode)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      alwaysShowCode ? 'bg-amber-500' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        alwaysShowCode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Archived chats */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Archived chats</div>
                    <div className="text-[11px] text-[#8e8e8e]">Manage hidden conversations</div>
                  </div>
                  <button
                    onClick={() => setIsArchivedChatsOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white text-xs font-medium transition-colors"
                  >
                    Manage
                  </button>
                </div>

                {/* Clear all chats */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-sm font-semibold text-red-400">Delete all chats</div>
                    <div className="text-[11px] text-[#8e8e8e]">Permanently wipe all conversation histories from database</div>
                  </div>
                  <button
                    onClick={() => setIsConfirmDeleteAllChatsOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-medium transition-colors"
                  >
                    Delete all
                  </button>
                </div>
              </div>
            )}

            {/* 2. PERSONALIZATION TAB */}
            {activeTab === 'personalization' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#252629]">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Personalization &amp; Persistent Memory</h3>
                    <p className="text-[11px] text-[#9AA0A6] mt-0.5">Custom instructions, bilingual Sinhala+English preferences, and memory.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResetSection('personalization')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2C2E33] bg-[#141517] hover:bg-[#1E1F22] text-[11px] text-[#C4C7C5] hover:text-white flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Section</span>
                  </button>
                </div>

                {/* Custom Instructions Accordion/Section */}
                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
                    <div>
                      <div className="text-sm font-semibold text-white">Custom instructions</div>
                      <div className="text-[11px] text-[#8e8e8e]">
                        Tailor how RaOne AI understands your context and formats responses
                      </div>
                    </div>
                    <button
                      onClick={() => setCustomInstructionsEnabled(!customInstructionsEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        customInstructionsEnabled ? 'bg-amber-500' : 'bg-[#333333]'
                      }`}
                      title="Enable for new chats"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          customInstructionsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#b4b4b4] mb-1.5">
                      What would you like RaOne AI to know about you?
                    </label>
                    <textarea
                      rows={3}
                      value={aboutUser}
                      onChange={(e) => setAboutUser(e.target.value)}
                      placeholder="e.g. Where are you based, what do you work on, what are your preferences..."
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#555] resize-none leading-relaxed"
                    />
                    <div className="text-[10px] text-[#737373] text-right mt-1">{aboutUser.length}/1500</div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#b4b4b4] mb-1.5">
                      How would you like RaOne AI to respond?
                    </label>
                    <textarea
                      rows={3}
                      value={responseStyle}
                      onChange={(e) => setResponseStyle(e.target.value)}
                      placeholder="e.g. How formal or casual, how long or short responses should be..."
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#555] resize-none leading-relaxed"
                    />
                    <div className="text-[10px] text-[#737373] text-right mt-1">{responseStyle.length}/1500</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#262626]">
                    <div>
                      <div className="text-xs font-semibold text-white">Native Bilingual Mode (English + සිංහල)</div>
                      <div className="text-[11px] text-[#8e8e8e]">Understand Singlish &amp; Sinhala seamlessly across prompts and enhancers</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setUniversalProfile((p) => ({
                          ...p,
                          customInstructions: {
                            ...p.customInstructions,
                            bilingualMode: !p.customInstructions.bilingualMode,
                          },
                        }))
                      }
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        universalProfile.customInstructions.bilingualMode ? 'bg-[#8AB4F8]' : 'bg-[#333333]'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          universalProfile.customInstructions.bilingualMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Memory Section */}
                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-between">
                  <div className="max-w-[75%]">
                    <div className="text-sm font-semibold text-white">Memory</div>
                    <div className="text-[11px] text-[#8e8e8e] leading-relaxed mt-0.5">
                      RaOne AI remembers details you share across conversations to provide personalized context.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMemoryManagerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white text-xs font-medium transition-colors"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => setMemoryEnabled(!memoryEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        memoryEnabled ? 'bg-amber-500' : 'bg-[#333333]'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          memoryEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SPEECH TAB */}
            {activeTab === 'speech' && (
              <div className="space-y-5">
                {/* Voice Selection */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Voice</div>
                    <div className="text-[11px] text-[#8e8e8e]">Choose the voice personality for audio synthesis</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="Breeze">Breeze (Calm & friendly)</option>
                      <option value="Cove">Cove (Warm & conversational)</option>
                      <option value="Ember">Ember (Confident & energetic)</option>
                      <option value="Juniper">Juniper (Bright & optimistic)</option>
                      <option value="Sky">Sky (Natural & soothing)</option>
                      <option value="Sol">Sol (Reflective & clear)</option>
                      <option value="Vale">Vale (Expressive & bold)</option>
                      <option value="Maple">Maple (Gentle & empathetic)</option>
                    </select>

                    <button
                      onClick={handlePlayVoiceSample}
                      disabled={isPlayingSample}
                      className="p-2 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white transition-colors"
                      title="Play voice sample"
                    >
                      <Play className={`w-3.5 h-3.5 ${isPlayingSample ? 'text-amber-400 animate-pulse' : 'text-white'}`} />
                    </button>
                  </div>
                </div>

                {/* Speech Language */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Main language</div>
                    <div className="text-[11px] text-[#8e8e8e]">Preferred language for speech recognition</div>
                  </div>
                  <select
                    value={speechLanguage}
                    onChange={(e) => setSpeechLanguage(e.target.value)}
                    className="bg-[#242424] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="en">English</option>
                    <option value="si">Sinhala (සිංහල)</option>
                  </select>
                </div>

                {/* Always-on Wake Word */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Always-On Wake Word Detection</div>
                    <div className="text-[11px] text-[#8e8e8e]">
                      Say “Hey RaOne” at any moment to activate voice interaction
                    </div>
                  </div>
                  <button
                    onClick={onToggleContinuousWake}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      isContinuousWakeListening ? 'bg-amber-500' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isContinuousWakeListening ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Auto-Speak Responses */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Auto-Speak Chat Responses</div>
                    <div className="text-[11px] text-[#8e8e8e]">Read assistant replies aloud automatically when voice mode is active</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setUniversalProfile((p) => ({
                        ...p,
                        voice: { ...p.voice, autoSpeakResponses: !p.voice.autoSpeakResponses },
                      }))
                    }
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      universalProfile.voice.autoSpeakResponses ? 'bg-[#8AB4F8]' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        universalProfile.voice.autoSpeakResponses ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Reduced Motion */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-sm font-semibold text-white">Reduced Motion Accessibility</div>
                    <div className="text-[11px] text-[#8e8e8e]">Minimize canvas &amp; transition animations across studios</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setUniversalProfile((p) => ({
                        ...p,
                        voice: { ...p.voice, reducedMotion: !p.voice.reducedMotion },
                      }))
                    }
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      universalProfile.voice.reducedMotion ? 'bg-[#8AB4F8]' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        universalProfile.voice.reducedMotion ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* 4. DATA CONTROLS TAB */}
            {activeTab === 'datacontrols' && (
              <div className="space-y-5">
                {/* Temporary Private Default */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div className="max-w-[75%]">
                    <div className="text-sm font-semibold text-white">Start new chats in Temporary Private Mode</div>
                    <div className="text-[11px] text-[#8e8e8e] leading-relaxed mt-0.5">
                      When enabled, new chats default to zero server persistence.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setUniversalProfile((p) => ({
                        ...p,
                        dataControls: {
                          ...p.dataControls,
                          temporaryChatDefault: !p.dataControls.temporaryChatDefault,
                        },
                      }))
                    }
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      universalProfile.dataControls.temporaryChatDefault ? 'bg-[#8AB4F8]' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        universalProfile.dataControls.temporaryChatDefault ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Chat History & Training */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div className="max-w-[75%]">
                    <div className="text-sm font-semibold text-white">Improve the model for everyone</div>
                    <div className="text-[11px] text-[#8e8e8e] leading-relaxed mt-0.5">
                      Allow your content to be used to train our AI models. Chats will still be saved to your history.
                    </div>
                  </div>
                  <button
                    onClick={() => setHistoryAndTraining(!historyAndTraining)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      historyAndTraining ? 'bg-amber-500' : 'bg-[#333333]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        historyAndTraining ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Shared Links */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Shared links</div>
                    <div className="text-[11px] text-[#8e8e8e]">Manage public links you have created</div>
                  </div>
                  <button
                    onClick={() => setStatusNotice('No active public shared links found.')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white text-xs font-medium transition-colors"
                  >
                    Manage
                  </button>
                </div>

                {/* Export Data */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Export data</div>
                    <div className="text-[11px] text-[#8e8e8e]">Download all conversations, profile, and settings as JSON</div>
                  </div>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                </div>

                {/* Delete Account */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-sm font-semibold text-red-400">Delete account</div>
                    <div className="text-[11px] text-[#8e8e8e]">Permanently delete your account and all associated data</div>
                  </div>
                  <button
                    onClick={() => setIsConfirmDeleteAccountOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* 5. SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                {/* Multi-Factor Authentication (Verified from Firebase Auth enrolledFactors) */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Multi-factor authentication (MFA)</div>
                    <div className="text-[11px] text-[#8e8e8e]">
                      {auth?.currentUser
                        ? mfaFactorCount > 0
                          ? `Firebase MFA active (${mfaFactorCount} verified factor${mfaFactorCount > 1 ? 's' : ''})`
                          : 'No MFA factors enrolled on this Firebase Auth account'
                        : 'Sign in with Firebase Auth to view enrolled MFA status'}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-semibold border ${
                      mfaFactorCount > 0
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#242424] border-[#383838] text-[#9e9e9e]'
                    }`}
                  >
                    {mfaFactorCount > 0 ? `Enrolled (${mfaFactorCount})` : 'Not enrolled'}
                  </span>
                </div>

                {/* Sign out active session */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Sign out of current session</div>
                    <div className="text-[11px] text-[#8e8e8e]">
                      End your authenticated Firebase session in this browser
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await logoutUser();
                      setStatusNotice('Signed out of current Firebase session.');
                      setTimeout(() => setStatusNotice(null), 2500);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white text-xs font-medium transition-colors"
                  >
                    Sign out
                  </button>
                </div>

                {/* Platform Policies & Compliance */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-400" />
                      <span className="text-sm font-semibold text-white">Platform Policies & Compliance</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <a
                        href="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                      >
                        <span>Privacy Policy</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href="/terms-of-service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                      >
                        <span>Terms of Service</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {policiesData ? (
                    <div className="space-y-2">
                      {(['privacyPolicy', 'termsOfService', 'aiSafetyPolicy', 'securityPolicy'] as const).map((key) => {
                        const sec = policiesData[key];
                        if (!sec) return null;
                        const isExpanded = expandedPolicy === key;
                        return (
                          <div
                            key={key}
                            className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedPolicy(isExpanded ? null : key)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-[#222222] transition-colors"
                            >
                              <span className="text-xs font-semibold text-white">{sec.title}</span>
                              <span className="text-[10px] text-[#8e8e8e]">
                                {isExpanded ? 'Hide' : 'View'}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="px-3.5 pb-3 pt-1 border-t border-[#252525] space-y-2">
                                <p className="text-[11px] text-[#cbd5e1] leading-relaxed">{sec.summary}</p>
                                <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#9ca3af]">
                                  {(sec.clauses || []).map((c: string, idx: number) => (
                                    <li key={idx}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#8e8e8e]">Loading platform policies...</div>
                  )}
                </div>
              </div>
            )}

            {/* 6. AI MODELS, LOCAL ENGINE & BYOK KEYS */}
            {activeTab === 'models' && (
              <div className="space-y-5">
                {/* Global Orchestration Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#131416] border border-[#252629]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">Auto Failover on Rate Limit</div>
                      <div className="text-[10px] text-[#9AA0A6]">Switch seamlessly to Groq LPU on 429/quota spikes</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setUniversalProfile((p) => ({ ...p, fallbackOnRateLimit: !p.fallbackOnRateLimit }))
                      }
                      className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                        universalProfile.fallbackOnRateLimit ? 'bg-[#8AB4F8]' : 'bg-[#2C2E33]'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-[#0E0F10] transform transition-transform ${
                          universalProfile.fallbackOnRateLimit ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9AA0A6] block mb-1">Global Prompt Enhancer Depth</label>
                    <select
                      value={universalProfile.globalEnhancerDepth}
                      onChange={(e) =>
                        setUniversalProfile((p) => ({ ...p, globalEnhancerDepth: e.target.value as any }))
                      }
                      className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                    >
                      <option value="quick">Quick Iteration</option>
                      <option value="fullstack">Balanced Production</option>
                      <option value="enterprise">Enterprise Architectural</option>
                    </select>
                  </div>
                </div>

                {/* Primary Streaming Provider Switcher */}
                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2d2d2d] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Chat Streaming Provider</div>
                      <div className="text-[11px] text-[#8e8e8e]">
                        Switch seamlessly between Google Gemini, Groq LPU, and Local AI
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[#8AB4F8] uppercase">
                      {providerMode === 'auto' ? 'Auto Failover' : providerMode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleProviderSwitch('auto')}
                      className={`px-3 py-2 rounded-xl border text-left transition-all ${
                        providerMode === 'auto'
                          ? 'bg-amber-500/15 border-amber-500/50 text-white'
                          : 'bg-[#242424] border-[#333] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">Auto Routing</div>
                      <div className="text-[10px] text-[#8e8e8e] mt-0.5">Gemini → Groq fallback</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderSwitch('gemini')}
                      className={`px-3 py-2 rounded-xl border text-left transition-all ${
                        providerMode === 'gemini'
                          ? 'bg-sky-500/15 border-sky-500/50 text-white'
                          : 'bg-[#242424] border-[#333] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">Google Gemini</div>
                      <div className="text-[10px] text-[#8e8e8e] mt-0.5">
                        {keysConfigured.geminiConfigured ? 'Key Configured' : 'Key Not Set'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderSwitch('groq')}
                      className={`px-3 py-2 rounded-xl border text-left transition-all ${
                        providerMode === 'groq'
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                          : 'bg-[#242424] border-[#333] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">Groq (Meta Llama)</div>
                      <div className="text-[10px] text-[#8e8e8e] mt-0.5">
                        {keysConfigured.groqConfigured ? 'Key Configured' : 'Key Not Set'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderSwitch('local')}
                      className={`px-3 py-2 rounded-xl border text-left transition-all ${
                        providerMode === 'local'
                          ? 'bg-violet-500/15 border-violet-500/50 text-white'
                          : 'bg-[#242424] border-[#333] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">Local AI (llama.cpp)</div>
                      <div className="text-[10px] text-[#8e8e8e] mt-0.5">
                        {localModelId ? localModelId.slice(0, 18) : 'GGUF / Ollama / LM Studio'}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Inbuilt Local AI Engine (llama.cpp / GGUF / Ollama / LM Studio) Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-[#191624] to-[#111018] border border-violet-500/30 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">Local AI Engine</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 font-semibold uppercase">
                            llama.cpp · Free
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94a3b8]">
                          Connect any local GGUF model via llama.cpp, Ollama, LM Studio, Jan, or KoboldCpp
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleScanLocalEngines}
                      disabled={localScanning}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-[11px] font-semibold transition-all disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw className={`w-3 h-3 ${localScanning ? 'animate-spin' : ''}`} />
                      <span>{localScanning ? 'Scanning...' : 'Scan Local Models'}</span>
                    </button>
                  </div>

                  {/* Transport Mode Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLocalTransport('browser_direct')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        localTransport === 'browser_direct'
                          ? 'bg-violet-500/15 border-violet-500/50 text-white'
                          : 'bg-[#1b1b24] border-[#2e2e3d] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">Browser Direct (localhost)</div>
                      <div className="text-[10px] text-[#94a3b8] mt-0.5">
                        Best for Firebase web app · Zero tunnel needed
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLocalTransport('backend_proxy')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        localTransport === 'backend_proxy'
                          ? 'bg-violet-500/15 border-violet-500/50 text-white'
                          : 'bg-[#1b1b24] border-[#2e2e3d] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">Backend Bridge / HTTPS Tunnel</div>
                      <div className="text-[10px] text-[#94a3b8] mt-0.5">
                        Local server.ts or Cloudflare Tunnel URL
                      </div>
                    </button>
                  </div>

                  {/* Detected Running Engines */}
                  {browserDetected.some((e) => e.online) && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-violet-300">Detected Running Local Engines:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {browserDetected
                          .filter((e) => e.online)
                          .map((eng) => (
                            <button
                              key={eng.id}
                              type="button"
                              onClick={() => {
                                setLocalBaseUrl(eng.baseUrl);
                                if (eng.models[0]) {
                                  setLocalModelId(eng.models[0]);
                                  onSelectModel(`local:${eng.models[0]}`);
                                }
                                handleProviderSwitch('local');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>{eng.label}</span>
                              {eng.models[0] && (
                                <span className="text-emerald-300/80 font-mono">({eng.models[0]})</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Inbuilt Managed llama-server Controller (available when running locally with ./models/*.gguf) */}
                  {backendLocalStatus?.processSpawnAllowed && (
                    <div className="p-3 rounded-xl bg-[#161522] border border-[#2d2b40] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          Inbuilt GGUF Launcher (./models/)
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            backendLocalStatus?.managedProcess?.running
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-[#24242f] text-[#94a3b8] border-[#343446]'
                          }`}
                        >
                          {backendLocalStatus?.managedProcess?.running
                            ? `Running PID ${backendLocalStatus.managedProcess.pid}`
                            : backendLocalStatus?.llamaServerBinaryAvailable
                            ? 'llama-server Ready'
                            : 'llama-server not on PATH'}
                        </span>
                      </div>

                      {Array.isArray(backendLocalStatus?.ggufFiles) && backendLocalStatus.ggufFiles.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedGgufFile}
                            onChange={(e) => setSelectedGgufFile(e.target.value)}
                            className="flex-1 bg-[#1e1d2b] border border-[#35334a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          >
                            {backendLocalStatus.ggufFiles.map((f: any) => (
                              <option key={f.filename} value={f.filename}>
                                {f.filename} ({f.sizeLabel})
                              </option>
                            ))}
                          </select>
                          {backendLocalStatus?.managedProcess?.running ? (
                            <button
                              type="button"
                              onClick={handleStopManagedLlama}
                              disabled={llamaStarting}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-1"
                            >
                              <Square className="w-3 h-3" />
                              <span>Stop</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleStartManagedLlama}
                              disabled={llamaStarting || !backendLocalStatus?.llamaServerBinaryAvailable}
                              className="px-3 py-1.5 rounded-lg bg-violet-500/25 hover:bg-violet-500/35 border border-violet-500/40 text-violet-100 text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                            >
                              <Play className="w-3 h-3" />
                              <span>{llamaStarting ? 'Starting...' : 'Start Model'}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#94a3b8]">
                          Drop any <code className="text-violet-300">.gguf</code> file into <code className="text-violet-300">models/</code> or run <code className="text-violet-300">llama-server</code> / Ollama below.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Endpoint URL & Model ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#cbd5e1] mb-1">
                        Endpoint Base URL (llama.cpp / Ollama / LM Studio)
                      </label>
                      <input
                        type="text"
                        value={localBaseUrl}
                        onChange={(e) => setLocalBaseUrl(e.target.value)}
                        placeholder="http://127.0.0.1:8080/v1"
                        className="w-full bg-[#1a1926] border border-violet-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#cbd5e1] mb-1">
                        Model ID (e.g. llama3.2, qwen2.5:7b, or local-model)
                      </label>
                      <input
                        type="text"
                        value={localModelId}
                        onChange={(e) => setLocalModelId(e.target.value)}
                        placeholder="Auto-detected or custom model name"
                        className="w-full bg-[#1a1926] border border-[#2f2d42] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>

                  {/* Quick Run Guide & Test Button */}
                  <div className="p-2.5 rounded-xl bg-[#161522] border border-[#29273a] text-[10px] text-[#94a3b8] space-y-1 font-mono">
                    <div># llama.cpp (any GGUF): <span className="text-violet-300">llama-server -m model.gguf --port 8080 --cors-allow-origin "*"</span></div>
                    <div># Ollama (local CORS): <span className="text-violet-300">OLLAMA_ORIGINS="*" ollama serve</span> (URL: <span className="text-violet-300">http://localhost:11434/v1</span>)</div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleTestLocalLlm}
                      disabled={localTesting || !localBaseUrl.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/25 hover:bg-violet-500/35 border border-violet-500/40 text-violet-200 text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      <Zap className="w-3 h-3" />
                      <span>{localTesting ? 'Connecting...' : 'Test & Save Local Engine'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderSwitch('local')}
                      className="text-[11px] text-violet-300 hover:text-violet-200 underline"
                    >
                      Use Local AI Now
                    </button>
                  </div>

                  {localTestResult && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        localTestResult.success
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/15 border border-red-500/30 text-red-300'
                      }`}
                    >
                      {localTestResult.success ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      <span>{localTestResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Model Engine Selector */}
                <div className="pb-4 border-b border-[#262626]">
                  <label className="block text-sm font-semibold text-white mb-1.5">
                    Active Sovereign Intelligence Engine
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const nextModel = e.target.value;
                      onSelectModel(nextModel);
                      if (nextModel.startsWith('raone-llama')) {
                        setProviderMode('groq');
                        if (onSelectProvider) onSelectProvider('groq');
                      }
                    }}
                    className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="gemini-3.8-flash">RaOne Flash (Gemini · Recommended)</option>
                    <option value="raone-llama3-70b">RaOne Llama 3.3 70B (Groq Free · Ultra Fast)</option>
                    <option value="raone-llama4">RaOne Llama 4 Scout (Groq Meta Llama 4)</option>
                    <option value="raone-llama-fast">RaOne Llama 3.1 8B Instant (Groq Low Latency)</option>
                    <option value="gemini-4-argon">RaOne Argon (Deep Cognitive Reasoning & Systems Logic)</option>
                    <option value="comet-all-in-one">CometAPI All-In-One (Multi-Model Gateway: GPT-4o, Claude, DeepSeek, Gemini)</option>
                    <option value="raone-deepseek-r1">RaOne DeepSeek R1 (Open Deep Reasoning Matrix)</option>
                    <option value="raone-gpt4o">RaOne GPT-4o (Omni Intelligence)</option>
                    <option value="raone-claude">RaOne Claude 3.5 (State-of-the-Art Code & Architecture)</option>
                    <option value="gemini-3.1-flash-lite">RaOne Lite (Ultra-Low Latency Streaming)</option>
                  </select>
                </div>

                {/* CometAPI All-In-One Gateway Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-[#131b26] to-[#0c1017] border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.12)] space-y-3.5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <Zap className="w-4 h-4 text-cyan-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-wide">CometAPI</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold uppercase">
                            All-In-One Gateway
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94a3b8]">
                          Unified AI API for 500+ models (GPT-4o, Claude, DeepSeek, Gemini, Midjourney)
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${
                        keysConfigured.cometApiConfigured
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                          : 'bg-[#242424] text-[#8e8e8e] border-[#383838]'
                      }`}
                    >
                      {keysConfigured.cometApiConfigured ? 'Active / Connected' : 'Not Set'}
                    </span>
                  </div>

                  {/* CometAPI Key Input */}
                  <div>
                    <label className="flex items-center justify-between text-xs font-medium text-[#cbd5e1] mb-1">
                      <span>CometAPI Key</span>
                      <a
                        href="https://cometapi.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        <span>Get key from cometapi.com</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </label>
                    <div className="relative">
                      <input
                        type={showCometKey ? 'text' : 'password'}
                        value={cometKey}
                        onChange={(e) => setCometKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-[#16202c] border border-cyan-500/30 rounded-xl px-3 py-2 pr-10 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono placeholder-[#475569]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCometKey(!showCometKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white p-1"
                        title={showCometKey ? 'Hide key' : 'Show key'}
                      >
                        {showCometKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* CometAPI Base URL Input */}
                  <div>
                    <label className="block text-xs font-medium text-[#cbd5e1] mb-1">
                      API Base URL (Default: https://api.cometapi.com/v1)
                    </label>
                    <input
                      type="text"
                      value={cometBaseUrl}
                      onChange={(e) => setCometBaseUrl(e.target.value)}
                      placeholder="https://api.cometapi.com/v1"
                      className="w-full bg-[#16202c] border border-[#2d3d50] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono placeholder-[#475569]"
                    />
                  </div>

                  {/* Test Connection & Feedback */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleTestCometApi}
                      disabled={cometTesting || (!cometKey && !keysConfigured.cometApiConfigured)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {cometTesting ? (
                        <>
                          <RotateCcw className="w-3 h-3 animate-spin" />
                          <span>Testing Gateway...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          <span>Test CometAPI Connection</span>
                        </>
                      )}
                    </button>

                    <div className="text-[10px] text-[#94a3b8]">
                      Click <strong className="text-white">Save & Apply</strong> below to persist.
                    </div>
                  </div>

                  {/* Test Result Notice */}
                  {cometTestResult && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                        cometTestResult.success
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/15 border border-red-500/30 text-red-300'
                      }`}
                    >
                      {cometTestResult.success ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      <span>{cometTestResult.message}</span>
                    </div>
                  )}
                </div>

                {/* API Keys Configuration */}
                <div className="space-y-3.5">
                  <div className="text-sm font-semibold text-white">Direct / Standalone API Keys (Optional Fallbacks)</div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#b4b4b4]">Google Gemini API Key</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full ${
                          keysConfigured.geminiConfigured
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#2a2a2a] text-[#737373]'
                        }`}
                      >
                        {keysConfigured.geminiConfigured ? 'Active' : 'Not Set'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2 text-xs text-white focus:outline-none placeholder-[#555]"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#161e1b] border border-emerald-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white">Groq API Key (Free · Meta Llama 3.3 / 4)</span>
                        <div className="text-[10px] text-[#94a3b8]">
                          Ultra-fast LPU streaming endpoint for Llama 3.3 70B &amp; Llama 4 Scout
                        </div>
                      </div>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full border ${
                          keysConfigured.groqConfigured
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-[#2a2a2a] text-[#737373] border-[#383838]'
                        }`}
                      >
                        {keysConfigured.groqConfigured ? 'Active' : 'Not Set'}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type={showGroqKey ? 'text' : 'password'}
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full bg-[#111614] border border-emerald-500/30 rounded-xl p-2 pr-9 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono placeholder-[#555]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGroqKey(!showGroqKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white p-1"
                        title={showGroqKey ? 'Hide key' : 'Show key'}
                      >
                        {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        type="button"
                        onClick={handleTestGroqApi}
                        disabled={groqTesting || (!groqKey && !keysConfigured.groqConfigured)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {groqTesting ? (
                          <>
                            <RotateCcw className="w-3 h-3 animate-spin" />
                            <span>Testing Groq...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3" />
                            <span>Test Groq Connection</span>
                          </>
                        )}
                      </button>

                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                      >
                        <span>Get free key at console.groq.com</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    {groqTestResult && (
                      <div
                        className={`p-2 rounded-xl text-[11px] flex items-center gap-2 ${
                          groqTestResult.success
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                            : 'bg-red-500/15 border border-red-500/30 text-red-300'
                        }`}
                      >
                        {groqTestResult.success ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span>{groqTestResult.message}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#b4b4b4]">OpenAI API Key (Optional)</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full ${
                          keysConfigured.openAiConfigured
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#2a2a2a] text-[#737373]'
                        }`}
                      >
                        {keysConfigured.openAiConfigured ? 'Active' : 'Not Set'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={openAiKey}
                      onChange={(e) => setOpenAiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2 text-xs text-white focus:outline-none placeholder-[#555]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#b4b4b4]">DeepSeek API Key (Optional)</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full ${
                          keysConfigured.deepSeekConfigured
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#2a2a2a] text-[#737373]'
                        }`}
                      >
                        {keysConfigured.deepSeekConfigured ? 'Active' : 'Not Set'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={deepSeekKey}
                      onChange={(e) => setDeepSeekKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2 text-xs text-white focus:outline-none placeholder-[#555]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#b4b4b4]">Anthropic API Key (Optional)</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full ${
                          keysConfigured.anthropicConfigured
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#2a2a2a] text-[#737373]'
                        }`}
                      >
                        {keysConfigured.anthropicConfigured ? 'Active' : 'Not Set'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2 text-xs text-white focus:outline-none placeholder-[#555]"
                    />
                  </div>
                </div>

                {/* Cloud Connectors */}
                <div className="pt-3 border-t border-[#262626] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">3rd-Party Platforms & Studio Plugins</div>
                      <p className="text-[11px] text-[#8e8e8e]">
                        Connect GitHub, Firebase, Vercel, Notion, Hugging Face, ElevenLabs & webhooks in the encrypted vault.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPlugins?.();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-white shrink-0 transition-colors"
                    >
                      Open Plugins Library
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 7. ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#8e8e8e]">Current Plan</div>
                    <div className="text-lg font-bold text-white capitalize flex items-center gap-2 mt-0.5">
                      <span>{currentPlan}</span>
                      {currentPlan === 'ultimate' && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 font-bold uppercase">
                          Ultimate Power
                        </span>
                      )}
                      {currentPlan === 'plus' && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold uppercase">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#737373] mt-1">
                      {currentPlan === 'free'
                        ? '$0 USD / month · Standard access'
                        : currentPlan === 'plus'
                        ? '$20 USD / month · Full reasoning & studios'
                        : '$200 USD / month · Sovereign execution & priority compute'}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenUpgrade) onOpenUpgrade();
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-semibold text-xs transition-colors shadow-md"
                  >
                    {currentPlan === 'free' ? 'Upgrade plan' : 'Manage plan'}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#262626]">
                    <span className="text-[#8e8e8e]">Account Name</span>
                    <span className="text-white font-medium">
                      {auth?.currentUser?.displayName || (auth?.currentUser ? 'Authenticated User' : 'Guest Session')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#262626]">
                    <span className="text-[#8e8e8e]">Email Address</span>
                    <span className="text-white font-mono">
                      {auth?.currentUser?.email || 'Sign in to link account'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#262626]">
                    <span className="text-[#8e8e8e]">Platform Provider</span>
                    <span className="text-amber-400 font-semibold">RaOne AI by RavanaTec</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8e8e8e]">Encryption Architecture</span>
                    <span className="text-emerald-400">AES-256-GCM Per-Tenant Vault</span>
                  </div>
                </div>
              </div>
            )}

            {/* ALL 5 STUDIOS, 2 LIBRARIES & SYSTEM DIAGNOSTICS */}
            <SettingsStudioPanels
              activeTab={activeTab}
              settings={universalProfile}
              onChangeSettings={setUniversalProfile}
              onResetSection={handleResetSection}
              diagnostics={diagnostics}
              diagnosticsLoading={diagnosticsLoading}
              onRefreshDiagnostics={loadDiagnostics}
              onExportProfile={handleExportProfile}
              onImportProfileFile={handleImportProfileFile}
              onOpenLibrary={() => {
                onClose();
                onOpenLibrary?.();
              }}
              onOpenPlugins={() => {
                onClose();
                onOpenPlugins?.();
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t border-[#252629] flex items-center justify-between bg-[#131416] shrink-0">
          <span className="text-[11px] text-[#9AA0A6]">
            RaOne Universal Settings Center · Synced to Workspace Vault
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#C4C7C5] hover:text-white hover:bg-[#1E1F22] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] transition-colors flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save &amp; Sync</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Memory Manager */}
      {isMemoryManagerOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-5 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2a2a]">
              <div>
                <h3 className="text-sm font-bold text-white">Memory Manager</h3>
                <p className="text-[11px] text-[#8e8e8e]">Things ChatGPT has remembered about you</p>
              </div>
              <button
                onClick={() => setIsMemoryManagerOpen(false)}
                className="p-1 rounded-lg text-[#8e8e8e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add memory item */}
            <div className="flex items-center gap-2 pt-3 pb-2">
              <input
                type="text"
                value={newMemoryInput}
                onChange={(e) => setNewMemoryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                placeholder="Add a new memory note..."
                className="flex-1 bg-[#242424] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
              <button
                onClick={handleAddMemory}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Memories list */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2 chat-scroll-area">
              {memories.length === 0 ? (
                <div className="text-xs text-[#737373] text-center py-8">No saved memories</div>
              ) : (
                memories.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#222] border border-[#2f2f2f] flex items-center justify-between text-xs text-white group"
                  >
                    <span>{m}</span>
                    <button
                      onClick={() => handleDeleteMemory(idx)}
                      className="p-1 text-[#8e8e8e] hover:text-red-400 opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
              <button
                onClick={handleClearAllMemories}
                className="text-xs text-red-400 hover:underline"
              >
                Clear all memories
              </button>
              <button
                onClick={() => setIsMemoryManagerOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#262626] text-white text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Confirm Delete All Chats */}
      {isConfirmDeleteAllChatsOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Clear all chats?</h3>
            </div>
            <p className="text-xs text-[#8e8e8e] leading-relaxed">
              Are you sure you want to clear your entire chat history? This action is permanent and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmDeleteAllChatsOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#262626] text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllChats}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Archived Chats */}
      {isArchivedChatsOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-bold text-white">Archived Chats</h3>
              <button onClick={() => setIsArchivedChatsOpen(false)} className="text-[#8e8e8e] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#737373] text-center py-8">
              You have no archived conversations.
            </div>
            <div className="flex justify-end pt-2 border-t border-[#2a2a2a]">
              <button
                onClick={() => setIsArchivedChatsOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#262626] text-white text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Delete Account Confirmation */}
      {isConfirmDeleteAccountOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Account?</h3>
            </div>
            <p className="text-xs text-[#8e8e8e] leading-relaxed">
              This will permanently delete your account, saved chats, custom instructions, and memories.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmDeleteAccountOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#262626] text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const res = await fetch('/api/user/settings/delete-account', { method: 'POST' });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setIsConfirmDeleteAccountOpen(false);
                    setStatusNotice(data?.error || 'Sign in required to delete account workspace.');
                    setTimeout(() => setStatusNotice(null), 3500);
                    return;
                  }
                  if (onClearAllChats) onClearAllChats();
                  setIsConfirmDeleteAccountOpen(false);
                  onClose();
                  window.location.reload();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
