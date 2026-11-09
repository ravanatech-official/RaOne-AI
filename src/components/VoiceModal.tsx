import React, { useEffect } from 'react';
import { Mic, MicOff, Volume2, X, Sparkles, Radio } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  isContinuousWakeListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  audioLevel: number;
  voiceError: string | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onToggleContinuousWake: () => void;
  onStopSpeaking: () => void;
  onSendVoiceQuery: (query: string) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  isListening,
  isContinuousWakeListening,
  isSpeaking,
  transcript,
  audioLevel,
  voiceError,
  onStartListening,
  onStopListening,
  onToggleContinuousWake,
  onStopSpeaking,
  onSendVoiceQuery,
}) => {
  useEffect(() => {
    // If opened and not already listening, trigger start
    if (isOpen && !isListening && !isContinuousWakeListening) {
      onStartListening();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0D1322] border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wider uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Voice Activation Protocol</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            “Hey RaOne”
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            One AI for Your World · Speak naturally in English, Sinhala, or Singlish
          </p>
        </div>

        {/* Central Glowing Orb & Waveform */}
        <div className="relative my-8 flex flex-col items-center justify-center">
          {/* Multiple concentric pulsating rings */}
          <div
            className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 relative ${
              isListening || isSpeaking
                ? 'shadow-[0_0_40px_rgba(245,158,11,0.6)]'
                : 'shadow-[0_0_20px_rgba(245,158,11,0.2)]'
            }`}
          >
            {/* Spinning orbital border */}
            <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/40 animate-spin-slow" />
            <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-spin-reverse" />
            
            {/* Core Orb with Official RaOne Logo */}
            <div
              className={`w-24 h-24 rounded-full overflow-hidden flex items-center justify-center cursor-pointer transition-transform duration-300 relative border-2 ${
                isListening
                  ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-105'
                  : isSpeaking
                  ? 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.8)] scale-105'
                  : 'border-amber-500/50 hover:scale-105'
              }`}
              onClick={() => {
                if (isListening) onStopListening();
                else onStartListening();
              }}
            >
              <img
                src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                alt="RaOne AI Core"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Mic
                  className={`w-7 h-7 ${
                    isListening || isSpeaking ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]' : 'text-white/80'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Sound bars animation */}
          <div className="flex items-center gap-1.5 h-10 mt-6">
            {[40, 70, 100, 60, 90, 45, 80, 50, 30].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-amber-400/80 rounded-full transition-all duration-150"
                style={{
                  height: isListening || isSpeaking ? `${Math.max(8, (audioLevel * h) / 100)}px` : '6px',
                  opacity: isListening || isSpeaking ? 0.9 : 0.3,
                }}
              />
            ))}
          </div>

          <div className="text-xs font-mono text-slate-300 mt-2">
            {isListening
              ? 'RaOne is listening...'
              : isSpeaking
              ? 'RaOne is speaking...'
              : isContinuousWakeListening
              ? 'Ambient wake listening active: say "Hey RaOne"'
              : 'Tap orb to start voice input'}
          </div>
        </div>

        {/* Live Transcript Box */}
        <div className="min-h-16 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 text-center mb-6">
          {transcript ? (
            <p className="italic">“{transcript}”</p>
          ) : (
            <p className="text-slate-500 text-xs">
              Try: &ldquo;Hey RaOne, think through our new product architecture&rdquo; or &ldquo;ලංකාවේ නව තාක්ෂණික ව්‍යාපෘතියක් සැලසුම් කරමු&rdquo;
            </p>
          )}
        </div>

        {voiceError && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg text-center">
            {voiceError}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between pt-2 border-t border-slate-800">
          {/* Wake Word Continuous Mode */}
          <button
            onClick={onToggleContinuousWake}
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full sm:w-auto justify-center ${
              isContinuousWakeListening
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isContinuousWakeListening ? 'animate-pulse text-amber-400' : ''}`} />
            <span>Wake Word Detection: {isContinuousWakeListening ? 'Active' : 'Standby'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {transcript && (
              <button
                onClick={() => {
                  onSendVoiceQuery(transcript);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
              >
                Send Query
              </button>
            )}
            {isSpeaking && (
              <button
                onClick={onStopSpeaking}
                className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Stop Voice</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
