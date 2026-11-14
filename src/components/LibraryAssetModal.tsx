import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Heart,
  Trash2,
  RotateCcw,
  Folder,
  FolderInput,
  Tag,
  Edit3,
  Check,
  Copy,
  Share2,
  GitBranch,
  FileText,
  Code2,
  Image as ImageIcon,
  Video,
  Music,
} from 'lucide-react';
import {
  LibraryAsset,
  LibraryFolder,
  LibraryStudioKey,
} from '../types/library.ts';

interface LibraryAssetModalProps {
  asset: LibraryAsset;
  allAssets: LibraryAsset[];
  folders: LibraryFolder[];
  onClose: () => void;
  onSelectAsset: (asset: LibraryAsset) => void;
  onDownload: (url: string, fallbackName: string) => void;
  onToggleFavorite: (asset: LibraryAsset) => void;
  onRenameOrTag: (key: string, customTitle: string, tags: string[]) => Promise<void>;
  onToggleFolder: (folderId: string, itemId: string) => void;
  onTrashOrRestore: (keys: string[], trash: boolean) => Promise<void>;
  onPurgeForever: (keys: string[]) => Promise<void>;
  onOpenInStudio: (studio: LibraryStudioKey, rawId: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const LibraryAssetModal: React.FC<LibraryAssetModalProps> = ({
  asset,
  allAssets,
  folders,
  onClose,
  onSelectAsset,
  onDownload,
  onToggleFavorite,
  onRenameOrTag,
  onToggleFolder,
  onTrashOrRestore,
  onPurgeForever,
  onOpenInStudio,
}) => {
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [titleDraft, setTitleDraft] = useState(asset.title);
  const [tagDraft, setTagDraft] = useState(asset.tags.join(', '));
  const [savingMeta, setSavingMeta] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const versions = useMemo(() => {
    const rootKey = asset.rootId || asset.rawId;
    return allAssets
      .filter((a) => a.studio === asset.studio && (a.rootId || a.rawId) === rootKey)
      .sort((a, b) => a.version - b.version);
  }, [allAssets, asset]);

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const parsedTags = tagDraft
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onRenameOrTag(asset.id, titleDraft.trim() || asset.title, parsedTags);
      setIsEditingMeta(false);
    } finally {
      setSavingMeta(false);
    }
  };

  const StudioIcon =
    asset.studio === 'code'
      ? Code2
      : asset.studio === 'vision'
      ? ImageIcon
      : asset.studio === 'cinema'
      ? Video
      : asset.studio === 'music'
      ? Music
      : FileText;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-[#141517] border border-[#282A2E] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#252629] flex items-center justify-between gap-3 bg-[#161719]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1E1F22] border border-[#2C2D30] flex items-center justify-center text-[#8AB4F8] shrink-0">
              <StudioIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{asset.title}</h3>
              <div className="text-[11px] text-[#9AA0A6] tabular-nums flex items-center gap-1.5 truncate">
                <span>{asset.categoryLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{asset.subCategory}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(asset.fileSizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>v{asset.version}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTitleDraft(asset.title);
                setTagDraft(asset.tags.join(', '));
                setIsEditingMeta((p) => !p);
              }}
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#252629]"
              title="Rename or edit tags"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#252629]"
              title="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 chat-scroll-area">
          {/* Rename & Tags Inline Form */}
          {isEditingMeta && (
            <div className="p-3.5 rounded-xl bg-[#18191C] border border-[#2F3135] space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-[#9AA0A6] block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="w-full bg-[#111214] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9AA0A6] block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder="client, launch, q4"
                    className="w-full bg-[#111214] border border-[#2F3135] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8AB4F8]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingMeta(false)}
                  className="px-3 py-1 rounded-lg text-xs text-[#9AA0A6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMeta}
                  disabled={savingMeta}
                  className="px-3 py-1 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium"
                >
                  {savingMeta ? 'Saving...' : 'Save Metadata'}
                </button>
              </div>
            </div>
          )}

          {/* Media / Document / Code Preview Surface */}
          {asset.studio === 'vision' && asset.previewUrl && (
            <div className="rounded-xl overflow-hidden bg-black border border-[#252629] flex items-center justify-center">
              <img
                src={asset.previewUrl}
                alt={asset.title}
                referrerPolicy="no-referrer"
                className="max-h-[44vh] w-auto object-contain"
              />
            </div>
          )}

          {asset.studio === 'cinema' && asset.previewUrl && (
            <div className="rounded-xl overflow-hidden bg-black border border-[#252629]">
              <video
                src={asset.previewUrl}
                poster={asset.thumbnailUrl}
                controls
                playsInline
                className="w-full max-h-[44vh]"
              />
            </div>
          )}

          {asset.studio === 'music' && asset.previewUrl && (
            <div className="p-4 rounded-xl bg-[#111214] border border-[#252629] space-y-3">
              <div className="flex items-center gap-3">
                {asset.thumbnailUrl && (
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.title}
                    className="w-14 h-14 rounded-lg object-cover border border-[#282A2E]"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white truncate">{asset.title}</div>
                  <div className="text-[11px] text-[#9AA0A6] truncate">{asset.subtitle}</div>
                </div>
              </div>
              <audio src={asset.previewUrl} controls className="w-full" />
              {asset.contentPreview && (
                <pre className="text-xs text-[#C4C7C5] whitespace-pre-wrap font-sans max-h-40 overflow-y-auto pt-2 border-t border-[#252629]">
                  {asset.contentPreview}
                </pre>
              )}
            </div>
          )}

          {(asset.studio === 'document' || asset.studio === 'code') && asset.contentPreview && (
            <div className="p-4 rounded-xl bg-[#111214] border border-[#252629] max-h-60 overflow-y-auto chat-scroll-area">
              <pre className="text-xs text-[#D8DADF] whitespace-pre-wrap font-mono leading-relaxed select-text">
                {asset.contentPreview}
              </pre>
            </div>
          )}

          {/* Available Download Formats */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#C4C7C5]">
              Download Formats ({asset.downloads.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {asset.downloads.map((dl) => (
                <button
                  key={dl.format}
                  type="button"
                  onClick={() => onDownload(dl.url, `${asset.title}.${dl.format}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1F22] hover:bg-[#2A2B2F] border border-[#2F3135] text-xs font-medium text-[#E3E3E3] transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#8AB4F8]" />
                  <span>{dl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Version Lineage Switcher */}
          {versions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#252629]">
              <GitBranch className="w-3.5 h-3.5 text-[#8AB4F8]" />
              <span className="text-[11px] text-[#9AA0A6]">Version History:</span>
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectAsset(v)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono tabular-nums border ${
                    v.id === asset.id
                      ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                      : 'bg-[#131314] border-[#282A2E] text-[#9AA0A6] hover:text-white'
                  }`}
                >
                  v{v.version}
                </button>
              ))}
            </div>
          )}

          {/* Tags & Folders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#252629]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#9AA0A6]">
                <Tag className="w-3 h-3" />
                <span>Tags</span>
              </div>
              <div className="text-xs text-[#D8DADF]">
                {asset.tags.length > 0 ? asset.tags.join(' · ') : 'No custom tags'}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#9AA0A6]">
                <FolderInput className="w-3 h-3" />
                <span>Folders</span>
              </div>
              {folders.length === 0 ? (
                <div className="text-xs text-[#6E7075]">No custom folders created yet.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {folders.map((fld) => {
                    const inFolder = fld.itemIds.includes(asset.id);
                    return (
                      <button
                        key={fld.id}
                        type="button"
                        onClick={() => onToggleFolder(fld.id, asset.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1.5 border ${
                          inFolder
                            ? 'bg-[#2B2D30] border-[#8AB4F8] text-white'
                            : 'bg-[#18191C] border-[#282A2E] text-[#9AA0A6] hover:text-white'
                        }`}
                      >
                        <Folder className="w-3 h-3" />
                        <span>{fld.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="px-5 py-3 border-t border-[#252629] flex flex-wrap items-center justify-between gap-2 bg-[#161719]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(asset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border ${
                asset.isFavorite
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-[#1E1F22] border-[#2F3135] text-[#E3E3E3] hover:bg-[#282A2E]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${asset.isFavorite ? 'fill-current' : ''}`} />
              <span>{asset.isFavorite ? 'Starred' : 'Star'}</span>
            </button>

            {asset.shareUrl && (
              <button
                type="button"
                onClick={() => {
                  const full = `${window.location.origin}${asset.shareUrl}`;
                  navigator.clipboard?.writeText(full).catch(() => {});
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 1800);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1E1F22] border border-[#2F3135] text-[#8AB4F8] inline-flex items-center gap-1.5"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Share Link</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(asset.title).catch(() => {});
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1E1F22] border border-[#2F3135] text-[#E3E3E3] inline-flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Title</span>
            </button>

            {asset.trashedAt ? (
              <>
                <button
                  type="button"
                  onClick={() => onTrashOrRestore([asset.id], false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1E1F22] border border-[#2F3135] text-emerald-400 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPurgeForever([asset.id])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 border border-red-500/40 text-red-300 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Forever</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onTrashOrRestore([asset.id], true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1E1F22] border border-[#2F3135] text-[#9AA0A6] hover:text-red-400 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenInStudio(asset.studio, asset.rawId)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#E3E3E3] hover:bg-white text-[#131314] inline-flex items-center gap-1.5"
          >
            <span>Open & Edit in Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
