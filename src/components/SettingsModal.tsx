import React, { useState } from 'react';
import { X, User, Settings, Volume2, Sparkles, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isContinuousWakeListening: boolean;
  onToggleContinuousWake: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isContinuousWakeListening,
  onToggleContinuousWake,
  selectedModel,
  onSelectModel,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'voice' | 'personalization' | 'about'>('general');
  const [customInstructions, setCustomInstructions] = useState(
    'Address me with high clarity and formidable capability. Support both Sinhala and English fluently. Sign responses with RaOne AI by RavanaTec — Think. Create. Act.'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-[#1E1E1E] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-[#2C2C2C] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
              alt="RaOne"
              className="w-5 h-5 rounded-full object-cover border border-amber-500/40"
            />
            <h2 className="text-base font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9E9E9E] hover:text-white hover:bg-[#2C2C2C]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content with tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left tabs */}
          <div className="w-48 bg-[#171717] border-r border-[#2C2C2C] p-2 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                activeTab === 'general' ? 'bg-[#2A2A2A] text-white' : 'text-[#A0A0A0] hover:bg-[#222222]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>General</span>
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                activeTab === 'voice' ? 'bg-[#2A2A2A] text-white' : 'text-[#A0A0A0] hover:bg-[#222222]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Speech & Voice</span>
            </button>
            <button
              onClick={() => setActiveTab('personalization')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                activeTab === 'personalization' ? 'bg-[#2A2A2A] text-white' : 'text-[#A0A0A0] hover:bg-[#222222]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Personalization</span>
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                activeTab === 'about' ? 'bg-[#2A2A2A] text-white' : 'text-[#A0A0A0] hover:bg-[#222222]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>About RaOne AI</span>
            </button>
          </div>

          {/* Right tab panel */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-[#ECECEC]">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Active Intelligence Engine
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => onSelectModel(e.target.value)}
                    className="w-full bg-[#2A2A2A] border border-[#3C3C3C] rounded-lg p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="gemini-3.8-flash">RaOne Flash (High Velocity · Recommended)</option>
                    <option value="gemini-4-argon">RaOne Argon (Deep Cognitive Reasoning & Systems Logic)</option>
                    <option value="raone-deepseek-r1">RaOne DeepSeek R1 (Open Deep Reasoning Matrix)</option>
                    <option value="raone-gpt4o">RaOne GPT-4o (Omni Intelligence)</option>
                    <option value="raone-claude">RaOne Claude 3.5 (State-of-the-Art Code & Architecture)</option>
                    <option value="gemini-3.1-flash-lite">RaOne Lite (Ultra-Low Latency Streaming)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-[#2C2C2C] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Language & Localization</div>
                    <div className="text-[11px] text-[#8E8E8E]">Bilingual Sinhala and English intelligence</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#2A2A2A] font-mono text-[11px] text-amber-400">
                    Sinhala (සිංහල) / EN
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#252525] border border-[#333]">
                  <div>
                    <div className="font-semibold text-white">Voice Activation Phrase</div>
                    <div className="text-[11px] text-[#8E8E8E]">Say “Hey RaOne” to begin voice conversation</div>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-400 px-2 py-1 rounded bg-[#1C1C1C] border border-amber-500/30">
                    “Hey RaOne”
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#252525] border border-[#333]">
                  <div>
                    <div className="font-semibold text-white">Ambient Wake-Word Listener</div>
                    <div className="text-[11px] text-[#8E8E8E]">Continuous background listening for “Hey RaOne”</div>
                  </div>
                  <button
                    onClick={onToggleContinuousWake}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isContinuousWakeListening
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-[#333] text-white hover:bg-[#3E3E3E]'
                    }`}
                  >
                    {isContinuousWakeListening ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div className="text-[11px] text-[#8E8E8E] leading-relaxed">
                  Tip: Speak naturally in Sinhala or English after saying &ldquo;Hey RaOne&rdquo;. The engine will automatically reason and read the answer back to you.
                </div>
              </div>
            )}

            {activeTab === 'personalization' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Custom Instructions for RaOne AI
                  </label>
                  <textarea
                    rows={4}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="w-full bg-[#2A2A2A] border border-[#3C3C3C] rounded-lg p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-3 leading-relaxed">
                <div className="flex items-center gap-3 pb-3 border-b border-[#2C2C2C]">
                  <img
                    src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                    alt="RaOne Symbol"
                    className="w-12 h-12 rounded-lg object-cover border border-amber-500/30"
                  />
                  <div>
                    <div className="text-sm font-bold text-white">RaOne AI by RavanaTec</div>
                    <div className="text-[11px] text-amber-400">One AI for Your World</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-[#8E8E8E]">Tagline:</span> Think. Create. Act.
                  </div>
                  <div>
                    <span className="text-[#8E8E8E]">Brand Meaning:</span> Ravana + One
                  </div>
                  <div>
                    <span className="text-[#8E8E8E]">Voice Command:</span> “Hey RaOne”
                  </div>
                  <div>
                    <span className="text-[#8E8E8E]">Organization:</span> RavanaTec
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-[#262626] border border-amber-500/20 text-[#B4B4B4] text-[11px] leading-relaxed">
                  RaOne combines the legendary multi-dimensional intellect and mastery of ten domains (Strategy, Engineering, Linguistics, Philosophy, Art, Tactics, Law, Architecture, Science, and Foresight) with a unified, modern, singular AI core: “One AI for Your World”.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t border-[#2C2C2C] flex items-center justify-between bg-[#1A1A1A]">
          <span className="text-[11px] text-[#757575]">RaOne AI by RavanaTec</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#B4B4B4] hover:text-white hover:bg-[#2A2A2A] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
