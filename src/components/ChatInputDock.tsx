import React, { useState, useRef } from 'react';
import {
  Plus,
  ArrowUp,
  Mic,
  ChevronDown,
  ArrowDown,
  Globe,
  MapPin,
  Sparkles,
  Check,
  Image as ImageIcon,
  Music,
  Video,
  Brain,
  Paperclip,
} from 'lucide-react';

interface ChatInputDockProps {
  onSendMessage: (text: string, options?: { enableSearch?: boolean; enableMaps?: boolean }) => void;
  isLoading: boolean;
  onOpenVoice: () => void;
  isListening: boolean;
  isContinuousWakeListening: boolean;
  showScrollDown: boolean;
  onScrollToBottom: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onOpenStudioHub: (tab?: 'image' | 'music' | 'video' | 'transcribe') => void;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  onSendMessage,
  isLoading,
  onOpenVoice,
  isListening,
  isContinuousWakeListening,
  showScrollDown,
  onScrollToBottom,
  selectedModel,
  onSelectModel,
  onOpenStudioHub,
}) => {
  const [inputText, setInputText] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableMaps, setEnableMaps] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: 'gemini-3.8-flash', name: 'RaOne Flash', tag: 'High Velocity' },
    { id: 'gemini-4-argon', name: 'RaOne Argon Medium', tag: 'Deep Reasoning & Code' },
    { id: 'raone-deepseek-r1', name: 'RaOne DeepSeek R1', tag: 'Reasoning Matrix' },
    { id: 'raone-gpt4o', name: 'RaOne GPT-4o', tag: 'Omni Intelligence' },
    { id: 'raone-claude', name: 'RaOne Claude 3.5', tag: 'Code & Architecture' },
    { id: 'gemini-3.1-flash-lite', name: 'RaOne Lite', tag: 'Ultra Fast' },
  ];

  const currentModelObj = models.find((m) => m.id === selectedModel) || models[0];

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text, { enableSearch, enableMaps });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  return (
    <div className="relative w-full max-w-[760px] mx-auto px-4 pb-3 select-none">
      {/* Floating Scroll to Bottom Arrow */}
      {showScrollDown && (
        <div className="flex justify-center mb-2">
          <button
            onClick={onScrollToBottom}
            className="w-8 h-8 rounded-full bg-[#2F2F2F] border border-[#3E3E3E] text-white flex items-center justify-center shadow-lg hover:bg-[#383838] transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grounding Badges */}
      {(enableSearch || enableMaps) && (
        <div className="flex items-center gap-2 mb-2 px-3">
          {enableSearch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium animate-in fade-in">
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Search Grounding Active</span>
              <button
                onClick={() => setEnableSearch(false)}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          )}
          {enableMaps && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-medium animate-in fade-in">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>Maps Grounding Active</span>
              <button
                onClick={() => setEnableMaps(false)}
                className="hover:text-white ml-0.5"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Main Input Container Pill (Exact ChatGPT Styling) */}
      <div className="relative bg-[#2f2f2f] border border-[#3a3a3a] focus-within:border-[#525252] rounded-[26px] p-3 shadow-2xl transition-all">
        {/* Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message RaOne"
          className="w-full bg-transparent text-[#ECECEC] placeholder-[#8E8E8E] text-sm focus:outline-none resize-none px-2 py-1 max-h-44 leading-relaxed font-normal"
        />

        {/* Bottom Actions Row inside Input Bar */}
        <div className="flex items-center justify-between pt-2 px-1">
          {/* Left: Plus attachment menu */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => setPlusMenuOpen(!plusMenuOpen)}
                className="p-1.5 rounded-full hover:bg-[#383838] text-[#B4B4B4] hover:text-white transition-colors"
                title="Add attachment or open studios"
              >
                <Plus className="w-4 h-4" />
              </button>

              {plusMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#212121] border border-[#333333] rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#8E8E8E] uppercase tracking-wider">
                    Tools & Studios
                  </div>

                  <button
                    onClick={() => {
                      onOpenStudioHub('image');
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs text-[#ECECEC] hover:bg-[#2C2C2C] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Create image</div>
                      <div className="text-[10px] text-[#8E8E8E]">Photorealistic 4K visual synthesis</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setEnableSearch(!enableSearch);
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs text-[#ECECEC] hover:bg-[#2C2C2C] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Search web</div>
                      <div className="text-[10px] text-[#8E8E8E]">Live verification & citations</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenStudioHub('music');
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs text-[#ECECEC] hover:bg-[#2C2C2C] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Music studio</div>
                      <div className="text-[10px] text-[#8E8E8E]">Acoustic generation & lyrics</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenStudioHub('video');
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs text-[#ECECEC] hover:bg-[#2C2C2C] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Video className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Video studio</div>
                      <div className="text-[10px] text-[#8E8E8E]">Cinematic motion direction</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Web Search Button */}
            <button
              onClick={() => {
                setEnableSearch(!enableSearch);
                if (!enableSearch) setEnableMaps(false);
              }}
              className={`p-1.5 rounded-full transition-colors ${
                enableSearch
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-[#B4B4B4] hover:bg-[#383838] hover:text-white'
              }`}
              title="Search Grounding"
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>

          {/* Right cluster: Model Selector Pill + Voice Mic + Send Arrow */}
          <div className="flex items-center gap-2">
            {/* Model Selector Pill (Matches screenshot: GPT-6 Astra Medium v) */}
            <div className="relative">
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full hover:bg-[#3A3A3A] text-[#B4B4B4] hover:text-white transition-colors"
              >
                <span>{currentModelObj.name}</span>
                <ChevronDown className="w-3 h-3 text-[#8E8E8E]" />
              </button>

              {modelMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#212121] border border-[#333333] rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#8E8E8E] uppercase tracking-wider">
                    Model
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between ${
                        selectedModel === m.id
                          ? 'bg-[#2F2F2F] text-white font-medium'
                          : 'text-[#B4B4B4] hover:bg-[#282828]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white">{m.name}</div>
                        <div className="text-[10px] text-[#8E8E8E]">{m.tag}</div>
                      </div>
                      {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dictation / Voice mic button ("Hey RaOne") */}
            <button
              onClick={onOpenVoice}
              className={`p-1.5 rounded-full hover:bg-[#383838] transition-colors ${
                isListening || isContinuousWakeListening
                  ? 'text-amber-400 bg-amber-500/20 animate-pulse'
                  : 'text-[#B4B4B4] hover:text-white'
              }`}
              title="Voice activation (Hey RaOne)"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Circular Send Arrow Button */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                inputText.trim() && !isLoading
                  ? 'bg-white text-black hover:bg-slate-200 shadow-md cursor-pointer'
                  : 'bg-[#383838] text-[#757575] cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Disclaimer (Exact ChatGPT wording: RaOne can make mistakes. Check important info.) */}
      <div className="text-center mt-2 text-[11px] text-[#8E8E8E]">
        RaOne can make mistakes. Check important info.
      </div>
    </div>
  );
};
