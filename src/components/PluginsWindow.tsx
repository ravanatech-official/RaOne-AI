import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  PanelLeft,
  Plus,
  Bookmark,
  CheckCircle2,
  PlugZap,
  ShieldCheck,
  Code2,
  Cpu,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Terminal,
  RefreshCw,
  Layers,
  Power,
  ExternalLink,
  AlertCircle,
  Sliders,
} from 'lucide-react';
import { resolveApiUrl } from '../utils/api.ts';
import { openUniversalSettingsAt } from '../utils/settingsClient.ts';
import {
  PLUGIN_STUDIO_LABELS,
  type PluginCategory,
  type PluginLibraryStats,
  type PluginPublicView,
  type PluginStudioScope,
} from '../types/plugins.ts';
import { PluginConfigModal } from './PluginConfigModal.tsx';

interface PluginsWindowProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  initialOpenCustomBuilder?: boolean;
  onConsumeInitialBuilder?: () => void;
}

type PluginsNavSection =
  | 'all'
  | 'connected'
  | 'bookmarked'
  | PluginCategory;

const CATEGORY_NAV: Array<{
  id: PluginsNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'All Connectors', icon: Layers },
  { id: 'connected', label: 'Connected Active', icon: CheckCircle2 },
  { id: 'bookmarked', label: 'Connect Later', icon: Bookmark },
  { id: 'code', label: 'Code & Cloud', icon: Code2 },
  { id: 'ai_models', label: 'AI Model Engines', icon: Cpu },
  { id: 'vision', label: 'Vision & Design', icon: ImageIcon },
  { id: 'cinema', label: 'Cinema & Video', icon: Video },
  { id: 'music', label: 'Music & Audio', icon: Music },
  { id: 'document', label: 'Docs & Comms', icon: FileText },
  { id: 'custom', label: 'Custom & MCP', icon: Terminal },
];

const STUDIO_FILTERS: Array<{ id: 'all' | PluginStudioScope; label: string }> = [
  { id: 'all', label: 'All Studios' },
  { id: 'code', label: 'Code' },
  { id: 'vision', label: 'Vision' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'music', label: 'Music' },
  { id: 'document', label: 'Documents' },
];

export const PluginsWindow: React.FC<PluginsWindowProps> = ({
  isSidebarOpen,
  onOpenSidebar,
  initialOpenCustomBuilder,
  onConsumeInitialBuilder,
}) => {
  const [plugins, setPlugins] = useState<PluginPublicView[]>([]);
  const [stats, setStats] = useState<PluginLibraryStats | null>(null);
  const [navSection, setNavSection] = useState<PluginsNavSection>('all');
  const [studioFilter, setStudioFilter] = useState<'all' | PluginStudioScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activePlugin, setActivePlugin] = useState<PluginPublicView | null>(null);
  const [isCustomCreatorOpen, setIsCustomCreatorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const fetchPlugins = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(resolveApiUrl('/api/plugins'));
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && Array.isArray(json.plugins)) {
        setPlugins(json.plugins);
        if (json.stats) setStats(json.stats);
      }
    } catch {
      showToast('Failed to load RaOne Plugins Vault.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  useEffect(() => {
    if (initialOpenCustomBuilder) {
      setActivePlugin(null);
      setIsCustomCreatorOpen(true);
      onConsumeInitialBuilder?.();
    }
  }, [initialOpenCustomBuilder, onConsumeInitialBuilder]);

  const handlePluginUpdated = (updated: PluginPublicView) => {
    setPlugins((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
      return next;
    });
    // Refresh stats cleanly from server
    void fetchPlugins();
    showToast(`${updated.name} vault state updated.`);
  };

  const handleDeletedCustom = (pluginId: string) => {
    setPlugins((prev) => prev.filter((p) => p.id !== pluginId));
    void fetchPlugins();
    showToast('Custom plugin removed.');
  };

  const handleQuickToggleEnabled = async (plugin: PluginPublicView, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!plugin.isConnected) {
      setActivePlugin(plugin);
      return;
    }
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/toggle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id, enabled: !plugin.enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.plugin) {
        handlePluginUpdated(json.plugin);
      }
    } catch {
      showToast(`Failed to toggle ${plugin.name}.`);
    }
  };

  const handleQuickBookmark = async (plugin: PluginPublicView, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/bookmark'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id, bookmarked: !plugin.bookmarked }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.plugin) {
        handlePluginUpdated(json.plugin);
      }
    } catch {
      showToast('Failed to update bookmark.');
    }
  };

  const handleQuickTest = async (plugin: PluginPublicView, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingId(plugin.id);
    try {
      const res = await fetch(resolveApiUrl('/api/plugins/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          json.ok
            ? `${plugin.name} verified (${json.latencyMs}ms)`
            : `${plugin.name}: ${json.message}`
        );
        await fetchPlugins();
      }
    } finally {
      setTestingId(null);
    }
  };

  const filteredPlugins = useMemo(() => {
    let list = plugins;
    if (navSection === 'connected') {
      list = list.filter((p) => p.isConnected);
    } else if (navSection === 'bookmarked') {
      list = list.filter((p) => p.bookmarked);
    } else if (navSection !== 'all') {
      list = list.filter((p) => p.category === navSection);
    }

    if (studioFilter !== 'all') {
      list = list.filter((p) => p.studios.includes(studioFilter));
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.provider.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.shortTag.toLowerCase().includes(q) ||
          p.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    }
    return list;
  }, [plugins, navSection, studioFilter, searchQuery]);

  const countForNav = (id: PluginsNavSection): number => {
    if (!stats) return 0;
    if (id === 'all') return stats.total;
    if (id === 'connected') return stats.connected;
    if (id === 'bookmarked') return stats.bookmarked;
    return stats.byCategory[id] || 0;
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full bg-[#0E0F10] text-[#E3E3E3] overflow-hidden relative">
      {/* Top Header Bar */}
      <header className="h-14 px-3 sm:px-6 pt-safe border-b border-[#252629] bg-[#131314] flex items-center justify-between gap-2 sm:gap-4 shrink-0 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {!isSidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="p-2 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#1E1F22] transition-colors shrink-0"
              title="Open sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <img
            src="/assets/aistudio/RaOne_Plugins_4adb9c36.png"
            alt="RaOne Plugins"
            className="w-6 h-6 object-contain rounded shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">RaOne Plugins Library</h1>
            <p className="text-[11px] text-[#9AA0A6] truncate tabular-nums">
              {stats
                ? `${stats.connected} connected · ${stats.enabled} active · ${stats.bookmarked} bookmarked · ${stats.total} integrations`
                : 'Loading encrypted connector vault...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden md:block w-64">
            <Search className="w-3.5 h-3.5 text-[#9AA0A6] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plugins, models, APIs..."
              className="w-full bg-[#0E0F10] border border-[#252629] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#5F6368] focus:outline-none focus:border-[#8AB4F8]"
            />
          </div>

          <button
            onClick={fetchPlugins}
            className="p-2 rounded-lg border border-[#252629] bg-[#161719] hover:bg-[#1E1F22] text-[#9AA0A6] hover:text-white transition-colors"
            title="Refresh connectors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => openUniversalSettingsAt('plugins_library')}
            className="p-2 rounded-lg border border-[#252629] bg-[#161719] hover:bg-[#1E1F22] text-[#9AA0A6] hover:text-white transition-colors"
            title="Plugins Library Security & Webhook Policies"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setActivePlugin(null);
              setIsCustomCreatorOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Custom Plugin</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace: Left Category Rail + Right Connector Grid */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Category Rail */}
        <aside className="hidden lg:flex w-64 border-r border-[#252629] bg-[#131314] flex-col justify-between p-3 overflow-y-auto chat-scroll-area shrink-0">
          <nav className="space-y-1">
            {CATEGORY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = navSection === item.id;
              const count = countForNav(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setNavSection(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-[#1E1F22] text-white font-medium border border-[#2C2E33]'
                      : 'text-[#9AA0A6] hover:text-white hover:bg-[#161719] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#8AB4F8]' : ''}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums opacity-75">{count}</span>
                </button>
              );
            })}
          </nav>

          {/* Encrypted Vault Architecture Status Card */}
          <div className="mt-4 p-3 rounded-xl bg-[#0E0F10] border border-[#252629] space-y-2 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Encrypted Tenant Vault</span>
            </div>
            <p className="text-[#9AA0A6] leading-relaxed">
              API tokens are encrypted with AES-256-GCM before storage and masked across all API responses.
            </p>
            {stats && (
              <div className="pt-2 border-t border-[#252629] grid grid-cols-2 gap-1 font-mono text-[10px] text-[#9AA0A6] tabular-nums">
                <div>Code: {stats.byStudio.code.connected}/{stats.byStudio.code.total}</div>
                <div>Vision: {stats.byStudio.vision.connected}/{stats.byStudio.vision.total}</div>
                <div>Cinema: {stats.byStudio.cinema.connected}/{stats.byStudio.cinema.total}</div>
                <div>Music: {stats.byStudio.music.connected}/{stats.byStudio.music.total}</div>
                <div>Docs: {stats.byStudio.document.connected}/{stats.byStudio.document.total}</div>
                <div>Custom: {stats.customCount}</div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Connector Grid & Filters */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Studio Compatibility Filter Bar + Mobile Search */}
          <div className="px-4 sm:px-6 py-3 border-b border-[#252629] bg-[#0E0F10] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {STUDIO_FILTERS.map((sf) => {
                const active = studioFilter === sf.id;
                return (
                  <button
                    key={sf.id}
                    onClick={() => setStudioFilter(sf.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                      active
                        ? 'bg-[#1E1F22] border-[#8AB4F8] text-white'
                        : 'bg-[#131314] border-[#252629] text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    {sf.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Category Dropdown */}
            <div className="flex lg:hidden items-center gap-2 w-full sm:w-auto">
              <select
                value={navSection}
                onChange={(e) => setNavSection(e.target.value as PluginsNavSection)}
                className="bg-[#131314] border border-[#252629] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {CATEGORY_NAV.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({countForNav(c.id)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 sm:w-44 bg-[#131314] border border-[#252629] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Grid Stage */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 chat-scroll-area">
            {isLoading && plugins.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-44 rounded-xl bg-[#131314] border border-[#252629] animate-pulse"
                  />
                ))}
              </div>
            ) : filteredPlugins.length === 0 ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6">
                <PlugZap className="w-8 h-8 text-[#5F6368] mb-3" />
                <div className="text-sm font-medium text-white">No plugins match your current filter</div>
                <p className="text-xs text-[#9AA0A6] mt-1 max-w-md">
                  Try switching categories, clearing your search query, or register your own custom REST / MCP integration.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPlugins.map((plugin) => {
                  const firstMasked = Object.values(plugin.maskedFields || {})[0];
                  const firstPublic = Object.values(plugin.publicFields || {})[0];
                  const studioSummary = plugin.studios
                    .map((s) => PLUGIN_STUDIO_LABELS[s].replace(' Studio', ''))
                    .join(' · ');

                  return (
                    <div
                      key={plugin.id}
                      onClick={() => {
                        setIsCustomCreatorOpen(false);
                        setActivePlugin(plugin);
                      }}
                      className={`group rounded-xl border p-4 bg-[#131314] hover:bg-[#161719] transition-colors cursor-pointer flex flex-col justify-between gap-4 ${
                        plugin.isConnected && plugin.enabled
                          ? 'border-emerald-700/50'
                          : 'border-[#252629] hover:border-[#383A40]'
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Title & Action Icons */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white truncate">
                                {plugin.name}
                              </h3>
                            </div>
                            <div className="text-[11px] text-[#9AA0A6] truncate mt-0.5">
                              {plugin.provider} · {plugin.shortTag}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleQuickBookmark(plugin, e)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                plugin.bookmarked
                                  ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                                  : 'border-transparent text-[#5F6368] hover:text-white hover:bg-[#1E1F22]'
                              }`}
                              title={plugin.bookmarked ? 'Remove bookmark' : 'Bookmark to connect later'}
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>

                            {plugin.isConnected && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickToggleEnabled(plugin, e)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  plugin.enabled
                                    ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300'
                                    : 'border-[#252629] bg-[#161719] text-[#9AA0A6] hover:text-white'
                                }`}
                                title={plugin.enabled ? 'Disable plugin temporarily' : 'Enable plugin'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-[#C4C7C5] line-clamp-2 leading-relaxed">
                          {plugin.description}
                        </p>

                        {/* Studio Scope & Capabilities Metadata (Clean dot-separated typography) */}
                        <div className="text-[11px] text-[#9AA0A6] font-mono truncate">
                          Studios: {studioSummary}
                        </div>

                        {/* Stored Masked Credential or Verified Latency Line */}
                        {(plugin.isConnected || plugin.lastTestMessage) && (
                          <div className="pt-2 border-t border-[#252629] text-[11px] space-y-1">
                            {plugin.isConnected && (firstMasked || firstPublic) && (
                              <div className="font-mono text-[#C4C7C5] truncate">
                                Vault: {firstMasked || firstPublic}
                                {plugin.source === 'byok' ? ' · BYOK synced' : ''}
                              </div>
                            )}
                            {plugin.lastTestMessage && (
                              <div
                                className={`flex items-center gap-1.5 truncate ${
                                  plugin.lastTestOk ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {plugin.lastTestOk ? (
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                )}
                                <span className="truncate">
                                  {plugin.verifiedAccount || plugin.lastTestMessage}
                                  {plugin.lastTestLatencyMs ? ` (${plugin.lastTestLatencyMs}ms)` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Controls */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#252629]">
                        <span
                          className={`text-[11px] font-medium ${
                            plugin.isConnected
                              ? plugin.enabled
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                              : 'text-[#9AA0A6]'
                          }`}
                        >
                          {plugin.isConnected
                            ? plugin.enabled
                              ? 'Connected · Active'
                              : 'Connected · Paused'
                            : 'Not Configured'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {plugin.isConnected && plugin.supportsLiveTest && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickTest(plugin, e)}
                              disabled={testingId === plugin.id}
                              className="px-2.5 py-1 rounded-lg border border-[#2C2E33] bg-[#0E0F10] hover:bg-[#1E1F22] text-[11px] text-[#C4C7C5] hover:text-white"
                            >
                              {testingId === plugin.id ? 'Testing...' : 'Verify'}
                            </button>
                          )}

                          {plugin.docsUrl && !plugin.isConnected && (
                            <a
                              href={plugin.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white"
                              title="Open documentation"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCustomCreatorOpen(false);
                              setActivePlugin(plugin);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              plugin.isConnected
                                ? 'bg-[#1E1F22] hover:bg-[#2C2E33] text-white border border-[#2C2E33]'
                                : 'bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#0E0F10]'
                            }`}
                          >
                            {plugin.isConnected ? 'Configure' : 'Connect'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-[#1E1F22] border border-[#383A40] text-xs text-white shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Setup / Custom Creator Modal */}
      <PluginConfigModal
        plugin={activePlugin}
        isCustomCreatorOpen={isCustomCreatorOpen}
        onClose={() => {
          setActivePlugin(null);
          setIsCustomCreatorOpen(false);
        }}
        onUpdated={handlePluginUpdated}
        onDeletedCustom={handleDeletedCustom}
      />
    </div>
  );
};
