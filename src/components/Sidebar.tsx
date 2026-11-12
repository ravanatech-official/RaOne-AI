import React, { useState } from 'react';
import {
  SquarePen,
  Search,
  PanelLeftClose,
  Clock,
  BookOpen,
  Boxes,
  ImageIcon,
  Sparkles,
  Trash2,
  Edit2,
  Check,
  PanelLeft,
  Settings,
  Video,
  Music,
  FileText,
} from 'lucide-react';
import { Conversation } from '../types/index.ts';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onPinConversation?: (id: string) => void;
  onOpenSettings: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  currentUser?: any;
  onOpenAuth?: () => void;
  onOpenStudioHub?: (tab?: 'image' | 'music' | 'video' | 'transcribe') => void;
  searchTrigger?: number;
  onOpenShortcuts?: () => void;
  currentPlan?: 'free' | 'plus' | 'ultimate';
  onOpenUpgrade?: () => void;
  onOpenAIStudio?: () => void;
  onOpenVisionStudio?: () => void;
  onOpenMotionStudio?: () => void;
  onOpenAudioStudio?: () => void;
  onOpenDocumentStudio?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  currentUser,
  onOpenAuth,
  onOpenStudioHub,
  searchTrigger = 0,
  onOpenShortcuts,
  currentPlan = 'free',
  onOpenUpgrade,
  onOpenAIStudio,
  onOpenVisionStudio,
  onOpenMotionStudio,
  onOpenAudioStudio,
  onOpenDocumentStudio,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus search input when triggered by keyboard shortcut (Ctrl+/)
  React.useEffect(() => {
    if (searchTrigger > 0) {
      setSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
  }, [searchTrigger]);

  if (!isOpen) return null;

  const isMac =
    typeof window !== 'undefined' &&
    (/Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      navigator.userAgent.includes('Mac'));
  const modKey = isMac ? '⌘' : 'Ctrl';

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim() && onRenameConversation) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const filteredConversations = conversations.filter(
    (c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-[260px] bg-[#000000] text-[#ECECEC] flex flex-col h-full border-r border-[#1a1a1a] shrink-0 select-none z-40 transition-all duration-200">
      {/* Top Header Row: Uploaded Logo + RaOne Studio + Search + Collapse icon */}
      <div className="h-14 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/assets/aistudio/RaOne_Logo_c8b49006.png"
            alt="RaOne Logo"
            className="w-6 h-6 object-contain rounded-md shrink-0 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
          />
          <span className="text-[16px] font-semibold text-white tracking-tight truncate">
            RaOne AI Studio
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#8e8e8e] hover:text-white transition-colors"
            title={`Search (${modKey}+/)`}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#8e8e8e] hover:text-white transition-colors"
            title={`Close sidebar (${modKey}+B)`}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input (conditionally visible) */}
      {searchOpen && (
        <div className="px-3 pb-2 animate-in fade-in duration-100">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search chats... (Esc to close)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            className="w-full bg-[#1a1a1a] text-xs text-white placeholder-[#737373] px-2.5 py-1.5 rounded-lg border border-[#2a2a2a] focus:outline-none focus:border-[#404040]"
            autoFocus
          />
        </div>
      )}

      {/* New chat action button */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={onNewChat}
          className="w-full bg-[#1a1a1a] hover:bg-[#242424] text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between transition-colors group"
          title={`New chat (${modKey}+K)`}
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/New_Chat_1de020da.png"
              alt="New Chat"
              className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)] group-hover:scale-110 transition-transform"
            />
            <span>New chat</span>
          </div>
          <span className="text-[10px] text-[#737373] font-mono px-1.5 py-0.5 rounded bg-[#141414] border border-[#2d2d2d] group-hover:text-[#b4b4b4]">
            {modKey} K
          </span>
        </button>
      </div>

      {/* Main Navigation Items list */}
      <div className="px-3 py-1 space-y-0.5">


        {/* RaOne Code Studio Button */}
        <button
          onClick={onOpenAIStudio}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors group"
          title="RaOne Code Studio — App Builder, Templates, and Prototyping"
        >
          <img
            src="/assets/aistudio/RaOne_Code_Studio_4ceb2ebb.png"
            alt="RaOne Code Logo"
            className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)] group-hover:scale-110 transition-transform"
          />
          <span className="font-medium text-white group-hover:text-cyan-300 transition-colors truncate">
            RaOne Code Studio
          </span>
        </button>

        {/* RaOne Vision Studio Button (Leonardo AI T2I Engine) */}
        <button
          onClick={onOpenVisionStudio}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors group"
          title="RaOne Vision Studio — Leonardo AI Engine (Midjourney v6.1, Flux 1.1 Pro, Imagen 3, DALL-E 3)"
        >
          <img
            src="/assets/aistudio/RaOne_Vision_Studio_03e7859b.png"
            alt="RaOne Vision Logo"
            className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)] group-hover:scale-110 transition-transform"
          />
          <span className="font-medium text-white group-hover:text-purple-300 transition-colors truncate">
            RaOne Vision Studio
          </span>
        </button>

        {/* RaOne Motion Studio Button (Generative Video & Motion Synthesis) */}
        <button
          onClick={onOpenMotionStudio}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors group"
          title="RaOne Cinema Studio — Generative Video & Motion Synthesis (Google Veo 2, OpenAI Sora, Runway Gen-3, Kling AI, Luma Dream Machine)"
        >
          <img
            src="/assets/aistudio/RaOne_Cinema_Studio_561b5a2a.png"
            alt="RaOne Cinema Logo"
            className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)] group-hover:scale-110 transition-transform"
          />
          <span className="font-medium text-white group-hover:text-cyan-300 transition-colors truncate">
            RaOne Cinema Studio
          </span>
        </button>

        {/* RaOne Suno Audio Button (AI Music, Vocals & Beats Synthesis) */}
        <button
          onClick={onOpenAudioStudio}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors group"
          title="RaOne Suno Audio — AI Music, Vocals & Beats Synthesis (Suno v4 Alpha, Udio 130, Google Lyria, ElevenLabs)"
        >
          <img
            src="/assets/aistudio/RaOne_Music_Studio_25c5e404.png"
            alt="RaOne Suno Audio Logo"
            className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)] group-hover:scale-110 transition-transform"
          />
          <span className="font-medium text-white group-hover:text-amber-300 transition-colors truncate">
            RaOne Suno Audio
          </span>
        </button>

        {/* RaOne DocuStudio Button (Intelligent Document Processing, NotebookLM, Gamma App & Copilot) */}
        <button
          onClick={onOpenDocumentStudio}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors group"
          title="RaOne DocuStudio — Intelligent Document Processing, NotebookLM, Gamma App & Copilot (PDFs, Slides, Spreadsheets, Graph-RAG)"
        >
          <img
            src="/assets/aistudio/RaOne_Document_Studio_a4a1c2ae.png"
            alt="RaOne DocuStudio Logo"
            className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)] group-hover:scale-110 transition-transform"
          />
          <span className="font-medium text-white group-hover:text-emerald-300 transition-colors truncate">
            RaOne DocuStudio
          </span>
        </button>

        {/* Library Button */}
        <button
          onClick={() => onOpenStudioHub && onOpenStudioHub('transcribe')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors"
        >
          <BookOpen className="w-4 h-4 text-[#8e8e8e]" />
          <span>Library</span>
        </button>

        {/* Plugins Button (moved under Library) */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ececec] hover:bg-[#171717] transition-colors"
        >
          <Boxes className="w-4 h-4 text-[#8e8e8e]" />
          <span>Plugins</span>
        </button>
      </div>

      {/* Scrollable Project & Recents lists */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 chat-scroll-area">
        {/* Projects Section */}
        <div>
          <div className="text-xs font-semibold text-[#8e8e8e] px-3 pb-1">Projects</div>
          <div className="text-xs text-[#737373] px-3 py-1">No projects</div>
        </div>

        {/* Recents Section */}
        <div>
          <div className="text-xs font-semibold text-[#8e8e8e] px-3 pb-1">Recents</div>
          {filteredConversations.length === 0 ? (
            <div className="text-xs text-[#737373] px-3 py-1">No chats</div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map((c) => {
                const isActive = c.id === activeConversationId;
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectConversation(c.id)}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive ? 'bg-[#1a1a1a] text-white font-medium' : 'text-[#b4b4b4] hover:bg-[#141414] hover:text-white'
                    }`}
                  >
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(c.id)}
                          className="bg-[#242424] text-white text-xs px-2 py-0.5 rounded border border-[#3a3a3a] w-full focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(c.id)}
                          className="p-1 hover:text-white text-green-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate pr-2">{c.title}</span>
                        <div className="hidden group-hover:flex items-center gap-1 text-[#8e8e8e]">
                          <button
                            onClick={(e) => handleStartRename(c, e)}
                            className="p-1 hover:text-white rounded hover:bg-[#262626]"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(c.id);
                            }}
                            className="p-1 hover:text-red-400 rounded hover:bg-[#262626]"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Profile Bar matching exact screenshot (Targeted by CSS Selector 1) */}
      <div className="p-3 border-t border-[#1a1a1a] flex items-center justify-between shrink-0 bg-[#000000]">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 p-1 -ml-1 rounded-xl hover:bg-[#1a1a1a] transition-all text-left min-w-0 group"
          title="Open Settings Center"
        >
          {/* Circular SS badge with Settings indicator icon */}
          <div className="relative w-8 h-8 rounded-full bg-[#2a2a2a] text-white flex items-center justify-center text-xs font-semibold shrink-0 group-hover:ring-1 group-hover:ring-white/20 transition-all">
            {currentUser?.displayName
              ? currentUser.displayName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : 'SS'}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#111111] border border-[#333333] flex items-center justify-center text-[#8e8e8e] group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors">
              <Settings className="w-2.5 h-2.5" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white truncate max-w-[90px] group-hover:text-white transition-colors">
                {currentUser?.displayName || 'Shanthapriya Silva'}
              </span>
              <Settings className="w-3 h-3 text-[#737373] group-hover:text-amber-400 transition-colors opacity-70 group-hover:opacity-100" />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] capitalize text-[#8e8e8e]">{currentPlan}</span>
              {currentPlan === 'plus' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold tracking-wide">
                  PLUS
                </span>
              )}
              {currentPlan === 'ultimate' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 font-semibold tracking-wide">
                  ULTIMATE
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Upgrade pill button (CSS selector 1 target) */}
        <button
          onClick={onOpenUpgrade || onOpenSettings}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-all ${
            currentPlan === 'ultimate'
              ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
              : currentPlan === 'plus'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              : 'bg-[#1e1e1e] hover:bg-[#2a2a2a] border-white/10 text-white'
          }`}
          title="Upgrade your plan (Free, Plus, Ultimate)"
        >
          {currentPlan === 'free' ? 'Upgrade' : 'Manage'}
        </button>
      </div>
    </aside>
  );
};
