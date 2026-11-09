import React, { useState } from 'react';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  RotateCw,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Brain,
  Sparkles,
} from 'lucide-react';
import { ChatMessage } from '../types/index.ts';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSpeak: (text: string) => void;
  onRegenerate?: () => void;
  isSpeaking: boolean;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onSpeak,
  onRegenerate,
  isSpeaking,
}) => {
  const [copied, setCopied] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-4 max-w-3xl mx-auto px-4">
        <div className="bg-[#284860] text-[#ECECEC] rounded-2xl px-5 py-3 max-w-[85%] sm:max-w-[75%] text-sm leading-relaxed shadow-sm font-normal break-words">
          {message.content}
        </div>
      </div>
    );
  }

  // Model response
  return (
    <div className="my-6 max-w-3xl mx-auto px-4 group">
      {/* Model Identity Header with Logo */}
      <div className="flex items-center gap-2 mb-2.5">
        <img
          src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
          alt="RaOne AI"
          className="w-5 h-5 rounded-full object-cover border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)] shrink-0"
        />
        <span className="text-xs font-semibold text-white">RaOne AI</span>
        <span className="text-[11px] text-[#8E8E8E]">by RavanaTec</span>
      </div>

      {/* Collapsible Thinking Section (as seen in screenshot: 'Worked for 58s >') */}
      {message.thoughtProcess && (
        <div className="mb-3">
          <button
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="flex items-center gap-1.5 text-xs text-[#9E9E9E] hover:text-white transition-colors py-1 px-1.5 rounded-md hover:bg-[#2F2F2F]"
          >
            <Brain className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">
              Worked for {message.thinkingTime || '14s'}
            </span>
            {isThinkingOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {isThinkingOpen && (
            <div className="mt-2 p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2F2F2F] text-xs font-mono text-[#B4B4B4] leading-relaxed whitespace-pre-wrap animate-in fade-in duration-150">
              {message.thoughtProcess}
            </div>
          )}
        </div>
      )}

      {/* Message Text Content */}
      <div className="text-sm text-[#ECECEC] leading-relaxed whitespace-pre-wrap font-normal selection:bg-amber-500/30 selection:text-amber-200">
        {message.content}
      </div>

      {/* Action Toolbar Below Message (Matches exact icons from screenshot) */}
      <div className="flex items-center gap-1 mt-3 text-[#8E8E8E] select-none">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
          title="Copy response"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setLiked(liked === true ? null : true)}
          className={`p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors ${
            liked === true ? 'text-emerald-400' : ''
          }`}
          title="Good response"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setLiked(liked === false ? null : false)}
          className={`p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors ${
            liked === false ? 'text-rose-400' : ''
          }`}
          title="Bad response"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onSpeak(message.content)}
          className={`p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors ${
            isSpeaking ? 'text-amber-400 animate-pulse' : ''
          }`}
          title="Read aloud"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
            title="Regenerate"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
          title="More options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
