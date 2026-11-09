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
  Globe,
  MapPin,
  ExternalLink,
  Download,
  Image as ImageIcon,
  Music,
  Video,
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
        {message.model && (
          <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 ml-1">
            {message.model}
          </span>
        )}
      </div>

      {/* Collapsible Thinking Section */}
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

      {/* Generated Media Attachments (Image, Audio, Video) */}
      {message.generatedImage && (
        <div className="mt-4 rounded-xl overflow-hidden border border-amber-500/30 bg-[#1A1A1A] p-3 max-w-md">
          <div className="flex items-center justify-between text-xs font-medium text-amber-300 mb-2">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Synthesized Image (gemini-nano-banana-2.1)</span>
            </span>
            <a
              href={message.generatedImage.url}
              download="RaOne_Image.png"
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>
          </div>
          <img
            src={message.generatedImage.url}
            alt={message.generatedImage.prompt}
            className="rounded-lg w-full h-auto object-cover max-h-80 shadow-lg"
          />
        </div>
      )}

      {message.generatedAudio && (
        <div className="mt-4 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#1A1A1A] p-4 max-w-lg">
          <div className="flex items-center justify-between text-xs font-medium text-cyan-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              <span>Lyria Audio Synthesis</span>
            </span>
            <a
              href={message.generatedAudio.url}
              download="RaOne_Audio.mp3"
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Download MP3</span>
            </a>
          </div>
          <audio src={message.generatedAudio.url} controls className="w-full my-2" />
          {message.generatedAudio.lyrics && (
            <div className="mt-2 text-xs font-mono text-slate-300 bg-black/40 p-2.5 rounded-lg whitespace-pre-wrap max-h-32 overflow-y-auto">
              {message.generatedAudio.lyrics}
            </div>
          )}
        </div>
      )}

      {message.generatedVideo && (
        <div className="mt-4 rounded-xl overflow-hidden border border-purple-500/30 bg-[#1A1A1A] p-4 max-w-lg">
          <div className="flex items-center justify-between text-xs font-medium text-purple-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              <span>Omni Flash Video (gemini-omni-1.2-flash)</span>
            </span>
          </div>
          {message.generatedVideo.url ? (
            <video src={message.generatedVideo.url} controls className="w-full rounded-lg" />
          ) : (
            <div className="p-3 bg-black/40 rounded-lg text-xs font-mono text-purple-200">
              {message.generatedVideo.storyboard?.map((s, i) => (
                <div key={i}>▸ {s}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grounding Sources (Search & Maps) */}
      {((message.groundingSources && message.groundingSources.length > 0) ||
        (message.mapsSources && message.mapsSources.length > 0)) && (
        <div className="mt-3.5 pt-3 border-t border-[#2F2F2F]">
          <div className="text-[11px] font-semibold text-[#8E8E8E] mb-2 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Verified Grounding Sources</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {message.groundingSources?.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#262626] hover:bg-[#303030] text-[11px] text-[#ECECEC] transition-colors border border-[#383838]"
              >
                <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[180px]">{source.title}</span>
                <ExternalLink className="w-2.5 h-2.5 text-[#8E8E8E] shrink-0" />
              </a>
            ))}
            {message.mapsSources?.map((place, index) => (
              <a
                key={index}
                href={place.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#262626] hover:bg-[#303030] text-[11px] text-[#ECECEC] transition-colors border border-cyan-500/30"
              >
                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate max-w-[180px]">{place.title}</span>
                <ExternalLink className="w-2.5 h-2.5 text-[#8E8E8E] shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Action Toolbar Below Message */}
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
