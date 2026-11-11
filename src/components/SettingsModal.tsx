import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Settings,
  Volume2,
  Sparkles,
  Check,
  Key,
  ShieldCheck,
  Lock,
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
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isContinuousWakeListening: boolean;
  onToggleContinuousWake: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  currentPlan?: 'free' | 'plus' | 'ultimate';
  onOpenUpgrade?: () => void;
  onClearAllChats?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isContinuousWakeListening,
  onToggleContinuousWake,
  selectedModel,
  onSelectModel,
  currentPlan = 'free',
  onOpenUpgrade,
  onClearAllChats,
}) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'personalization' | 'speech' | 'datacontrols' | 'security' | 'connectedapps' | 'account'
  >('general');

  // General Settings State
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<string>('auto');
  const [alwaysShowCode, setAlwaysShowCode] = useState<boolean>(true);
  const [isConfirmDeleteAllChatsOpen, setIsConfirmDeleteAllChatsOpen] = useState<boolean>(false);
  const [isArchivedChatsOpen, setIsArchivedChatsOpen] = useState<boolean>(false);

  // Personalization State
  const [aboutUser, setAboutUser] = useState<string>(
    'Software Engineer & Builder, prefers precise, complete, and high-level architectural solutions.'
  );
  const [responseStyle, setResponseStyle] = useState<string>(
    'Address me with high clarity and formidable capability. Support both Sinhala and English fluently. Sign responses with RaOne AI by RavanaTec — Think. Create. Act.'
  );
  const [customInstructionsEnabled, setCustomInstructionsEnabled] = useState<boolean>(true);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [memories, setMemories] = useState<string[]>([
    'Lives in Sri Lanka and prefers Colombo/IST timezone',
    'Prefers clean React 19 + TypeScript + Tailwind CSS code',
    'Communicates bilingually in Sinhala and English (Singlish supported)',
    'Prefers Dark Mode UI with high contrast',
  ]);
  const [newMemoryInput, setNewMemoryInput] = useState<string>('');
  const [isMemoryManagerOpen, setIsMemoryManagerOpen] = useState<boolean>(false);

  // Speech State
  const [selectedVoice, setSelectedVoice] = useState<string>('Breeze');
  const [speechLanguage, setSpeechLanguage] = useState<string>('auto');
  const [isPlayingSample, setIsPlayingSample] = useState<boolean>(false);

  // Data Controls State
  const [historyAndTraining, setHistoryAndTraining] = useState<boolean>(true);
  const [isConfirmDeleteAccountOpen, setIsConfirmDeleteAccountOpen] = useState<boolean>(false);

  // Security State
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);

  // API Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [deepSeekKey, setDeepSeekKey] = useState('');
  const [xaiKey, setXaiKey] = useState('');
  const [keysConfigured, setKeysConfigured] = useState<{
    geminiConfigured: boolean;
    openAiConfigured: boolean;
    anthropicConfigured: boolean;
    deepSeekConfigured: boolean;
    xaiConfigured?: boolean;
  }>({
    geminiConfigured: false,
    openAiConfigured: false,
    anthropicConfigured: false,
    deepSeekConfigured: false,
    xaiConfigured: false,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Fetch settings & keys from Backend API on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/user/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.theme) setTheme(data.theme);
            if (data.language) setLanguage(data.language);
            if (typeof data.alwaysShowCode === 'boolean') setAlwaysShowCode(data.alwaysShowCode);
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
              setHistoryAndTraining(data.dataControls.historyAndTraining ?? true);
            }
            if (data.security) {
              setMfaEnabled(data.security.mfaEnabled ?? false);
            }
          }
        })
        .catch(() => {});

      fetch('/api/keys')
        .then((res) => res.json())
        .then((data) => setKeysConfigured(data))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Save Settings to Backend API
  const handleSave = async () => {
    try {
      const payload = {
        theme,
        language,
        alwaysShowCode,
        customInstructions: {
          aboutUser,
          responseStyle,
          enabled: customInstructionsEnabled,
        },
        memory: {
          enabled: memoryEnabled,
          items: memories,
        },
        voice: {
          selectedVoice,
          speechLanguage,
          wakeWordEnabled: isContinuousWakeListening,
        },
        dataControls: {
          historyAndTraining,
        },
        security: {
          mfaEnabled,
        },
      };

      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Save API keys if any entered
      if (geminiKey || openAiKey || anthropicKey || deepSeekKey || xaiKey) {
        await fetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey: geminiKey || undefined,
            openAiApiKey: openAiKey || undefined,
            anthropicApiKey: anthropicKey || undefined,
            deepSeekApiKey: deepSeekKey || undefined,
            xaiApiKey: xaiKey || undefined,
          }),
        });
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.warn('Could not save settings:', err);
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
      await fetch('/api/user/settings/clear-all-chats', { method: 'POST' });
      if (onClearAllChats) onClearAllChats();
      setIsConfirmDeleteAllChatsOpen(false);
      setStatusNotice('All chat history was permanently deleted.');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Export Data action
  const handleExportData = () => {
    window.open('/api/user/settings/export-data', '_blank');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-3xl bg-[#171717] border border-[#2d2d2d] rounded-2xl sm:rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-[#262626] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-white" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-white hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification toast */}
        {statusNotice && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Content with 7 ChatGPT Tabs */}
        <div className="flex-1 flex overflow-hidden min-h-[460px]">
          {/* Left Navigation Tabs */}
          <div className="w-52 sm:w-56 bg-[#141414] border-r border-[#262626] p-2 space-y-0.5 shrink-0 overflow-y-auto chat-scroll-area">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'general'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>General</span>
            </button>

            <button
              onClick={() => setActiveTab('personalization')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'personalization'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Personalization</span>
            </button>

            <button
              onClick={() => setActiveTab('speech')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'speech'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Speech</span>
            </button>

            <button
              onClick={() => setActiveTab('datacontrols')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'datacontrols'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Data controls</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'security'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security</span>
            </button>

            <button
              onClick={() => setActiveTab('connectedapps')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'connectedapps'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>Connected apps & APIs</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                activeTab === 'account'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#1c1c1c]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <div className="flex items-center justify-between w-full">
                <span>Account</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    currentPlan === 'ultimate'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                      : currentPlan === 'plus'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-[#222] text-[#8e8e8e]'
                  }`}
                >
                  {currentPlan}
                </span>
              </div>
            </button>
          </div>

          {/* Right Tab Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto chat-scroll-area text-xs text-[#ececec] space-y-6">
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-5">
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
                {/* Custom Instructions Accordion/Section */}
                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
                    <div>
                      <div className="text-sm font-semibold text-white">Custom instructions</div>
                      <div className="text-[11px] text-[#8e8e8e]">
                        What would you like ChatGPT to know about you to provide better responses?
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
                      What would you like ChatGPT to know about you to provide better responses?
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
                      How would you like ChatGPT to respond?
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
                </div>

                {/* Memory Section */}
                <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-between">
                  <div className="max-w-[75%]">
                    <div className="text-sm font-semibold text-white">Memory</div>
                    <div className="text-[11px] text-[#8e8e8e] leading-relaxed mt-0.5">
                      ChatGPT will remember details you share across conversations to provide personalized context.
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
                <div className="flex items-center justify-between pt-1">
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
              </div>
            )}

            {/* 4. DATA CONTROLS TAB */}
            {activeTab === 'datacontrols' && (
              <div className="space-y-5">
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
                {/* Multi-Factor Authentication */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <div>
                    <div className="text-sm font-semibold text-white">Multi-factor authentication (MFA)</div>
                    <div className="text-[11px] text-[#8e8e8e]">
                      Require an extra security verification code when logging in
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMfaEnabled(!mfaEnabled);
                      setStatusNotice(mfaEnabled ? 'MFA disabled' : 'MFA enabled successfully');
                      setTimeout(() => setStatusNotice(null), 2500);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      mfaEnabled
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white'
                    }`}
                  >
                    {mfaEnabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {/* Log out of all devices */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-sm font-semibold text-white">Log out of all devices</div>
                    <div className="text-[11px] text-[#8e8e8e]">
                      Terminate all active web and mobile sessions for your account
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setStatusNotice('Logged out of all other sessions.');
                      setTimeout(() => setStatusNotice(null), 2500);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-white text-xs font-medium transition-colors"
                  >
                    Log out all
                  </button>
                </div>
              </div>
            )}

            {/* 6. CONNECTED APPS & APIS TAB */}
            {activeTab === 'connectedapps' && (
              <div className="space-y-5">
                {/* Model Engine Selector */}
                <div className="pb-4 border-b border-[#262626]">
                  <label className="block text-sm font-semibold text-white mb-1.5">
                    Active Sovereign Intelligence Engine
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => onSelectModel(e.target.value)}
                    className="w-full bg-[#242424] border border-[#383838] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="gemini-3.8-flash">RaOne Flash (High Velocity · Recommended)</option>
                    <option value="gemini-4-argon">RaOne Argon (Deep Cognitive Reasoning & Systems Logic)</option>
                    <option value="raone-deepseek-r1">RaOne DeepSeek R1 (Open Deep Reasoning Matrix)</option>
                    <option value="raone-gpt4o">RaOne GPT-4o (Omni Intelligence)</option>
                    <option value="raone-claude">RaOne Claude 3.5 (State-of-the-Art Code & Architecture)</option>
                    <option value="gemini-3.1-flash-lite">RaOne Lite (Ultra-Low Latency Streaming)</option>
                  </select>
                </div>

                {/* API Keys Configuration */}
                <div className="space-y-3.5">
                  <div className="text-sm font-semibold text-white">External Model API Keys</div>

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
                  <div className="text-sm font-semibold text-white">Workspace Apps</div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-center">
                      <div className="font-semibold text-white text-xs">Google Drive</div>
                      <div className="text-[10px] text-emerald-400 mt-0.5">Connected</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-center">
                      <div className="font-semibold text-white text-xs">OneDrive</div>
                      <div className="text-[10px] text-[#737373] mt-0.5">Not linked</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-center">
                      <div className="font-semibold text-white text-xs">GitHub</div>
                      <div className="text-[10px] text-emerald-400 mt-0.5">Connected</div>
                    </div>
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
                    <span className="text-white font-medium">Shanthapriya Silva</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#262626]">
                    <span className="text-[#8e8e8e]">Email Address</span>
                    <span className="text-white font-mono">info.ravanatech@gmail.com</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#262626]">
                    <span className="text-[#8e8e8e]">Platform Provider</span>
                    <span className="text-amber-400 font-semibold">RaOne AI by RavanaTec</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8e8e8e]">Encryption Architecture</span>
                    <span className="text-emerald-400">Zero-Knowledge Sovereign Proxy</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t border-[#262626] flex items-center justify-between bg-[#141414] shrink-0">
          <span className="text-[11px] text-[#737373]">RaOne AI Settings Center · 100% ChatGPT Compliant</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#b4b4b4] hover:text-white hover:bg-[#262626] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-200 text-slate-950 transition-colors flex items-center gap-1.5 shadow-md"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Memory Manager */}
      {isMemoryManagerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
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
                  await fetch('/api/user/settings/delete-account', { method: 'POST' });
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
