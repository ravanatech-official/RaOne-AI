import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Brain, Code, Play, Copy, Check, Mic, Volume2, ArrowUpRight, RotateCcw } from 'lucide-react';
import { ChatMessage, Mode } from '../types/index.ts';

interface ChatViewProps {
  messages: ChatMessage[];
  currentMode: Mode;
  setCurrentMode: (mode: Mode) => void;
  onSendMessage: (text: string, mode: Mode) => Promise<void>;
  isLoading: boolean;
  onOpenVoice: () => void;
  onSpeakText: (text: string) => void;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
}

const STARTER_PROMPTS = [
  {
    mode: 'think' as Mode,
    label: 'Ten Facets Strategic Analysis',
    prompt: 'Analyze building a resilient AI-native operating system using the ten facets of Ravana strategic intellect.',
  },
  {
    mode: 'create' as Mode,
    label: 'High-Performance UI Component',
    prompt: 'Create a clean, production-grade real-time telemetric audio spectrum analyzer in React and Tailwind CSS.',
  },
  {
    mode: 'act' as Mode,
    label: 'Executive Launch Plan',
    prompt: 'Generate an autonomous 30-day action execution blueprint for deploying RaOne AI enterprise infrastructure.',
  },
  {
    mode: 'think' as Mode,
    label: 'Sinhala AI Strategy (ලංකා දැක්ම)',
    prompt: 'ශ්‍රී ලංකාවේ ඩිජිටල් පරිවර්තනය සහ කෘතිම බුද්ධිය හරහා ආර්ථිකය සවිබල ගැන්වීමට RaOne AI උපයෝගී කරගත හැකි ක්‍රමවේදයක් සැලසුම් කරන්න.',
  },
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  currentMode,
  setCurrentMode,
  onSendMessage,
  isLoading,
  onOpenVoice,
  onSpeakText,
  isSpeaking,
  onStopSpeaking,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(text, currentMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] max-w-6xl mx-auto px-4 sm:px-6 py-4">
      {/* Mode Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
          <button
            onClick={() => setCurrentMode('think')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              currentMode === 'think'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-amber-400" />
            <span>Think</span>
          </button>
          <button
            onClick={() => setCurrentMode('create')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              currentMode === 'create'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>Create</span>
          </button>
          <button
            onClick={() => setCurrentMode('act')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              currentMode === 'act'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Act</span>
          </button>
        </div>

        {/* Clean unboxed metadata with typographic separators */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span>RaOne Core</span>
          <span aria-hidden="true">·</span>
          <span>gemini-3.8-flash</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-400">One AI for Your World</span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">
              RaOne AI
            </h2>
            <p className="text-sm text-slate-400 max-w-md mt-2 mb-8 leading-relaxed">
              Ravana + One — One AI for Your World. Think with multi-faceted depth, create without boundaries, and act with autonomous execution.
            </p>

            {/* Starter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
              {STARTER_PROMPTS.map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentMode(starter.mode);
                    onSendMessage(starter.prompt, starter.mode);
                  }}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/90 transition-all text-left group"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold text-amber-400/90">{starter.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {starter.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-9 h-9 rounded-xl bg-[#0F172A] border border-amber-500/30 flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-5 ${
                    isUser
                      ? 'bg-amber-500 text-slate-950 font-medium ml-12 rounded-tr-sm'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-100 rounded-tl-sm shadow-xl'
                  }`}
                >
                  {/* Clean unboxed header metadata */}
                  <div className="flex items-center justify-between gap-4 text-xs mb-3 pb-2 border-b border-slate-700/40">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{isUser ? 'You' : 'RaOne AI'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums opacity-80">{message.timestamp}</span>
                      {message.mode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize text-amber-400">{message.mode}</span>
                        </>
                      )}
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSpeakText(message.content)}
                          className="text-slate-400 hover:text-amber-300 transition-colors p-1"
                          title="Read aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="text-slate-400 hover:text-amber-300 transition-colors p-1"
                          title="Copy text"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-normal">
                    {message.content}
                  </div>

                  {/* Signature mark */}
                  {!isUser && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 font-medium flex items-center justify-between">
                      <span>RaOne AI by RavanaTec</span>
                      <span className="text-slate-400">Think. Create. Act.</span>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-300">U</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="w-9 h-9 rounded-xl bg-[#0F172A] border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 rounded-tl-sm text-sm text-slate-300">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-mono mb-2">
                <Brain className="w-3.5 h-3.5 animate-pulse" />
                <span>RaOne is synthesizing across intelligence matrices...</span>
              </div>
              <div className="flex items-center gap-1.5 h-4">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping delay-100" />
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="pt-2">
        <div className="relative bg-slate-900/90 border border-slate-800 focus-within:border-amber-500/60 rounded-2xl p-2.5 transition-all shadow-2xl">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask RaOne AI in ${currentMode.toUpperCase()} mode (or say "Hey RaOne")...`}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none px-2 py-1 max-h-36"
          />

          <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors"
                title="Voice input (Hey RaOne)"
              >
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Voice</span>
              </button>

              <span className="text-[11px] text-slate-400 hidden md:inline">
                Press Enter to send, Shift+Enter for newline
              </span>
            </div>

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 rounded-lg transition-all shadow-md"
            >
              <span>Transmit</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
