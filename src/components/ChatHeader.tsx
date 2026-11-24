import React from 'react';
import { PanelLeft, Sparkles, Shield, EyeOff, LogIn, UserPlus, User } from 'lucide-react';

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
  currentUser?: any;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  isOutputsOpen,
  onToggleOutputs,
  hasOutputs,
  onOpenSettings,
  isTemporaryChat = false,
  onToggleTemporaryChat,
  currentPlan = 'free',
  onOpenUpgrade,
  currentUser,
  onOpenAuth,
}) => {
  return (
    <header className="h-14 px-2.5 sm:px-4 pt-safe bg-[#000000] flex items-center justify-between gap-2 text-[#ECECEC] shrink-0 select-none z-30 min-w-0">
      {/* Left zone: Sidebar toggle + Temporary Chat pill */}
      <div className="flex items-center gap-2 min-w-0">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#8e8e8e] hover:text-white transition-colors shrink-0"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}

        {/* Temporary Chat Active Indicator Pill */}
        {isTemporaryChat && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-medium animate-in fade-in duration-150 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="truncate max-w-[96px] sm:max-w-none">Temporary Chat</span>
            <span className="hidden md:inline text-[10px] text-amber-400/70 border-l border-amber-500/30 pl-2 whitespace-nowrap">
              Not saved to history
            </span>
          </div>
        )}
      </div>

      {/* Right zone: Upgrade + Outputs toggle + Temporary Chat Toggle + Account */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {hasOutputs && (
          <button
            onClick={onToggleOutputs}
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
              isOutputsOpen
                ? 'bg-[#262626] border-white/20 text-white'
                : 'bg-[#111111] border-white/10 text-[#B4B4B4] hover:text-white hover:bg-[#1a1a1a]'
            }`}
            title="Toggle Outputs & Artifacts drawer"
          >
            Outputs
          </button>
        )}

        <button
          onClick={onOpenUpgrade || onOpenSettings}
          className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-0 py-1 text-xs sm:text-sm font-medium text-white hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
          title={`Plan: ${currentPlan.toUpperCase()} — Click to view or upgrade packages`}
        >
          {currentPlan === 'ultimate' ? (
            <>
              <Sparkles className="w-4 h-4 text-purple-400 fill-purple-400 shrink-0" />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent font-semibold">
                Ultimate
              </span>
            </>
          ) : currentPlan === 'plus' ? (
            <>
              <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-amber-300 font-semibold">Plus</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-[#38bdf8] fill-[#38bdf8] shrink-0" />
              <span className="text-white">Upgrade</span>
            </>
          )}
        </button>

        {/* Temporary Chat Toggle Button (Targeted by user CSS selector) */}
        <button
          onClick={onToggleTemporaryChat}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
            isTemporaryChat
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
              : 'border border-white/20 text-white/80 hover:border-white/40 hover:text-white hover:bg-white/5'
          }`}
          title={
            isTemporaryChat
              ? 'Temporary Chat is ON (Chats are private and will disappear) — Click to exit'
              : 'Temporary Chat (Private chat: zero server saving, no history)'
          }
          aria-label="Toggle Temporary Chat"
        >
          {/* Inner icon element targeted by CSS selector 2 */}
          <div className="relative flex items-center justify-center">
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

        {/* Account / Sign In & Sign Up Actions */}
        {onOpenAuth && !currentUser && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => onOpenAuth('signin')}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#111111] hover:bg-[#1e1e1e] text-[11px] sm:text-xs font-medium text-white transition-colors whitespace-nowrap"
              title="Sign in to your RaOne AI account"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Sign in</span>
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-[11px] sm:text-xs font-semibold transition-colors shadow-sm whitespace-nowrap"
              title="Create a new RaOne AI account"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Sign up</span>
            </button>
          </div>
        )}

        {onOpenAuth && currentUser && (
          <button
            onClick={() => onOpenAuth('signin')}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#141414] hover:bg-[#1f1f1f] text-xs font-medium text-[#ECECEC] transition-colors shrink-0"
            title={currentUser.email || 'Manage RaOne Account'}
          >
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'Account'}
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="hidden sm:inline max-w-[110px] truncate">
              {currentUser.displayName || currentUser.email?.split('@')[0] || 'Account'}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
