import React, { useState } from 'react';
import { X, User, Settings, Volume2, Shield, Sparkles, Check, Globe, Flame, Database, Copy, Server, ShieldCheck } from 'lucide-react';
import { RAONE_PROJECT_OVERVIEW, firebaseConfig } from '../lib/firebase.ts';

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
  const [activeTab, setActiveTab] = useState<'general' | 'voice' | 'personalization' | 'firebase' | 'about'>('general');
  const [copiedConfig, setCopiedConfig] = useState(false);
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
              onClick={() => setActiveTab('firebase')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                activeTab === 'firebase' ? 'bg-[#2A2A2A] text-white' : 'text-[#A0A0A0] hover:bg-[#222222]'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Firebase (raoneai)</span>
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
                    <option value="gemini-3.8-flash">RaOne AI · Gemini 3.8 Flash (Recommended)</option>
                    <option value="gpt-6-astra">GPT-6 Astra Medium (Autonomous Reasoning)</option>
                    <option value="raone-thinker">RaOne Thinker (Ten Facets Matrix)</option>
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
                <div className="p-3.5 rounded-xl bg-[#2A2A2A]/50 border border-[#3C3C3C] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Voice Activation: “Hey RaOne”</div>
                    <div className="text-[11px] text-[#8E8E8E] mt-0.5">
                      Continuously listen for wake phrase in the background
                    </div>
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
                  Tip: Speak naturally in Sinhala or English after saying &ldquo;Hey RaOne&rdquo;. The engine will automatically transcribe, reason, and read the answer back to you.
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

            {activeTab === 'firebase' && (
              <div className="space-y-4">
                {/* Project Header Banner */}
                <div className="p-3.5 rounded-xl bg-[#262626] border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">
                        {RAONE_PROJECT_OVERVIEW.projectName} ({RAONE_PROJECT_OVERVIEW.projectId})
                      </div>
                      <div className="text-[11px] text-[#8E8E8E]">
                        Project #{RAONE_PROJECT_OVERVIEW.projectNumber} · {RAONE_PROJECT_OVERVIEW.billingPlan}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-semibold">
                    BLAZE ACTIVE
                  </span>
                </div>

                {/* Services Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#252525] border border-[#333]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Firebase Authentication</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                    </div>
                    <div className="text-[11px] text-[#A0A0A0] space-y-1">
                      <div>• Google Sign-In & Email/Password</div>
                      <div>• Authorized: localhost, raoneai.firebaseapp.com, raoneai.web.app</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#252525] border border-[#333]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Cloud Firestore</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">nam5</span>
                    </div>
                    <div className="text-[11px] text-[#A0A0A0] space-y-1">
                      <div>• Instance: (default) FIRESTORE_NATIVE</div>
                      <div>• Location: nam5 (US Multi-region)</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#252525] border border-[#333]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-amber-400" />
                        <span>Realtime Database</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                    </div>
                    <div className="text-[11px] text-[#A0A0A0] space-y-1">
                      <div>• Instance: raoneai-default-rtdb</div>
                      <div>• Location: us-central1</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#252525] border border-[#333]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>AI & Analytics</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                    </div>
                    <div className="text-[11px] text-[#A0A0A0] space-y-1">
                      <div>• Gemini Developer & Vertex AI APIs</div>
                      <div>• Analytics Property: 563366712</div>
                    </div>
                  </div>
                </div>

                {/* Web SDK Config Snippet */}
                <div className="rounded-xl border border-[#333] bg-[#161616] overflow-hidden">
                  <div className="p-2.5 bg-[#1F1F1F] border-b border-[#333] flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[#999]">firebaseConfig (raoneai)</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(firebaseConfig, null, 2));
                        setCopiedConfig(true);
                        setTimeout(() => setCopiedConfig(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                    >
                      {copiedConfig ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedConfig ? 'Copied' : 'Copy Config'}</span>
                    </button>
                  </div>
                  <pre className="p-3 text-[10px] font-mono text-cyan-200/90 overflow-x-auto leading-relaxed">
                    {JSON.stringify(firebaseConfig, null, 2)}
                  </pre>
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
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t border-[#2C2C2C] bg-[#171717] flex items-center justify-between">
          <span className="text-[11px] text-[#8E8E8E]">
            {savedSuccess ? 'Settings updated successfully' : 'Shanthapriya Silva · Plus Member'}
          </span>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold bg-white text-black hover:bg-slate-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
