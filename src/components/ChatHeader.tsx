import React, { useState } from 'react';
import {
  PanelLeft,
  ChevronDown,
  Share2,
  Sparkles,
  Volume2,
  Mic,
  LayoutTemplate,
  Pencil,
  Check,
} from 'lucide-react';

interface ChatHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  title: string;
  onRenameTitle: (newTitle: string) => void;
  onShare: () => void;
  isOutputsOpen: boolean;
  onToggleOutputs: () => void;
  hasOutputs: boolean;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  onOpenVoice: () => void;
  isContinuousWakeListening: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  title,
  onRenameTitle,
  onShare,
  isOutputsOpen,
  onToggleOutputs,
  hasOutputs,
  isSpeaking,
  onStopSpeaking,
  onOpenVoice,
  isContinuousWakeListening,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);

  const handleTitleSubmit = () => {
    if (currentTitle.trim()) {
      onRenameTitle(currentTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="h-14 px-4 border-b border-[#262626] bg-[#212121] flex items-center justify-between text-[#ECECEC] shrink-0 select-none z-30">
      {/* Left zone: Sidebar toggle + Chat Title */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-[#2F2F2F] text-[#9E9E9E] hover:text-white transition-colors"
            title="Open sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}

        {isEditingTitle ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className="bg-[#2F2F2F] border border-[#444] rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleTitleSubmit}
              className="p-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-semibold rounded-lg hover:bg-[#2F2F2F] text-[#ECECEC] transition-colors group"
          >
            <img
              src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
              alt="RaOne Logo"
              className="w-5 h-5 rounded-full object-cover border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)] shrink-0"
            />
            <span className="truncate max-w-[200px] sm:max-w-md">{title}</span>
            <ChevronDown className="w-4 h-4 text-[#8E8E8E] group-hover:text-white" />
          </button>
        )}
      </div>

      {/* Right zone: Voice indicator + Share + Outputs drawer */}
      <div className="flex items-center gap-2">
        {/* Speaking indicator */}
        {isSpeaking && (
          <button
            onClick={onStopSpeaking}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20"
          >
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Speaking</span>
          </button>
        )}

        {/* Wake word status button */}
        <button
          onClick={onOpenVoice}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            isContinuousWakeListening
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              : 'bg-[#2F2F2F] hover:bg-[#383838] text-[#ECECEC]'
          }`}
          title="Voice Command & 'Hey RaOne' Wake Word"
        >
          <img
            src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
            alt="RaOne"
            className="w-3.5 h-3.5 rounded-full object-cover"
          />
          <span className="hidden sm:inline">Hey RaOne</span>
        </button>

        {/* Share Button (as in screenshot) */}
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-[#2F2F2F] text-[#ECECEC] transition-colors"
        >
          <Share2 className="w-4 h-4 text-[#B4B4B4]" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Outputs / Artifacts Toggle (as in screenshot) */}
        <button
          onClick={onToggleOutputs}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isOutputsOpen
              ? 'bg-[#2F2F2F] text-amber-300 border border-amber-500/40'
              : 'hover:bg-[#2F2F2F] text-[#ECECEC]'
          }`}
          title="Toggle Outputs & Artifacts"
        >
          <LayoutTemplate className="w-4 h-4 text-[#B4B4B4]" />
          <span className="hidden sm:inline">Outputs</span>
          {hasOutputs && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </button>
      </div>
    </header>
  );
};
