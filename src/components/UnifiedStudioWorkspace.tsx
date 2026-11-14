import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  GitFork,
  Share2,
  Rocket,
  Bug,
  Settings,
  Plus,
  ChevronUp,
  ChevronDown,
  Mic,
  MicOff,
  ArrowUp,
  Eye,
  CodeXml,
  Folder,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  RotateCw,
  Maximize2,
  Minimize2,
  Pencil,
  Loader2,
  Check,
  X,
  Pause,
} from 'lucide-react';

export interface WorkspaceTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelLabel?: string;
  durationSec?: string;
  details?: string[];
  timestamp?: string;
}

export interface StudioModeOption {
  id: string;
  label: string;
  description?: string;
}

export type WorkspaceRightTab = 'preview' | 'code' | 'files';
export type ViewportSize = 'desktop' | 'laptop' | 'tablet' | 'mobile';

interface UnifiedStudioWorkspaceProps {
  isOpen: boolean;
  onBackToStart: () => void;
  moduleName: string;
  workspaceTitle: string;
  modelOptions: StudioModeOption[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmitPrompt: () => void;
  isGenerating: boolean;
  turns: WorkspaceTurn[];
  onResetWorkspace: () => void;
  rightTab: WorkspaceRightTab;
  onRightTabChange: (tab: WorkspaceRightTab) => void;
  routePath?: string;
  viewport?: ViewportSize;
  onViewportChange?: (vp: ViewportSize) => void;
  onRefresh?: () => void;
  onRemix?: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  publishLabel?: string;
  filesCount?: number;
  previewContent: React.ReactNode;
  codeContent: React.ReactNode;
  filesContent: React.ReactNode;
  editDrawerContent?: React.ReactNode;
  composerAddContent?: React.ReactNode;
  diagnosticsContent?: React.ReactNode;
  settingsContent?: React.ReactNode;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  emptyStateActionLabel?: string;
  onEmptyStateAction?: () => void;
  hasActiveItem?: boolean;
  bottomDockContent?: React.ReactNode;
  toastMessage?: string | null;
  diagnosticsBadgeCount?: number;
  headerCenterExtra?: React.ReactNode;
  streamingFeedCard?: React.ReactNode;
  composerExtraFooter?: React.ReactNode;
  modalOverlay?: React.ReactNode;
}

export const UnifiedStudioWorkspace: React.FC<UnifiedStudioWorkspaceProps> = ({
  isOpen,
  onBackToStart,
  moduleName,
  workspaceTitle,
  modelOptions,
  selectedModel,
  onSelectModel,
  prompt,
  onPromptChange,
  onSubmitPrompt,
  isGenerating,
  turns,
  onResetWorkspace,
  rightTab,
  onRightTabChange,
  routePath = '/',
  viewport = 'desktop',
  onViewportChange,
  onRefresh,
  onRemix,
  onShare,
  onPublish,
  publishLabel = 'Publish',
  filesCount,
  previewContent,
  codeContent,
  filesContent,
  editDrawerContent,
  composerAddContent,
  diagnosticsContent,
  settingsContent,
  emptyStateTitle = 'Workspace is empty',
  emptyStateSubtitle = 'Describe what you want to create below or open saved files.',
  emptyStateActionLabel = 'Browse Files',
  onEmptyStateAction,
  hasActiveItem = false,
  bottomDockContent,
  toastMessage,
  diagnosticsBadgeCount = 0,
  headerCenterExtra,
  streamingFeedCard,
  composerExtraFooter,
  modalOverlay,
}) => {
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [collapsedTurns, setCollapsedTurns] = useState<Record<string, boolean>>({});
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'chat' | 'stage'>('chat');

  const feedEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (turns.length > 0) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns.length]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  const notify = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => setLocalToast(null), 2400);
  };

  const activeToast = toastMessage || localToast;

  const currentModelObj =
    modelOptions.find((m) => m.id === selectedModel) ||
    modelOptions[0] || { id: selectedModel, label: 'Default' };

  const cycleViewport = () => {
    if (!onViewportChange) return;
    const order: ViewportSize[] = ['desktop', 'laptop', 'tablet', 'mobile'];
    const idx = order.indexOf(viewport);
    const next = order[(idx + 1) % order.length];
    onViewportChange(next);
    notify(`Viewport: ${next}`);
  };

  const toggleVoiceDictation = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      notify('Voice dictation is not supported in this browser.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          onPromptChange(prompt ? `${prompt.trim()} ${transcript}` : transcript);
        }
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const handleDefaultShare = () => {
    if (onShare) {
      onShare();
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    notify('Workspace link copied to clipboard.');
  };

  const ViewportIcon =
    viewport === 'mobile'
      ? Smartphone
      : viewport === 'tablet'
      ? Tablet
      : viewport === 'laptop'
      ? Laptop
      : Monitor;

  return (
    <div className="fixed inset-0 z-50 bg-[#131314] text-[#E3E3E3] flex flex-col overflow-hidden select-none">
      {/* Subtle Top Toast */}
      {activeToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[120] px-3.5 py-1.5 rounded-lg bg-[#2B2D30] border border-[#3E4046] text-xs font-medium text-[#E3E3E3] shadow-lg flex items-center gap-2 pointer-events-none">
          <Check className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{activeToast}</span>
        </div>
      )}

      {/* ================================================================= */}
      {/* TOP GLOBAL BAR (100% MATCHING REFERENCE SCREENSHOT)               */}
      {/* ================================================================= */}
      <header className="h-12 px-3 bg-[#131314] border-b border-[#252629] flex items-center justify-between gap-4 shrink-0 z-30">
        {/* Left: Back to start */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onBackToStart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E1F20] hover:bg-[#28292C] border border-[#303236] text-xs font-medium text-[#E3E3E3] transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#9AA0A6]" />
            <span>Back to start</span>
          </button>

          {/* Mobile Pane Switcher */}
          <div className="flex md:hidden items-center bg-[#1B1C1E] border border-[#2C2D30] rounded-lg p-0.5">
            <button
              onClick={() => setMobilePane('chat')}
              className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap ${
                mobilePane === 'chat' ? 'bg-[#2B2D30] text-white' : 'text-[#9AA0A6]'
              }`}
            >
              Prompt
            </button>
            <button
              onClick={() => setMobilePane('stage')}
              className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap ${
                mobilePane === 'stage' ? 'bg-[#2B2D30] text-white' : 'text-[#9AA0A6]'
              }`}
            >
              Workspace
            </button>
          </div>
        </div>

        {/* Center: Clean Project / Workspace Title + Optional Version Switcher */}
        <div className="hidden sm:flex items-center justify-center gap-2 min-w-0 flex-1 px-4">
          <span
            className="text-[13px] font-medium text-[#E3E3E3] truncate max-w-[360px] tracking-tight"
            title={workspaceTitle}
          >
            {workspaceTitle}
          </span>
          {headerCenterExtra}
        </div>

        {/* Right: Remix, Share, Publish, Bug/Diagnostics, Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (onRemix) {
                onRemix();
              } else {
                notify('Loaded parameters into workspace for remix.');
              }
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#C4C7C5] hover:text-white hover:bg-[#1E1F20] transition-colors whitespace-nowrap shrink-0"
            title="Remix current workspace"
          >
            <GitFork className="w-3.5 h-3.5 text-[#9AA0A6]" />
            <span>Remix</span>
          </button>

          <button
            onClick={handleDefaultShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B2D30] hover:bg-[#35373C] text-xs font-medium text-[#E3E3E3] transition-colors whitespace-nowrap shrink-0"
          >
            <span className="hidden sm:inline">Share</span>
            <Share2 className="w-3.5 h-3.5 sm:hidden" />
          </button>

          <button
            onClick={() => {
              if (onPublish) {
                onPublish();
              } else {
                notify('Workspace ready to export.');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#36383D] hover:bg-[#1E1F20] text-xs font-medium text-[#E3E3E3] transition-colors whitespace-nowrap shrink-0"
          >
            <span>{publishLabel}</span>
          </button>

          <button
            onClick={() => {
              setIsSettingsOpen(false);
              setIsDiagnosticsOpen((prev) => !prev);
            }}
            className={`relative p-1.5 rounded-lg transition-colors shrink-0 ${
              isDiagnosticsOpen
                ? 'bg-[#2B2D30] text-white'
                : diagnosticsBadgeCount > 0
                ? 'text-red-400 hover:bg-[#1E1F20]'
                : 'text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20]'
            }`}
            title="Diagnostics & Engine Telemetry"
          >
            <Bug className="w-4 h-4" />
            {diagnosticsBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-red-500 text-white text-[9px] font-mono tabular-nums flex items-center justify-center">
                {diagnosticsBadgeCount > 9 ? '9+' : diagnosticsBadgeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setIsDiagnosticsOpen(false);
              setIsSettingsOpen((prev) => !prev);
            }}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isSettingsOpen
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20]'
            }`}
            title="Studio Settings & Parameters"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN SPLIT WORKSPACE                                              */}
      {/* ================================================================= */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* --------------------------------------------------------------- */}
        {/* LEFT COLUMN: PROMPT / AGENT CONVERSATION & COMPOSER             */}
        {/* --------------------------------------------------------------- */}
        {!isFullscreen && (
          <section
            className={`${
              mobilePane === 'chat' ? 'flex' : 'hidden md:flex'
            } w-full md:w-[360px] lg:w-[400px] xl:w-[430px] shrink-0 flex-col border-r border-[#252629] bg-[#131314] min-h-0`}
          >
            {/* Left Sub-header: Star icon + Module name on left, + Reset on right */}
            <div className="h-11 px-4 flex items-center justify-between border-b border-[#252629]/70 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-[#8AB4F8] shrink-0"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <span className="text-[13px] font-medium text-[#E3E3E3] truncate">
                  {moduleName}
                </span>
              </div>

              <button
                onClick={onResetWorkspace}
                className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20] transition-colors shrink-0"
                title="New empty workspace"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Middle Feed Area (Empty by default on clean workspace) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 chat-scroll-area select-text">
              {turns.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <p className="text-xs text-[#6E7075] leading-relaxed max-w-[260px]">
                    Empty workspace ready. Describe what you want to create below, or attach parameters with <span className="text-[#9AA0A6] font-medium">+</span>.
                  </p>
                </div>
              ) : (
                turns.map((turn) => {
                  const isCollapsed = !!collapsedTurns[turn.id];
                  if (turn.role === 'user') {
                    return (
                      <div
                        key={turn.id}
                        className="rounded-xl bg-[#1E1F20] border border-[#2C2D30] px-3.5 py-2.5 text-[13px] text-[#E3E3E3] leading-relaxed"
                      >
                        {turn.content}
                      </div>
                    );
                  }
                  return (
                    <div key={turn.id} className="space-y-2">
                      {/* Model & Timing Header matching screenshot ("Gemini 3.8 Flash · Ran for X") */}
                      <button
                        onClick={() =>
                          setCollapsedTurns((prev) => ({
                            ...prev,
                            [turn.id]: !prev[turn.id],
                          }))
                        }
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-[#9AA0A6] tabular-nums">
                          <span>{turn.modelLabel || currentModelObj.label}</span>
                          {turn.durationSec && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Ran for {turn.durationSec}</span>
                            </>
                          )}
                        </div>
                        {isCollapsed ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#6E7075] group-hover:text-[#E3E3E3]" />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5 text-[#6E7075] group-hover:text-[#E3E3E3]" />
                        )}
                      </button>

                      {!isCollapsed && (
                        <div className="text-[13px] text-[#D8DADF] leading-relaxed space-y-2">
                          <p className="whitespace-pre-wrap">{turn.content}</p>
                          {turn.details && turn.details.length > 0 && (
                            <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#B4B7BD]">
                              {turn.details.map((d, idx) => (
                                <li key={idx}>{d}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {isGenerating && (
                streamingFeedCard || (
                  <div className="flex items-center gap-2 text-xs text-[#9AA0A6] py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8AB4F8]" />
                    <span>Generating in {moduleName}...</span>
                  </div>
                )
              )}

              <div ref={feedEndRef} />
            </div>

            {/* Bottom Prompt Composer Card (100% Matching Screenshot) */}
            <div className="p-3 shrink-0 relative">
              {/* + Parameters / Attachments Popover */}
              {isAddMenuOpen && composerAddContent && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#1B1C1E] border border-[#2F3135] rounded-2xl p-3.5 shadow-2xl z-40 max-h-[60vh] overflow-y-auto chat-scroll-area">
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#2A2B2E]">
                    <span className="text-xs font-medium text-[#E3E3E3]">
                      {moduleName} Parameters & Inputs
                    </span>
                    <button
                      onClick={() => setIsAddMenuOpen(false)}
                      className="p-1 rounded text-[#8E918F] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {composerAddContent}
                </div>
              )}

              {composerExtraFooter}

              <div className="rounded-2xl bg-[#1E1F20] border border-[#2F3135] p-3 focus-within:border-[#4A4D54] transition-colors">
                <textarea
                  rows={2}
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isGenerating && prompt.trim()) {
                        onSubmitPrompt();
                      }
                    }
                  }}
                  placeholder="Make changes, add new features, ask for anything"
                  className="w-full bg-transparent text-[13px] text-[#E3E3E3] placeholder-[#7C7E83] focus:outline-none resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-2 mt-1">
                  {/* Left Circular + Button */}
                  <button
                    onClick={() => setIsAddMenuOpen((prev) => !prev)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                      isAddMenuOpen
                        ? 'bg-[#2B2D30] border-[#52555C] text-white'
                        : 'border-[#3C3E43] text-[#9AA0A6] hover:text-white hover:border-[#6E7075] hover:bg-[#2A2B2E]'
                    }`}
                    title="Attach inputs & configure parameters"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Right Controls: Model Dropdown + Mic + Submit Arrow */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <button
                        onClick={() => setIsModeMenuOpen((prev) => !prev)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs font-medium text-[#E3E3E3] flex items-center gap-1.5 transition-colors whitespace-nowrap max-w-[165px]"
                        title={`Active Engine: ${currentModelObj.label}`}
                      >
                        <span className="truncate">{currentModelObj.label}</span>
                        <ChevronDown className="w-3 h-3 text-[#9AA0A6] shrink-0" />
                      </button>

                      {isModeMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-[#1E1F20] border border-[#34363A] rounded-xl shadow-2xl p-1.5 z-50 max-h-64 overflow-y-auto chat-scroll-area">
                          {modelOptions.map((opt) => {
                            const active = opt.id === selectedModel;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  onSelectModel(opt.id);
                                  setIsModeMenuOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                                  active
                                    ? 'bg-[#2E3034] text-white font-medium'
                                    : 'text-[#C4C7C5] hover:bg-[#26272B]'
                                }`}
                              >
                                <div className="truncate">{opt.label}</div>
                                {opt.description && (
                                  <div className="text-[11px] text-[#8E918F] truncate mt-0.5">
                                    {opt.description}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={toggleVoiceDictation}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isListening
                          ? 'bg-red-500/20 text-red-400'
                          : 'text-[#9AA0A6] hover:text-white hover:bg-[#2A2B2E]'
                      }`}
                      title={isListening ? 'Stop dictation' : 'Voice dictation'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={onSubmitPrompt}
                      disabled={isGenerating || !prompt.trim()}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                        prompt.trim() && !isGenerating
                          ? 'bg-[#E3E3E3] hover:bg-white text-[#131314]'
                          : 'bg-[#2A2B2E] text-[#6E7075] cursor-not-allowed'
                      }`}
                      title="Generate"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* RIGHT COLUMN: MAIN WORKSPACE STAGE                              */}
        {/* --------------------------------------------------------------- */}
        <main
          className={`${
            mobilePane === 'stage' || isFullscreen ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col min-w-0 bg-[#0E0F10] overflow-hidden relative`}
        >
          {/* Right Toolbar (100% Matching Screenshot) */}
          <div className="h-11 px-3 bg-[#131314] border-b border-[#252629] flex items-center justify-between gap-3 shrink-0 z-20">
            {/* Left Segmented View Tabs: [Preview] [<>] [Files] */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onRightTabChange('preview')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === 'preview'
                    ? 'bg-[#2B2D30] text-white border border-[#3B3D42]'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20] border border-transparent'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>

              <button
                onClick={() => onRightTabChange('code')}
                className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === 'code'
                    ? 'bg-[#2B2D30] text-white border border-[#3B3D42]'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20] border border-transparent'
                }`}
                title="Code, Specs & Architecture"
              >
                <CodeXml className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onRightTabChange('files')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === 'files'
                    ? 'bg-[#2B2D30] text-white border border-[#3B3D42]'
                    : 'text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20] border border-transparent'
                }`}
                title={
                  typeof filesCount === 'number'
                    ? `Saved Files & Gallery (${filesCount})`
                    : 'Saved Files & Gallery'
                }
              >
                <Folder className="w-3.5 h-3.5" />
                {typeof filesCount === 'number' && filesCount > 0 && (
                  <span className="text-[10px] font-mono tabular-nums text-[#9AA0A6]">
                    {filesCount}
                  </span>
                )}
              </button>
            </div>

            {/* Center Address / Route Pill */}
            <div className="hidden sm:flex items-center justify-between bg-[#1B1C1E] border border-[#2C2D30] rounded-lg px-2.5 py-1 w-[210px] md:w-[270px] lg:w-[320px] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={cycleViewport}
                  className="text-[#9AA0A6] hover:text-white transition-colors shrink-0"
                  title={`Viewport: ${viewport} (click to cycle)`}
                >
                  <ViewportIcon className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-[#9AA0A6] truncate">
                  {rightTab === 'code'
                    ? '/code'
                    : rightTab === 'files'
                    ? '/files'
                    : routePath || '/'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    if (onRefresh) onRefresh();
                    notify('Workspace refreshed.');
                  }}
                  className="text-[#9AA0A6] hover:text-white transition-colors p-0.5"
                  title="Refresh workspace"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="text-[#9AA0A6] hover:text-white transition-colors p-0.5"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Right: Edit Controls Drawer Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsEditDrawerOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isEditDrawerOpen
                    ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                    : 'bg-[#1E1F20] hover:bg-[#28292C] border-[#323438] text-[#E3E3E3]'
                }`}
              >
                <Pencil className="w-3.5 h-3.5 text-[#9AA0A6]" />
                <span>Edit</span>
              </button>
            </div>
          </div>

          {/* Right Stage Body + Optional Slide-Over Edit / Diagnostics / Settings Panel */}
          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              {rightTab === 'preview' ? (
                hasActiveItem ? (
                  <div className="flex-1 min-h-0 overflow-y-auto chat-scroll-area">
                    {previewContent}
                  </div>
                ) : (
                  /* 100% Exact Screenshot Empty Workspace Center Card */
                  <div className="flex-1 flex items-center justify-center p-6 bg-[#0E0F10]">
                    <div className="bg-[#191A1C] border border-[#282A2E] rounded-2xl px-10 py-8 flex flex-col items-center justify-center text-center max-w-sm w-full shadow-sm">
                      <div className="w-10 h-10 rounded-full border border-[#383A3F] flex items-center justify-center text-[#9AA0A6] mb-3">
                        <Pause className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-medium text-[#E3E3E3] mb-1">
                        {emptyStateTitle}
                      </h3>
                      <p className="text-xs text-[#8E918F] mb-5 leading-relaxed">
                        {emptyStateSubtitle}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={
                            onEmptyStateAction || (() => onRightTabChange('files'))
                          }
                          className="px-4 py-1.5 rounded-full bg-[#2B2D30] hover:bg-[#35373C] border border-[#3E4046] text-xs font-medium text-[#E3E3E3] transition-colors whitespace-nowrap"
                        >
                          {emptyStateActionLabel}
                        </button>
                        {editDrawerContent && (
                          <button
                            onClick={() => setIsEditDrawerOpen(true)}
                            className="px-4 py-1.5 rounded-full bg-[#1E1F20] hover:bg-[#28292C] border border-[#323438] text-xs font-medium text-[#C4C7C5] transition-colors whitespace-nowrap"
                          >
                            Controls
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ) : rightTab === 'code' ? (
                <div className="flex-1 min-h-0 overflow-y-auto chat-scroll-area bg-[#0E0F10]">
                  {codeContent}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto chat-scroll-area bg-[#0E0F10]">
                  {filesContent}
                </div>
              )}

              {bottomDockContent && (
                <div className="shrink-0 border-t border-[#252629] bg-[#131314]">
                  {bottomDockContent}
                </div>
              )}
            </div>

            {/* Slide-Over Edit Controls Drawer */}
            {isEditDrawerOpen && editDrawerContent && (
              <aside className="w-80 sm:w-[340px] shrink-0 border-l border-[#252629] bg-[#161719] flex flex-col min-h-0 z-20">
                <div className="h-10 px-4 border-b border-[#252629] flex items-center justify-between shrink-0">
                  <span className="text-xs font-medium text-[#E3E3E3]">
                    Edit Parameters
                  </span>
                  <button
                    onClick={() => setIsEditDrawerOpen(false)}
                    className="p-1 rounded text-[#8E918F] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 chat-scroll-area">
                  {editDrawerContent}
                </div>
              </aside>
            )}

            {/* Diagnostics Drawer (Bug button) */}
            {isDiagnosticsOpen && (
              <aside className="w-80 sm:w-[340px] shrink-0 border-l border-[#252629] bg-[#161719] flex flex-col min-h-0 z-20">
                <div className="h-10 px-4 border-b border-[#252629] flex items-center justify-between shrink-0">
                  <span className="text-xs font-medium text-[#E3E3E3]">
                    Diagnostics & Pipeline Info
                  </span>
                  <button
                    onClick={() => setIsDiagnosticsOpen(false)}
                    className="p-1 rounded text-[#8E918F] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 chat-scroll-area text-xs text-[#C4C7C5]">
                  {diagnosticsContent || (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30]">
                        <div className="font-medium text-white mb-1">{moduleName}</div>
                        <div className="text-[#8E918F]">Active Model: {currentModelObj.label}</div>
                        <div className="text-[#8E918F] mt-0.5 tabular-nums">
                          Session Turns: {turns.length}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* Settings Drawer (Gear button) */}
            {isSettingsOpen && (
              <aside className="w-80 sm:w-[340px] shrink-0 border-l border-[#252629] bg-[#161719] flex flex-col min-h-0 z-20">
                <div className="h-10 px-4 border-b border-[#252629] flex items-center justify-between shrink-0">
                  <span className="text-xs font-medium text-[#E3E3E3]">
                    Workspace Settings
                  </span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded text-[#8E918F] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 chat-scroll-area text-xs text-[#C4C7C5]">
                  {settingsContent || (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30]">
                        <div className="font-medium text-white mb-1">Active Engine</div>
                        <div className="text-[#8E918F]">{currentModelObj.label}</div>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
      {modalOverlay}
    </div>
  );
};
