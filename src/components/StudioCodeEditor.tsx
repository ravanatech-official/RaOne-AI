import React, { useState, useRef } from 'react';
import {
  FileCode2,
  FileJson,
  FileText,
  Copy,
  Check,
  Download,
  Play,
  Plus,
  FolderArchive,
  Save,
  Loader2,
} from 'lucide-react';

interface StudioCodeEditorProps {
  title: string;
  files: Record<string, string | undefined>;
  activeFile: string;
  onSelectFile: (filename: string) => void;
  onChangeFile: (filename: string, content: string) => void;
  onCreateFile: (filename: string) => void;
  onApplyAndSave: () => void;
  onDownloadHtml: () => void;
  onDownloadZip: () => void;
  isDirty: boolean;
  isSaving: boolean;
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.json')) return FileJson;
  if (filename.endsWith('.md')) return FileText;
  return FileCode2;
}

export const StudioCodeEditor: React.FC<StudioCodeEditorProps> = ({
  files,
  activeFile,
  onSelectFile,
  onChangeFile,
  onCreateFile,
  onApplyAndSave,
  onDownloadHtml,
  onDownloadZip,
  isDirty,
  isSaving,
}) => {
  const [copied, setCopied] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const gutterRef = useRef<HTMLDivElement>(null);

  const fileList = Object.keys(files).filter((k) => files[k] !== undefined);
  const currentContent = files[activeFile] ?? '';
  const lineCount = Math.max(1, currentContent.split('\n').length);

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentContent).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newFilename.trim().replace(/[^a-zA-Z0-9._-]/g, '');
    if (!cleaned) return;
    onCreateFile(cleaned);
    setNewFilename('');
    setIsCreatingFile(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#0E0F10] select-none">
      {/* Top Action Bar */}
      <div className="h-10 px-3 bg-[#161719] border-b border-[#252629] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-[#E3E3E3] truncate">{activeFile}</span>
          <span className="text-[11px] font-mono text-[#8E918F] tabular-nums whitespace-nowrap">
            {lineCount} lines
          </span>
          {isDirty && (
            <span className="text-[11px] text-amber-400 whitespace-nowrap">
              · Unsaved edits
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onApplyAndSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isDirty
                ? 'bg-[#8AB4F8] text-[#0E0F10] hover:bg-[#AECBFA]'
                : 'bg-[#252629] hover:bg-[#323438] text-[#E3E3E3]'
            }`}
            title="Compile files into live Preview and save to workspace"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDirty ? (
              <Save className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isDirty ? 'Apply & Save' : 'Run Preview'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1E1F20] hover:bg-[#2B2D30] border border-[#323438] text-xs text-[#E3E3E3] whitespace-nowrap shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={onDownloadZip}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1E1F20] hover:bg-[#2B2D30] border border-[#323438] text-xs text-[#E3E3E3] whitespace-nowrap shrink-0"
            title="Export multi-file project as ZIP"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>ZIP</span>
          </button>

          <button
            onClick={onDownloadHtml}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2B2D30] hover:bg-[#36383D] text-xs text-white whitespace-nowrap shrink-0"
            title="Export single-file compiled HTML"
          >
            <Download className="w-3.5 h-3.5" />
            <span>HTML</span>
          </button>
        </div>
      </div>

      {/* Main Split: File Explorer Tree + Line-Numbered Editable Code */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* File Tree */}
        <aside className="w-48 sm:w-52 shrink-0 border-r border-[#252629] bg-[#131314] flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[#252629]/70 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#9AA0A6]">Project Files</span>
            <button
              onClick={() => setIsCreatingFile((p) => !p)}
              className="p-1 rounded text-[#9AA0A6] hover:text-white hover:bg-[#1E1F20]"
              title="Add new file"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {isCreatingFile && (
            <form onSubmit={handleCreateSubmit} className="p-2 border-b border-[#252629]">
              <input
                type="text"
                autoFocus
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                placeholder="utils.js"
                className="w-full bg-[#1B1C1E] border border-[#36383D] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#8AB4F8]"
              />
            </form>
          )}

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 chat-scroll-area">
            {fileList.map((fname) => {
              const Icon = getFileIcon(fname);
              const active = fname === activeFile;
              return (
                <button
                  key={fname}
                  onClick={() => onSelectFile(fname)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left ${
                    active
                      ? 'bg-[#252629] text-white'
                      : 'text-[#9AA0A6] hover:text-[#E3E3E3] hover:bg-[#1B1C1E]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[#8AB4F8]" />
                  <span className="truncate">{fname}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Line-Numbered Editable Source Area */}
        <div className="flex-1 flex min-w-0 min-h-0 bg-[#0E0F10] relative overflow-hidden">
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="w-12 py-4 pr-2 text-right font-mono text-xs leading-6 text-[#55585E] bg-[#0B0C0D] border-r border-[#1F2024] select-none overflow-hidden tabular-nums shrink-0"
          >
            {Array.from({ length: lineCount }, (_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>

          <textarea
            value={currentContent}
            onChange={(e) => onChangeFile(activeFile, e.target.value)}
            onScroll={(e) => {
              if (gutterRef.current) {
                gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            spellCheck={false}
            wrap="off"
            className="flex-1 h-full w-full p-4 bg-transparent font-mono text-xs leading-6 text-[#D4D7DD] focus:outline-none resize-none overflow-auto select-text whitespace-pre"
          />
        </div>
      </div>
    </div>
  );
};
