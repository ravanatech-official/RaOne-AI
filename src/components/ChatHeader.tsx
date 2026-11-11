import React from 'react';
import { PanelLeft, Sparkles, Shield, EyeOff } from 'lucide-react';

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
  onOpenSettings?: () => void;
  isTemporaryChat?: boolean;
  onToggleTemporaryChat?: () => void;
  currentPlan?: 'free' | 'plus' | 'ultimate';
  onOpenUpgrade?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenSettings,
  isTemporaryChat = false,
  onToggleTemporaryChat,
  currentPlan = 'free',
  onOpenUpgrade,
}) => {
  return (
    <header className="h-14 px-4 bg-[#000000] flex items-center justify-between text-[#ECECEC] shrink-0 select-none z-30">
      {/* Left zone: Sidebar toggle if closed + Temporary Chat pill */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#8e8e8e] hover:text-white transition-colors"
            title="Open sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}

        {/* Temporary Chat Active Indicator Pill */}
        {isTemporaryChat && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium animate-in fade-in duration-150">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Temporary Chat</span>
            <span className="text-[10px] text-amber-400/70 border-l border-amber-500/30 pl-2">
              Not saved to history
            </span>
          </div>
        )}
      </div>

      {/* Right zone: ✦ Upgrade (CSS selector 2 target) + Temporary Chat Toggle Icon Button */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onOpenUpgrade || onOpenSettings}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white hover:opacity-80 transition-opacity"
          title={`Plan: ${currentPlan.toUpperCase()} — Click to view or upgrade packages`}
        >
          {currentPlan === 'ultimate' ? (
            <>
              <Sparkles className="w-4 h-4 text-purple-400 fill-purple-400" />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent font-semibold">
                Ultimate
              </span>
            </>
          ) : currentPlan === 'plus' ? (
            <>
              <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-amber-300 font-semibold">Plus</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-[#38bdf8] fill-[#38bdf8]" />
              <span className="text-white">Upgrade</span>
            </>
          )}
        </button>

        {/* Temporary Chat Toggle Button (Targeted by user CSS selector) */}
        <button
          onClick={onToggleTemporaryChat}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isTemporaryChat
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
              : 'border border-white/20 text-white/80 hover:border-white/40 hover:text-white hover:bg-white/5'
          }`}
          title={
            isTemporaryChat
              ? 'Temporary Chat is ON (Chats are private and will disappear) — Click to exit'
              : 'Temporary Chat (Private chat: zero server saving, no history)'
          }
        >
          {/* Inner icon element targeted by CSS selector 2 */}
          <div className="relative flex items-center justify-center">
            {/* Dashed circle ring icon matching ChatGPT */}
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${
                isTemporaryChat ? 'rotate-45 text-amber-300' : 'text-white/80'
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 3"
            >
              <circle cx="12" cy="12" r="9" />
            </svg>
            {isTemporaryChat ? (
              <span className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full border border-white/60" />
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
