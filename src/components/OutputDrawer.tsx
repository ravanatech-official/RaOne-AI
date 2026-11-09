import React, { useState } from 'react';
import { X, Copy, Check, Code, FileText, Sparkles, Layers, Compass, Brain } from 'lucide-react';

interface OutputDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  outputs?: {
    id: string;
    title: string;
    type: 'code' | 'artifact' | 'blueprint' | 'document';
    content: string;
    language?: string;
  }[];
  sourcesCount?: number;
}

export const OutputDrawer: React.FC<OutputDrawerProps> = ({
  isOpen,
  onClose,
  outputs = [],
  sourcesCount = 42,
}) => {
  const [activeTab, setActiveTab] = useState<'outputs' | 'sources'>('outputs');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const defaultLogoArtifact = {
    id: 'logo-spec-1',
    title: 'RaOne AI Master Brand & Logo Specification',
    type: 'artifact' as const,
    content: `Brand: RaOne
Product name: RaOne AI
Brand meaning: Ravana + One — One AI for Your World.
Voice activation phrase: “Hey RaOne”
Tagline: Think. Create. Act.
Brand signature: RaOne AI by RavanaTec

Symbolic Geometry:
- Central Quantum Crest: Modernized ten-spoke celestial glyph symbolizing the ten disciplines of Ravana.
- Color Matrix: Celestial Electric Cyan (#06B6D4) & Deep Solar Amber (#F59E0B) against Obsidian Void (#080B11).
- Typography: Outfit Display Bold + JetBrains Tabular Monospace.`,
  };

  const currentOutputs = outputs.length > 0 ? outputs : [defaultLogoArtifact];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside className="w-80 sm:w-96 bg-[#171717] border-l border-[#262626] flex flex-col h-full shrink-0 z-30 select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('outputs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'outputs'
                ? 'bg-[#2F2F2F] text-white'
                : 'text-[#9E9E9E] hover:text-white'
            }`}
          >
            Outputs ({currentOutputs.length})
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'sources'
                ? 'bg-[#2F2F2F] text-white'
                : 'text-[#9E9E9E] hover:text-white'
            }`}
          >
            Sources ({sourcesCount})
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#2F2F2F] text-[#9E9E9E] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {activeTab === 'outputs' ? (
          <div className="space-y-4">
            {/* Visual Logo Asset Card */}
            <div className="rounded-xl overflow-hidden border border-amber-500/30 bg-[#212121] shadow-lg">
              <div className="p-3 border-b border-[#262626] flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300">
                  RaOne AI Emblem by RavanaTec
                </span>
                <a
                  href="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                  download="RaOne_AI_Logo_by_RavanaTec.jpg"
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30"
                >
                  Download
                </a>
              </div>
              <div className="p-3 bg-black/40 flex items-center justify-center">
                <img
                  src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                  alt="RaOne AI Emblem"
                  referrerPolicy="no-referrer"
                  className="w-48 h-48 rounded-lg object-cover shadow-2xl border border-amber-500/20"
                />
              </div>
            </div>

            {/* Artifact specifications */}
            {currentOutputs.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#2F2F2F] bg-[#212121] overflow-hidden"
              >
                <div className="p-3 border-b border-[#2F2F2F] flex items-center justify-between bg-[#1D1D1D]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-white truncate max-w-[200px]">
                      {item.title}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(item.content, item.id)}
                    className="p-1 rounded text-[#9E9E9E] hover:text-white"
                    title="Copy"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="p-3">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-[#9E9E9E] mb-2">
              Retrieved from the Ten Matrices of Ravana Cognitive Synthesis:
            </div>
            {[
              { id: 1, title: 'Ravana Intellectual Shastras & Historical Lore', domain: 'Cultural & Technological Lexicon' },
              { id: 2, title: 'Vimana Shastra Aerodynamic & Propulsion Principles', domain: 'Ancient Flight & Autonomous Drones' },
              { id: 3, title: 'Arka Shastra Empirical Synthesis', domain: 'Natural Chemistry & Bio-Systems' },
              { id: 4, title: 'Sigiriya Hydraulic & High-Altitude Structural Engineering', domain: 'Distributed Infrastructure' },
              { id: 5, title: 'Shiva Tandava Stotra Phonetic Metrics', domain: 'Acoustic Synthesizer & Voice Cadence' },
              { id: 6, title: 'Gemini 3.8 Flash Native Multimodal Invariants', domain: 'Google GenAI Cloud API' },
            ].map((source) => (
              <div
                key={source.id}
                className="p-3 rounded-xl border border-[#2F2F2F] bg-[#212121] hover:border-amber-500/30 transition-all text-xs"
              >
                <div className="font-semibold text-slate-200">{source.title}</div>
                <div className="text-[11px] text-amber-400/90 mt-1">{source.domain}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
