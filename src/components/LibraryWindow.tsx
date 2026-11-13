import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ListFilter,
  LayoutGrid,
  List,
  Search,
  ChevronDown,
  SlidersHorizontal,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Sparkles,
  FolderPlus,
  Folder,
  Heart,
  Download,
  ExternalLink,
  X,
  Check,
  Trash2,
  RefreshCw,
  PanelLeft,
  Copy,
  FolderInput,
  AlertTriangle,
} from 'lucide-react';
import { resolveApiUrl } from '../utils/api.ts';
import { auth } from '../lib/firebase.ts';

export type LibraryAssetType = 'image' | 'video' | 'audio' | 'document' | 'app';

export interface LibraryItem {
  id: string;
  type: LibraryAssetType;
  title: string;
  subtitle?: string;
  url?: string;
  thumbnailUrl?: string;
  content?: string;
  model?: string;
  createdAt: string;
  isFavorite: boolean;
  raw?: any;
}

export interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
  itemIds: string[];
}

interface LibraryWindowProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onOpenVisionStudio: () => void;
  onOpenMotionStudio: () => void;
  onOpenAudioStudio: () => void;
  onOpenDocumentStudio: () => void;
  onOpenAIStudio: () => void;
}

type LibraryTab = 'Suggested' | 'Favorites' | 'Folders' | 'Images' | 'All';
type SortMode = 'newest' | 'oldest' | 'title';

function getFoldersStorageKey(uid?: string | null): string {
  return `raone_library_folders_v1_${uid || 'guest'}`;
}
function getLocalFavoritesKey(uid?: string | null): string {
  return `raone_library_local_favorites_v1_${uid || 'guest'}`;
}

const TABS: LibraryTab[] = ['Suggested', 'Favorites', 'Folders', 'Images', 'All'];

function formatDateLabel(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTypeLabel(type: LibraryAssetType): string {
  switch (type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Document';
    case 'app':
      return 'App';
  }
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
  const [activeTab, setActiveTab] = useState<LibraryTab>('Suggested');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<LibraryAssetType | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const uid = auth?.currentUser?.uid || null;
  const foldersStorageKey = getFoldersStorageKey(uid);
  const localFavoritesKey = getLocalFavoritesKey(uid);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [folders, setFolders] = useState<LibraryFolder[]>(() => {
    try {
      const saved = localStorage.getItem(foldersStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const foldersHydratedRef = useRef(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const newMenuRef = useRef<HTMLDivElement>(null);
  const startMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Persist folders to UID-scoped localStorage and backend /api/library/folders
  useEffect(() => {
    try {
      localStorage.setItem(foldersStorageKey, JSON.stringify(folders));
    } catch {
      // ignore
    }
    if (!foldersHydratedRef.current) return;
    fetch(resolveApiUrl('/api/library/folders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders }),
    }).catch(() => {});
  }, [folders, foldersStorageKey]);

  // Close popovers on outside click / Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (newMenuRef.current && !newMenuRef.current.contains(target)) setIsNewMenuOpen(false);
      if (startMenuRef.current && !startMenuRef.current.contains(target)) setIsStartMenuOpen(false);
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) setIsFilterMenuOpen(false);
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) setIsSortMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNewMenuOpen(false);
        setIsStartMenuOpen(false);
        setIsFilterMenuOpen(false);
        setIsSortMenuOpen(false);
        if (selectedItem) setSelectedItem(null);
        if (isFolderModalOpen) setIsFolderModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [selectedItem, isFolderModalOpen]);

  const fetchLibraryItems = useCallback(async () => {
    setIsLoading(true);
    setSyncWarning(null);
    let localFavs: Record<string, boolean> = {};
    try {
      const rawFavs = localStorage.getItem(localFavoritesKey);
      if (rawFavs) localFavs = JSON.parse(rawFavs);
    } catch {
      // ignore
    }

    // Hydrate tenant folders from server
    fetch(resolveApiUrl('/api/library/folders'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.folders)) {
          foldersHydratedRef.current = true;
          setFolders(data.folders);
        } else {
          foldersHydratedRef.current = true;
        }
      })
      .catch(() => {
        foldersHydratedRef.current = true;
      });

    const endpoints = [
      { key: 'vision', label: 'Images', url: resolveApiUrl('/api/vision/history') },
      { key: 'motion', label: 'Videos', url: resolveApiUrl('/api/motion/history') },
      { key: 'audio', label: 'Audio', url: resolveApiUrl('/api/audio/history') },
      { key: 'documents', label: 'Documents', url: resolveApiUrl('/api/documents/history') },
      { key: 'apps', label: 'Apps', url: resolveApiUrl('/api/studio/apps') },
    ] as const;

    const results = await Promise.allSettled(
      endpoints.map(async (ep) => {
        const res = await fetch(ep.url);
        if (!res.ok) throw new Error(`${ep.label} (${res.status})`);
        const data = await res.json();
        return { key: ep.key, label: ep.label, data };
      })
    );

    const unified: LibraryItem[] = [];
    const failedSources: string[] = [];

    for (let idx = 0; idx < results.length; idx++) {
      const r = results[idx];
      if (r.status !== 'fulfilled' || !r.value.data) {
        failedSources.push(endpoints[idx].label);
        continue;
      }
      const { key, data } = r.value;
      const rawList = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

      for (const entry of rawList) {
        if (!entry || typeof entry !== 'object') continue;
        if (key === 'vision') {
          unified.push({
            id: `vision:${entry.id || entry.imageUrl || Math.random()}`,
            type: 'image',
            title: entry.prompt || entry.title || 'Generated Image',
            subtitle: entry.style || entry.aspectRatio || 'Vision Studio',
            url: entry.imageUrl,
            thumbnailUrl: entry.imageUrl,
            model: entry.model || 'Vision Diffusion',
            createdAt: entry.createdAt || new Date().toISOString(),
            isFavorite: Boolean(entry.isFavorite),
            raw: entry,
          });
        } else if (key === 'motion') {
          unified.push({
            id: `motion:${entry.id || entry.videoUrl || Math.random()}`,
            type: 'video',
            title: entry.prompt || entry.title || 'Generated Video',
            subtitle: entry.cameraMotion || entry.aspectRatio || 'Cinema Studio',
            url: entry.videoUrl,
            thumbnailUrl: entry.thumbnailUrl || entry.coverUrl,
            model: entry.model || 'Cinema Motion',
            createdAt: entry.createdAt || new Date().toISOString(),
            isFavorite: Boolean(entry.isFavorite),
            raw: entry,
          });
        } else if (key === 'audio') {
          unified.push({
            id: `audio:${entry.id || entry.audioUrl || Math.random()}`,
            type: 'audio',
            title: entry.title || entry.prompt || 'Generated Track',
            subtitle: entry.style || entry.genre || 'Suno Audio',
            url: entry.audioUrl,
            thumbnailUrl: entry.coverUrl || entry.imageUrl,
            content: entry.lyrics,
            model: entry.model || 'Audio Engine',
            createdAt: entry.createdAt || new Date().toISOString(),
            isFavorite: Boolean(entry.isFavorite),
            raw: entry,
          });
        } else if (key === 'documents') {
          unified.push({
            id: `doc:${entry.id || entry.title || Math.random()}`,
            type: 'document',
            title: entry.title || entry.prompt || 'Generated Document',
            subtitle: entry.docType || entry.tone || 'DocuStudio',
            content: entry.content || entry.summary,
            model: entry.model || 'Document AI',
            createdAt: entry.createdAt || new Date().toISOString(),
            isFavorite: Boolean(entry.isFavorite),
            raw: entry,
          });
        } else if (key === 'apps') {
          const itemId = `app:${entry.id || entry.title || Math.random()}`;
          unified.push({
            id: itemId,
            type: 'app',
            title: entry.title || 'Studio App',
            subtitle: entry.description || entry.framework || 'RaOne Studio',
            content: entry.code || entry.prompt,
            model: entry.model || 'App Builder',
            createdAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
            isFavorite: Boolean(localFavs[itemId]),
            raw: entry,
          });
        }
      }
    }

    if (failedSources.length > 0) {
      setSyncWarning(`Some asset feeds could not sync: ${failedSources.join(', ')}`);
    }
    setItems(unified);
    setIsLoading(false);
  }, [localFavoritesKey]);

  useEffect(() => {
    fetchLibraryItems();
  }, [fetchLibraryItems]);

  const handleToggleFavorite = async (item: LibraryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextFav = !item.isFavorite;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isFavorite: nextFav } : it)));
    if (selectedItem?.id === item.id) {
      setSelectedItem({ ...item, isFavorite: nextFav });
    }

    const rawId = item.raw?.id;
    const endpointMap: Record<LibraryAssetType, string | null> = {
      image: '/api/vision/favorite',
      video: '/api/motion/favorite',
      audio: '/api/audio/favorite',
      document: '/api/documents/favorite',
      app: null,
    };

    const ep = endpointMap[item.type];
    if (ep && rawId) {
      fetch(resolveApiUrl(ep), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rawId }),
      }).catch(() => {});
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem(localFavoritesKey) || '{}');
        stored[item.id] = nextFav;
        localStorage.setItem(localFavoritesKey, JSON.stringify(stored));
      } catch {
        // ignore
      }
    }
  };

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const created: LibraryFolder = {
      id: `fld-${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
      itemIds: [],
    };
    setFolders((prev) => [created, ...prev]);
    setNewFolderName('');
    setIsFolderModalOpen(false);
    setActiveTab('Folders');
    setActiveFolderId(created.id);
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolderId === folderId) setActiveFolderId(null);
  };

  const handleToggleItemInFolder = (folderId: string, itemId: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const exists = f.itemIds.includes(itemId);
        return {
          ...f,
          itemIds: exists ? f.itemIds.filter((id) => id !== itemId) : [...f.itemIds, itemId],
        };
      })
    );
  };

  const handleOpenStudioForType = (type: LibraryAssetType) => {
    setSelectedItem(null);
    if (type === 'image') onOpenVisionStudio();
    else if (type === 'video') onOpenMotionStudio();
    else if (type === 'audio') onOpenAudioStudio();
    else if (type === 'document') onOpenDocumentStudio();
    else onOpenAIStudio();
  };

  const handleCopyPrompt = (item: LibraryItem) => {
    const text = item.title || item.content || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) || null,
    [folders, activeFolderId]
  );

  const visibleItems = useMemo(() => {
    let list = [...items];

    if (activeTab === 'Favorites') {
      list = list.filter((it) => it.isFavorite);
    } else if (activeTab === 'Images') {
      list = list.filter((it) => it.type === 'image');
    } else if (activeTab === 'Folders') {
      if (activeFolder) {
        list = list.filter((it) => activeFolder.itemIds.includes(it.id));
      } else {
        list = [];
      }
    }

    if (typeFilter !== 'all') {
      list = list.filter((it) => it.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          (it.subtitle || '').toLowerCase().includes(q) ||
          (it.model || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortMode === 'title') return a.title.localeCompare(b.title);
      const tA = new Date(a.createdAt).getTime() || 0;
      const tB = new Date(b.createdAt).getTime() || 0;
      return sortMode === 'newest' ? tB - tA : tA - tB;
    });

    if (activeTab === 'Suggested' && !searchQuery.trim() && typeFilter === 'all') {
      return list.slice(0, 12);
    }

    return list;
  }, [items, activeTab, activeFolder, typeFilter, searchQuery, sortMode]);

  const creationMenuItems = [
    {
      label: 'Create image',
      desc: 'Vision Studio',
      icon: ImageIcon,
      onClick: () => {
        setIsNewMenuOpen(false);
        setIsStartMenuOpen(false);
        onOpenVisionStudio();
      },
    },
    {
      label: 'Create video',
      desc: 'Cinema Studio',
      icon: Video,
      onClick: () => {
        setIsNewMenuOpen(false);
        setIsStartMenuOpen(false);
        onOpenMotionStudio();
      },
    },
    {
      label: 'Create audio',
      desc: 'RaOne Suno Audio',
      icon: Music,
      onClick: () => {
        setIsNewMenuOpen(false);
        setIsStartMenuOpen(false);
        onOpenAudioStudio();
      },
    },
    {
      label: 'Create document',
      desc: 'DocuStudio',
      icon: FileText,
      onClick: () => {
        setIsNewMenuOpen(false);
        setIsStartMenuOpen(false);
        onOpenDocumentStudio();
      },
    },
    {
      label: 'Build app',
      desc: 'RaOne Studio',
      icon: Sparkles,
      onClick: () => {
        setIsNewMenuOpen(false);
        setIsStartMenuOpen(false);
        onOpenAIStudio();
      },
    },
  ];

  const renderCreationDropdown = (align: 'right' | 'center') => (
    <div
      className={`absolute ${
        align === 'right' ? 'right-0 top-full mt-2' : 'left-1/2 -translate-x-1/2 top-full mt-2'
      } w-56 rounded-2xl bg-[#1f1f1f] border border-[#2f2f2f] shadow-2xl p-1.5 z-50 text-left`}
    >
      {creationMenuItems.map((entry) => {
        const Icon = entry.icon;
        return (
          <button
            key={entry.label}
            onClick={entry.onClick}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-[#b4b4b4] shrink-0" />
              <span className="font-medium whitespace-nowrap">{entry.label}</span>
            </span>
            <span className="text-[11px] text-[#7a7a7a] whitespace-nowrap">{entry.desc}</span>
          </button>
        );
      })}
      <div className="my-1 border-t border-[#2d2d2d]" />
      <button
        onClick={() => {
          setIsNewMenuOpen(false);
          setIsStartMenuOpen(false);
          setIsFolderModalOpen(true);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
      >
        <FolderPlus className="w-4 h-4 text-[#b4b4b4] shrink-0" />
        <span className="font-medium whitespace-nowrap">New folder</span>
      </button>
    </div>
  );

  const renderAssetIcon = (type: LibraryAssetType, className = 'w-5 h-5') => {
    switch (type) {
      case 'image':
        return <ImageIcon className={className} />;
      case 'video':
        return <Video className={className} />;
      case 'audio':
        return <Music className={className} />;
      case 'document':
        return <FileText className={className} />;
      case 'app':
        return <Sparkles className={className} />;
    }
  };

  const showFoldersGrid = activeTab === 'Folders' && !activeFolder && folders.length > 0;
  const showEmptyState =
    !isLoading &&
    !showFoldersGrid &&
    visibleItems.length === 0;

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full bg-[#000000] text-[#ECECEC] border-l border-[#1c1c1c]/80 select-none">
      {/* Top Header Bar (Exact match to ChatGPT Library SS) */}
      <header className="px-5 sm:px-8 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          {!isSidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              title="Open sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-[19px] sm:text-[20px] font-semibold text-white tracking-tight">
            Library
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Type Filter Icon */}
          <div className="relative" ref={filterMenuRef}>
            <button
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                typeFilter !== 'all'
                  ? 'bg-[#242424] text-white'
                  : 'text-[#9A9A9A] hover:text-white hover:bg-[#1a1a1a]'
              }`}
              title="Filter by media type"
            >
              <ListFilter className="w-4 h-4" />
            </button>
            {isFilterMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-[#1f1f1f] border border-[#2f2f2f] shadow-2xl p-1.5 z-50">
                {(
                  [
                    { id: 'all', label: 'All types' },
                    { id: 'image', label: 'Images' },
                    { id: 'video', label: 'Videos' },
                    { id: 'audio', label: 'Audio' },
                    { id: 'document', label: 'Documents' },
                    { id: 'app', label: 'Apps' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setTypeFilter(opt.id);
                      setIsFilterMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                  >
                    <span>{opt.label}</span>
                    {typeFilter === opt.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grid / List View Switcher */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#242424] text-white'
                  : 'text-[#9A9A9A] hover:text-white hover:bg-[#1a1a1a]'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#242424] text-white'
                  : 'text-[#9A9A9A] hover:text-white hover:bg-[#1a1a1a]'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Search Pill Input */}
          <div className="h-9 px-3.5 rounded-full bg-transparent border border-[#2a2a2a] focus-within:border-[#4c4c4c] flex items-center gap-2 w-40 sm:w-56 transition-colors">
            <Search className="w-3.5 h-3.5 text-[#9A9A9A] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library"
              className="bg-transparent text-[13px] text-white placeholder-[#9A9A9A] focus:outline-none w-full min-w-0 select-text"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#8e8e8e] hover:text-white"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* White Pill "New v" Dropdown */}
          <div className="relative" ref={newMenuRef}>
            <button
              onClick={() => setIsNewMenuOpen((prev) => !prev)}
              className="h-9 px-4 rounded-full bg-white text-black hover:bg-[#e5e5e5] text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>New</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {isNewMenuOpen && renderCreationDropdown('right')}
          </div>

          {/* Sliders / Sort Preferences Icon */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setIsSortMenuOpen((prev) => !prev)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9A9A9A] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              title="Display & sort options"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {isSortMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#1f1f1f] border border-[#2f2f2f] shadow-2xl p-1.5 z-50">
                <div className="px-3 py-1 text-[11px] font-medium text-[#7a7a7a]">Sort by</div>
                {(
                  [
                    { id: 'newest', label: 'Newest first' },
                    { id: 'oldest', label: 'Oldest first' },
                    { id: 'title', label: 'Title (A–Z)' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSortMode(s.id);
                      setIsSortMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                  >
                    <span>{s.label}</span>
                    {sortMode === s.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
                <div className="my-1 border-t border-[#2d2d2d]" />
                <button
                  onClick={() => {
                    setIsSortMenuOpen(false);
                    fetchLibraryItems();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#9A9A9A]" />
                  <span>Refresh library</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Filter Tabs Row (Suggested, Favorites, Folders, Images, All) */}
      <nav className="px-5 sm:px-8 pt-1 pb-4 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab !== 'Folders') setActiveFolderId(null);
              }}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#212121] text-white'
                  : 'text-[#9A9A9A] hover:text-white hover:bg-[#141414]'
              }`}
            >
              {tab}
            </button>
          );
        })}

        {activeTab === 'Folders' && activeFolder && (
          <div className="ml-2 flex items-center gap-2 text-[13px] text-[#9A9A9A]">
            <span>/</span>
            <button
              onClick={() => setActiveFolderId(null)}
              className="hover:text-white transition-colors"
            >
              Folders
            </button>
            <span>/</span>
            <span className="text-white font-medium">{activeFolder.name}</span>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 pb-8 chat-scroll-area flex flex-col">
        {syncWarning && (
          <div className="mb-4 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 shrink-0">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{syncWarning}</span>
            </span>
            <button
              onClick={() => setSyncWarning(null)}
              className="text-amber-200 hover:text-white"
              title="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8e8e8e] text-sm gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#9A9A9A]" />
            <span>Loading library...</span>
          </div>
        ) : showFoldersGrid ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-[#8e8e8e]">
                {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
              </span>
              <button
                onClick={() => setIsFolderModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-[#1d1d1d] hover:bg-[#2a2a2a] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New folder</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  className="group cursor-pointer p-4 rounded-2xl bg-[#111111] border border-[#242424] hover:border-[#3d3d3d] hover:bg-[#161616] transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#1d1d1d] flex items-center justify-center text-[#d4d4d4] shrink-0">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{folder.name}</div>
                      <div className="text-xs text-[#8e8e8e] tabular-nums">
                        {folder.itemIds.length} {folder.itemIds.length === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#8e8e8e] hover:text-red-400 hover:bg-[#242424] transition-all"
                    title="Delete folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : showEmptyState ? (
          /* Exact Centered Empty State matching ChatGPT Library Screenshot */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pb-16">
            {/* Layered Photo Cards SVG Icon */}
            <svg
              className="w-8 h-8 text-[#d4d4d4]"
              viewBox="0 0 28 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                x="4"
                y="6"
                width="14"
                height="14"
                rx="3"
                transform="rotate(-8 4 6)"
                className="opacity-60"
              />
              <rect x="9" y="8" width="15" height="15" rx="3" fill="#000000" />
              <circle cx="14" cy="13" r="1.4" fill="currentColor" stroke="none" />
              <path d="M10.5 20.5l4.2-4.2a1.2 1.2 0 0 1 1.7 0l1.6 1.6 2-2a1.2 1.2 0 0 1 1.7 0l2.3 2.3" />
            </svg>

            <h2 className="mt-4 text-[18px] sm:text-[19px] font-semibold text-white tracking-tight">
              Create something new
            </h2>
            <p className="mt-1.5 text-[13px] sm:text-[14px] text-[#9A9A9A] max-w-md">
              Things you make with RaOne AI, like images and documents, will appear here
            </p>

            <div className="relative mt-5" ref={startMenuRef}>
              <button
                onClick={() => setIsStartMenuOpen((prev) => !prev)}
                className="h-9 px-4 rounded-full bg-white text-black hover:bg-[#e5e5e5] text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Start creating</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {isStartMenuOpen && renderCreationDropdown('center')}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group cursor-pointer rounded-2xl bg-[#111111] border border-[#242424] hover:border-[#3c3c3c] overflow-hidden flex flex-col transition-colors"
              >
                <div className="aspect-[4/3] w-full bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center border-b border-[#1f1f1f]">
                  {item.type === 'image' && item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : item.type === 'video' && item.url ? (
                    <video
                      src={item.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-[#8e8e8e] px-4 text-center">
                      <div className="w-11 h-11 rounded-2xl bg-[#181818] border border-[#2a2a2a] flex items-center justify-center text-[#d4d4d4]">
                        {renderAssetIcon(item.type, 'w-5 h-5')}
                      </div>
                      <span className="text-[11px] font-medium text-[#7a7a7a] line-clamp-2">
                        {item.subtitle || getTypeLabel(item.type)}
                      </span>
                    </div>
                  )}

                  {/* Top corner controls */}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-[#e5e5e5] whitespace-nowrap">
                    {getTypeLabel(item.type)}
                  </div>
                  <button
                    onClick={(e) => handleToggleFavorite(item, e)}
                    className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
                      item.isFavorite
                        ? 'bg-black/80 text-rose-400'
                        : 'bg-black/60 text-[#b4b4b4] opacity-0 group-hover:opacity-100 hover:text-white'
                    }`}
                    title={item.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="p-3.5 flex flex-col gap-1">
                  <div className="text-[13px] font-medium text-white line-clamp-1">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#8e8e8e]">
                    <span className="truncate">{item.model || item.subtitle}</span>
                    <span className="shrink-0 tabular-nums ml-2">{formatDateLabel(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col divide-y divide-[#1e1e1e] border border-[#242424] rounded-2xl overflow-hidden bg-[#0a0a0a]">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group cursor-pointer px-4 py-3 hover:bg-[#141414] transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#181818] border border-[#282828] overflow-hidden flex items-center justify-center shrink-0 text-[#c4c4c4]">
                    {item.type === 'image' && item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      renderAssetIcon(item.type, 'w-5 h-5')
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-white truncate">{item.title}</div>
                    <div className="text-xs text-[#8e8e8e] truncate">
                      {getTypeLabel(item.type)} · {item.model || item.subtitle || 'RaOne AI'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-[#8e8e8e] tabular-nums hidden sm:inline">
                    {formatDateLabel(item.createdAt)}
                  </span>
                  <button
                    onClick={(e) => handleToggleFavorite(item, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.isFavorite ? 'text-rose-400' : 'text-[#8e8e8e] hover:text-white'
                    }`}
                    title={item.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#171717] border border-[#2e2e2e] p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">New folder</h3>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1 rounded-lg text-[#8e8e8e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
              }}
              placeholder="Folder name..."
              autoFocus
              className="w-full px-3.5 py-2 rounded-xl bg-[#0e0e0e] border border-[#2f2f2f] focus:border-white/40 text-sm text-white placeholder-[#7a7a7a] focus:outline-none select-text"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="px-4 py-1.5 rounded-full text-xs font-medium text-[#b4b4b4] hover:text-white hover:bg-[#242424] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-white text-black hover:bg-[#e5e5e5] disabled:opacity-40 transition-colors"
              >
                Create folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Preview Lightbox Modal */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-[#141414] border border-[#2c2c2c] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            <div className="px-5 py-3.5 border-b border-[#242424] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2.5 py-0.5 rounded-full bg-[#242424] text-[11px] font-medium text-white shrink-0">
                  {getTypeLabel(selectedItem.type)}
                </span>
                <h3 className="text-sm font-semibold text-white truncate">{selectedItem.title}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-[#242424] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {selectedItem.type === 'image' && selectedItem.url && (
                <div className="rounded-xl overflow-hidden bg-black border border-[#242424] flex items-center justify-center">
                  <img
                    src={selectedItem.url}
                    alt={selectedItem.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[46vh] w-auto object-contain"
                  />
                </div>
              )}

              {selectedItem.type === 'video' && selectedItem.url && (
                <div className="rounded-xl overflow-hidden bg-black border border-[#242424]">
                  <video
                    src={selectedItem.url}
                    controls
                    autoPlay
                    className="w-full max-h-[46vh]"
                  />
                </div>
              )}

              {selectedItem.type === 'audio' && selectedItem.url && (
                <div className="p-4 rounded-xl bg-[#0b0b0b] border border-[#242424] space-y-3">
                  <audio src={selectedItem.url} controls className="w-full" />
                  {selectedItem.content && (
                    <pre className="text-xs text-[#b4b4b4] whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                      {selectedItem.content}
                    </pre>
                  )}
                </div>
              )}

              {(selectedItem.type === 'document' || selectedItem.type === 'app') && selectedItem.content && (
                <div className="p-4 rounded-xl bg-[#0b0b0b] border border-[#242424] max-h-64 overflow-y-auto">
                  <pre className="text-xs text-[#d4d4d4] whitespace-pre-wrap font-mono select-text">
                    {selectedItem.content}
                  </pre>
                </div>
              )}

              {/* Assign to Folder */}
              {folders.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#8e8e8e] mb-2">
                    <FolderInput className="w-3.5 h-3.5" />
                    <span>Add to folder</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {folders.map((fld) => {
                      const inFolder = fld.itemIds.includes(selectedItem.id);
                      return (
                        <button
                          key={fld.id}
                          onClick={() => handleToggleItemInFolder(fld.id, selectedItem.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-colors ${
                            inFolder
                              ? 'bg-white text-black border-white'
                              : 'bg-[#1b1b1b] text-[#d4d4d4] border-[#2e2e2e] hover:border-[#4c4c4c]'
                          }`}
                        >
                          <Folder className="w-3 h-3" />
                          <span>{fld.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-[#242424] flex flex-wrap items-center justify-between gap-2 bg-[#101010]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedItem)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-colors ${
                    selectedItem.isFavorite
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      : 'bg-[#1c1c1c] border-[#2e2e2e] text-[#e0e0e0] hover:bg-[#252525]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${selectedItem.isFavorite ? 'fill-current' : ''}`} />
                  <span>{selectedItem.isFavorite ? 'Favorited' : 'Favorite'}</span>
                </button>
                <button
                  onClick={() => handleCopyPrompt(selectedItem)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1c1c1c] border border-[#2e2e2e] text-[#e0e0e0] hover:bg-[#252525] inline-flex items-center gap-1.5 transition-colors"
                >
                  {copiedId === selectedItem.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy title</span>
                    </>
                  )}
                </button>
                {selectedItem.url && (
                  <a
                    href={selectedItem.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1c1c1c] border border-[#2e2e2e] text-[#e0e0e0] hover:bg-[#252525] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
              </div>

              <button
                onClick={() => handleOpenStudioForType(selectedItem.type)}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-white text-black hover:bg-[#e5e5e5] inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Open Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
