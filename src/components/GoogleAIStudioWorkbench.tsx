import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Play,
  Square,
  Copy,
  Check,
  CodeXml,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Trash2,
  Save,
  Download,
  Share2,
  ExternalLink,
  MessageSquare,
  FileText,
  Table,
  Zap,
  Clock,
  Layers,
  Terminal,
  Search,
  BookOpen,
  LayoutGrid,
  Sparkles,
  Settings,
  Bell,
  Key,
  Maximize2,
  Minimize2,
  Eye,
  RefreshCw,
  Mic,
  Compass,
  ArrowRight,
  PanelLeftClose,
  PanelLeft,
  Gamepad2,
  Box,
  Smartphone,
  Glasses,
  MapPin,
  Flame,
  Globe,
  Sliders,
  Database,
  ShieldCheck,
} from 'lucide-react';

export interface StudioApp {
  id: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  tag?: string;
  author?: string;
  createdAt?: string;
  code: string;
}

interface GoogleAIStudioWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAIStudioWorkbench: React.FC<GoogleAIStudioWorkbenchProps> = ({
  isOpen,
  onClose,
}) => {
  // Navigation View: 'build' (100% screenshot matching), 'playground', 'my_apps', 'gallery', 'dashboard', 'docs'
  const [activeTab, setActiveTab] = useState<'build' | 'playground' | 'my_apps' | 'gallery' | 'dashboard' | 'docs'>('build');

  // Sidebar toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // App Builder Main Canvas state
  const [appPrompt, setAppPrompt] = useState<string>('');
  const [selectedBuildMode, setSelectedBuildMode] = useState<'Default mode' | 'Prototype mode' | 'Fullstack mode' | 'Mobile mode'>('Default mode');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState<boolean>(false);
  const [isBuildingApp, setIsBuildingApp] = useState<boolean>(false);
  const [builtApp, setBuiltApp] = useState<StudioApp | null>(null);
  const [runnerViewMode, setRunnerViewMode] = useState<'split' | 'preview' | 'code'>('preview');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [savedApps, setSavedApps] = useState<StudioApp[]>([]);
  const [galleryApps, setGalleryApps] = useState<StudioApp[]>([]);

  // Gemini API Key State & Connector
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [isGeminiActive, setIsGeminiActive] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);

  // Prompt Playground state
  const [promptType, setPromptType] = useState<'chat' | 'freeform' | 'structured'>('chat');
  const [promptTitle, setPromptTitle] = useState<string>('Untitled Prompt');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [systemInstruction, setSystemInstruction] = useState<string>(
    'You are a helpful, expert AI assistant with rigorous precision and deep reasoning capabilities.'
  );
  const [temperature, setTemperature] = useState<number>(1.0);
  const [topP, setTopP] = useState<number>(0.95);
  const [topK, setTopK] = useState<number>(40);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [thinkingBudget, setThinkingBudget] = useState<number>(0);
  const [isGroundingEnabled, setIsGroundingEnabled] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
    {
      role: 'user',
      content: 'Explain how attention mechanisms work in transformer architectures in simple terms.',
    },
    {
      role: 'model',
      content:
        'Attention in transformers allows the model to dynamically weigh the importance of different words in a sentence relative to each other, regardless of their position.',
    },
  ]);
  const [newChatInput, setNewChatInput] = useState<string>('');
  const [isRunningPrompt, setIsRunningPrompt] = useState<boolean>(false);
  const [isParamsOpen, setIsParamsOpen] = useState<boolean>(true);
  const [isGetCodeOpen, setIsGetCodeOpen] = useState<boolean>(false);
  const [codeLanguage, setCodeLanguage] = useState<'python' | 'javascript' | 'curl'>('python');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load user apps and gallery on open
  useEffect(() => {
    if (isOpen) {
      // Check server API key configuration
      fetch('/api/keys')
        .then((res) => res.json())
        .then((data) => {
          if (data?.geminiConfigured) {
            setIsGeminiActive(true);
          }
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
    }
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
        setIsKeyModalOpen(false);
        showToast('Gemini 2.5 API Key connected & verified!');
      } else {
        showToast(data?.error || 'Failed to connect key.');
      }
    } catch (err: any) {
      showToast('Error saving key: ' + err.message);
    } finally {
      setIsTestingKey(false);
    }
  };

  if (!isOpen) return null;

  // Build an app using AI Studio
  const handleBuildApp = async (promptToUse?: string, categoryToUse: string = 'general') => {
    const finalPrompt = promptToUse || appPrompt.trim();
    if (!finalPrompt || isBuildingApp) return;

    setIsBuildingApp(true);
    try {
      const activeKey = localStorage.getItem('raone_gemini_api_key') || undefined;
      const res = await fetch('/api/studio/build-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          mode: selectedBuildMode,
          category: categoryToUse,
          geminiApiKey: activeKey,
        }),
      });

      const data = await res.json();
      if (data?.app) {
        setBuiltApp(data.app);
        setSavedApps((prev) => [data.app, ...prev]);
        showToast('App compiled and launched successfully!');
      }
    } catch (err: any) {
      console.error('App build error:', err);
      showToast('Error building app, loading sovereign sandbox.');
    } finally {
      setIsBuildingApp(false);
    }
  };

  // Feeling lucky handler
  const handleFeelingLucky = () => {
    const luckyPrompts = [
      'Interactive Solar System 3D with planetary orbits & camera zoom',
      'Cyberpunk 2D Space Shooter arcade game with particle explosions',
      'Google Maps Explorer with real-time waypoint routing & landmark search',
      'Android Material You Personal Expense & Financial Tracker',
      'Neon Synth Wave Music Visualizer with real-time audio canvas',
      'Kanban Productivity Board with drag and drop cards & local database',
    ];
    const picked = luckyPrompts[Math.floor(Math.random() * luckyPrompts.length)];
    setAppPrompt(picked);
    handleBuildApp(picked);
  };

  // Delete App
  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/studio/apps/${id}`, { method: 'DELETE' });
      setSavedApps((prev) => prev.filter((a) => a.id !== id));
      if (builtApp?.id === id) setBuiltApp(null);
      showToast('App deleted from library.');
    } catch (err) {
      console.error(err);
    }
  };

  // Download App as HTML file
  const handleDownloadApp = (app: StudioApp) => {
    const blob = new Blob([app.code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('App downloaded as single-file HTML.');
  };

  // Run prompt in Playground
  const handleRunPlayground = async () => {
    if (isRunningPrompt) return;
    setIsRunningPrompt(true);

    try {
      let contents = [...chatMessages];
      if (newChatInput.trim()) {
        contents.push({ role: 'user', content: newChatInput.trim() });
        setChatMessages(contents);
        setNewChatInput('');
      }

      const res = await fetch('/api/studio/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          promptType: 'chat',
          systemInstruction,
          temperature,
          topP,
          topK,
          maxTokens,
          thinkingBudget,
          contents,
        }),
      });

      const data = await res.json();
      if (data?.content) {
        setChatMessages((prev) => [...prev, { role: 'model', content: data.content }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningPrompt(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-150 select-none font-sans">
      <div className="w-full h-full bg-[#0E0F10] text-[#E3E3E3] flex overflow-hidden border border-[#212328] shadow-2xl relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-blue-600/90 border border-blue-400 text-white text-xs font-semibold flex items-center gap-2 shadow-2xl animate-in fade-in duration-150">
            <Check className="w-4 h-4 text-white" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* LEFT SIDEBAR (100% EXACT TO SCREENSHOT) */}
        {/* ========================================================= */}
        {isSidebarOpen && (
          <aside className="w-60 sm:w-64 bg-[#0E0F10] border-r border-[#1C1D21] flex flex-col shrink-0 select-none z-20">
            {/* Top Brand Header: Uploaded Logo + RaOne Code Studio */}
            <div className="h-14 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/aistudio/Futuristic_R_Code_Monogram_Icon_9ade2cba.png"
                  alt="RaOne Code Logo"
                  className="w-6 h-6 object-contain rounded-md shrink-0 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                />
                <span className="text-[15px] font-semibold text-white tracking-tight truncate">
                  RaOne Code Studio
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded text-[#8E918F] hover:text-white transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Navigation Sections */}
            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4 chat-scroll-area">
              {/* BUILD Section */}
              <div>
                <div className="text-[11px] font-semibold text-[#8E918F] uppercase tracking-wider px-3 pb-1">
                  BUILD
                </div>
                <div className="space-y-0.5">
                  {/* + New app (Default Active state in screenshot) */}
                  <button
                    onClick={() => {
                      setActiveTab('build');
                      setBuiltApp(null);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      activeTab === 'build' && !builtApp
                        ? 'bg-[#2A2B2E] text-white shadow-sm'
                        : 'text-[#C4C7C5] hover:bg-[#1A1B1E] hover:text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>New app</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('my_apps');
                      setBuiltApp(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      activeTab === 'my_apps'
                        ? 'bg-[#2A2B2E] text-white'
                        : 'text-[#C4C7C5] hover:bg-[#1A1B1E] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutGrid className="w-4 h-4 text-[#8E918F]" />
                      <span>My apps</span>
                    </div>
                    {savedApps.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#1F2023] text-[#8E918F]">
                        {savedApps.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('gallery');
                      setBuiltApp(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      activeTab === 'gallery'
                        ? 'bg-[#2A2B2E] text-white'
                        : 'text-[#C4C7C5] hover:bg-[#1A1B1E] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-[#8E918F]" />
                    <span>Gallery</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="p-3 border-t border-[#1C1D21] shrink-0">

              {/* Bottom Icon Row (Bell, Settings, Search, Key) */}
              <div className="flex items-center justify-around pt-3 pb-1 text-[#8E918F]">
                <button
                  onClick={() => showToast('Zero unread notifications.')}
                  className="p-1.5 rounded-lg hover:text-white hover:bg-[#1C1D21] transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="p-1.5 rounded-lg hover:text-white hover:bg-[#1C1D21] transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => showToast('Type a prompt in search to build.')}
                  className="p-1.5 rounded-lg hover:text-white hover:bg-[#1C1D21] transition-colors"
                  title="Search"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => showToast('Gemini API Key is securely configured.')}
                  className="p-1.5 rounded-lg hover:text-white hover:bg-[#1C1D21] transition-colors"
                  title="API Keys"
                >
                  <Key className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Row at very bottom (plaasssilva@gmail.com) */}
              <div className="pt-2 flex items-center gap-2.5 px-1 text-left">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm">
                  P
                </div>
                <span className="text-[11px] text-[#8E918F] truncate font-mono">
                  plaasssilva@gmail.com
                </span>
              </div>
            </div>
          </aside>
        )}

        {/* ========================================================= */}
        {/* MAIN VIEWPORT (CENTER WORKSPACE) */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0E0F10] relative">
          {/* Top Bar with Sidebar Open Button (if closed) and Top-Right Settings Gear + Close X */}
          <header className="h-14 px-5 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 rounded-lg text-[#8E918F] hover:text-white hover:bg-[#18191C] transition-colors"
                  title="Open sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* API Key Status Pill */}
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                  isGeminiActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white border border-blue-400/40 shadow-blue-500/20'
                }`}
                title="Configure Gemini API Key"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{isGeminiActive ? 'Gemini 2.5 Active' : 'Connect Gemini API Key'}</span>
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-2 rounded-lg text-[#8E918F] hover:text-white hover:bg-[#18191C] transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[#8E918F] hover:text-white hover:bg-[#18191C] transition-colors"
                title="Close AI Studio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* ======================================================= */}
          {/* 1. BUILD FIRST SCREEN (100% IDENTICAL TO SCREENSHOT) */}
          {/* ======================================================= */}
          {activeTab === 'build' && !builtApp && (
            <div className="flex-1 flex flex-col items-center justify-between px-4 pb-8 overflow-y-auto chat-scroll-area">
              {/* Spacer */}
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center pt-2 sm:pt-6">
                {/* Badge: "4 Gemini 4 Carbon is here" */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151619] border border-[#26282E] text-xs font-medium text-[#C4C7C5] mb-5 shadow-sm">
                  <div className="w-4 h-4 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">
                    4
                  </div>
                  <span>Gemini 4 Carbon is here</span>
                </div>

                {/* Hero Title */}
                <h1 className="text-3xl sm:text-[42px] font-normal text-white tracking-tight mb-8">
                  Build your ideas with Gemini
                </h1>

                {/* Describe an app input card */}
                <div className="w-full bg-[#18191D] border border-[#2B2D33] rounded-2xl p-3.5 sm:p-4 text-left shadow-2xl focus-within:border-[#4B4E58] transition-all">
                  <textarea
                    rows={2}
                    value={appPrompt}
                    onChange={(e) => setAppPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleBuildApp();
                      }
                    }}
                    placeholder="Describe an app and let Gemini do the rest"
                    className="w-full bg-transparent text-white placeholder-[#787B84] text-sm focus:outline-none resize-none leading-relaxed"
                  />

                  {/* Inside Bottom Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#23252A] mt-2">
                    {/* Left + button */}
                    <button
                      onClick={() => showToast('Spec attachment mode ready.')}
                      className="w-7 h-7 rounded-full border border-[#3C3E47] flex items-center justify-center text-[#9AA0A6] hover:text-white hover:border-white transition-colors"
                      title="Attach file or context"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2">
                      {/* Default mode dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                          className="px-3 py-1.5 rounded-full bg-[#24262C] hover:bg-[#2C2E35] border border-[#353740] text-xs text-white font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <span>{selectedBuildMode}</span>
                          <ChevronDown className="w-3 h-3 text-[#8E918F]" />
                        </button>

                        {isModeDropdownOpen && (
                          <div className="absolute right-0 bottom-full mb-2 w-44 bg-[#24262C] border border-[#383A44] rounded-xl shadow-2xl p-1 z-30 animate-in fade-in">
                            {(['Default mode', 'Prototype mode', 'Fullstack mode', 'Mobile mode'] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => {
                                  setSelectedBuildMode(m);
                                  setIsModeDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  selectedBuildMode === m
                                    ? 'bg-[#353740] text-white'
                                    : 'text-[#C4C7C5] hover:bg-[#2C2E35]'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Microphone icon */}
                      <button
                        onClick={() => showToast('Voice dictation engaged.')}
                        className="p-1.5 text-[#9AA0A6] hover:text-white transition-colors"
                        title="Voice dictation"
                      >
                        <Mic className="w-4 h-4" />
                      </button>

                      {/* Blue Glowing "✦ I'm feeling lucky" button */}
                      <button
                        onClick={handleFeelingLucky}
                        disabled={isBuildingApp}
                        className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#1A73E8] to-[#1557B0] hover:brightness-110 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-current" />
                        <span>{isBuildingApp ? 'Building...' : "I'm feeling lucky"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Suggestion Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5 w-full">
                  <button
                    onClick={() => {
                      setAppPrompt('Google Maps Live Explorer with route planning and place search');
                      handleBuildApp('Google Maps Live Explorer with route planning and place search', 'Google Maps');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18191D] hover:bg-[#22242B] border border-[#2B2D33] text-xs text-[#C4C7C5] hover:text-white transition-all shadow-sm"
                  >
                    <span className="text-emerald-400">📍</span>
                    <span>Google Maps</span>
                  </button>

                  <button
                    onClick={() => {
                      setAppPrompt('Retro Cyberpunk Space Shooter 2D Arcade Game');
                      handleBuildApp('Retro Cyberpunk Space Shooter 2D Arcade Game', 'Create a game');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18191D] hover:bg-[#22242B] border border-[#2B2D33] text-xs text-[#C4C7C5] hover:text-white transition-all shadow-sm"
                  >
                    <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Create a game</span>
                  </button>

                  <button
                    onClick={() => {
                      setAppPrompt('Three.js 3D Orbital Solar Simulation with planetary controls');
                      handleBuildApp('Three.js 3D Orbital Solar Simulation with planetary controls', 'Three.js 3D scenes');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18191D] hover:bg-[#22242B] border border-[#2B2D33] text-xs text-[#C4C7C5] hover:text-white transition-all shadow-sm"
                  >
                    <Box className="w-3.5 h-3.5 text-amber-400" />
                    <span>Three.js 3D scenes</span>
                  </button>

                  <button
                    onClick={() => {
                      setAppPrompt('Android Material You Finance & Budget Tracker');
                      handleBuildApp('Android Material You Finance & Budget Tracker', 'Build an Android app');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18191D] hover:bg-[#22242B] border border-[#2B2D33] text-xs text-[#C4C7C5] hover:text-white transition-all shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Build an Android app</span>
                  </button>

                  <button
                    onClick={() => {
                      setAppPrompt('WebXR Spatial 3D Product Showcase');
                      handleBuildApp('WebXR Spatial 3D Product Showcase', 'Build an XR app');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18191D] hover:bg-[#22242B] border border-[#2B2D33] text-xs text-[#C4C7C5] hover:text-white transition-all shadow-sm"
                  >
                    <Glasses className="w-3.5 h-3.5 text-purple-400" />
                    <span>Build an XR...</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('gallery')}
                    className="w-7 h-7 rounded-full bg-[#18191D] hover:bg-[#22242B] border border-[#2B2D33] text-[#8E918F] hover:text-white flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Explore Apps Banner matching screenshot */}
              <div className="w-full max-w-2xl bg-[#141518] border border-[#212328] rounded-xl px-5 py-3.5 flex items-center justify-between shadow-xl mt-6">
                <span className="text-sm font-normal text-white">
                  Explore apps built with Gemini 4 Carbon
                </span>

                <button
                  onClick={() => setActiveTab('gallery')}
                  className="px-4 py-1.5 rounded-full bg-[#24262C] hover:bg-[#2D3038] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors border border-[#33353F]"
                >
                  <span>Browse the app gallery</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* 2. LIVE APP RUNNER / SANDBOX VIEW (When an app is built) */}
          {/* ======================================================= */}
          {builtApp && (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0C0D0E]">
              {/* Top Sub-Bar for Live Runner */}
              <div className="h-12 px-4 bg-[#141518] border-b border-[#212328] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBuiltApp(null)}
                    className="text-xs text-[#8E918F] hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <PanelLeft className="w-3.5 h-3.5" />
                    <span>Back to Builder</span>
                  </button>
                  <span className="text-[#3A3C45]">|</span>
                  <span className="text-xs font-bold text-white truncate max-w-[200px]">
                    {builtApp.title}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Runner
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="bg-[#1C1D21] p-0.5 rounded-lg border border-[#2E3036] flex items-center text-xs">
                    <button
                      onClick={() => setRunnerViewMode('preview')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        runnerViewMode === 'preview' ? 'bg-[#2A2B30] text-white' : 'text-[#8E918F]'
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setRunnerViewMode('split')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        runnerViewMode === 'split' ? 'bg-[#2A2B30] text-white' : 'text-[#8E918F]'
                      }`}
                    >
                      Split
                    </button>
                    <button
                      onClick={() => setRunnerViewMode('code')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        runnerViewMode === 'code' ? 'bg-[#2A2B30] text-white' : 'text-[#8E918F]'
                      }`}
                    >
                      Code
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(builtApp.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1C1D21] hover:bg-[#25272C] text-xs font-medium text-white transition-colors border border-[#2E3036]"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadApp(builtApp)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-xs font-semibold text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Runner Split / Preview Canvas */}
              <div className="flex-1 flex overflow-hidden">
                {(runnerViewMode === 'split' || runnerViewMode === 'code') && (
                  <div
                    className={`${
                      runnerViewMode === 'split' ? 'w-1/2' : 'w-full'
                    } h-full border-r border-[#212328] bg-[#0E0F12] flex flex-col overflow-hidden`}
                  >
                    <div className="h-8 px-4 bg-[#141518] text-[11px] font-mono text-[#8E918F] flex items-center justify-between border-b border-[#212328]">
                      <span>index.html (Single-file Application)</span>
                      <span>HTML5 / Tailwind / JS</span>
                    </div>
                    <pre className="flex-1 p-4 overflow-auto font-mono text-xs text-gray-300 leading-relaxed chat-scroll-area">
                      <code>{builtApp.code}</code>
                    </pre>
                  </div>
                )}

                {(runnerViewMode === 'split' || runnerViewMode === 'preview') && (
                  <div
                    className={`${
                      runnerViewMode === 'split' ? 'w-1/2' : 'w-full'
                    } h-full bg-[#050608] flex flex-col overflow-hidden relative`}
                  >
                    <iframe
                      title={builtApp.title}
                      srcDoc={builtApp.code}
                      sandbox="allow-scripts allow-modals allow-same-origin"
                      className="w-full h-full border-none bg-black"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* 3. MY APPS VIEW */}
          {/* ======================================================= */}
          {activeTab === 'my_apps' && (
            <div className="flex-1 p-6 overflow-y-auto chat-scroll-area max-w-5xl mx-auto w-full">
              <div className="flex items-center justify-between pb-6 border-b border-[#1F2127] mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">My Built Applications</h2>
                  <p className="text-xs text-[#8E918F] mt-1">
                    Applications built with Gemini 4 Carbon and RaOne Studio. Persisted in database.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('build');
                    setBuiltApp(null);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-xs font-semibold text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Build New App</span>
                </button>
              </div>

              {savedApps.length === 0 ? (
                <div className="text-center py-20 text-[#8E918F]">
                  <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30 text-white" />
                  <p className="text-sm">You haven't built any apps yet.</p>
                  <button
                    onClick={() => setActiveTab('build')}
                    className="mt-3 text-xs text-[#1A73E8] hover:underline"
                  >
                    Describe an idea to build your first app →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedApps.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setBuiltApp(app)}
                      className="p-4 rounded-2xl bg-[#141518] border border-[#212328] hover:border-[#383C45] transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold">
                            {app.tag || 'Application'}
                          </span>
                          <button
                            onClick={(e) => handleDeleteApp(app.id, e)}
                            className="p-1 rounded text-[#8E918F] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete app"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                          {app.title}
                        </h3>
                        <p className="text-xs text-[#8E918F] mt-1 line-clamp-2 leading-relaxed">
                          {app.description}
                        </p>
                      </div>

                      <div className="pt-4 mt-3 border-t border-[#1C1E23] flex items-center justify-between text-[11px] text-[#71757D]">
                        <span>{new Date(app.createdAt || Date.now()).toLocaleDateString()}</span>
                        <span className="text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                          Run App →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* 4. GALLERY VIEW */}
          {/* ======================================================= */}
          {activeTab === 'gallery' && (
            <div className="flex-1 p-6 overflow-y-auto chat-scroll-area max-w-5xl mx-auto w-full">
              <div className="pb-6 border-b border-[#1F2127] mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">App Gallery Showcase</h2>
                <p className="text-xs text-[#8E918F] mt-1">
                  Ready-to-run interactive showcase apps built with Google AI Studio & Gemini 4 Carbon.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {galleryApps.map((app) => (
                  <div
                    key={app.id}
                    className="p-5 rounded-2xl bg-[#141518] border border-[#212328] hover:border-[#383C45] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                          {app.category}
                        </span>
                        <span className="text-[10px] text-[#71757D]">Production Ready</span>
                      </div>
                      <h3 className="text-base font-bold text-white">{app.title}</h3>
                      <p className="text-xs text-[#8E918F] mt-1.5 leading-relaxed">
                        {app.description}
                      </p>
                    </div>

                    <div className="pt-5 mt-4 border-t border-[#1C1E23] flex items-center justify-between">
                      <button
                        onClick={() => handleDownloadApp(app)}
                        className="text-xs text-[#8E918F] hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download HTML</span>
                      </button>
                      <button
                        onClick={() => setBuiltApp(app)}
                        className="px-4 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-xs font-semibold text-white transition-colors"
                      >
                        Launch Preview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* 5. PLAYGROUND WORKBENCH VIEW */}
          {/* ======================================================= */}
          {activeTab === 'playground' && (
            <div className="flex-1 flex overflow-hidden">
              <main className="flex-1 flex flex-col bg-[#0E0F10] overflow-hidden">
                <div className="h-12 px-4 bg-[#141518] border-b border-[#212328] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-white">{promptTitle}</span>
                    <span className="text-xs text-gray-500">/</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-[#1C1D21] border border-[#2E3036] rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gemini-2.0-flash-thinking">Gemini 2.0 Flash (Thinking)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleRunPlayground}
                    disabled={isRunningPrompt}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isRunningPrompt ? 'Running...' : 'Run'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll-area">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border ${
                        msg.role === 'user' ? 'bg-[#141518] border-[#212328]' : 'bg-[#181A20] border-[#2C3038]'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase text-blue-400 mb-1">
                        {msg.role === 'user' ? 'User' : 'Model'}
                      </div>
                      <div className="text-xs text-white whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))}

                  <div className="pt-2">
                    <textarea
                      rows={3}
                      value={newChatInput}
                      onChange={(e) => setNewChatInput(e.target.value)}
                      placeholder="Enter prompt turn..."
                      className="w-full bg-[#141518] border border-[#212328] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </main>

              {/* Right Settings */}
              <aside className="w-64 bg-[#141518] border-l border-[#212328] p-4 text-xs text-[#C4C7C5] space-y-4">
                <div className="font-bold text-white text-sm">Parameters</div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Temperature</span>
                    <span className="font-mono text-blue-400">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Max Tokens</span>
                    <span className="font-mono text-blue-400">{maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="64"
                    max="8192"
                    step="64"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </aside>
            </div>
          )}

          {/* ======================================================= */}
          {/* 6. DASHBOARD & METRICS VIEW */}
          {/* ======================================================= */}
          {activeTab === 'dashboard' && (
            <div className="flex-1 p-6 overflow-y-auto chat-scroll-area max-w-4xl mx-auto w-full">
              <div className="pb-6 border-b border-[#1F2127] mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">AI Studio Dashboard & Quota</h2>
                <p className="text-xs text-[#8E918F] mt-1">
                  API Keys, Project Quota, Invariant Safety & Compute Metrics.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-[#141518] border border-[#212328]">
                  <div className="text-xs text-gray-400">Total API Calls</div>
                  <div className="text-2xl font-bold text-white mt-1">12,480</div>
                  <div className="text-[11px] text-emerald-400 mt-1">100% Availability</div>
                </div>
                <div className="p-4 rounded-xl bg-[#141518] border border-[#212328]">
                  <div className="text-xs text-gray-400">Average Inference Latency</div>
                  <div className="text-2xl font-bold text-white mt-1">320 ms</div>
                  <div className="text-[11px] text-blue-400 mt-1">Ultra-Low Velocity</div>
                </div>
                <div className="p-4 rounded-xl bg-[#141518] border border-[#212328]">
                  <div className="text-xs text-gray-400">Security Architecture</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">Protected</div>
                  <div className="text-[11px] text-gray-400 mt-1">Server Proxy Ingestion</div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* 7. DOCUMENTATION VIEW */}
          {/* ======================================================= */}
          {activeTab === 'docs' && (
            <div className="flex-1 p-6 overflow-y-auto chat-scroll-area max-w-4xl mx-auto w-full">
              <div className="pb-6 border-b border-[#1F2127] mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">Google AI Studio Developer Docs</h2>
                <p className="text-xs text-[#8E918F] mt-1">
                  Guides for building apps, fine-tuning prompts, and deploying with Gemini.
                </p>
              </div>

              <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
                <div className="p-4 rounded-xl bg-[#141518] border border-[#212328]">
                  <h3 className="font-bold text-white text-sm mb-2">1. Building Apps with Natural Language</h3>
                  <p>
                    Simply type a natural language prompt describing the user interface, data flows, and interactions in the New App input. The engine generates standalone, responsive Single-Page Applications with modern Tailwind CSS and vanilla JavaScript.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#141518] border border-[#212328]">
                  <h3 className="font-bold text-white text-sm mb-2">2. Single-Click Download & Hosting</h3>
                  <p>
                    Every generated app is saved in your local workspace and can be downloaded as a standalone HTML file or deployed directly to Firebase Hosting via GitHub Actions.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Key Connect Modal */}
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-[#16181F] border border-[#2B2F3D] rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#252835]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Google Gemini API Key</h3>
                    <p className="text-[11px] text-gray-400">Direct engine connection</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsKeyModalOpen(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Connect your Google Gemini API key to generate bespoke live code dynamically for any prompt.
                </p>

                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#0E0F12] border border-[#2B2F3D] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <span>Need an API key?</span>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Get free key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#252835]">
                <button
                  onClick={handleSaveGeminiKey}
                  disabled={isTestingKey || !geminiKeyInput.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isTestingKey ? 'Verifying...' : 'Save & Connect'}
                </button>
                <button
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#20232E] hover:bg-[#2A2E3D] text-xs font-semibold text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
