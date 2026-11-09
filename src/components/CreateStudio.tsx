import React, { useState } from 'react';
import { Code, Sparkles, Copy, Check, Play, FileCode, Wand2, Eye, RotateCw } from 'lucide-react';

interface CreateStudioProps {
  onGenerateCreation: (prompt: string, format: string) => void;
  isLoading: boolean;
}

const CREATION_TEMPLATES = [
  {
    title: 'Autonomous Drone Fleet Controller',
    category: 'Full-Stack Code',
    format: 'react',
    prompt:
      'Build a futuristic interactive drone telemetry dashboard in React and Tailwind CSS with real-time waypoint plotting and battery diagnostics.',
    codeSnippet: `// RaOne AI Generated: Telemetry Core
export function DroneFleetMonitor() {
  const [drones, setDrones] = useState([
    { id: 'VIMANA-01', battery: 94, altitude: 420, status: 'Active' },
    { id: 'VIMANA-02', battery: 88, altitude: 310, status: 'Patrol' }
  ]);
  return (
    <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-xl">
      <h3 className="text-sm font-bold text-amber-400">Vimana Aerial Array</h3>
      {/* Real-time telemetry nodes */}
    </div>
  );
}`,
  },
  {
    title: 'Cyberpunk Ravana 2050 Narrative',
    category: 'Epic Literature',
    format: 'narrative',
    prompt:
      'Write a high-concept cyberpunk narrative where ancient aerospace secrets of Sigiriya are integrated into modern planetary orbital defense.',
    codeSnippet: `In the neo-monolithic heights of Sigiriya 2050, the quantum relays of the Dandumonara hummed with primordial resonance. Architect Ravana's tenth neural lattice had awakened—not as a ghost, but as a living algorithm safeguarding the equatorial skies...`,
  },
  {
    title: 'Distributed System Blueprint',
    category: 'System Architecture',
    format: 'architecture',
    prompt:
      'Design a resilient event-driven architecture for ultra-low latency voice AI streaming supporting 100,000 concurrent websocket connections.',
    codeSnippet: `1. Ingress Layer: Anycast BGP -> Envoy Gateway (TLS 1.3 Termination)
2. Live WebSocket Multiplexer: Go-based worker pools with ring-buffer IPC
3. Audio Transcribe Pipeline: Google GenAI 16kHz PCM duplex stream
4. State Synchronization: Raft-backed Redis cluster with ephemeral sub-ms leases`,
  },
];

export const CreateStudio: React.FC<CreateStudioProps> = ({ onGenerateCreation, isLoading }) => {
  const [selectedFormat, setSelectedFormat] = useState('code');
  const [prompt, setPrompt] = useState('');
  const [activeCode, setActiveCode] = useState(CREATION_TEMPLATES[0].codeSnippet);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('code');

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    onGenerateCreation(prompt, selectedFormat);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 tracking-wider uppercase mb-1.5">
          <Wand2 className="w-4 h-4" />
          <span>Generative Dimension: Create</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
          RaOne Generative Studio
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
          Transform thoughts into concrete artifacts: production code, system blueprints, literary narratives, and high-fidelity creative concepts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Generation Control Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0D1322] border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Creation Directive</span>
            </h2>

            {/* Format selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Output Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'code', label: 'Code / UI' },
                  { id: 'architecture', label: 'Architecture' },
                  { id: 'narrative', label: 'Literature' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`py-2 px-2 text-xs font-medium rounded-lg border transition-all text-center ${
                      selectedFormat === fmt.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt textarea */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Prompt or Blueprint Specification
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want RaOne to synthesize in high craft..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              className="w-full py-2.5 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>Synthesize with RaOne AI</span>
            </button>
          </div>

          {/* Quick Curated Blueprints */}
          <div className="bg-[#0D1322] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              Curated Exemplars
            </h3>
            <div className="space-y-2.5">
              {CREATION_TEMPLATES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(item.prompt);
                    setActiveCode(item.codeSnippet);
                    setSelectedFormat(item.format);
                  }}
                  className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-left transition-all"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-medium text-slate-200">{item.title}</span>
                    <span className="text-[11px] text-cyan-400">{item.category}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Code / Artifact Viewer */}
        <div className="lg:col-span-7">
          <div className="bg-[#0A0E17] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-full flex flex-col min-h-[500px]">
            {/* Viewer Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-slate-400 ml-2">
                  raone-artifact.{selectedFormat === 'code' ? 'tsx' : 'md'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Artifact</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 p-5 overflow-auto bg-[#070A10]">
              <pre className="font-mono text-xs text-cyan-200/90 leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30">
                {activeCode}
              </pre>
            </div>

            {/* Viewer Footer */}
            <div className="px-5 py-2.5 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between font-mono">
              <span>RaOne AI Generative Matrix</span>
              <span className="text-amber-400">RaOne AI by RavanaTec</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
