import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LayoutGrid,
  List,
  Search,
  ChevronDown,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Code2,
  FolderPlus,
  Folder,
  Heart,
  Download,
  X,
  Check,
  Trash2,
  RefreshCw,
  PanelLeft,
  RotateCcw,
  FileUp,
  Layers,
  HardDrive,
  Archive,
  Sliders,
} from 'lucide-react';
import { resolveApiUrl } from '../utils/api.ts';
import {
  fetchUniversalSettings,
  openUniversalSettingsAt,
  subscribeUniversalSettings,
} from '../utils/settingsClient.ts';
import {
  LibraryAsset,
  LibraryFolder,
  LibraryStudioKey,
  LibraryVaultStats,
} from '../types/library.ts';
import { LibraryAssetModal } from './LibraryAssetModal.tsx';

interface LibraryWindowProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onOpenVisionStudio: () => void;
  onOpenMotionStudio: () => void;
  onOpenAudioStudio: () => void;
  onOpenDocumentStudio: () => void;
  onOpenAIStudio: () => void;
}

type VaultNavSection =
  | 'all'
  | 'code'
  | 'vision'
  | 'cinema'
  | 'music'
  | 'document'
  | 'starred'
  | 'folders'
  | 'trash';

type SortMode = 'newest' | 'oldest' | 'size' | 'title';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const LibraryWindow: React.FC<LibraryWindowProps> = ({
  isSidebarOpen,
  onOpenSidebar,
  onOpenVisionStudio,
  onOpenMotionStudio,
  onOpenAudioStudio,
  onOpenDocumentStudio,
  onOpenAIStudio,
}) => {
  const [navSection, setNavSection] = useState<VaultNavSection>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [stats, setStats] = useState<LibraryVaultStats | null>(null);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null);
  const [openDownloadMenuId, setOpenDownloadMenuId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmBeforeTrash, setConfirmBeforeTrash] = useState(false);
  const [pendingTrashKeys, setPendingTrashKeys] = useState<string[] | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const fetchVaultData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assetsRes, foldersRes] = await Promise.all([
        fetch(resolveApiUrl('/api/library/assets')),
        fetch(resolveApiUrl('/api/library/folders')),
      ]);
      const assetsJson = await assetsRes.json().catch(() => ({}));
      const foldersJson = await foldersRes.json().catch(() => ({}));

      if (assetsJson?.success && Array.isArray(assetsJson.items)) {
        setAssets(assetsJson.items);
        if (assetsJson.stats) setStats(assetsJson.stats);
        if (selectedAsset) {
          const refreshed = assetsJson.items.find((i: LibraryAsset) => i.id === selectedAsset.id);
          if (refreshed) setSelectedAsset(refreshed);
        }
      }
      if (foldersJson?.success && Array.isArray(foldersJson.folders)) {
        setFolders(foldersJson.folders);
      }
    } catch {
      showToast('Failed to load vault index.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAsset]);

  useEffect(() => {
    fetchVaultData();
    fetchUniversalSettings()
      .then((profile) => {
        const f = profile?.libraries?.files;
        if (f?.defaultViewMode) setViewMode(f.defaultViewMode);
        if (f?.defaultSortMode) setSortMode(f.defaultSortMode);
        if (typeof f?.confirmBeforeTrash === 'boolean') setConfirmBeforeTrash(f.confirmBeforeTrash);
      })
      .catch(() => {});

    return subscribeUniversalSettings((profile) => {
      const f = profile?.libraries?.files;
      if (f?.defaultViewMode) setViewMode(f.defaultViewMode);
      if (f?.defaultSortMode) setSortMode(f.defaultSortMode);
      if (typeof f?.confirmBeforeTrash === 'boolean') setConfirmBeforeTrash(f.confirmBeforeTrash);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setIsNewMenuOpen(false);
      }
      setOpenDownloadMenuId(null);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const persistFolders = async (nextFolders: LibraryFolder[]) => {
    setFolders(nextFolders);
    try {
      await fetch(resolveApiUrl('/api/library/folders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: nextFolders }),
      });
    } catch {
      // ignore transient errors
    }
  };

  const triggerDownloadUrl = async (url: string, fallbackName: string) => {
    showToast(`Downloading ${fallbackName}...`);
    try {
      const res = await fetch(resolveApiUrl(url));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || `Download failed (${res.status}).`);
        return;
      }
      const cd = res.headers.get('content-disposition') || '';
      const fnMatch = /filename="?([^"]+)"?/i.exec(cd);
      const downloadFilename = fnMatch?.[1] || fallbackName;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      showToast(`Downloaded ${downloadFilename}`);
    } catch {
      showToast('Download failed.');
    }
  };

  const handleBulkZipDownload = async () => {
    if (selectedKeys.size === 0 || isBusy) return;
    setIsBusy(true);
    showToast(`Packaging ${selectedKeys.size} assets into ZIP...`);
    try {
      const specs = Array.from(selectedKeys)
        .map((key) => {
          const item = assets.find((a) => a.id === key);
          if (!item) return null;
          return {
            studio: item.studio,
            rawId: item.rawId,
            format: item.downloads[0]?.format,
          };
        })
        .filter(Boolean);

      const res = await fetch(resolveApiUrl('/api/library/bundle-zip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: specs }),
      });
      if (!res.ok) {
        showToast('Failed to build ZIP bundle.');
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `RaOne_Vault_Bundle_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      showToast(`Exported ${specs.length} assets as ZIP.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleFavorite = async (asset: LibraryAsset, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextFav = !asset.isFavorite;
    setAssets((prev) =>
      prev.map((a) => (a.id === asset.id ? { ...a, isFavorite: nextFav } : a))
    );
    if (selectedAsset?.id === asset.id) {
      setSelectedAsset({ ...asset, isFavorite: nextFav });
    }
    try {
      await fetch(resolveApiUrl('/api/library/favorite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio: asset.studio, rawId: asset.rawId }),
      });
    } catch {
      // ignore
    }
  };

  const handleRenameOrTag = async (
    key: string,
    customTitle: string,
    tags: string[]
  ) => {
    const res = await fetch(resolveApiUrl('/api/library/rename'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, customTitle, tags }),
    });
    if (res.ok) {
      showToast('Asset metadata updated.');
      await fetchVaultData();
    } else {
      showToast('Failed to update metadata.');
    }
  };

  const executeTrashOrRestore = async (keys: string[], trash: boolean) => {
    setIsBusy(true);
    try {
      const endpoint = trash ? '/api/library/trash' : '/api/library/restore';
      const res = await fetch(resolveApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      if (res.ok) {
        setSelectedKeys(new Set());
        if (selectedAsset && keys.includes(selectedAsset.id)) {
          setSelectedAsset(null);
        }
        showToast(trash ? 'Moved to Trash.' : 'Restored from Trash.');
        await fetchVaultData();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleTrashOrRestore = async (keys: string[], trash: boolean) => {
    if (trash && confirmBeforeTrash && keys.length > 0) {
      setPendingTrashKeys(keys);
      return;
    }
    await executeTrashOrRestore(keys, trash);
  };

  const handlePurgeForever = async (keys: string[]) => {
    setIsBusy(true);
    try {
      const res = await fetch(resolveApiUrl('/api/library/purge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      if (res.ok) {
        setSelectedKeys(new Set());
        if (selectedAsset && keys.includes(selectedAsset.id)) {
          setSelectedAsset(null);
        }
        showToast('Permanently deleted.');
        await fetchVaultData();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleUploadToVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    showToast(`Uploading "${file.name}" into Vault...`);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(resolveApiUrl('/api/library/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Saved "${file.name}" to ${data.studio} vault.`);
        await fetchVaultData();
      } else {
        showToast(data?.error || 'Upload failed.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Vault upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenInStudio = (studio: LibraryStudioKey, rawId: string) => {
    setSelectedAsset(null);
    (window as any).__RAONE_PENDING_ASSET__ = { studio, rawId };
    if (studio === 'vision') onOpenVisionStudio();
    else if (studio === 'cinema') onOpenMotionStudio();
    else if (studio === 'music') onOpenAudioStudio();
    else if (studio === 'document') onOpenDocumentStudio();
    else onOpenAIStudio();
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const created: LibraryFolder = {
      id: `fld-${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
      itemIds: Array.from(selectedKeys),
    };
    setNewFolderName('');
    setIsFolderModalOpen(false);
    await persistFolders([created, ...folders]);
    setNavSection('folders');
    setActiveFolderId(created.id);
    setSelectedKeys(new Set());
    showToast(`Created folder "${trimmed}".`);
  };

  const handleToggleItemInFolder = async (folderId: string, itemId: string) => {
    const next = folders.map((f) => {
      if (f.id !== folderId) return f;
      const exists = f.itemIds.includes(itemId);
      return {
        ...f,
        itemIds: exists ? f.itemIds.filter((i) => i !== itemId) : [...f.itemIds, itemId],
      };
    });
    await persistFolders(next);
  };

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) || null,
    [folders, activeFolderId]
  );

  const visibleAssets = useMemo(() => {
    let list = assets.filter((it) =>
      navSection === 'trash' ? Boolean(it.trashedAt) : !it.trashedAt
    );

    if (
      navSection === 'code' ||
      navSection === 'vision' ||
      navSection === 'cinema' ||
      navSection === 'music' ||
      navSection === 'document'
    ) {
      list = list.filter((it) => it.studio === navSection);
    } else if (navSection === 'starred') {
      list = list.filter((it) => it.isFavorite);
    } else if (navSection === 'folders') {
      if (activeFolder) {
        list = list.filter((it) => activeFolder.itemIds.includes(it.id));
      } else {
        list = [];
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.subtitle.toLowerCase().includes(q) ||
          it.subCategory.toLowerCase().includes(q) ||
          it.model.toLowerCase().includes(q) ||
          it.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortMode === 'title') return a.title.localeCompare(b.title);
      if (sortMode === 'size') return b.fileSizeBytes - a.fileSizeBytes;
      const tA = new Date(a.updatedAt || a.createdAt).getTime() || 0;
      const tB = new Date(b.updatedAt || b.createdAt).getTime() || 0;
      return sortMode === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [assets, navSection, activeFolder, searchQuery, sortMode]);

  const toggleSelectKey = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderStudioIcon = (studio: LibraryStudioKey, cls = 'w-4 h-4') => {
    switch (studio) {
      case 'code':
        return <Code2 className={cls} />;
      case 'vision':
        return <ImageIcon className={cls} />;
      case 'cinema':
        return <Video className={cls} />;
      case 'music':
        return <Music className={cls} />;
      case 'document':
        return <FileText className={cls} />;
    }
  };

  const navGroups: {
    id: VaultNavSection;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: 'all',
      label: 'All Assets',
      icon: <Layers className="w-4 h-4" />,
      count: stats?.activeAssets ?? 0,
    },
    {
      id: 'code',
      label: 'Code & Apps',
      icon: <Code2 className="w-4 h-4" />,
      count: stats?.byStudio.code.count ?? 0,
    },
    {
      id: 'vision',
      label: 'Vision Images',
      icon: <ImageIcon className="w-4 h-4" />,
      count: stats?.byStudio.vision.count ?? 0,
    },
    {
      id: 'cinema',
      label: 'Cinema Videos',
      icon: <Video className="w-4 h-4" />,
      count: stats?.byStudio.cinema.count ?? 0,
    },
    {
      id: 'music',
      label: 'Music & Audio',
      icon: <Music className="w-4 h-4" />,
      count: stats?.byStudio.music.count ?? 0,
    },
    {
      id: 'document',
      label: 'Documents',
      icon: <FileText className="w-4 h-4" />,
      count: stats?.byStudio.document.count ?? 0,
    },
  ];

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full bg-[#0E0F10] text-[#E3E3E3] border-l border-[#222327] select-none relative">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.mp3,.wav,.mp4,.webm"
        onChange={handleUploadToVault}
        className="hidden"
      />

      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] px-3.5 py-1.5 rounded-lg bg-[#252629] border border-[#383A40] text-xs font-medium text-white shadow-xl flex items-center gap-2 pointer-events-none">
          <Check className="w-3.5 h-3.5 text-[#8AB4F8]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="h-14 px-4 sm:px-6 border-b border-[#222327] bg-[#131314] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22]"
              title="Open sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              RaOne Files Library
            </h1>
            <div className="text-[11px] text-[#8E918F] tabular-nums hidden sm:block">
              {stats?.activeAssets || 0} active assets across 5 studios · {formatBytes(stats?.totalBytes || 0)} stored
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="h-8 px-3 rounded-lg bg-[#1A1B1E] border border-[#2C2D30] focus-within:border-[#8AB4F8] flex items-center gap-2 w-40 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8E918F] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, format, tag..."
              className="bg-transparent text-xs text-white placeholder-[#6E7075] focus:outline-none w-full select-text"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#8E918F] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Select */}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="hidden md:block h-8 px-2.5 rounded-lg bg-[#1A1B1E] border border-[#2C2D30] text-xs text-[#E3E3E3] focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="size">Largest Size</option>
            <option value="title">Title A–Z</option>
          </select>

          {/* Grid / List Switcher */}
          <div className="flex items-center bg-[#1A1B1E] border border-[#2C2D30] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded-md ${
                viewMode === 'grid' ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1 rounded-md ${
                viewMode === 'list' ? 'bg-[#2B2D30] text-white' : 'text-[#8E918F] hover:text-white'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Upload to Vault */}
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={isUploading}
            className="h-8 px-3 rounded-lg bg-[#1E1F22] hover:bg-[#28292D] border border-[#323438] text-xs font-medium text-[#E3E3E3] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileUp className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload'}</span>
          </button>

          {/* Create New Studio Dropdown */}
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              onClick={() => setIsNewMenuOpen((p) => !p)}
              className="h-8 px-3 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium inline-flex items-center gap-1"
            >
              <span>New</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isNewMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-[#1A1B1E] border border-[#2F3135] shadow-2xl p-1.5 z-50">
                {[
                  { label: 'New Code / App', studio: 'Code Studio', fn: onOpenAIStudio, icon: Code2 },
                  { label: 'New Image', studio: 'Vision Studio', fn: onOpenVisionStudio, icon: ImageIcon },
                  { label: 'New Video', studio: 'Cinema Studio', fn: onOpenMotionStudio, icon: Video },
                  { label: 'New Music Track', studio: 'Music Studio', fn: onOpenAudioStudio, icon: Music },
                  { label: 'New Document', studio: 'Document Studio', fn: onOpenDocumentStudio, icon: FileText },
                ].map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        entry.fn();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-[#E3E3E3] hover:bg-[#25262B]"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-[#8AB4F8]" />
                        <span>{entry.label}</span>
                      </span>
                    </button>
                  );
                })}
                <div className="my-1 border-t border-[#282A2E]" />
                <button
                  type="button"
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    setIsFolderModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[#E3E3E3] hover:bg-[#25262B]"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#8AB4F8]" />
                  <span>New Folder</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={fetchVaultData}
            className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22]"
            title="Refresh vault"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => openUniversalSettingsAt('files_library')}
            className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22]"
            title="Files Library Governance Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Split: Left Studio Category Rail + Right Content Vault */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Navigation Rail */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[#222327] bg-[#131314] p-3 justify-between overflow-y-auto chat-scroll-area">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-[#8E918F]">
                Studios & Categories
              </div>
              {navGroups.map((item) => {
                const active = navSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setNavSection(item.id);
                      setActiveFolderId(null);
                      setSelectedKeys(new Set());
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#222428] text-white'
                        : 'text-[#B4B7BD] hover:text-white hover:bg-[#1B1C1F]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className={active ? 'text-[#8AB4F8]' : 'text-[#8E918F]'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="text-[11px] text-[#8E918F] tabular-nums">{item.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#222327] space-y-0.5">
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-[#8E918F]">
                Collections
              </div>
              <button
                type="button"
                onClick={() => {
                  setNavSection('starred');
                  setActiveFolderId(null);
                  setSelectedKeys(new Set());
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium ${
                  navSection === 'starred'
                    ? 'bg-[#222428] text-white'
                    : 'text-[#B4B7BD] hover:text-white hover:bg-[#1B1C1F]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4 text-[#8E918F]" />
                  <span>Starred</span>
                </span>
                <span className="text-[11px] text-[#8E918F] tabular-nums">
                  {stats?.favoritesCount ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNavSection('folders');
                  setSelectedKeys(new Set());
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium ${
                  navSection === 'folders'
                    ? 'bg-[#222428] text-white'
                    : 'text-[#B4B7BD] hover:text-white hover:bg-[#1B1C1F]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Folder className="w-4 h-4 text-[#8E918F]" />
                  <span>Folders</span>
                </span>
                <span className="text-[11px] text-[#8E918F] tabular-nums">
                  {folders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNavSection('trash');
                  setActiveFolderId(null);
                  setSelectedKeys(new Set());
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium ${
                  navSection === 'trash'
                    ? 'bg-[#222428] text-white'
                    : 'text-[#B4B7BD] hover:text-white hover:bg-[#1B1C1F]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Trash2 className="w-4 h-4 text-[#8E918F]" />
                  <span>Trash Bin</span>
                </span>
                <span className="text-[11px] text-[#8E918F] tabular-nums">
                  {stats?.trashedAssets ?? 0}
                </span>
              </button>
            </div>
          </div>

          {/* Storage Breakdown Footer Card */}
          <div className="p-3 rounded-xl bg-[#18191C] border border-[#252629] space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs font-medium text-white">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>Vault Storage</span>
              </span>
              <span className="tabular-nums text-[11px] text-[#C4C7C5]">
                {formatBytes(stats?.totalBytes || 0)}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-[#8E918F] tabular-nums">
              <div className="flex justify-between">
                <span>Videos</span>
                <span>{formatBytes(stats?.byStudio.cinema.bytes || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Music & Stems</span>
                <span>{formatBytes(stats?.byStudio.music.bytes || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Images</span>
                <span>{formatBytes(stats?.byStudio.vision.bytes || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Docs & Code</span>
                <span>
                  {formatBytes(
                    (stats?.byStudio.document.bytes || 0) + (stats?.byStudio.code.bytes || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Viewport Stage */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Category Strip */}
          <div className="flex md:hidden items-center gap-1.5 px-4 py-2 border-b border-[#222327] overflow-x-auto no-scrollbar shrink-0 bg-[#131314]">
            {[
              ['all', 'All'],
              ['code', 'Code'],
              ['vision', 'Images'],
              ['cinema', 'Videos'],
              ['music', 'Music'],
              ['document', 'Docs'],
              ['starred', 'Starred'],
              ['folders', 'Folders'],
              ['trash', 'Trash'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setNavSection(id as VaultNavSection);
                  setActiveFolderId(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                  navSection === id
                    ? 'bg-[#2B2D30] text-white'
                    : 'text-[#9AA0A6] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bulk Multi-Select Toolbar */}
          {selectedKeys.size > 0 && (
            <div className="px-5 py-2.5 bg-[#18191C] border-b border-[#282A2E] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-xs font-medium text-white tabular-nums">
                {selectedKeys.size} {selectedKeys.size === 1 ? 'asset' : 'assets'} selected
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {navSection !== 'trash' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleBulkZipDownload}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-40"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Download Bundle (.ZIP)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTrashOrRestore(Array.from(selectedKeys), true)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#252629] hover:bg-red-500/20 text-xs text-[#E3E3E3] hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Move to Trash</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTrashOrRestore(Array.from(selectedKeys), false)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#252629] hover:bg-[#303236] text-xs text-emerald-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurgeForever(Array.from(selectedKeys))}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Forever</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set())}
                  className="px-2.5 py-1 rounded-lg text-xs text-[#9AA0A6] hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Folder Breadcrumb */}
          {navSection === 'folders' && activeFolder && (
            <div className="px-5 py-2 border-b border-[#222327] flex items-center gap-2 text-xs text-[#9AA0A6]">
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className="hover:text-white"
              >
                Folders
              </button>
              <span>/</span>
              <span className="text-white font-medium">{activeFolder.name}</span>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 chat-scroll-area">
            {isLoading && assets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-[#8E918F] gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#8AB4F8]" />
                <span>Indexing files across 5 studios...</span>
              </div>
            ) : navSection === 'folders' && !activeFolder ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#9AA0A6]">
                    {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFolderModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1F22] hover:bg-[#282A2E] border border-[#303236] text-xs font-medium text-white"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#8AB4F8]" />
                    <span>New Folder</span>
                  </button>
                </div>

                {folders.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#8E918F]">
                    Create custom project folders to bundle related code, docs, images, videos, and audio.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {folders.map((fld) => (
                      <div
                        key={fld.id}
                        onClick={() => setActiveFolderId(fld.id)}
                        className="group cursor-pointer p-4 rounded-xl bg-[#161719] border border-[#252629] hover:border-[#3E4046] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[#1E1F22] flex items-center justify-center text-[#8AB4F8] shrink-0">
                            <Folder className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {fld.name}
                            </div>
                            <div className="text-[11px] text-[#8E918F] tabular-nums">
                              {fld.itemIds.length} items
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            persistFolders(folders.filter((x) => x.id !== fld.id));
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#8E918F] hover:text-red-400"
                          title="Delete folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : visibleAssets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-16">
                <div className="w-11 h-11 rounded-xl bg-[#18191C] border border-[#282A2E] flex items-center justify-center text-[#8E918F] mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-medium text-white">
                  {navSection === 'trash' ? 'Trash is empty' : 'No matching assets'}
                </h2>
                <p className="text-xs text-[#8E918F] mt-1 max-w-sm">
                  {navSection === 'trash'
                    ? 'Deleted files stay here so you can restore them anytime.'
                    : 'Generate content in any studio or upload external files directly into your vault.'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleAssets.map((asset) => {
                  const isSelected = selectedKeys.has(asset.id);
                  const menuOpen = openDownloadMenuId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`group cursor-pointer rounded-xl bg-[#161719] border transition-colors flex flex-col ${
                        isSelected
                          ? 'border-[#8AB4F8]'
                          : 'border-[#252629] hover:border-[#3E4046]'
                      }`}
                    >
                      {/* Thumbnail Surface */}
                      <div className="aspect-[16/10] w-full bg-[#0E0F10] relative overflow-hidden rounded-t-xl border-b border-[#222327] flex items-center justify-center">
                        {asset.studio === 'vision' && asset.thumbnailUrl ? (
                          <img
                            src={asset.thumbnailUrl}
                            alt={asset.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : asset.studio === 'cinema' && asset.previewUrl ? (
                          <video
                            src={asset.previewUrl}
                            poster={asset.thumbnailUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#18191C] border border-[#282A2E] flex items-center justify-center text-[#8AB4F8]">
                              {renderStudioIcon(asset.studio, 'w-5 h-5')}
                            </div>
                            <span className="text-[11px] text-[#9AA0A6] capitalize truncate max-w-[180px]">
                              {asset.subCategory}
                            </span>
                          </div>
                        )}

                        {/* Selection Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => toggleSelectKey(asset.id, e)}
                          className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-md border flex items-center justify-center transition-opacity ${
                            isSelected
                              ? 'bg-[#8AB4F8] border-[#8AB4F8] text-[#131314] opacity-100'
                              : 'bg-black/70 border-white/25 text-transparent opacity-0 group-hover:opacity-100'
                          }`}
                          title="Select for batch actions"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        {/* Top Right Favorite & Quick Download */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavorite(asset, e)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center backdrop-blur-sm ${
                              asset.isFavorite
                                ? 'bg-black/75 text-rose-400'
                                : 'bg-black/65 text-[#C4C7C5] opacity-0 group-hover:opacity-100 hover:text-white'
                            }`}
                            title="Favorite"
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${asset.isFavorite ? 'fill-current' : ''}`}
                            />
                          </button>

                          <div
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (asset.downloads.length === 1) {
                                  triggerDownloadUrl(
                                    asset.downloads[0].url,
                                    `${asset.title}.${asset.downloads[0].format}`
                                  );
                                } else {
                                  setOpenDownloadMenuId(menuOpen ? null : asset.id);
                                }
                              }}
                              className="w-7 h-7 rounded-md bg-black/75 text-[#E3E3E3] hover:text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                              title="Download asset"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {menuOpen && asset.downloads.length > 1 && (
                              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[#1A1B1E] border border-[#2F3135] shadow-2xl p-1 z-40">
                                {asset.downloads.map((dl) => (
                                  <button
                                    key={dl.format}
                                    type="button"
                                    onClick={() => {
                                      setOpenDownloadMenuId(null);
                                      triggerDownloadUrl(dl.url, `${asset.title}.${dl.format}`);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-[#E3E3E3] hover:bg-[#282A2E] flex items-center justify-between"
                                  >
                                    <span className="truncate">{dl.label}</span>
                                    <Download className="w-3 h-3 text-[#8AB4F8] shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Body (Zero Pills — clean typographic hierarchy) */}
                      <div className="p-3 space-y-1">
                        <div className="text-xs font-medium text-white truncate">
                          {asset.title}
                        </div>
                        <div className="text-[11px] text-[#8E918F] tabular-nums flex items-center gap-1.5 truncate">
                          <span>{asset.categoryLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{asset.format}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBytes(asset.fileSizeBytes)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDateShort(asset.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Compact Table List View */
              <div className="rounded-xl border border-[#252629] overflow-hidden bg-[#131314]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#18191C] border-b border-[#252629] text-[11px] text-[#8E918F]">
                      <th className="w-9 px-3 py-2.5"></th>
                      <th className="px-3 py-2.5 font-medium">Asset</th>
                      <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Studio</th>
                      <th className="px-3 py-2.5 font-medium hidden md:table-cell">Format</th>
                      <th className="px-3 py-2.5 font-medium hidden md:table-cell">Size</th>
                      <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Updated</th>
                      <th className="px-3 py-2.5 text-right font-medium">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202124]">
                    {visibleAssets.map((asset) => {
                      const isSelected = selectedKeys.has(asset.id);
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className="hover:bg-[#191A1D] cursor-pointer"
                        >
                          <td className="px-3 py-2.5" onClick={(e) => toggleSelectKey(asset.id, e)}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="accent-[#8AB4F8]"
                            />
                          </td>
                          <td className="px-3 py-2.5 max-w-[260px]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[#8AB4F8] shrink-0">
                                {renderStudioIcon(asset.studio, 'w-4 h-4')}
                              </span>
                              <span className="font-medium text-white truncate">{asset.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[#9AA0A6] hidden sm:table-cell whitespace-nowrap">
                            {asset.categoryLabel}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#C4C7C5] hidden md:table-cell whitespace-nowrap">
                            {asset.format}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#9AA0A6] tabular-nums hidden md:table-cell whitespace-nowrap">
                            {formatBytes(asset.fileSizeBytes)}
                          </td>
                          <td className="px-3 py-2.5 text-[#8E918F] tabular-nums hidden lg:table-cell whitespace-nowrap">
                            {formatDateShort(asset.createdAt)}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {asset.downloads[0] && (
                              <button
                                type="button"
                                onClick={() =>
                                  triggerDownloadUrl(
                                    asset.downloads[0].url,
                                    `${asset.title}.${asset.downloads[0].format}`
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1E1F22] hover:bg-[#2A2B2F] text-[11px] text-[#E3E3E3]"
                              >
                                <Download className="w-3 h-3 text-[#8AB4F8]" />
                                <span>{asset.downloads[0].format.toUpperCase()}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#161719] border border-[#2C2D30] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Project Folder</h3>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1 text-[#8E918F] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="e.g., Q4 Client Launch Bundle"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-[#111214] border border-[#2F3135] focus:border-[#8AB4F8] text-xs text-white focus:outline-none select-text"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#9AA0A6] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#E3E3E3] hover:bg-white text-[#131314] text-xs font-medium disabled:opacity-40"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Deep Inspector Modal */}
      {selectedAsset && (
        <LibraryAssetModal
          asset={selectedAsset}
          allAssets={assets}
          folders={folders}
          onClose={() => setSelectedAsset(null)}
          onSelectAsset={(next) => setSelectedAsset(next)}
          onDownload={triggerDownloadUrl}
          onToggleFavorite={(it) => handleToggleFavorite(it)}
          onRenameOrTag={handleRenameOrTag}
          onToggleFolder={handleToggleItemInFolder}
          onTrashOrRestore={handleTrashOrRestore}
          onPurgeForever={handlePurgeForever}
          onOpenInStudio={handleOpenInStudio}
        />
      )}
      {/* Confirm Move to Trash Modal (when enabled in Files Library Governance Settings) */}
      {pendingTrashKeys && (
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#1A1B1E] border border-[#2F3135] p-5 space-y-4">
            <div className="text-sm font-semibold text-white">
              Move {pendingTrashKeys.length} {pendingTrashKeys.length === 1 ? 'item' : 'items'} to Vault Trash?
            </div>
            <p className="text-xs text-[#9AA0A6]">
              You can restore trashed assets anytime from Vault Trash before scheduled purge.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTrashKeys(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#9AA0A6] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const keys = pendingTrashKeys;
                  setPendingTrashKeys(null);
                  await executeTrashOrRestore(keys, true);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
