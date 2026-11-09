import React from 'react';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import { NavTab } from '../types/index.ts';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isListening: boolean;
  isContinuousWakeListening: boolean;
  onVoiceClick: () => void;
  onOpenVoiceModal: () => void;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isListening,
  isContinuousWakeListening,
  onOpenVoiceModal,
  isSpeaking,
  onStopSpeaking,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-[#080B11]/90 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#studio"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('studio');
        }}
        className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2 group"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
        <span className="font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
          RaOne AI
        </span>
      </a>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
        <button
          onClick={() => setActiveTab('studio')}
          className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'studio' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Studio
        </button>
        <button
          onClick={() => setActiveTab('think')}
          className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'think' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Think Matrix
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'create' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Create Studio
        </button>
        <button
          onClick={() => setActiveTab('act')}
          className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'act' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Act Operations
        </button>
        <button
          onClick={() => setActiveTab('vision')}
          className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'vision' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Philosophy
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        {isSpeaking && (
          <button
            onClick={onStopSpeaking}
            title="Mute speech playback"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-300 bg-amber-950/60 border border-amber-500/30 rounded-lg hover:bg-amber-900/50 transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span className="whitespace-nowrap">Speaking</span>
          </button>
        )}

        <button
          onClick={onOpenVoiceModal}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap shrink-0 shadow-lg ${
            isListening || isContinuousWakeListening
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-2 ring-amber-300 animate-pulse'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.35)]'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Hey RaOne</span>
        </button>
      </div>
    </header>
  );
};
