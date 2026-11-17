import React, { useState, useEffect, useRef } from 'react';
import { resolveApiUrl } from '../utils/api';
import {
  Dices,
  FileText,
  Search,
  Trash2,
  Heart,
  FileUp,
  Cpu,
  Sparkles,
  Loader2,
  Wand2,
} from 'lucide-react';
import {
  DocumentItem,
  DocumentConfig,
  DocumentCategory,
  DocumentTone,
  DocumentEditPreset,
  DEFAULT_DOCUMENT_CONFIG,
} from '../types/index.ts';
import {
  UnifiedStudioWorkspace,
  WorkspaceTurn,
  WorkspaceRightTab,
} from './UnifiedStudioWorkspace';
import { DocumentConfigDrawer } from './DocumentConfigDrawer';
import { DocumentStage } from './DocumentStage';
import {
  fetchUniversalSettings,
  subscribeUniversalSettings,
} from '../utils/settingsClient.ts';

interface DocumentAIStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOC_MODELS = [
  {
    id: 'Gemini 4 Hydrogen Document AI',
    label: 'Gemini 4 Hydrogen',
    description: 'Frontier 1M context OCR, reasoning & synthesis',
  },
  {
    id: 'Gemini 3.8 Flash Document AI',
    label: 'Gemini 3.8 Flash',
    description: 'High-speed executive synthesis & citations',
  },
  {
    id: 'Google NotebookLM Core',
    label: 'NotebookLM Core',
    description: 'Strict source grounding & MP3 Podcast Overview',
  },
  {
    id: 'Gamma Presentation Engine',
    label: 'Gamma Slides AI',
    description: 'Boardroom presentation decks & speaker notes',
  },
];

const QUICK_CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: 'report', label: 'Executive Report' },
  { id: 'presentation', label: 'Slide Deck' },
  { id: 'spreadsheet', label: 'Financial Model' },
  { id: 'technical_prd', label: 'Technical PRD' },
  { id: 'contract', label: 'Legal Contract' },
  { id: 'notebook', label: 'Notebook Brief' },
  { id: 'sop_runbook', label: 'SOP / Runbook' },
  { id: 'study_guide', label: 'Study Guide' },
];

const RANDOM_DOC_PROMPTS = [
  'Comprehensive strategic roadmap for building Sri Lanka Sovereign AI compute clusters and clean energy data centers by 2030.',
  'Series A investor memo & unit economics model for an AI-native supply chain logistics SaaS targeting South Asia.',
  'Technical PRD and system architecture for a multi-tenant Graph-RAG enterprise document search & compliance platform.',
  'Master Services Agreement (MSA) with strict SLA guarantees, IP ownership, and SOC2 data privacy clauses.',
];

type LibraryFilter = 'all' | 'favorites' | 'uploads' | 'edited';

export const DocumentAIStudio: React.FC<DocumentAIStudioProps> = ({
  isOpen,
  onClose,
}) => {
  const [rightTab, setRightTab] = useState<WorkspaceRightTab>('preview');
  const [config, setConfig] = useState<DocumentConfig>(DEFAULT_DOCUMENT_CONFIG);
  const [prompt, setPrompt] = useState<string>('');
  const [enhancedFrom, setEnhancedFrom] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasRestoredHistoryRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const fetchDocumentHistory = async () => {
    try {
      const res = await fetch('/api/documents/history');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setDocuments(data.items);
        if (!hasRestoredHistoryRef.current && data.items.length > 0) {
          hasRestoredHistoryRef.current = true;
          const pending = (window as any).__RAONE_PENDING_ASSET__;
          if (!pending || pending.studio !== 'document') {
            setActiveDoc((prev) => prev || data.items[0]);
          }
          setTurns((prev) => {
            if (prev.length > 0) return prev;
            const restored: WorkspaceTurn[] = [];
            [...data.items]
              .slice(0, 10)
              .reverse()
              .forEach((doc: DocumentItem) => {
                restored.push({
                  id: `u_hist_${doc.id}`,
                  role: 'user',
                  content: doc.enhancedFrom || doc.prompt || doc.title,
                });
                restored.push({
                  id: `a_hist_${doc.id}`,
                  role: 'assistant',
                  modelLabel: doc.model || 'Document AI',
                  content: `Synthesized "${doc.title}" (${doc.wordCount || 0} words · ${doc.pageCount || 1} pages).`,
                  details: [
                    `Category: ${(doc.docCategory || doc.docType || 'report').replace(/_/g, ' ')} · v${doc.version || 1}`,
                  ],
                });
              });
            return restored;
          });
        }
      }
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchDocumentHistory();
    fetchUniversalSettings()
      .then((profile) => {
        if (profile?.studioDefaults?.document) {
          setConfig((prev) => ({ ...prev, ...profile.studioDefaults.document }));
        }
      })
      .catch(() => {});

    return subscribeUniversalSettings((profile) => {
      if (profile?.studioDefaults?.document) {
        setConfig((prev) => ({ ...prev, ...profile.studioDefaults.document }));
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || documents.length === 0) return;
    const pending = (window as any).__RAONE_PENDING_ASSET__;
    if (pending && pending.studio === 'document' && pending.rawId) {
      const match = documents.find((d) => d.id === pending.rawId);
      if (match) {
        setActiveDoc(match);
        setRightTab('preview');
        delete (window as any).__RAONE_PENDING_ASSET__;
      }
    }
  }, [isOpen, documents]);

  const handleEnhancePrompt = async () => {
    const cleanSeed = prompt.trim();
    if (!cleanSeed || isEnhancing || isLoading) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/documents/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanSeed,
          enhancerMode: config.enhancerMode,
          documentConfig: config,
        }),
      });
      const data = await res.json();
      if (data.success && data.enhancedPrompt) {
        setEnhancedFrom(cleanSeed);
        setPrompt(data.enhancedPrompt);
        if (data.suggestedCategory || data.suggestedTone) {
          setConfig((prev) => ({
            ...prev,
            category: (data.suggestedCategory as DocumentCategory) || prev.category,
            tone: (data.suggestedTone as DocumentTone) || prev.tone,
          }));
        }
        const sections = Array.isArray(data.breakdown?.sections)
          ? data.breakdown.sections
          : [];
        setTurns((prev) => [
          ...prev,
          {
            id: `enh_${Date.now()}`,
            role: 'assistant',
            modelLabel: 'Prompt Enhancer',
            content: `Expanded "${cleanSeed}" into structured deliverable prompt${
              data.suggestedTitle ? ` ("${data.suggestedTitle}")` : ''
            }.`,
            details: sections.slice(0, 4).map((s: string) => `Section: ${s}`),
          },
        ]);
        showToast('Prompt enhanced cleanly.');
      } else {
        showToast(data?.error || 'Prompt enhancement failed.');
      }
    } catch {
      showToast('Failed to enhance prompt.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUploadDocumentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    showToast(`Importing "${file.name}"...`);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read file'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
          documentConfig: config,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data.document) {
        showToast(data?.error || `Failed to import "${file.name}".`);
        return;
      }

      setDocuments((prev) => [data.document, ...prev]);
      setActiveDoc(data.document);
      setSourceText(data.extractedText || data.document.content || '');
      setConfig((prev) => ({ ...prev, mode: 'edit' }));
      setRightTab('preview');
      setTurns((prev) => [
        ...prev,
        {
          id: `up_${Date.now()}`,
          role: 'assistant',
          modelLabel: data.document.ocrEngine || 'Document OCR',
          content: `Imported "${data.document.title}" (${data.document.wordCount || 0} words) — switched to Edit Mode.`,
          details: ['Type an edit instruction on the left or use inline Edit / Table Grid.'],
        },
      ]);
      showToast(`Imported "${file.name}" into workspace.`);
    } catch (err: any) {
      showToast(err?.message || 'Document upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditDocument = async (
    instruction: string,
    preset: DocumentEditPreset = config.editPreset,
    targetSection = ''
  ) => {
    if (!activeDoc || isMutating || isLoading) return;
    const startMs = Date.now();
    const label = instruction.trim() || `Apply ${preset.replace(/_/g, ' ')}`;
    setTurns((prev) => [
      ...prev,
      { id: `u_ed_${Date.now()}`, role: 'user', content: `Edit v${activeDoc.version || 1}: ${label}` },
    ]);
    setIsMutating(true);
    setIsLoading(true);

    try {
      const res = await fetch('/api/documents/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeDoc.id,
          instruction,
          editPreset: preset,
          targetSection,
          documentConfig: config,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      if (data.success && data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setActiveDoc(data.document);
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_ed_${Date.now()}`,
            role: 'assistant',
            modelLabel: config.model,
            durationSec: elapsed,
            content: `Updated "${data.document.title}" → v${data.document.version || 2}.`,
            details: [data.document.aiNotes || 'Revision committed with full version lineage.'],
          },
        ]);
        showToast(`Created v${data.document.version || 2} revision.`);
      } else {
        showToast(data?.error || 'Document edit failed.');
      }
    } catch {
      showToast('Failed to apply document edit.');
    } finally {
      setIsMutating(false);
      setIsLoading(false);
    }
  };

  const handleComposerSubmit = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isLoading) return;

    if (config.mode === 'edit' && activeDoc) {
      setPrompt('');
      await handleEditDocument(cleanPrompt, config.editPreset, '');
      return;
    }

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
          docType: config.category,
          tone: config.tone,
          model: config.model,
          sourceText,
          enhancedFrom: enhancedFrom || undefined,
          documentConfig: config,
          includeAudioOverview: config.audio.autoGenerateOverview,
        }),
      });
      const data = await res.json();
      const elapsed = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
      setEnhancedFrom('');

      if (data.success && data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setActiveDoc(data.document);
        setRightTab('preview');
        setTurns((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            modelLabel: config.model,
            durationSec: elapsed,
            content: `Synthesized "${data.document.title}" (${data.document.wordCount || 0} words · ${data.document.pageCount || 1} pages).`,
            details: [
              `Category: ${config.category.replace(/_/g, ' ')} · Language: ${config.language}`,
              `${data.document.slides?.length || 0} slides · Ready for DOCX, PPTX, XLSX, PDF & HTML export.`,
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

  const handleSaveManual = async (payload: {
    id: string;
    title: string;
    summary: string;
    content: string;
  }) => {
    setIsMutating(true);
    try {
      const res = await fetch('/api/documents/save-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.document) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === data.document.id ? data.document : d))
        );
        setActiveDoc(data.document);
        showToast('Changes saved.');
      } else {
        showToast(data?.error || 'Save failed.');
      }
    } catch {
      showToast('Error saving manual edits.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleRunAudit = async (docId: string) => {
    setIsMutating(true);
    try {
      const res = await fetch('/api/documents/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId }),
      });
      const data = await res.json();
      if (data.success && data.document) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === data.document.id ? data.document : d))
        );
        setActiveDoc(data.document);
        showToast('Compliance & quality audit completed.');
      } else {
        showToast(data?.error || 'Audit failed.');
      }
    } catch {
      showToast('Failed to run document audit.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleGenerateAudioOverview = async (docId: string) => {
    setIsMutating(true);
    showToast('Synthesizing Podcast MP3 Overview...');
    try {
      const res = await fetch('/api/documents/audio-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId,
          voiceName: config.audio.voiceName,
          style: config.audio.style,
        }),
      });
      const data = await res.json();
      if (data.success && data.document) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === data.document.id ? data.document : d))
        );
        setActiveDoc(data.document);
        showToast('Podcast MP3 Overview ready.');
      } else {
        showToast(data?.error || 'Audio overview synthesis failed.');
      }
    } catch {
      showToast('Audio overview failed.');
    } finally {
      setIsMutating(false);
    }
  };

  const handlePublishShare = async (docId: string) => {
    setIsMutating(true);
    try {
      const res = await fetch('/api/documents/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId }),
      });
      const data = await res.json();
      if (data.success && data.shareUrl) {
        if (data.item) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === data.item.id ? data.item : d))
          );
          setActiveDoc(data.item);
        }
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        navigator.clipboard?.writeText(fullUrl).catch(() => {});
        showToast(`Published & copied share link: ${data.shareUrl}`);
      } else {
        showToast(data?.error || 'Publish failed.');
      }
    } catch {
      showToast('Failed to publish share link.');
    } finally {
      setIsMutating(false);
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
        }
        showToast('Document deleted.');
      }
    } catch {
      showToast('Delete failed.');
    }
  };

  const handleAskQuestion = async (query: string): Promise<string | null> => {
    if (!activeDoc) return null;
    try {
      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDoc.id,
          query,
          content: activeDoc.content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return data.answer;
      }
      showToast(data?.error || 'Q&A failed.');
      return null;
    } catch {
      showToast('Q&A request error.');
      return null;
    }
  };

  const handleExportOffice = async (
    format: 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'html' | 'md'
  ) => {
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

  const filteredDocs = documents.filter((d) => {
    const matchFilter =
      libraryFilter === 'all'
        ? true
        : libraryFilter === 'favorites'
        ? !!d.isFavorite
        : libraryFilter === 'uploads'
        ? d.operationType === 'upload' || !!d.sourceFile
        : (d.version || 1) > 1 || d.operationType === 'text_edit' || d.operationType === 'section_rewrite';

    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.prompt.toLowerCase().includes(q) ||
      (d.docCategory || d.docType).toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const previewContent = activeDoc ? (
    <DocumentStage
      activeDoc={activeDoc}
      allDocs={documents}
      onSelectDoc={(doc) => {
        setActiveDoc(doc);
        setRightTab('preview');
      }}
      onEditDocument={handleEditDocument}
      onSaveManual={handleSaveManual}
      onRunAudit={handleRunAudit}
      onGenerateAudioOverview={handleGenerateAudioOverview}
      onExportOffice={handleExportOffice}
      onPublishShare={handlePublishShare}
      onToggleFavorite={(id) => handleToggleFavorite(id)}
      onDelete={(id) => handleDelete(id)}
      onAskQuestion={handleAskQuestion}
      isMutating={isMutating || isLoading}
    />
  ) : null;

  const codeContent = (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
        <span className="text-xs font-medium text-white block">
          {activeDoc ? 'Document Markdown & Lineage Manifest' : 'Active Document Parameters'}
        </span>
        <pre className="font-mono text-xs text-[#D4D7DD] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto whitespace-pre-wrap">
          {activeDoc ? activeDoc.content : JSON.stringify(config, null, 2)}
        </pre>
      </div>

      {activeDoc?.compiledPrompt && (
        <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-2">
          <span className="text-xs font-medium text-white block">
            Compiled AI Directive & Config Snapshot
          </span>
          <pre className="font-mono text-[11px] text-[#9AA0A6] bg-[#111214] p-3.5 rounded-lg border border-[#252629] overflow-x-auto whitespace-pre-wrap">
            {activeDoc.compiledPrompt}
          </pre>
        </div>
      )}

      <div className="p-4 rounded-xl bg-[#18191B] border border-[#282A2E] space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Cpu className="w-4 h-4 text-[#8AB4F8]" />
          <span>RaOne Document Pipeline Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA0A6]">
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">1. Multimodal OCR & Office Import</div>
            Extracts native PDF, DOCX, CSV, JSON, and scanned images cleanly into editable v1 Markdown.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">2. Non-Destructive Versioned Edits</div>
            Every AI rewrite, translation, or table expansion preserves parent history and line diffs.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">3. TTS Podcast Overview</div>
            Generates executive audio briefings encoded cleanly to normalized MP3 assets.
          </div>
          <div className="p-3 rounded-lg bg-[#131314] border border-[#252629]">
            <div className="font-medium text-[#E3E3E3] mb-1">4. Native Multi-Format Compilers</div>
            Exports genuine styled .DOCX, .PPTX, .XLSX, .PDF, and responsive standalone .HTML.
          </div>
        </div>
      </div>
    </div>
  );

  const filesContent = (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252629] pb-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#1B1C1E] p-0.5 rounded-lg border border-[#2C2D30]">
          {(
            [
              ['all', `All (${documents.length})`],
              ['favorites', `Favorites (${documents.filter((d) => d.isFavorite).length})`],
              ['uploads', 'Uploaded'],
              ['edited', 'Edited Revisions'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setLibraryFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                libraryFilter === key
                  ? 'bg-[#2B2D30] text-white'
                  : 'text-[#8E918F] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
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
        <div className="py-16 text-center text-xs text-[#8E918F] space-y-2">
          <FileText className="w-8 h-8 mx-auto opacity-40" />
          <p>No documents found.</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-white"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Import Document to Edit</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => {
                setActiveDoc(doc);
                setRightTab('preview');
              }}
              className="p-4 rounded-xl bg-[#18191B] border border-[#27292D] hover:border-[#42454C] transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] text-[#8AB4F8] capitalize truncate">
                    {(doc.docCategory || doc.docType).replace(/_/g, ' ')} · v{doc.version || 1}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
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
                      type="button"
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
                <span>
                  {doc.pageCount || 1}p · {doc.wordCount || 0}w
                </span>
                <span className="text-[#8AB4F8]">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editDrawerContent = (
    <DocumentConfigDrawer
      config={config}
      onChange={setConfig}
      sourceText={sourceText}
      onSourceTextChange={setSourceText}
      onTriggerUpload={() => fileInputRef.current?.click()}
      isUploading={isUploading}
      onResetDefaults={() => {
        setConfig(DEFAULT_DOCUMENT_CONFIG);
        showToast('Document parameters reset to defaults.');
      }}
    />
  );

  const composerInlineActions = (
    <button
      type="button"
      onClick={handleEnhancePrompt}
      disabled={!prompt.trim() || isEnhancing || isLoading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#252629] hover:bg-[#303236] border border-[#35373B] text-[11px] font-medium text-[#E3E3E3] disabled:opacity-40 transition-colors"
      title="Expand short keywords into a Silicon Valley-grade document brief"
    >
      {isEnhancing ? (
        <Loader2 className="w-3 h-3 animate-spin text-[#8AB4F8]" />
      ) : (
        <Sparkles className="w-3 h-3 text-[#8AB4F8]" />
      )}
      <span>Enhance</span>
    </button>
  );

  const extraToolbarActions = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E1F20] hover:bg-[#28292C] border border-[#323438] text-xs font-medium text-[#E3E3E3] whitespace-nowrap disabled:opacity-50"
        title="Upload PDF, DOCX, TXT, MD, CSV, or scanned image to edit"
      >
        <FileUp className="w-3.5 h-3.5 text-[#8AB4F8]" />
        <span className="hidden sm:inline">{isUploading ? 'Importing...' : 'Upload'}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (!activeDoc && config.mode === 'create') {
            showToast('Generate or upload a document first to switch into Edit Mode.');
            return;
          }
          setConfig((prev) => ({
            ...prev,
            mode: prev.mode === 'edit' ? 'create' : 'edit',
          }));
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap ${
          config.mode === 'edit'
            ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
            : 'bg-[#1E1F20] border-[#323438] text-[#C4C7C5]'
        }`}
        title="Toggle prompt composer between Create New vs Edit Active Document"
      >
        <Wand2 className="w-3 h-3 text-[#8AB4F8]" />
        <span>{config.mode === 'edit' ? 'Edit Mode' : 'Create Mode'}</span>
      </button>
    </div>
  );

  const composerAddContent = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#2E3034] border border-[#35373B] text-xs text-[#E3E3E3]"
        >
          <FileUp className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>Upload PDF / DOCX / OCR</span>
        </button>

        <button
          type="button"
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
          <span>Sample Prompt</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, category: c.id }))}
            className={`px-2.5 py-1.5 rounded-lg border text-xs text-left truncate ${
              config.category === c.id
                ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                : 'bg-[#131314] border-[#2F3135] text-[#C4C7C5]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp"
        onChange={handleUploadDocumentFile}
        className="hidden"
      />
      <UnifiedStudioWorkspace
        isOpen={isOpen}
        onBackToStart={onClose}
        moduleName="RaOne Document Studio"
        workspaceTitle={activeDoc ? activeDoc.title : 'Untitled Document Workspace'}
        modelOptions={DOC_MODELS}
        selectedModel={config.model}
        onSelectModel={(model) => setConfig((prev) => ({ ...prev, model }))}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmitPrompt={handleComposerSubmit}
        isGenerating={isLoading}
        turns={turns}
        onResetWorkspace={() => {
          setActiveDoc(null);
          setTurns([]);
          setPrompt('');
          setEnhancedFrom('');
          setConfig((prev) => ({ ...prev, mode: 'create' }));
          setRightTab('preview');
          showToast('Started fresh document workspace.');
        }}
        rightTab={rightTab}
        onRightTabChange={setRightTab}
        routePath={activeDoc ? `/docs/${activeDoc.id}` : '/'}
        onRefresh={fetchDocumentHistory}
        onRemix={() => {
          if (activeDoc) {
            setPrompt(activeDoc.prompt);
            setConfig((prev) => ({
              ...prev,
              mode: 'create',
              category: activeDoc.docCategory || prev.category,
            }));
            showToast('Document brief loaded for remix.');
          } else {
            setPrompt(RANDOM_DOC_PROMPTS[0]);
            showToast('Sample document prompt loaded.');
          }
        }}
        onShare={() => {
          if (activeDoc) {
            handlePublishShare(activeDoc.id);
          } else {
            showToast('Generate or upload a document first.');
          }
        }}
        onPublish={() => {
          if (activeDoc) {
            handleExportOffice('docx');
          } else {
            showToast('Generate or select a document first.');
          }
        }}
        publishLabel="Export .DOCX"
        filesCount={documents.length}
        hasActiveItem={!!activeDoc}
        previewContent={previewContent}
        codeContent={codeContent}
        filesContent={filesContent}
        editDrawerContent={editDrawerContent}
        composerAddContent={composerAddContent}
        composerInlineActions={composerInlineActions}
        extraToolbarActions={extraToolbarActions}
        emptyStateTitle="Document Workspace Ready"
        emptyStateSubtitle="Type even a 2-word idea on the left and click Enhance, or Upload an existing PDF/DOCX/image to edit."
        emptyStateActionLabel="Browse Documents"
        onEmptyStateAction={() => setRightTab('files')}
        toastMessage={toastMessage}
        universalSettingsSection="document_studio"
      />
    </>
  );
};
