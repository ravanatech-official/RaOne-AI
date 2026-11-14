import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  Copy,
  Check,
  Heart,
  Trash2,
  Share2,
  Bookmark,
  Network,
  ShieldCheck,
  Sparkles,
  FileEdit,
  Table as TableIcon,
  FileText,
  Presentation,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Send,
  Headphones,
  Loader2,
  Plus,
  Save,
  ExternalLink,
} from 'lucide-react';
import {
  DocumentItem,
  DocumentEditPreset,
  GraphEntityNode,
} from '../types/index.ts';

interface DocumentStageProps {
  activeDoc: DocumentItem;
  allDocs: DocumentItem[];
  onSelectDoc: (doc: DocumentItem) => void;
  onEditDocument: (
    instruction: string,
    preset: DocumentEditPreset,
    targetSection: string
  ) => Promise<void>;
  onSaveManual: (payload: {
    id: string;
    title: string;
    summary: string;
    content: string;
  }) => Promise<void>;
  onRunAudit: (docId: string) => Promise<void>;
  onGenerateAudioOverview: (docId: string) => Promise<void>;
  onExportOffice: (format: 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'html' | 'md') => void;
  onPublishShare: (docId: string) => Promise<void>;
  onToggleFavorite: (docId: string) => void;
  onDelete: (docId: string) => void;
  onAskQuestion: (query: string) => Promise<string | null>;
  isMutating?: boolean;
}

type StageView = 'reader' | 'editor' | 'grid' | 'slides' | 'graph_audit';

interface ParsedMarkdownTable {
  tableIndex: number;
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
}

const EDIT_PRESETS: { id: DocumentEditPreset; label: string }[] = [
  { id: 'custom_edit', label: 'Custom Edit' },
  { id: 'rewrite_clarity', label: 'Rewrite Clarity' },
  { id: 'expand_depth', label: 'Expand Depth' },
  { id: 'condense_exec', label: 'Condense Exec' },
  { id: 'translate_bilingual', label: 'Translate' },
  { id: 'add_financial_tables', label: 'Add KPI Tables' },
  { id: 'convert_slides', label: 'Sync Slides' },
];

function extractHeadings(markdown: string): string[] {
  const lines = String(markdown || '').split('\n');
  const out: string[] = [];
  for (const raw of lines) {
    const m = /^#{1,3}\s+(.+)$/.exec(raw.trim());
    if (m && m[1]) {
      out.push(m[1].replace(/[*`#]/g, '').trim());
    }
  }
  return Array.from(new Set(out)).slice(0, 24);
}

function parseMarkdownTables(markdown: string): ParsedMarkdownTable[] {
  const lines = String(markdown || '').split('\n');
  const tables: ParsedMarkdownTable[] = [];
  let i = 0;

  const splitRow = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  while (i < lines.length - 1) {
    const headerLine = lines[i].trim();
    const sepLine = lines[i + 1].trim();
    const isPipeHeader = headerLine.includes('|');
    const isSeparator = /^\|?[\s:-]+\|[\s|:-]*$/.test(sepLine);

    if (isPipeHeader && isSeparator) {
      const headers = splitRow(headerLine);
      const startLine = i;
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && !/^\s*$/.test(lines[i])) {
        const rowCells = splitRow(lines[i]);
        while (rowCells.length < headers.length) rowCells.push('');
        rows.push(rowCells.slice(0, headers.length));
        i++;
      }
      tables.push({
        tableIndex: tables.length,
        startLine,
        endLine: i - 1,
        headers,
        rows,
      });
    } else {
      i++;
    }
  }

  return tables;
}

function serializeMarkdownTable(headers: string[], rows: string[][]): string {
  const safeCell = (s: string) => String(s || '').replace(/\|/g, '/').replace(/\n+/g, ' ').trim();
  const hLine = `| ${headers.map(safeCell).join(' | ')} |`;
  const sLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rLines = rows.map(
    (r) => `| ${headers.map((_, idx) => safeCell(r[idx] || '')).join(' | ')} |`
  );
  return [hLine, sLine, ...rLines].join('\n');
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-[#1E1F20] border border-[#2C2D30] font-mono text-[11px] text-[#8AB4F8]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{tok}</React.Fragment>;
  });
}

const MarkdownReader: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => {
    const lines = String(content || '').split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Fenced code block
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        elements.push(
          <pre
            key={`code_${i}`}
            className="p-3.5 rounded-xl bg-[#111214] border border-[#252629] font-mono text-[11px] text-[#D4D7DD] overflow-x-auto whitespace-pre-wrap"
          >
            {codeLines.join('\n')}
          </pre>
        );
        continue;
      }

      // Markdown table
      if (
        trimmed.includes('|') &&
        i + 1 < lines.length &&
        /^\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1].trim())
      ) {
        const splitRow = (l: string) =>
          l
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());
        const headers = splitRow(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
          const row = splitRow(lines[i]);
          while (row.length < headers.length) row.push('');
          rows.push(row.slice(0, headers.length));
          i++;
        }
        elements.push(
          <div key={`tbl_${i}`} className="overflow-x-auto rounded-xl border border-[#282A2E] my-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1E1F22] border-b border-[#282A2E]">
                  {headers.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 font-semibold text-white whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-[#252629] last:border-b-0 bg-[#131314] hover:bg-[#191A1D]"
                  >
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-[#D8DADF] tabular-nums">
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h3_${i}`} className="text-sm font-semibold text-[#E3E3E3] pt-2">
            {renderInlineFormatting(trimmed.slice(4))}
          </h4>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3
            key={`h2_${i}`}
            className="text-base font-semibold text-white pt-3 pb-1 border-b border-[#252629]"
          >
            {renderInlineFormatting(trimmed.slice(3))}
          </h3>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={`h1_${i}`} className="text-lg font-bold text-white pt-2">
            {renderInlineFormatting(trimmed.slice(2))}
          </h2>
        );
        i++;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`bq_${i}`}
            className="pl-3.5 border-l-2 border-[#8AB4F8] text-xs text-[#C4C7C5] italic py-0.5"
          >
            {renderInlineFormatting(trimmed.slice(2))}
          </blockquote>
        );
        i++;
        continue;
      }

      // List block
      if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const listItems: string[] = [];
        while (
          i < lines.length &&
          (/^[-*+]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))
        ) {
          listItems.push(lines[i].trim().replace(/^([-*+]|\d+\.)\s+/, ''));
          i++;
        }
        elements.push(
          <ul key={`ul_${i}`} className="space-y-1.5 pl-4 list-disc text-xs text-[#D8DADF]">
            {listItems.map((item, li) => (
              <li key={li} className="leading-relaxed">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Paragraph
      elements.push(
        <p key={`p_${i}`} className="text-xs text-[#D8DADF] leading-relaxed">
          {renderInlineFormatting(trimmed)}
        </p>
      );
      i++;
    }

    return elements;
  }, [content]);

  return <div className="space-y-3">{blocks}</div>;
};

function computeLineDiff(beforeText: string, afterText: string) {
  const beforeLines = String(beforeText || '').split('\n');
  const afterLines = String(afterText || '').split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  const removed = beforeLines.filter((l) => l.trim() && !afterSet.has(l)).slice(0, 40);
  const added = afterLines.filter((l) => l.trim() && !beforeSet.has(l)).slice(0, 40);
  return { removed, added };
}

export const DocumentStage: React.FC<DocumentStageProps> = ({
  activeDoc,
  allDocs,
  onSelectDoc,
  onEditDocument,
  onSaveManual,
  onRunAudit,
  onGenerateAudioOverview,
  onExportOffice,
  onPublishShare,
  onToggleFavorite,
  onDelete,
  onAskQuestion,
  isMutating = false,
}) => {
  const [stageView, setStageView] = useState<StageView>(
    activeDoc.docType === 'presentation' && (activeDoc.slides?.length || 0) > 0
      ? 'slides'
      : 'reader'
  );
  const [copied, setCopied] = useState(false);

  // Edit bar state
  const [editInstruction, setEditInstruction] = useState('');
  const [editPreset, setEditPreset] = useState<DocumentEditPreset>('custom_edit');
  const [targetSection, setTargetSection] = useState('');

  // Manual markdown editor state
  const [draftTitle, setDraftTitle] = useState(activeDoc.title);
  const [draftSummary, setDraftSummary] = useState(activeDoc.summary || '');
  const [draftContent, setDraftContent] = useState(activeDoc.content);

  // Diff viewer state
  const [showDiff, setShowDiff] = useState(false);

  // Slides state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Audio player state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Q&A state
  const [qaQuery, setQaQuery] = useState('');
  const [qaHistory, setQaHistory] = useState<{ query: string; answer: string }[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Graph selected node
  const [selectedEntity, setSelectedEntity] = useState<GraphEntityNode | null>(null);

  // Sync manual editor drafts when activeDoc changes
  useEffect(() => {
    setDraftTitle(activeDoc.title);
    setDraftSummary(activeDoc.summary || '');
    setDraftContent(activeDoc.content);
    setCurrentSlideIndex(0);
    setIsPlayingAudio(false);
    setQaHistory([]);
    setSelectedEntity(null);
    setTargetSection('');
  }, [activeDoc.id, activeDoc.title, activeDoc.summary, activeDoc.content]);

  // Version lineage
  const versionTree = useMemo(() => {
    const rootKey = activeDoc.rootId || activeDoc.id;
    return allDocs
      .filter((d) => (d.rootId || d.id) === rootKey || d.id === rootKey)
      .sort((a, b) => Number(a.version || 1) - Number(b.version || 1));
  }, [allDocs, activeDoc.id, activeDoc.rootId]);

  const parentDoc = useMemo(() => {
    if (activeDoc.parentId) {
      return allDocs.find((d) => d.id === activeDoc.parentId) || null;
    }
    const idx = versionTree.findIndex((d) => d.id === activeDoc.id);
    return idx > 0 ? versionTree[idx - 1] : null;
  }, [allDocs, versionTree, activeDoc.id, activeDoc.parentId]);

  const diffPreview = useMemo(() => {
    if (!parentDoc) return null;
    return computeLineDiff(parentDoc.content, activeDoc.content);
  }, [parentDoc, activeDoc.content]);

  const headings = useMemo(() => extractHeadings(activeDoc.content), [activeDoc.content]);
  const parsedTables = useMemo(() => parseMarkdownTables(activeDoc.content), [activeDoc.content]);

  // Spreadsheet table grid editing state
  const [selectedTableIdx, setSelectedTableIdx] = useState(0);
  const [gridHeaders, setGridHeaders] = useState<string[]>([]);
  const [gridRows, setGridRows] = useState<string[][]>([]);

  useEffect(() => {
    const tbl = parsedTables[selectedTableIdx] || parsedTables[0];
    if (tbl) {
      setGridHeaders([...tbl.headers]);
      setGridRows(tbl.rows.map((r) => [...r]));
    } else {
      setGridHeaders(['Item / Metric', 'Baseline', 'Target Projection']);
      setGridRows([
        ['Revenue Growth', '$1.2M', '$3.8M'],
        ['Gross Margin', '68%', '76%'],
      ]);
    }
  }, [parsedTables, selectedTableIdx]);

  const handleSaveGridToMarkdown = async () => {
    const serialized = serializeMarkdownTable(gridHeaders, gridRows);
    const tbl = parsedTables[selectedTableIdx] || parsedTables[0];
    const lines = String(activeDoc.content || '').split('\n');
    let nextContent = '';
    if (tbl) {
      lines.splice(tbl.startLine, tbl.endLine - tbl.startLine + 1, serialized);
      nextContent = lines.join('\n');
    } else {
      nextContent = `${activeDoc.content.trim()}\n\n### Data Model Grid\n\n${serialized}\n`;
    }
    await onSaveManual({
      id: activeDoc.id,
      title: activeDoc.title,
      summary: activeDoc.summary || '',
      content: nextContent,
    });
  };

  const handleApplyInlineEdit = async () => {
    if (isMutating) return;
    if (!editInstruction.trim() && editPreset === 'custom_edit') return;
    const text = editInstruction.trim();
    setEditInstruction('');
    await onEditDocument(text, editPreset, targetSection);
  };

  const handleQaSubmit = async () => {
    if (!qaQuery.trim() || isAnswering) return;
    const q = qaQuery.trim();
    setQaQuery('');
    setIsAnswering(true);
    try {
      const answer = await onAskQuestion(q);
      if (answer) {
        setQaHistory((prev) => [...prev, { query: q, answer }]);
      }
    } finally {
      setIsAnswering(false);
    }
  };

  const wordCount =
    activeDoc.wordCount || String(activeDoc.content || '').split(/\s+/).filter(Boolean).length;
  const pageCount = activeDoc.pageCount || Math.max(1, Math.ceil(wordCount / 280));
  const audit = activeDoc.auditReport;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 select-text">
      {/* Top Document Header & Export Strip */}
      <div className="rounded-xl bg-[#18191C] border border-[#282A2E] p-3.5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-white truncate">{activeDoc.title}</h2>
            <div className="text-[11px] text-[#9AA0A6] tabular-nums flex flex-wrap items-center gap-1.5">
              <span>v{activeDoc.version || 1}</span>
              <span aria-hidden="true">·</span>
              <span>{wordCount.toLocaleString()} words</span>
              <span aria-hidden="true">·</span>
              <span>{pageCount} pages</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">
                {(activeDoc.docCategory || activeDoc.docType).replace(/_/g, ' ')}
              </span>
              {activeDoc.language && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{activeDoc.language}</span>
                </>
              )}
              {activeDoc.sourceFile && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#8AB4F8]">Source: {activeDoc.sourceFile}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions & Exports */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activeDoc.content).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>

            {(['docx', 'pptx', 'xlsx', 'pdf', 'html', 'md'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onExportOffice(fmt)}
                className="px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[11px] font-medium text-[#E3E3E3] uppercase"
              >
                .{fmt}
              </button>
            ))}

            <button
              type="button"
              onClick={() => onPublishShare(activeDoc.id)}
              disabled={isMutating}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#8AB4F8]"
              title="Publish public read-only link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(activeDoc.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-[#E3E3E3]"
              title="Toggle favorite"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  activeDoc.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => onDelete(activeDoc.id)}
              className="p-1.5 rounded-lg bg-[#252629] hover:bg-red-500/20 text-[#9AA0A6] hover:text-red-400"
              title="Delete document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Published Share Link Callout */}
        {activeDoc.publishMeta?.shareUrl && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#131314] border border-[#2C2D30] text-[11px]">
            <span className="text-[#9AA0A6] truncate">
              Published Link:{' '}
              <span className="text-[#8AB4F8] font-mono">{activeDoc.publishMeta.shareUrl}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${window.location.origin}${activeDoc.publishMeta?.shareUrl}`)
                  .catch(() => {});
              }}
              className="inline-flex items-center gap-1 text-[#8AB4F8] hover:underline shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Copy URL</span>
            </button>
          </div>
        )}

        {/* Version Lineage & Diff Controls */}
        {(versionTree.length > 1 || parentDoc) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252629]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <GitBranch className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span className="text-[11px] text-[#9AA0A6]">Versions:</span>
              {versionTree.map((vDoc, idx) => (
                <button
                  key={vDoc.id}
                  type="button"
                  onClick={() => onSelectDoc(vDoc)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums border ${
                    vDoc.id === activeDoc.id
                      ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                      : 'bg-[#131314] border-[#282A2E] text-[#9AA0A6] hover:text-white'
                  }`}
                >
                  v{vDoc.version || idx + 1}
                </button>
              ))}
            </div>
            {parentDoc && (
              <button
                type="button"
                onClick={() => setShowDiff((p) => !p)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                  showDiff
                    ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                    : 'bg-[#131314] border-[#282A2E] text-[#C4C7C5]'
                }`}
              >
                {showDiff ? 'Hide Diff' : `Compare vs v${parentDoc.version || 1}`}
              </button>
            )}
          </div>
        )}

        {/* Inline Text-to-Document Edit Bar */}
        <div className="pt-2 border-t border-[#252629] space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {EDIT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setEditPreset(preset.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  editPreset === preset.id
                    ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                    : 'bg-[#131314] border-[#252629] text-[#9AA0A6] hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {headings.length > 0 && (
              <select
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                className="ml-auto bg-[#131314] border border-[#2C2D30] rounded-md px-2 py-1 text-[11px] text-[#E3E3E3] max-w-[200px]"
              >
                <option value="">All Sections</option>
                {headings.map((h) => (
                  <option key={h} value={h}>
                    Section: {h}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyInlineEdit()}
              placeholder="Instruct Text-to-Document Edit (e.g., Add Sri Lanka pricing comparison table, simplify section 2, translate to Sinhala)..."
              className="flex-1 bg-[#131314] border border-[#2F3135] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#6E7075] focus:outline-none focus:border-[#8AB4F8]"
            />
            <button
              type="button"
              onClick={handleApplyInlineEdit}
              disabled={isMutating || (!editInstruction.trim() && editPreset === 'custom_edit')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-40 shrink-0"
            >
              {isMutating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Apply Edit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Before / After Diff Panel */}
      {showDiff && diffPreview && parentDoc && (
        <div className="p-4 rounded-xl bg-[#161719] border border-[#282A2E] space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-white">
            <span>
              Line Diff: v{parentDoc.version || 1} → v{activeDoc.version || 2}
            </span>
            <span className="text-[11px] text-[#9AA0A6] tabular-nums">
              -{diffPreview.removed.length} / +{diffPreview.added.length} changed lines
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
            <div className="p-3 rounded-lg bg-[#131314] border border-[#252629] space-y-1 max-h-52 overflow-y-auto">
              <div className="text-[#9AA0A6] font-sans font-medium mb-1">Removed / Previous</div>
              {diffPreview.removed.length === 0 ? (
                <div className="text-[#6E7075]">No lines removed.</div>
              ) : (
                diffPreview.removed.map((line, i) => (
                  <div key={i} className="text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">
                    - {line}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 rounded-lg bg-[#131314] border border-[#252629] space-y-1 max-h-52 overflow-y-auto">
              <div className="text-[#9AA0A6] font-sans font-medium mb-1">Added / Updated</div>
              {diffPreview.added.length === 0 ? (
                <div className="text-[#6E7075]">No new lines added.</div>
              ) : (
                diffPreview.added.map((line, i) => (
                  <div key={i} className="text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    + {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#18191C] border border-[#282A2E] rounded-xl p-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setStageView('reader')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              stageView === 'reader' ? 'bg-[#2B2D30] text-white' : 'text-[#9AA0A6] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reader</span>
          </button>

          <button
            type="button"
            onClick={() => setStageView('editor')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              stageView === 'editor' ? 'bg-[#2B2D30] text-white' : 'text-[#9AA0A6] hover:text-white'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Markdown Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setStageView('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              stageView === 'grid' ? 'bg-[#2B2D30] text-white' : 'text-[#9AA0A6] hover:text-white'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table Grid ({parsedTables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStageView('slides')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              stageView === 'slides' ? 'bg-[#2B2D30] text-white' : 'text-[#9AA0A6] hover:text-white'
            }`}
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Slides ({activeDoc.slides?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setStageView('graph_audit')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              stageView === 'graph_audit'
                ? 'bg-[#2B2D30] text-white'
                : 'text-[#9AA0A6] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Graph & Audit</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onGenerateAudioOverview(activeDoc.id)}
          disabled={isMutating}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3] disabled:opacity-50"
        >
          <Headphones className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{activeDoc.audioOverviewUrl ? 'Refresh Podcast' : 'Audio Podcast'}</span>
        </button>
      </div>

      {/* Audio Podcast Overview Player */}
      {activeDoc.audioOverviewUrl && (
        <div className="p-4 rounded-xl bg-[#18191C] border border-[#282A2E] space-y-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
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
                  Audio Podcast Overview (MP3)
                </div>
                <p className="text-[11px] text-[#9AA0A6] truncate">
                  {activeDoc.audioOverviewTranscript || 'Grounded spoken executive briefing.'}
                </p>
              </div>
            </div>

            {activeDoc.audioOverviewTranscript && (
              <button
                type="button"
                onClick={() => setShowTranscript((p) => !p)}
                className="px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-[11px] text-[#E3E3E3] shrink-0"
              >
                {showTranscript ? 'Hide Script' : 'Transcript'}
              </button>
            )}
          </div>

          {showTranscript && activeDoc.audioOverviewTranscript && (
            <div className="p-3 rounded-lg bg-[#131314] border border-[#252629] text-xs text-[#C4C7C5] leading-relaxed">
              {activeDoc.audioOverviewTranscript}
            </div>
          )}

          <audio
            ref={audioPlayerRef}
            src={activeDoc.audioOverviewUrl}
            onEnded={() => setIsPlayingAudio(false)}
          />
        </div>
      )}

      {/* VIEW 1: Formatted Reader */}
      {stageView === 'reader' && (
        <div className="p-6 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-5">
          {activeDoc.summary && (
            <div className="p-4 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-1">
              <div className="text-[11px] font-medium text-[#8AB4F8]">Executive Summary</div>
              <p className="text-xs text-[#D8DADF] leading-relaxed">{activeDoc.summary}</p>
            </div>
          )}

          <MarkdownReader content={activeDoc.content} />

          {activeDoc.citations && activeDoc.citations.length > 0 && (
            <div className="pt-4 border-t border-[#252629] space-y-2.5">
              <div className="text-xs font-medium text-[#C4C7C5] flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>Grounded Citations ({activeDoc.citations.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {activeDoc.citations.map((cit) => (
                  <div
                    key={cit.id}
                    className="p-3 rounded-xl bg-[#131314] border border-[#252629] space-y-1"
                  >
                    <div className="flex justify-between text-xs font-medium text-[#E3E3E3] gap-2">
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

      {/* VIEW 2: Live Markdown Editor */}
      {stageView === 'editor' && (
        <div className="p-5 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">Direct Markdown Editor</span>
            <button
              type="button"
              onClick={() =>
                onSaveManual({
                  id: activeDoc.id,
                  title: draftTitle,
                  summary: draftSummary,
                  content: draftContent,
                })
              }
              disabled={isMutating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>

          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Document Title"
            className="w-full bg-[#131314] border border-[#2F3135] rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-[#8AB4F8]"
          />

          <textarea
            rows={2}
            value={draftSummary}
            onChange={(e) => setDraftSummary(e.target.value)}
            placeholder="Executive summary..."
            className="w-full bg-[#131314] border border-[#2F3135] rounded-lg p-2.5 text-xs text-[#E3E3E3] focus:outline-none focus:border-[#8AB4F8] resize-none"
          />

          <textarea
            rows={18}
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            className="w-full bg-[#111214] border border-[#2F3135] rounded-lg p-3 font-mono text-xs text-[#E3E3E3] leading-relaxed focus:outline-none focus:border-[#8AB4F8]"
          />
        </div>
      )}

      {/* VIEW 3: Interactive Spreadsheet Table Grid */}
      {stageView === 'grid' && (
        <div className="p-5 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white">Interactive Table & KPI Grid</span>
              {parsedTables.length > 1 && (
                <select
                  value={selectedTableIdx}
                  onChange={(e) => setSelectedTableIdx(Number(e.target.value))}
                  className="bg-[#131314] border border-[#2F3135] rounded-md px-2 py-1 text-xs text-white"
                >
                  {parsedTables.map((t) => (
                    <option key={t.tableIndex} value={t.tableIndex}>
                      Table #{t.tableIndex + 1} ({t.rows.length} rows)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setGridRows((prev) => [...prev, Array(gridHeaders.length).fill('')])
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
              >
                <Plus className="w-3 h-3" />
                <span>Row</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGridHeaders((prev) => [...prev, `Col ${prev.length + 1}`]);
                  setGridRows((prev) => prev.map((r) => [...r, '']));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-[#E3E3E3]"
              >
                <Plus className="w-3 h-3" />
                <span>Column</span>
              </button>
              <button
                type="button"
                onClick={handleSaveGridToMarkdown}
                disabled={isMutating}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Grid</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#282A2E]">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1E1F22] border-b border-[#282A2E]">
                  {gridHeaders.map((h, colIdx) => (
                    <th key={colIdx} className="p-1.5 border-r border-[#282A2E] last:border-r-0">
                      <input
                        type="text"
                        value={h}
                        onChange={(e) => {
                          const next = [...gridHeaders];
                          next[colIdx] = e.target.value;
                          setGridHeaders(next);
                        }}
                        className="w-full bg-transparent px-2 py-1 font-semibold text-white focus:outline-none focus:bg-[#131314] rounded"
                      />
                    </th>
                  ))}
                  <th className="w-10 p-1.5 text-center text-[#8E918F]">Del</th>
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-[#252629] last:border-b-0">
                    {gridHeaders.map((_, colIdx) => (
                      <td key={colIdx} className="p-1 border-r border-[#252629]">
                        <input
                          type="text"
                          value={row[colIdx] || ''}
                          onChange={(e) => {
                            const next = gridRows.map((r) => [...r]);
                            next[rowIdx][colIdx] = e.target.value;
                            setGridRows(next);
                          }}
                          className="w-full bg-[#131314] px-2 py-1.5 text-xs text-[#E3E3E3] rounded focus:outline-none focus:ring-1 focus:ring-[#8AB4F8]"
                        />
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setGridRows((prev) => prev.filter((_, idx) => idx !== rowIdx))
                        }
                        className="p-1 text-[#8E918F] hover:text-red-400"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: Presentation Slide Deck */}
      {stageView === 'slides' && (
        <div className="space-y-3">
          {activeDoc.slides && activeDoc.slides.length > 0 ? (
            <>
              <div className="flex items-center justify-between bg-[#18191C] border border-[#282A2E] rounded-xl px-4 py-2">
                <span className="text-xs font-medium text-[#E3E3E3] tabular-nums">
                  Slide {currentSlideIndex + 1} / {activeDoc.slides.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                    disabled={currentSlideIndex === 0}
                    className="p-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] disabled:opacity-40 text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
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
                <div className="min-h-[320px] p-6 rounded-2xl bg-[#161719] border border-[#282A2E] flex flex-col justify-between space-y-5">
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
                    <div className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] text-xs text-[#D8DADF] italic">
                      "{activeDoc.slides[currentSlideIndex].callout}"
                    </div>
                  )}

                  {activeDoc.slides[currentSlideIndex].speakerNotes && (
                    <div className="p-3 rounded-xl bg-[#131314] border border-[#252629] text-[11px] text-[#9AA0A6]">
                      <span className="font-medium text-[#C4C7C5]">Speaker Notes: </span>
                      {activeDoc.slides[currentSlideIndex].speakerNotes}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-8 rounded-2xl bg-[#161719] border border-[#282A2E] text-center space-y-3">
              <p className="text-xs text-[#9AA0A6]">
                No slides attached yet. Convert this document into a structured deck in one click.
              </p>
              <button
                type="button"
                onClick={() =>
                  onEditDocument(
                    'Generate structured executive presentation slides summarizing every key section.',
                    'convert_slides',
                    ''
                  )
                }
                disabled={isMutating}
                className="px-3.5 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium"
              >
                Convert Document to Slides
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: Knowledge Graph & Compliance Quality Audit */}
      {stageView === 'graph_audit' && (
        <div className="space-y-4">
          {/* Quality & Compliance Audit Card */}
          <div className="p-5 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-white">
                <ShieldCheck className="w-4 h-4 text-[#8AB4F8]" />
                <span>Quality & Structure Audit</span>
              </div>
              <div className="flex items-center gap-2">
                {audit?.autoFixPrompt && (
                  <button
                    type="button"
                    onClick={() => onEditDocument(audit.autoFixPrompt, 'custom_edit', '')}
                    disabled={isMutating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-40"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>1-Click Auto-Fix</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRunAudit(activeDoc.id)}
                  disabled={isMutating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-white disabled:opacity-50"
                >
                  {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{audit ? 'Re-Run Audit' : 'Run Audit'}</span>
                </button>
              </div>
            </div>

            {audit ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#252629]">
                    <div className="text-[11px] text-[#8E918F]">Words</div>
                    <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                      {audit.wordCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#252629]">
                    <div className="text-[11px] text-[#8E918F]">Headings</div>
                    <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                      {audit.headingCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#252629]">
                    <div className="text-[11px] text-[#8E918F]">Tables</div>
                    <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                      {audit.tableCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#252629]">
                    <div className="text-[11px] text-[#8E918F]">Citations</div>
                    <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                      {audit.citationCount}
                    </div>
                  </div>
                </div>

                {audit.issues.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#252629] text-xs text-emerald-400">
                    No structural or clarity issues detected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {audit.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="p-3 rounded-xl bg-[#131314] border border-[#252629] space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white">{issue.area}</span>
                          <span className="text-[10px] font-mono uppercase text-[#8AB4F8]">
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-[#C4C7C5]">{issue.description}</p>
                        <p className="text-[11px] text-[#8E918F]">Fix: {issue.suggestedFix}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#9AA0A6]">
                Run a structural audit to verify headings, comparison tables, executive clarity, and citation hygiene.
              </p>
            )}
          </div>

          {/* Knowledge Graph Entities */}
          <div className="p-5 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-3">
            <div className="text-xs font-medium text-white flex items-center gap-2">
              <Network className="w-4 h-4 text-[#8AB4F8]" />
              <span>Knowledge Graph Entities</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(activeDoc.graphEntities?.length
                ? activeDoc.graphEntities
                : [
                    {
                      id: 'e1',
                      name: activeDoc.title.slice(0, 32),
                      type: 'milestone' as const,
                      connections: ['e2'],
                    },
                    {
                      id: 'e2',
                      name: 'Grounded Document Synthesis',
                      type: 'concept' as const,
                      connections: ['e1', 'e3'],
                    },
                    {
                      id: 'e3',
                      name: `${wordCount} Words · ${parsedTables.length} Tables`,
                      type: 'metric' as const,
                      connections: ['e2'],
                    },
                  ]
              ).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedEntity(node)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    selectedEntity?.id === node.id
                      ? 'bg-[#2B2D30] border-[#8AB4F8]'
                      : 'bg-[#1E1F20] border-[#2C2D30] hover:border-[#42454C]'
                  }`}
                >
                  <div className="text-[10px] font-mono text-[#8AB4F8] uppercase">
                    {node.type}
                  </div>
                  <div className="text-xs font-medium text-white mt-1 truncate">{node.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grounded Document Q&A */}
      <div className="p-4 rounded-2xl bg-[#161719] border border-[#282A2E] space-y-3">
        <div className="text-xs font-medium text-white">Ask Grounded Questions</div>
        {qaHistory.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto chat-scroll-area">
            {qaHistory.map((qa, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-[#1E1F20] border border-[#2C2D30] space-y-1 text-xs"
              >
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
            onKeyDown={(e) => e.key === 'Enter' && handleQaSubmit()}
            placeholder="Ask a question grounded in this document..."
            className="flex-1 bg-[#131314] border border-[#2F3135] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
          />
          <button
            type="button"
            onClick={handleQaSubmit}
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
  );
};
