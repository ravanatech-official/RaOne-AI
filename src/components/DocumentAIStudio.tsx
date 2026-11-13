import React, { useState, useEffect, useRef } from 'react';
import { resolveApiUrl } from '../utils/api';
import {
  Play,
  Pause,
  Download,
  Copy,
  Trash2,
  Heart,
  Dices,
  FileText,
  Presentation,
  Table,
  BookOpen,
  Send,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  Cpu,
  FileUp,
  Bookmark,
  Network,
  FileSpreadsheet,
  Quote,
  Loader2,
} from 'lucide-react';
import { DocumentItem, GraphEntityNode } from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
} from './UnifiedStudioWorkspace';

interface DocumentAIStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOC_TYPES = [
  { id: 'report', label: 'Executive Report', icon: FileText },
  { id: 'presentation', label: 'Gamma Slides', icon: Presentation },
  { id: 'spreadsheet', label: 'Financial Sheet', icon: Table },
  { id: 'notebook', label: 'NotebookLM', icon: BookOpen },
];

const DOC_MODELS = [
  { id: 'Gemini 3.8 Flash Document AI', label: 'Gemini 3.8 Doc AI', description: '1M context multi-modal OCR & synthesis' },
  { id: 'Google NotebookLM Core', label: 'NotebookLM Core', description: 'Source-grounded citations & Audio Overview' },
  { id: 'Gamma Presentation Engine', label: 'Gamma Slides AI', description: 'Structured executive presentation decks' },
  { id: 'Microsoft 365 Copilot Core', label: 'Copilot Enterprise', description: 'Financial models & Office binary exports' },
];

const RANDOM_DOC_PROMPTS = [
  'Comprehensive strategic roadmap for building Sri Lanka Sovereign AI compute clusters and clean energy data centers by 2030.',
  'Investor pitch deck for a $15M Series A round in autonomous AI software engineering platforms.',
  'Detailed Q4 2026 financial model and unit economics for a 512x NVIDIA H200 GPU cluster.',
  'Enterprise security whitepaper on zero-hallucination Graph-RAG architectures.',
];

export const DocumentAIStudio: React.FC<DocumentAIStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [docType, setDocType] = useState<
    'report' | 'presentation' | 'spreadsheet' | 'notebook' | 'summary'
  >('report');
  const [prompt, setPrompt] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Gemini 3.8 Flash Document AI');
  const [tone, setTone] = useState<'executive' | 'academic' | 'technical' | 'creative'>(
    'executive'
  );
  const [includeAudioOverview, setIncludeAudioOverview] = useState<boolean>(true);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'document' | 'slides' | 'graph'>('document');
  const [selectedEntity, setSelectedEntity] = useState<GraphEntityNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [copiedDoc, setCopiedDoc] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qaQuery, setQaQuery] = useState<string>('');
  const [qaHistory, setQaHistory] = useState<{ query: string; answer: string }[]>([]);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchDocumentHistory = async () => {
    try {
      const res = await fetch('/api/documents/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setDocuments(data.items);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocumentHistory();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isLoading) return;

    const startMs = Date.now();
    setTurns((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: cleanPrompt },
    ]);
    setPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          docType,
          tone,
          model: selectedModel,
          sourceText,
          includeSlides: true,
          includeAudioOverview,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      if (data.success && data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setActiveDoc(data.document);
        setCurrentSlideIndex(0);
        setQaHistory([]);
        setActiveView(
          data.document.slides?.length > 0 && docType === 'presentation'
            ? 'slides'
            : 'document'
        );
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: selectedModel,
            durationSec: elapsed,
            content: `Synthesized "${data.document.title}" (${data.document.pageCount || 1} pages).`,
            details: [
              `Format: ${docType} · Tone: ${tone}`,
              data.document.citations?.length
                ? `${data.document.citations.length} grounded citations attached.`
                : 'Ready for DOCX, PPTX, XLSX & Markdown export.',
            ],
          },
        ]);
      } else {
        showToast(data?.error || 'Document generation failed.');
      }
    } catch {
      showToast('Error generating document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/documents/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, isFavorite: data.item.isFavorite } : d
          )
        );
        if (activeDoc?.id === id) {
          setActiveDoc((prev) =>
            prev ? { ...prev, isFavorite: data.item.isFavorite } : null
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
          setActiveDoc(null);
          setIsPlayingAudio(false);
        }
        showToast('Document deleted.');
      }
    } catch {
      showToast('Delete failed.');
    }
  };

  const handleDocumentQA = async () => {
    if (!qaQuery.trim() || !activeDoc || isAnswering) return;
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setQaHistory((prev) => [...prev, { query: queryText, answer: data.answer }]);
      } else {
        showToast(data?.error || 'Q&A analysis failed.');
      }
    } catch {
      showToast('Q&A query failed.');
    } finally {
      setIsAnswering(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    showToast(`Extracting "${file.name}"...`);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read file'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/uploads/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        showToast(data?.error || `Failed to extract text from "${file.name}".`);
        return;
      }
      setSourceText(data.extractedText || '');
      showToast(`Source grounded from "${file.name}" (${data.charCount || 0} chars).`);
    } catch (err: any) {
      showToast(err?.message || 'Source upload extraction failed.');
    }
  };

  const handleExportOffice = async (format: 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'md') => {
    if (!activeDoc) return;
    showToast(`Exporting .${format.toUpperCase()}...`);
    try {
      const downloadUrl = resolveApiUrl(
        `/api/documents/export/${format}?id=${encodeURIComponent(activeDoc.id)}`
      );
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData?.error || `Export failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${activeDoc.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast(`Exported .${format.toUpperCase()} successfully.`);
    } catch (err: any) {
      showToast(err?.message || `Failed to export .${format.toUpperCase()}.`);
    }
  };

  const previewContent = activeDoc ? (
    <div className="p-5 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Document Sub-navigation & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18191C] border border-[#282A2E] rounded-xl p-2.5">
        <div className="flex items-center gap-1 bg-[#131314] p-0.5 rounded-lg border border-[#252629]">
          <button
            onClick={() => setActiveView('document')}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              activeView === 'document'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Reader
          </button>
          <button
            onClick={() => setActiveView('slides')}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              activeView === 'slides'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Slides ({activeDoc.slides?.length || 0})
          </button>
          <button
            onClick={() => setActiveView('graph')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
              activeView === 'graph'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#8E918F] hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Graph-RAG</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              navigator.clipboard.writeText(activeDoc.content);
              setCopiedDoc(true);
              setTimeout(() => setCopiedDoc(false), 1500);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
          >
            {copiedDoc ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>Copy</span>
          </button>
          <button
            onClick={() => handleExportOffice('docx')}
            className="px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
          >
            .DOCX
          </button>
          <button
            onClick={() => handleExportOffice('pptx')}
            className="px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
          >
            .PPTX
          </button>
          <button
            onClick={() => handleExportOffice('xlsx')}
            className="px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
          >
            .XLSX
          </button>
          <button
            onClick={() => handleExportOffice('pdf')}
            className="px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
          >
            .PDF
          </button>
          <button
            onClick={() => handleToggleFavorite(activeDoc.id)}
            className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                activeDoc.isFavorite ? 'fill-rose-500 text-rose-500' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* NotebookLM Audio Overview Player */}
      {activeDoc.audioOverviewUrl && (
        <div className="p-4 rounded-xl bg-[#18191C] border border-[#282A2E] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (!audioPlayerRef.current) return;
                if (isPlayingAudio) {
                  audioPlayerRef.current.pause();
                  setIsPlayingAudio(false);
                } else {
                  audioPlayerRef.current.play().catch(() => {});
                  setIsPlayingAudio(true);
                }
              }}
              className="w-10 h-10 rounded-full bg-[#E3E3E3] hover:bg-white text-[#131314] flex items-center justify-center shrink-0"
            >
              {isPlayingAudio ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <div className="min-w-0">
              <div className="text-xs font-medium text-white">
                Audio Overview (Deep Dive Discussion)
              </div>
              <p className="text-[11px] text-[#9AA0A6] truncate">
                {activeDoc.audioOverviewTranscript ||
                  'Grounded conversational audio synthesis.'}
              </p>
            </div>
          </div>
          <audio
            ref={audioPlayerRef}
            src={activeDoc.audioOverviewUrl}
            onEnded={() => setIsPlayingAudio(false)}
          />
        </div>
      )}

      {/* Document Reader */}
      {activeView === 'document' && (
        <div className="p-6 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-5 select-text">
          <h2 className="text-lg font-semibold text-white">{activeDoc.title}</h2>
          {activeDoc.summary && (
            <div className="p-4 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-1">
              <div className="text-[11px] font-medium text-[#8AB4F8]">Executive Summary</div>
              <p className="text-xs text-[#D8DADF] leading-relaxed">{activeDoc.summary}</p>
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-xs text-[#E3E3E3] leading-relaxed">
            {activeDoc.content}
          </pre>

          {activeDoc.citations && activeDoc.citations.length > 0 && (
            <div className="pt-4 border-t border-[#252629] space-y-2.5">
              <div className="text-xs font-medium text-[#C4C7C5] flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>Grounded Citations</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {activeDoc.citations.map((cit) => (
                  <div
                    key={cit.id}
                    className="p-3 rounded-xl bg-[#131314] border border-[#252629] space-y-1"
                  >
                    <div className="flex justify-between text-xs font-medium text-[#E3E3E3]">
                      <span className="truncate">{cit.sourceTitle}</span>
                      <span className="text-[11px] text-[#8E918F] font-mono shrink-0">
                        {cit.pageOrSection}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9AA0A6] italic">"{cit.snippet}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Presentation Slides */}
      {activeView === 'slides' && activeDoc.slides && activeDoc.slides.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#18191C] border border-[#282A2E] rounded-xl px-4 py-2">
            <span className="text-xs font-medium text-[#E3E3E3] tabular-nums">
              Slide {currentSlideIndex + 1} / {activeDoc.slides.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                disabled={currentSlideIndex === 0}
                className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] disabled:opacity-40 text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentSlideIndex(
                    Math.min((activeDoc.slides?.length || 1) - 1, currentSlideIndex + 1)
                  )
                }
                disabled={currentSlideIndex === (activeDoc.slides?.length || 1) - 1}
                className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] disabled:opacity-40 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeDoc.slides[currentSlideIndex] && (
            <div className="min-h-[340px] p-7 rounded-2xl bg-[#161719] border border-[#282A2E] flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <span className="text-[11px] font-mono text-[#8AB4F8]">
                  Slide {activeDoc.slides[currentSlideIndex].slideNumber}
                </span>
                <h2 className="text-xl font-semibold text-white">
                  {activeDoc.slides[currentSlideIndex].title}
                </h2>
                {activeDoc.slides[currentSlideIndex].subtitle && (
                  <p className="text-xs text-[#9AA0A6]">
                    {activeDoc.slides[currentSlideIndex].subtitle}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {activeDoc.slides[currentSlideIndex].bulletPoints.map((bp, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] flex items-start gap-2.5 text-xs text-[#E3E3E3]"
                    >
                      <span className="font-mono text-[#8AB4F8] shrink-0">{i + 1}.</span>
                      <span>{bp}</span>
                    </div>
                  ))}
                </div>
              </div>
              {activeDoc.slides[currentSlideIndex].callout && (
                <div className="p-3.5 rounded-xl bg-[#1E1F20] border border-[#2C2D30] flex items-center gap-2.5 text-xs text-[#D8DADF] italic">
                  <Quote className="w-4 h-4 text-[#8AB4F8] shrink-0" />
                  <span>"{activeDoc.slides[currentSlideIndex].callout}"</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Graph-RAG Entities */}
      {activeView === 'graph' && (
        <div className="p-5 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-4">
          <div className="text-xs font-medium text-white flex items-center gap-2">
            <Network className="w-4 h-4 text-[#8AB4F8]" />
            <span>Knowledge Graph Entities</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(activeDoc.graphEntities?.length
              ? activeDoc.graphEntities
              : [
                  { id: 'e1', name: activeDoc.title.slice(0, 32), type: 'milestone' as const, connections: ['e2'] },
                  { id: 'e2', name: 'LayoutLMv3 OCR', type: 'concept' as const, connections: ['e1', 'e3'] },
                  { id: 'e3', name: 'BM25 + Dense Vector RRF', type: 'metric' as const, connections: ['e2'] },
                ]
            ).map((node) => (
              <button
                key={node.id}
                onClick={() => setSelectedEntity(node)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  selectedEntity?.id === node.id
                    ? 'bg-[#2B2D30] border-[#8AB4F8]'
                    : 'bg-[#1E1F20] border-[#2C2D30] hover:border-[#42454C]'
                }`}
              >
                <div className="text-[11px] font-mono text-[#8AB4F8] uppercase">
                  {node.type}
                </div>
                <div className="text-xs font-medium text-white mt-1 truncate">
                  {node.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Document Q&A */}
      <div className="p-4 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-3">
        <div className="text-xs font-medium text-white">Ask Grounded Questions</div>
        {qaHistory.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto chat-scroll-area">
            {qaHistory.map((qa, i) => (
              <div key={i} className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-1 text-xs">
                <div className="font-medium text-white">Q: {qa.query}</div>
                <div className="text-[#C4C7C5] whitespace-pre-wrap">{qa.answer}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={qaQuery}
            onChange={(e) => setQaQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDocumentQA()}
            placeholder="Ask a question grounded in this document..."
            className="flex-1 bg-[#131314] border border-[#2F3135] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
          />
          <button
            onClick={handleDocumentQA}
            disabled={!qaQuery.trim() || isAnswering}
            className="px-3 py-1.5 rounded-lg bg-[#2B2D30] hover:bg-[#383A40] text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1"
          >
            {isAnswering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Ask</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
        <span className="text-xs font-medium text-white block">
          Document Markdown & Source Grounding Spec
        </span>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto whitespace-pre-wrap">
          {activeDoc
            ? activeDoc.content
            : JSON.stringify(
                {
                  model: selectedModel,
                  docType,
                  tone,
                  includeAudioOverview,
                  hasSourceText: !!sourceText.trim(),
                },
                null,
                2
              )}
        </pre>
      </div>

      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Cpu className="w-4 h-4 text-[#8AB4F8]" />
          <span>Intelligent Document Processing (IDP) & RAG Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. LayoutLMv3 Vision OCR</div>
            Parses tables, columns, and charts with spatial bounding coherence.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. Hybrid Dense + BM25 RRF</div>
            Combines semantic embeddings and exact keyword matches cleanly.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">3. Graph-RAG Entity Linking</div>
            Connects organizational, financial, and regulatory concepts across sources.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">4. Native Office Binary Exports</div>
            Compiles formatted .DOCX, .PPTX, .XLSX, and .MD deliverables on server.
          </div>
        </div>
      </div>
    </div>
  );

  const filteredDocs = documents.filter((d) => {
    const matchFav = !filterFavorite || d.isFavorite;
    const matchSearch =
      !searchQuery.trim() ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFav && matchSearch;
  });

  const filesContent = (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          <button
            onClick={() => setFilterFavorite(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              !filterFavorite ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            All Documents ({documents.length})
          </button>
          <button
            onClick={() => setFilterFavorite(true)}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              filterFavorite ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
            }`}
          >
            Favorites ({documents.filter((d) => d.isFavorite).length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E918F] absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="bg-[#1B1C1E] border border-[#2C2D30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#6E7075] focus:outline-none w-56"
          />
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E918F]">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No documents found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => {
                setActiveDoc(doc);
                setCurrentSlideIndex(0);
                setQaHistory([]);
                setRightTab('preview');
              }}
              className="p-4 rounded-xl bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] text-[#8AB4F8] capitalize">
                    {doc.docType}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleToggleFavorite(doc.id, e)}
                      className="p-1 rounded text-[#8E918F] hover:text-rose-400"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          doc.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1 rounded text-[#8E918F] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-medium text-white line-clamp-1">
                  {doc.title}
                </h4>
                <p className="text-xs text-[#8E918F] mt-1 line-clamp-2">
                  {doc.summary || doc.prompt}
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[#252629] flex items-center justify-between text-[11px] text-[#8E918F] tabular-nums">
                <span>{doc.pageCount || 1} pages</span>
                <span className="text-[#8AB4F8]">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editDrawerContent = (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.json,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1.5">
          Document Format
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {DOC_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setDocType(t.id as any)}
                className={`p-2 rounded-lg border text-left flex items-center gap-2 text-xs ${
                  docType === t.id
                    ? 'bg-[#2B2D30] border-[#4A4D54] text-white'
                    : 'bg-[#1E1F20] border-[#2C2D30] text-[#8E918F] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#C4C7C5] block mb-1">
          Tone of Voice
        </label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as any)}
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="executive">Executive (C-Suite)</option>
          <option value="technical">Technical (Engineering)</option>
          <option value="academic">Academic (Research)</option>
          <option value="creative">Pitch / Persuasive</option>
        </select>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-[#1B1C1E] border border-[#2C2D30] text-xs">
        <span className="text-[#E3E3E3]">Podcast Audio Overview</span>
        <button
          onClick={() => setIncludeAudioOverview(!includeAudioOverview)}
          className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
            includeAudioOverview ? 'bg-[#8AB4F8] justify-end' : 'bg-[#34363A] justify-start'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-[#131314]" />
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[#C4C7C5]">
            Source Grounding
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] text-[#8AB4F8] hover:underline flex items-center gap-1"
          >
            <FileUp className="w-3 h-3" />
            <span>Upload (.pdf, .docx, .txt, .md)</span>
          </button>
        </div>
        <textarea
          rows={4}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste raw notes or metrics to ground citations..."
          className="w-full bg-[#1E1F20] border border-[#2F3135] rounded-lg p-2 text-xs text-[#E3E3E3] focus:outline-none resize-none font-mono"
        />
      </div>

      {activeDoc && (
        <div className="space-y-1.5 pt-2 border-t border-[#252629]">
          <label className="text-xs font-medium text-[#C4C7C5] block">
            Export Deliverables
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['docx', 'pptx', 'xlsx', 'pdf', 'md'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExportOffice(fmt)}
                className="py-1.5 rounded-lg bg-[#1E1F20] hover:bg-[#2B2D30] border border-[#2F3135] text-xs font-medium text-[#E3E3E3] uppercase flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>.{fmt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const composerAddContent = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <FileUp className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Upload Source File</span>
        </button>

        <button
          onClick={() => {
            setPrompt(
              RANDOM_DOC_PROMPTS[
                Math.floor(Math.random() * RANDOM_DOC_PROMPTS.length)
              ]
            );
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <Dices className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Inspiration</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {DOC_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setDocType(t.id as any)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs text-left truncate ${
              docType === t.id
                ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                : 'bg-[#131314] border-[#2F3135] text-[#C4C7C5]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <UnifiedStudioWorkspace
      isOpen={isOpen}
      onBackToStart={onClose}
      moduleName="RaOne DocuStudio"
      workspaceTitle={activeDoc ? activeDoc.title : 'Untitled Workspace'}
      modelOptions={DOC_MODELS}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      prompt={prompt}
      onPromptChange={setPrompt}
      onSubmitPrompt={handleGenerate}
      isGenerating={isLoading}
      turns={turns}
      onResetWorkspace={() => {
        setActiveDoc(null);
        setIsPlayingAudio(false);
        setTurns([]);
        setPrompt('');
        setRightTab('preview');
        showToast('Started empty workspace.');
      }}
      rightTab={rightTab}
      onRightTabChange={setRightTab}
      routePath={activeDoc ? `/docs/${activeDoc.id}` : '/'}
      onRefresh={fetchDocumentHistory}
      onRemix={() => {
        if (activeDoc) {
          setPrompt(activeDoc.prompt);
          showToast('Document directive loaded for remix.');
        } else {
          setPrompt(RANDOM_DOC_PROMPTS[0]);
          showToast('Sample document prompt loaded.');
        }
      }}
      onShare={() => {
        if (activeDoc) {
          navigator.clipboard?.writeText(activeDoc.content).catch(() => {});
          showToast('Document markdown copied.');
        } else {
          showToast('Workspace ready.');
        }
      }}
      onPublish={() => {
        if (activeDoc) {
          handleExportOffice('docx');
        } else {
          showToast('Generate or select a document first.');
        }
      }}
      publishLabel="Export"
      filesCount={documents.length}
      hasActiveItem={!!activeDoc}
      previewContent={previewContent}
      codeContent={codeContent}
      filesContent={filesContent}
      editDrawerContent={editDrawerContent}
      composerAddContent={composerAddContent}
      emptyStateTitle="Empty Workspace"
      emptyStateSubtitle="Describe a report, presentation, or notebook on the left, or browse saved files."
      emptyStateActionLabel="Open Files"
      onEmptyStateAction={() => setRightTab('files')}
      toastMessage={toastMessage}
    />
  );
};
