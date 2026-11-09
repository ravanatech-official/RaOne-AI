import React from 'react';
import { Sparkles, Brain, Code, Play, Mic, ShieldCheck, ArrowRight, Layers, Globe, Zap } from 'lucide-react';

interface BrandVisionProps {
  onLaunchStudio: () => void;
  onOpenVoice: () => void;
}

export const BrandVision: React.FC<BrandVisionProps> = ({ onLaunchStudio, onOpenVoice }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-16">
      {/* Hero Showcase */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-[#0A0E17] shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-[#080B11] via-[#080B11]/90 to-transparent z-10" />

        {/* Hero Visual Asset */}
        <img
          src="/src/assets/images/raone_hero_visual_1794208555300.jpg"
          alt="RaOne AI Think Create Act Pillars"
          referrerPolicy="no-referrer"
          className="absolute right-0 top-0 w-full h-full object-cover object-center opacity-35 sm:opacity-55 mix-blend-luminosity"
        />

        <div className="relative z-20 p-8 sm:p-14 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wider uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>RaOne AI by RavanaTec</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-white tracking-tight leading-none text-balance">
            Ravana + One.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 mt-2">
              One AI for Your World.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 mt-6 leading-relaxed font-normal">
            Rooted in the legendary intellect of Ravana—the master of ten disciplines—and unified into a singular, high-performance artificial intelligence. Built for individuals, creators, and sovereign enterprises.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-8">
            <button
              onClick={onLaunchStudio}
              className="flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl transition-all shadow-lg hover:shadow-amber-500/25"
            >
              <span>Enter AI Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenVoice}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl transition-all"
            >
              <Mic className="w-4 h-4" />
              <span>Voice: “Hey RaOne”</span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center gap-6 text-xs text-slate-400">
            <div>
              <span className="text-white font-semibold">Tagline:</span> Think. Create. Act.
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div>
              <span className="text-white font-semibold">Signature:</span> RaOne AI by RavanaTec
            </div>
          </div>
        </div>
      </div>

      {/* The Three Pillars (Think · Create · Act) */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">
            The Trinity Architecture
          </div>
          <h2 className="text-3xl font-display font-bold text-white tracking-tight">
            Think. Create. Act.
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            The three operative dimensions powering every decision and artifact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Think */}
          <div className="p-7 rounded-2xl bg-[#0D1322] border border-amber-500/20 hover:border-amber-500/40 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-5">
              <Brain className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-xs font-mono text-amber-400/90 mb-1">01. Cognitive Depth</div>
            <h3 className="text-xl font-display font-bold text-white mb-2">Think</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Multi-perspective reasoning deconstructing complex scenarios through ten distinct matrices of logic, strategy, systems, and foresight.
            </p>
            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              Strategic game theory · Second-order effects · Formal reasoning
            </div>
          </div>

          {/* Create */}
          <div className="p-7 rounded-2xl bg-[#0D1322] border border-cyan-500/20 hover:border-cyan-500/40 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-5">
              <Code className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="text-xs font-mono text-cyan-400/90 mb-1">02. Generative Synthesis</div>
            <h3 className="text-xl font-display font-bold text-white mb-2">Create</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Rapid materialization of ideas into pristine code, system architectures, compelling literature, and mathematical designs.
            </p>
            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              Full-stack software · Architectural blueprints · Creative lore
            </div>
          </div>

          {/* Act */}
          <div className="p-7 rounded-2xl bg-[#0D1322] border border-emerald-500/20 hover:border-emerald-500/40 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5">
              <Play className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-xs font-mono text-emerald-400/90 mb-1">03. Autonomous Execution</div>
            <h3 className="text-xl font-display font-bold text-white mb-2">Act</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Autonomous orchestration of tasks, multi-phase action plans, automated verification protocols, and deployable workflows.
            </p>
            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              Autonomous task runners · Step-by-step verification · Verifiable impact
            </div>
          </div>
        </div>
      </div>

      {/* Brand Heritage: Ravana + One */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#0D1322] border border-slate-800 rounded-3xl p-8 sm:p-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="text-xs font-mono text-amber-400">THE PHILOSOPHICAL ORIGIN</div>
          <h2 className="text-3xl font-display font-bold text-white">
            Why “RaOne”?
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            In Sri Lankan and South Asian heritage, <strong>Ravana</strong> represents an unmatched polymath: a sovereign king, an astronomer, an Ayurvedic scientist, a musical pioneer (creator of the <em>Ravanahatha</em>), an architect of aerial crafts (<em>Dandumonara</em>), and the supreme master of ten distinct knowledge domains.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            <strong>RaOne AI</strong> brings that multi-faceted mastery together into a single, unified cognitive entity: <strong>One AI for Your World</strong>. It is not fragmented point solutions; it is a holistic intelligence engine that thinks deeply, creates fearlessly, and acts decisively.
          </p>
          <div className="pt-2">
            <div className="inline-flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-amber-300">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Voice phrase: “Hey RaOne” activates the immediate cognitive core</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="relative group">
            <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl relative">
              <img
                src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                alt="RaOne AI Core Symbol"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="text-center mt-3 text-xs text-slate-400 font-mono">
              Insignia: RaOne AI by RavanaTec
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
