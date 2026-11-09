import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ArrowUp,
  Mic,
  ChevronDown,
  ArrowDown,
  Paperclip,
  Code,
  Globe,
  Sparkles,
  Check,
} from 'lucide-react';

interface ChatInputDockProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onOpenVoice: () => void;
  isListening: boolean;
  isContinuousWakeListening: boolean;
  showScrollDown: boolean;
  onScrollToBottom: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
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
}) => {
  const [inputText, setInputText] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: 'gpt-6-astra', name: 'GPT-6 Astra Medium', tag: 'Reasoning' },
    { id: 'gemini-3.8-flash', name: 'RaOne AI (Gemini 3.8 Flash)', tag: 'Fast' },
    { id: 'raone-thinker', name: 'RaOne Thinker (Ten Facets)', tag: 'Strategy' },
  ];

  const currentModelObj = models.find((m) => m.id === selectedModel) || models[0];

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto px-4 pb-4 select-none">
      {/* Floating Scroll to Bottom Arrow (as in screenshot) */}
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

      {/* Main Input Container Pill */}
      <div className="relative bg-[#2F2F2F] border border-[#3A3A3A] focus-within:border-[#525252] rounded-[26px] p-3 shadow-xl transition-all">
        {/* Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="sudda hama menu ekakma (or ask in Sinhala / English)..."
          className="w-full bg-transparent text-[#ECECEC] placeholder-[#8E8E8E] text-sm focus:outline-none resize-none px-2 py-1 max-h-44 leading-relaxed"
        />

        {/* Bottom Actions Row inside Input Bar */}
        <div className="flex items-center justify-between pt-2 px-1">
          {/* Plus button with popover */}
          <div className="relative">
            <button
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
              className="p-1.5 rounded-full hover:bg-[#383838] text-[#B4B4B4] hover:text-white transition-colors"
              title="Add attachment or tools"
            >
              <Plus className="w-4 h-4" />
            </button>

            {plusMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#212121] border border-[#333333] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150">
                <button
                  onClick={() => {
                    setInputText((prev) => `${prev}\n[Attachment: Architecture Schema]`);
                    setPlusMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-[#ECECEC] hover:bg-[#2A2A2A]"
                >
                  <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload from computer</span>
                </button>
                <button
                  onClick={() => {
                    setInputText((prev) => `${prev}\n[Tool: Code Canvas]`);
                    setPlusMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-[#ECECEC] hover:bg-[#2A2A2A]"
                >
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Canvas / Code Studio</span>
                </button>
                <button
                  onClick={() => {
                    setInputText((prev) => `${prev}\n[Deep Research: Web Grounding]`);
                    setPlusMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-[#ECECEC] hover:bg-[#2A2A2A]"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deep Web Grounding</span>
                </button>
              </div>
            )}
          </div>

          {/* Right cluster: Model Selector + Voice Mic + Send Arrow */}
          <div className="flex items-center gap-2">
            {/* Model Selector dropdown (Matches screenshot 'GPT-6 Astra Medium v') */}
            <div className="relative">
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full hover:bg-[#3A3A3A] text-[#B4B4B4] hover:text-white transition-colors"
              >
                <img
                  src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                  alt="RaOne"
                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                />
                <span>{currentModelObj.name}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {modelMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#212121] border border-[#333333] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150">
                  <div className="px-2 py-1 text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">
                    Select Engine
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                        selectedModel === m.id ? 'bg-[#2F2F2F] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#2A2A2A]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-[10px] text-[#8E8E8E]">{m.tag}</div>
                      </div>
                      {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
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

            {/* Circular Send Arrow Button (Blue when active or text entered) */}
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

      {/* Footer Disclaimer */}
      <div className="text-center mt-2 text-[11px] text-[#8E8E8E]">
        RaOne AI by RavanaTec can make mistakes. Verify important info. · Think. Create. Act.
      </div>
    </div>
  );
};
