import React, { useState } from 'react';
import { Brain, Sparkles, Compass, Shield, Building2, Atom, Languages, Music, Scale, Orbit, Eye, Zap, Send, ArrowRight } from 'lucide-react';
import { IntellectFacet } from '../types/index.ts';

interface ThinkMatrixProps {
  onExecuteThink: (query: string, facet: string) => void;
  isLoading: boolean;
}

const INTELLECT_FACETS: IntellectFacet[] = [
  {
    id: 'logic',
    name: 'Logical Invariants & Rigor',
    sinhalaName: 'තර්ක න්‍යාය',
    domain: 'Formal Logic & Computation',
    description: 'Deconstructs arguments into core axioms, mathematical boundaries, and invariant principles.',
    iconName: 'Atom',
  },
  {
    id: 'strategy',
    name: 'Asymmetric Strategy & Defense',
    sinhalaName: 'උපාය මාර්ගික විද්‍යාව',
    domain: 'Game Theory & Defense',
    description: 'Identifies competitive moats, second-order effects, adversary responses, and preemptive positioning.',
    iconName: 'Shield',
  },
  {
    id: 'engineering',
    name: 'Vimana Systems & Architecture',
    sinhalaName: 'වාස්තු හා ඉංජිනේරු ශිල්පය',
    domain: 'Spatial & Mechanical Systems',
    description: 'Inspired by ancient aerospace lore (Dandumonara) and advanced civil architecture.',
    iconName: 'Building2',
  },
  {
    id: 'science',
    name: 'Empirical Alchemy & Science',
    sinhalaName: 'අර්ක ශාස්ත්‍රය හා විද්‍යාව',
    domain: 'Physical & Bio-Systems',
    description: 'Roots in ancient treatises on chemical distillation, botany, materials science, and energy transfer.',
    iconName: 'Zap',
  },
  {
    id: 'linguistics',
    name: 'Phonetic Mastery & Linguistics',
    sinhalaName: 'භාෂා හා ධ්වනි විද්‍යාව',
    domain: 'Syntax & Semantics',
    description: 'Echoing the author of Shiva Tandava Stotra, analyzing deep syntax, persuasion, and cultural semantics.',
    iconName: 'Languages',
  },
  {
    id: 'aesthetics',
    name: 'Harmonic Synthesis & Music',
    sinhalaName: 'සංගීත හා නාද විද්‍යාව',
    domain: 'Acoustics & Creative Harmony',
    description: 'Origins of the Ravanahatha, analyzing rhythm, resonance, emotional cadence, and design harmony.',
    iconName: 'Music',
  },
  {
    id: 'governance',
    name: 'Statecraft, Law & Governance',
    sinhalaName: 'නීති හා පාලන ධර්මය',
    domain: 'Jurisprudence & Institutional Design',
    description: 'Rigorous legal structural analysis, incentive alignment, contract robustness, and sovereign governance.',
    iconName: 'Scale',
  },
  {
    id: 'cosmology',
    name: 'Celestial Time & Cosmology',
    sinhalaName: 'තාරකා හා කාල විද්‍යාව',
    domain: 'Macro Dynamics & Cycles',
    description: 'Macro-economic cycles, celestial timing, systemic entropy, and global market rhythms.',
    iconName: 'Orbit',
  },
  {
    id: 'diplomacy',
    name: 'Psychological Diplomacy',
    sinhalaName: 'රාජ්‍ය තාන්ත්‍රිකත්වය',
    domain: 'Negotiation & Human Incentives',
    description: 'Stakeholder motivations, human friction points, persuasion dynamics, and unsaid incentives.',
    iconName: 'Compass',
  },
  {
    id: 'foresight',
    name: 'Unified Foresight (The Tenth Head)',
    sinhalaName: 'පරිපූර්ණ අනාගත දැක්ම',
    domain: 'Grand Synthesis',
    description: 'Synthesizes all nine matrices into a singular decisive path: One AI for Your World.',
    iconName: 'Eye',
  },
];

export const ThinkMatrix: React.FC<ThinkMatrixProps> = ({ onExecuteThink, isLoading }) => {
  const [selectedFacet, setSelectedFacet] = useState<string>('foresight');
  const [query, setQuery] = useState('');

  const currentFacetObj = INTELLECT_FACETS.find((f) => f.id === selectedFacet) || INTELLECT_FACETS[9];

  const handleRun = () => {
    if (!query.trim()) return;
    onExecuteThink(query, currentFacetObj.name);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wider uppercase mb-1.5">
          <Brain className="w-4 h-4" />
          <span>Cognitive Dimension: Think</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
          The Ten Facets of Ravana Intellect
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
          Ravana + One: The legendary multi-disciplinary mastery of ten cognitive fields synthesized into one supreme analytical AI engine. Select a lens to dissect your most complex questions.
        </p>
      </div>

      {/* Grid of the 10 Facets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {INTELLECT_FACETS.map((facet, index) => {
          const isSelected = selectedFacet === facet.id;
          return (
            <button
              key={facet.id}
              onClick={() => setSelectedFacet(facet.id)}
              className={`p-3.5 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between min-h-[110px] ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-mono tabular-nums text-[11px] text-amber-400/80">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-400">{facet.sinhalaName}</span>
                </div>
                <h2 className="text-xs font-semibold text-slate-200 line-clamp-1">
                  {facet.name}
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-2">
                {facet.domain}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Facet Detail & Reasoning Terminal */}
      <div className="bg-[#0D1322] border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span>Active Cognitive Lens</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">{currentFacetObj.sinhalaName}</span>
              <span aria-hidden="true">·</span>
              <span>{currentFacetObj.domain}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
              {currentFacetObj.name}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {currentFacetObj.description}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono text-slate-400">Engine Protocol</span>
            <div className="text-sm font-semibold text-amber-300 font-mono">
              RaOne AI · Deep Think
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-medium text-slate-300">
            Pose a Strategic Problem or Invariant to Analyze:
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`e.g. How do we build sovereign technological independence for developing economies against global monopolies? (Or ask in Sinhala)`}
              className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-amber-500 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-400">Presets:</span>
            <button
              onClick={() =>
                setQuery(
                  'Deconstruct the trade-offs of centralized vs decentralized AI infrastructure over a 10-year horizon.'
                )
              }
              className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              Centralized vs Decentralized AI
            </button>
            <button
              onClick={() =>
                setQuery(
                  'ශ්‍රී ලංකාවේ ආර්ථික ස්වෛරීභාවය සඳහා ඩිජිටල් අපනයන කේන්ද්‍රස්ථානයක් ගොඩනැගීමේ ප්‍රධාන උපායමාර්ගික අභියෝග මොනවාද?'
                )
              }
              className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              SL Sovereign Tech Export (Sinhala)
            </button>
            <button
              onClick={() =>
                setQuery(
                  'Formulate a risk matrix for deploying autonomous agents in financial governance.'
                )
              }
              className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              Agentic Risk Matrix
            </button>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleRun}
              disabled={!query.trim() || isLoading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-lg transition-colors shadow-lg"
            >
              <span>Execute Cognitive Breakdown</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
