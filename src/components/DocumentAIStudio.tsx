import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Play,
  Pause,
  Download,
  Copy,
  Trash2,
  Heart,
  RefreshCw,
  Dices,
  Sliders,
  FileText,
  Presentation,
  Table,
  BookOpen,
  Send,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  ExternalLink,
  Layers,
  Cpu,
  Share2,
  FileUp,
  Bookmark,
  Radio,
  Quote,
  ShieldCheck,
} from 'lucide-react';
import { DocumentItem, DocumentSlide, DocumentCitation } from '../types/index.ts';

interface DocumentAIStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOC_TYPES = [
  { id: 'report', label: 'Executive Report', icon: FileText, desc: 'Formal whitepaper with tables & roadmap' },
  { id: 'presentation', label: 'Gamma Presentation', icon: Presentation, desc: 'Slide deck with visual cards & callouts' },
  { id: 'spreadsheet', label: 'Financial Sheet', icon: Table, desc: 'Budget model, Capex/Opex & unit metrics' },
  { id: 'notebook', label: 'NotebookLM Research', icon: BookOpen, desc: 'Source-grounded synthesis & citations' },
];

const DOC_MODELS = [
  {
    id: 'Gemini 3.8 Flash Document AI',
    name: 'Gemini 3.8 Flash Document AI',
    badge: '1M Token Window',
    desc: 'Deep multi-modal document understanding with native OCR, tables, and long-context synthesis.',
  },
  {
    id: 'Google NotebookLM Core',
    name: 'NotebookLM Deep Dive Core',
    badge: 'Audio Overview',
    desc: 'Conversational 2-host audio podcast synthesis with 100% grounded citations.',
  },
  {
    id: 'Gamma Presentation Engine',
    name: 'Gamma Slide Deck AI',
    badge: 'Visual Design',
    desc: 'Structured slide cards with executive callout blocks and dynamic color palettes.',
  },
  {
    id: 'Microsoft 365 Copilot Core',
    name: 'Microsoft Copilot Enterprise',
    badge: 'Enterprise IDP',
    desc: 'Financial spreadsheets, mathematical modeling, and enterprise compliance reporting.',
  },
];

const RANDOM_DOC_PROMPTS = [
  'Comprehensive strategic roadmap for building Sri Lanka Sovereign AI compute clusters, clean energy data centers, and localized Sinhala/Tamil LLMs by 2030.',
  'Gamma style investor pitch deck for a $15M Series A round in autonomous AI software engineering factories.',
  'Detailed Q4 2026 financial model and unit economics for 512× NVIDIA H200 GPU cluster with hydroelectric power tariffs.',
  'Enterprise security whitepaper on zero-hallucination Graph-RAG architectures combining dense vector stores with knowledge graphs.',
  'Standard Operating Procedure (SOP) for automated medical record processing using HIPAA-compliant vision transformers.',
];

export const DocumentAIStudio: React.FC<DocumentAIStudioProps> = ({ isOpen, onClose }) => {
  // Creation Drawer Form State
  const [docType, setDocType] = useState<'report' | 'presentation' | 'spreadsheet' | 'notebook' | 'summary'>('report');
  const [prompt, setPrompt] = useState<string>('Comprehensive strategic roadmap for building Sri Lanka Sovereign AI compute clusters, clean energy data centers, and localized Sinhala/Tamil LLMs by 2030.');
  const [sourceText, setSourceText] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Gemini 3.8 Flash Document AI');
  const [tone, setTone] = useState<'executive' | 'academic' | 'technical' | 'creative'>('executive');
  const [includeAudioOverview, setIncludeAudioOverview] = useState<boolean>(true);

  // Studio State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'document' | 'slides' | 'architecture'>('document');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Audio Overview Player State
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Interactive Document Q&A State
  const [qaQuery, setQaQuery] = useState<string>('');
  const [qaHistory, setQaHistory] = useState<{ query: string; answer: string }[]>([]);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);

  // Presentation Slide Navigation
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      fetchDocumentHistory();
    }
  }, [isOpen]);

  const fetchDocumentHistory = async () => {
    try {
      const res = await fetch('/api/documents/history');
      const data = await res.json();
      if (data.success && data.items) {
        setDocuments(data.items);
        if (!activeDoc && data.items.length > 0) {
          setActiveDoc(data.items[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);

    try {
      const payload = {
        prompt,
        docType,
        tone,
        model: selectedModel,
        sourceText,
        includeSlides: true,
        includeAudioOverview,
      };

      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setActiveDoc(data.document);
        setCurrentSlideIndex(0);
        if (data.document.slides && data.document.slides.length > 0 && docType === 'presentation') {
          setActiveView('slides');
        } else {
          setActiveView('document');
        }
      }
    } catch (err) {
      console.error('Document generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/documents/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, isFavorite: data.item.isFavorite } : d)));
        if (activeDoc?.id === id) {
          setActiveDoc((prev) => (prev ? { ...prev, isFavorite: data.item.isFavorite } : null));
        }
      }
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        if (activeDoc?.id === id) {
          const remaining = documents.filter((d) => d.id !== id);
          setActiveDoc(remaining[0] || null);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDocumentQA = async () => {
    if (!qaQuery.trim() || !activeDoc) return;
    setIsAnswering(true);
    const queryText = qaQuery;
    setQaQuery('');

    try {
      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDoc.id,
          query: queryText,
          content: activeDoc.content,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQaHistory((prev) => [...prev, { query: queryText, answer: data.answer }]);
      }
    } catch (err) {
      console.error('QA failed:', err);
    } finally {
      setIsAnswering(false);
    }
  };

  const toggleAudioOverview = () => {
    if (audioPlayerRef.current) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioPlayerRef.current.play().catch(() => {});
        setIsPlayingAudio(true);
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setSourceText(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!activeDoc) return;
    const blob = new Blob([activeDoc.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDoc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };


  if (!isOpen) return null;

  const filteredDocs = documents.filter((d) => {
    const matchesFav = !filterFavorite || d.isFavorite;
    const matchesSearch =
      !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFav && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex bg-[#090a10] text-slate-100 font-sans overflow-hidden select-none">
      {/* ============================================================== */}
      {/* 1. LEFT CREATION DRAWER: NOTEBOOKLM + GAMMA FORM              */}
      {/* ============================================================== */}
      <aside className="w-96 flex-shrink-0 bg-[#0f111a] border-r border-slate-800/80 flex flex-col h-full z-20 overflow-y-auto custom-scrollbar">
        {/* Header Branding */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#131522]/70 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-[1.5px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#0a0c13] rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-wide text-white">RaOne DocuStudio</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                  IDP RAG
                </span>
              </div>
              <p className="text-[10px] text-slate-400">NotebookLM + Gamma + Copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#181a26] px-2.5 py-1 rounded-full border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold">
            <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
            <span>100</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Document Type Selector (Cards) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Document Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DOC_TYPES.map((type) => {
                const IconComponent = type.icon;
                const active = docType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setDocType(type.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-950/30'
                        : 'bg-[#141624]/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 mb-1.5 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <div className="text-xs font-bold text-white truncate">{type.label}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{type.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Document Topic or Directive
              </label>
              <button
                onClick={() => {
                  const r = RANDOM_DOC_PROMPTS[Math.floor(Math.random() * RANDOM_DOC_PROMPTS.length)];
                  setPrompt(r);
                }}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
              >
                <Dices className="w-3 h-3" />
                <span>Inspiration</span>
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Detailed strategic proposal on implementing sovereign cloud GPU datacenters in Sri Lanka with financial models..."
              className="w-full bg-[#0a0b12] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/70 resize-none leading-relaxed"
            />
          </div>

          {/* Tone & Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Tone of Voice
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full bg-[#0a0b12] border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/70"
              >
                <option value="executive">Executive (C-Suite)</option>
                <option value="technical">Technical (Engineering)</option>
                <option value="academic">Academic (Research)</option>
                <option value="creative">Pitch / Persuasive</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 bg-[#141624]/60 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAudioOverview}
                  onChange={(e) => setIncludeAudioOverview(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span className="text-xs font-medium text-slate-300">Podcast Audio Overview</span>
              </label>
            </div>
          </div>

          {/* Source Grounding Box (NotebookLM Style) */}
          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Source Grounding (Optional)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <FileUp className="w-3 h-3" />
                <span>Upload File (.txt, .md)</span>
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={3}
              placeholder="Paste raw research notes, statistics, or quotes to ground the document in 100% verified facts..."
              className="w-full bg-[#0a0b12] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/70 resize-none font-mono text-[11px]"
            />
          </div>

          {/* AI Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Document AI Engine
            </label>
            <div className="space-y-1.5">
              {DOC_MODELS.map((model) => {
                const active = selectedModel === model.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      active
                        ? 'bg-[#151928] border-emerald-500/80 shadow-md shadow-emerald-500/10'
                        : 'bg-[#141624]/40 border-slate-800 hover:border-slate-700 hover:bg-[#141624]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs font-semibold ${active ? 'text-emerald-300' : 'text-slate-200'}`}>
                        {model.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{model.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-98"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synthesizing Document & Citations...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-white" />
                <span>Generate Document</span>
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-emerald-200 border border-emerald-400/20">
                  <Zap className="w-2.5 h-2.5 fill-emerald-300 text-emerald-300" />
                  10 Credits
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MAIN WORKSPACE: DOCUMENT VIEWER, SLIDES & RAG CHAT         */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col h-full bg-[#0a0b12] overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-[#0e1018]/70 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-[#06070a] p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveView('document')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'document'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Document Reader
              </button>
              <button
                onClick={() => setActiveView('slides')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'slides'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Gamma Presentation Deck
              </button>
              <button
                onClick={() => setActiveView('architecture')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'architecture'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Silicon Valley IDP & RAG Architecture
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents & sources..."
                className="bg-[#121420] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 w-52"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeDoc && (
              <>
                <button
                  onClick={() => copyToClipboard(activeDoc.content, 'doc_content')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                >
                  {copyFeedback === 'doc_content' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy Markdown</span>
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-md shadow-emerald-900/30"
                  title="Download as Markdown (.md)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .MD</span>
                </button>

                <button
                  onClick={() => handleToggleFavorite(activeDoc.id)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${activeDoc.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
                  />
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Sub-bar: Document Selector Pills */}
        <div className="px-6 py-2 bg-[#0d0e17] border-b border-slate-800/60 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {filteredDocs.map((doc) => {
            const active = activeDoc?.id === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => {
                  setActiveDoc(doc);
                  setCurrentSlideIndex(0);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/60 shadow-sm'
                    : 'bg-[#121420] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="font-medium truncate max-w-xs">{doc.title}</span>
                <span className="text-[10px] font-mono text-slate-500">{doc.pageCount}p</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeDoc ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* ============================================================== */}
              {/* NOTEBOOKLM AUDIO OVERVIEW PLAYER (DEEP DIVE 2-HOST PODCAST)   */}
              {/* ============================================================== */}
              {activeDoc.audioOverviewUrl && (
                <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-cyan-950/40 border border-emerald-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-emerald-950/20">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleAudioOverview}
                      className="w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg transition-transform active:scale-95 flex-shrink-0"
                    >
                      {isPlayingAudio ? (
                        <Pause className="w-5 h-5 fill-black" />
                      ) : (
                        <Play className="w-5 h-5 fill-black ml-0.5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">NotebookLM Deep Dive Audio Overview</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          2 AI Hosts Discussing
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                        {activeDoc.audioOverviewTranscript || 'Conversational analysis and key takeaways synthesis.'}
                      </p>
                    </div>
                  </div>

                  <audio
                    ref={audioPlayerRef}
                    src={activeDoc.audioOverviewUrl}
                    onEnded={() => setIsPlayingAudio(false)}
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400 font-semibold">Grounded Podcast</span>
                  </div>
                </div>
              )}

              {/* View 1: Document Reader (Markdown, Tables, Headings) */}
              {activeView === 'document' && (
                <div className="bg-[#10121d] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
                  {/* Executive Summary Callout */}
                  {activeDoc.summary && (
                    <div className="bg-[#141829] border-l-4 border-emerald-400 p-4 rounded-r-2xl">
                      <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Executive Summary
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">{activeDoc.summary}</p>
                    </div>
                  )}

                  {/* Document Body */}
                  <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed space-y-4">
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed">
                      {activeDoc.content}
                    </pre>
                  </div>

                  {/* Grounded Citations & Sources Section (NotebookLM Style) */}
                  {activeDoc.citations && activeDoc.citations.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-emerald-400" />
                        Grounded Sources & Citations
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeDoc.citations.map((cit) => (
                          <div
                            key={cit.id}
                            className="p-3 bg-[#0a0c13] rounded-xl border border-slate-800/80 space-y-1 hover:border-emerald-500/40 transition-colors"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                              <span>{cit.sourceTitle}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{cit.pageOrSection}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 italic">"{cit.snippet}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Gamma Presentation Slide Deck */}
              {activeView === 'slides' && activeDoc.slides && activeDoc.slides.length > 0 && (
                <div className="space-y-4">
                  {/* Slide Carousel Navigator */}
                  <div className="flex items-center justify-between bg-[#121422] p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-300">
                        Slide {currentSlideIndex + 1} of {activeDoc.slides.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                        disabled={currentSlideIndex === 0}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentSlideIndex(Math.min((activeDoc.slides?.length || 1) - 1, currentSlideIndex + 1))
                        }
                        disabled={currentSlideIndex === (activeDoc.slides?.length || 1) - 1}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-white"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Active Gamma Slide Card */}
                  {activeDoc.slides[currentSlideIndex] && (
                    <div className="min-h-[380px] bg-gradient-to-br from-[#131526] via-[#10111f] to-[#0a0b14] border border-purple-500/40 rounded-3xl p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                      <div className="space-y-4">
                        <div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-bold uppercase">
                            Slide {activeDoc.slides[currentSlideIndex].slideNumber}
                          </span>
                          <h2 className="text-2xl font-black text-white mt-2 tracking-tight">
                            {activeDoc.slides[currentSlideIndex].title}
                          </h2>
                          {activeDoc.slides[currentSlideIndex].subtitle && (
                            <p className="text-sm text-purple-300 font-medium">
                              {activeDoc.slides[currentSlideIndex].subtitle}
                            </p>
                          )}
                        </div>

                        {/* Slide Bullets */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          {activeDoc.slides[currentSlideIndex].bulletPoints.map((bp, i) => (
                            <div
                              key={i}
                              className="p-3.5 bg-[#0a0c16]/80 rounded-2xl border border-slate-800 flex items-start gap-3"
                            >
                              <div className="w-6 h-6 rounded-lg bg-purple-950 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                                {i + 1}
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed font-medium">{bp}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gamma Callout Banner */}
                      {activeDoc.slides[currentSlideIndex].callout && (
                        <div className="mt-6 p-4 bg-purple-950/40 border border-purple-500/30 rounded-2xl flex items-center gap-3">
                          <Quote className="w-5 h-5 text-purple-400 shrink-0" />
                          <p className="text-xs text-purple-200 font-semibold italic">
                            "{activeDoc.slides[currentSlideIndex].callout}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* View 3: Silicon Valley IDP & Graph-RAG Architecture Blueprint */}
              {activeView === 'architecture' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-cyan-950/40 border border-emerald-500/40 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Cpu className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">
                          Silicon Valley-Grade Intelligent Document Processing (IDP) & Graph-RAG Architecture
                        </h2>
                        <p className="text-xs text-emerald-300">
                          Inside Google Document AI, NotebookLM, Gamma App, and Microsoft 365 Copilot
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Next-generation document intelligence moves beyond basic keyword search into high-dimensional semantic vector spaces coupled with relational knowledge graphs. Below is the blueprint of what a production-grade Silicon Valley document system requires:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-[#121422] border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                        <span className="w-6 h-6 rounded-full bg-emerald-950 flex items-center justify-center text-xs font-mono border border-emerald-500/40">1</span>
                        Vision Transformer OCR (LayoutLMv3 & Nougat)
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Standard OCR extracts flat text and loses table boundaries and multi-column formatting. Modern Silicon Valley IDP treats documents as images using Vision Transformers to retain coordinate bounding boxes, hierarchy, financial tables, and chart axes.
                      </p>
                    </div>

                    <div className="p-4 bg-[#121422] border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                        <span className="w-6 h-6 rounded-full bg-cyan-950 flex items-center justify-center text-xs font-mono border border-cyan-500/40">2</span>
                        Hybrid Dense-Sparse RAG + Graph Entity Linking
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Combining dense vector embeddings (OpenAI 3-Large / Gemini Text Embedding) with sparse BM25 lexicons guarantees exact keyword hits (IDs, part numbers, legal codes) while capturing high-level conceptual nuances. Graph entity linking connects entities across multiple documents.
                      </p>
                    </div>

                    <div className="p-4 bg-[#121422] border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                        <span className="w-6 h-6 rounded-full bg-purple-950 flex items-center justify-center text-xs font-mono border border-purple-500/40">3</span>
                        Grounding & Hallucination Elimination
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Every sentence generated by the model must cite a specific chunk ID and character range from the original source file. If a generated claim cannot be verified against the retrieved context, it is automatically filtered before user presentation.
                      </p>
                    </div>

                    <div className="p-4 bg-[#121422] border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                        <span className="w-6 h-6 rounded-full bg-amber-950 flex items-center justify-center text-xs font-mono border border-amber-500/40">4</span>
                        NotebookLM Conversational Audio Synthesis
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Instead of reading a 50-page PDF, users can listen to a simulated 2-host podcast deep dive. Two voice models (male & female) take turns asking clarifying questions, debating trade-offs, and summarizing the document with natural conversational filler words.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* NotebookLM Style Document Chat & Q&A Dock */}
              <div className="bg-[#121420] border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Ask Document AI (Grounded Q&A with Citations)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Zero Hallucination</span>
                </div>

                {/* Q&A History */}
                {qaHistory.length > 0 && (
                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar p-2 bg-[#090a10] rounded-xl border border-slate-800">
                    {qaHistory.map((item, idx) => (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="font-semibold text-emerald-300">Q: {item.query}</div>
                        <div className="text-slate-300 bg-[#141624] p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                          {item.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qaQuery}
                    onChange={(e) => setQaQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isAnswering && handleDocumentQA()}
                    placeholder="Ask anything about this document... e.g. What is the total projected Capex and payback timeline?"
                    className="flex-1 bg-[#090a10] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    onClick={handleDocumentQA}
                    disabled={isAnswering || !qaQuery.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isAnswering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Ask</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-white mb-1">No Document Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select an existing document from the top bar or use the left panel to synthesize an executive report, slide deck, or financial sheet.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
export default DocumentAIStudio;
