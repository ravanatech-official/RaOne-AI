import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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
  Globe,
  MapPin,
  ExternalLink,
  Download,
  Image as ImageIcon,
  Music,
  Video,
  Share2,
} from 'lucide-react';
import { ChatMessage } from '../types/index.ts';

let purifyHookRegistered = false;
function ensurePurifyHook() {
  if (purifyHookRegistered || typeof window === 'undefined') return;
  purifyHookRegistered = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      const lower = href.toLowerCase();
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:')
      ) {
        node.removeAttribute('href');
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

function renderMarkdownWithMath(raw: string): string {
  ensurePurifyHook();
  const text = String(raw || '');
  const codePlaceholders: string[] = [];
  const mathPlaceholders: string[] = [];

  // 1. Protect fenced & inline code blocks before extracting LaTeX delimiters
  const withoutCode = text
    .replace(/```[\s\S]*?```/g, (match) => {
      const idx = codePlaceholders.push(match) - 1;
      return `@@RAONE_CODE_${idx}@@`;
    })
    .replace(/`[^`\n]+`/g, (match) => {
      const idx = codePlaceholders.push(match) - 1;
      return `@@RAONE_CODE_${idx}@@`;
    });

  // 2. Render block $$...$$ and inline $...$ formulas with KaTeX
  const withMathTokens = withoutCode
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
      let rendered = '';
      try {
        rendered = katex.renderToString(String(expr).trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        rendered = String(expr);
      }
      const idx = mathPlaceholders.push(rendered) - 1;
      return `@@RAONE_MATH_${idx}@@`;
    })
    .replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_m, prefix, expr) => {
      let rendered = '';
      try {
        rendered = katex.renderToString(String(expr).trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        rendered = String(expr);
      }
      const idx = mathPlaceholders.push(rendered) - 1;
      return `${prefix}@@RAONE_MATH_${idx}@@`;
    });

  // 3. Restore protected code snippets for Markdown parsing
  const restoredForMarkdown = withMathTokens.replace(
    /@@RAONE_CODE_(\d+)@@/g,
    (_m, idxStr) => codePlaceholders[Number(idxStr)] || ''
  );

  const parsedHtml = marked.parse(restoredForMarkdown, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  // 4. Restore KaTeX HTML tokens and sanitize everything with DOMPurify
  const withRenderedMath = parsedHtml.replace(
    /@@RAONE_MATH_(\d+)@@/g,
    (_m, idxStr) => mathPlaceholders[Number(idxStr)] || ''
  );

  return DOMPurify.sanitize(withRenderedMath, {
    USE_PROFILES: { html: true, mathMl: true },
    ADD_TAGS: ['semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mspace', 'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd', 'mtext'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onmouseenter'],
  });
}

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
  const renderedHtml = useMemo(
    () => (isUser ? '' : renderMarkdownWithMath(message.content)),
    [isUser, message.content]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-3 max-w-[760px] mx-auto px-4">
        <div className="bg-[#2f2f2f] text-white rounded-2xl px-5 py-2.5 max-w-[85%] sm:max-w-[75%] text-sm leading-relaxed shadow-sm font-normal whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  // Model response matching ChatGPT exactly
  return (
    <div className="my-5 max-w-[760px] mx-auto px-4 group">
      {/* Collapsible Thinking Section (Matches ChatGPT screenshot: 'Worked for 58s >') */}
      {message.thoughtProcess && (
        <div className="mb-2">
          <button
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="flex items-center gap-1.5 text-xs text-[#8E8E8E] hover:text-[#B4B4B4] transition-colors py-1 px-1 rounded-md"
          >
            <span>Worked for {message.thinkingTime || '1.0s'}</span>
            {message.verifiedSource && (
              <span className="text-[11px] text-emerald-400/90 font-mono">
                · {message.verifiedSource === 'gemini' ? 'Gemini Verified' : message.verifiedSource === 'groq' ? 'Groq Verified' : message.verifiedSource}
                {message.model ? ` (${message.model})` : ''}
              </span>
            )}
            {isThinkingOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {isThinkingOpen && (
            <div className="mt-2 mb-3 p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2F2F2F] text-xs font-mono text-[#B4B4B4] leading-relaxed whitespace-pre-wrap animate-in fade-in duration-150">
              {message.thoughtProcess}
            </div>
          )}
        </div>
      )}

      {/* Sanitized Markdown + KaTeX Content */}
      <div
        className="raone-markdown selection:bg-amber-500/30 selection:text-amber-200"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Generated Media Attachments (Image, Audio, Video) */}
      {message.generatedImage && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-[#333333] bg-[#1A1A1A] p-3 max-w-md shadow-xl">
          <div className="flex items-center justify-between text-xs font-medium text-white mb-2">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Created with Visual Studio</span>
            </span>
            <a
              href={message.generatedImage.url}
              download="RaOne_Image.png"
              className="text-[11px] text-[#B4B4B4] hover:text-white flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>
          </div>
          <img
            src={message.generatedImage.url}
            alt={message.generatedImage.prompt}
            className="rounded-xl w-full h-auto object-cover max-h-80 shadow-lg"
          />
        </div>
      )}

      {message.generatedAudio && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-[#333333] bg-[#1A1A1A] p-4 max-w-lg shadow-xl">
          <div className="flex items-center justify-between text-xs font-medium text-white mb-2">
            <span className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-cyan-400" />
              <span>Music Studio Synthesis</span>
            </span>
            <a
              href={message.generatedAudio.url}
              download="RaOne_Audio.mp3"
              className="text-[11px] text-[#B4B4B4] hover:text-white flex items-center gap-1 transition-colors"
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
        <div className="mt-4 rounded-2xl overflow-hidden border border-[#333333] bg-[#1A1A1A] p-4 max-w-lg shadow-xl">
          <div className="flex items-center justify-between text-xs font-medium text-white mb-2">
            <span className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span>Video Studio Synthesis</span>
            </span>
          </div>
          {message.generatedVideo.url ? (
            <video src={message.generatedVideo.url} controls className="w-full rounded-xl" />
          ) : (
            <div className="p-3 bg-black/40 rounded-xl text-xs font-mono text-purple-200">
              {message.generatedVideo.storyboard?.map((s, i) => (
                <div key={i}>▸ {s}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grounding Sources (Search & Maps) */}
      {((message.groundingSources && message.groundingSources.length > 0) ||
        (message.mapsSources && message.mapsSources.length > 0) ||
        (message.searchQueries && message.searchQueries.length > 0)) && (
        <div className="mt-3.5 pt-3 border-t border-[#2F2F2F]">
          <div className="text-[11px] font-semibold text-[#8E8E8E] mb-2 flex items-center gap-1.5 flex-wrap">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Sources</span>
            {message.searchQueries && message.searchQueries.length > 0 && (
              <span className="text-[10px] text-[#737373] font-normal">
                · Searched: {message.searchQueries.join(' · ')}
              </span>
            )}
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

      {/* Action Toolbar Below Message (Matches Screenshot) */}
      <div className="flex items-center gap-1 mt-2.5 text-[#8E8E8E] select-none">
        <button
          onClick={() => onSpeak(message.content)}
          className={`p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors ${
            isSpeaking ? 'text-amber-400 animate-pulse' : ''
          }`}
          title="Read aloud"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
          title="Copy"
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

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
            title="Try again"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
          title="Share response"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        <button
          className="p-1.5 rounded-lg hover:bg-[#2F2F2F] hover:text-white transition-colors"
          title="More"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
