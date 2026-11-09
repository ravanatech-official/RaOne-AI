import React from 'react';
import { NavTab } from '../types/index.ts';

interface FooterProps {
  setActiveTab: (tab: NavTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  return (
    <footer className="border-t border-slate-800/80 bg-[#06080E] text-slate-400 py-10 px-6 mt-16">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs">
        {/* Brand identity */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <span className="font-display font-bold text-slate-200 text-sm">
            RaOne AI
          </span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span>One AI for Your World</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-amber-400/90 font-medium">Think. Create. Act.</span>
        </div>

        {/* Navigation mirror */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => setActiveTab('studio')}
            className="hover:text-amber-300 transition-colors"
          >
            Studio
          </button>
          <button
            onClick={() => setActiveTab('think')}
            className="hover:text-amber-300 transition-colors"
          >
            Think Matrix
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className="hover:text-amber-300 transition-colors"
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('act')}
            className="hover:text-amber-300 transition-colors"
          >
            Act
          </button>
          <button
            onClick={() => setActiveTab('vision')}
            className="hover:text-amber-300 transition-colors"
          >
            Philosophy
          </button>
        </div>

        {/* Brand signature & contact */}
        <div className="text-center sm:text-right">
          <div className="text-slate-300 font-medium">RaOne AI by RavanaTec</div>
          <div className="text-[11px] text-slate-400 mt-0.5">firebase00.ravanatech@gmail.com</div>
        </div>
      </div>
    </footer>
  );
};
