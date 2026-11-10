import React, { useState } from 'react';
import {
  SquarePen,
  Clock,
  BookOpen,
  Boxes,
  Compass,
  Folder,
  Pin,
  Search,
  PanelLeftClose,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  Settings,
  Trash2,
  Check,
  Edit2,
  LogOut,
  User,
  Shield,
  HelpCircle,
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
  onPinConversation,
  onOpenSettings,
  selectedModel,
  onSelectModel,
  currentUser,
  onOpenAuth,
  onOpenStudioHub,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  if (!isOpen) return null;

  const models = [
    { id: 'gemini-3.8-flash', name: 'RaOne Flash', desc: 'Fast, multimodal & intelligent' },
    { id: 'gemini-4-argon', name: 'RaOne Argon', desc: 'Deep cognitive reasoning & systems code' },
    { id: 'raone-deepseek-r1', name: 'RaOne DeepSeek R1', desc: 'Open reasoning & algorithmic proofs' },
    { id: 'raone-gpt4o', name: 'RaOne GPT-4o', desc: 'Advanced vision & omni reasoning' },
    { id: 'raone-claude', name: 'RaOne Claude 3.5', desc: 'State-of-the-art coding & prose' },
    { id: 'gemini-3.1-flash-lite', name: 'RaOne Lite', desc: 'Ultra-fast responsive stream' },
  ];

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  const pinned = conversations.filter((c) => c.section === 'pinned');
  const projects = conversations.filter((c) => c.section === 'projects');
  const recents = conversations.filter(
    (c) =>
      c.section !== 'pinned' &&
      c.section !== 'projects' &&
      (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleStartRename = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameText(conv.title);
    setActiveMenuConvId(null);
  };

  const handleSaveRename = (id: string) => {
    if (renameText.trim() && onRenameConversation) {
      onRenameConversation(id, renameText.trim());
    }
    setRenamingId(null);
  };

  return (
    <aside className="w-64 bg-[#171717] text-[#ECECEC] flex flex-col h-full border-r border-[#262626] shrink-0 select-none z-40 transition-all duration-200">
      {/* Top Bar: Model Selector + Search + Close */}
      <div className="p-3 pb-2 flex items-center justify-between border-b border-[#262626]/50">
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold rounded-lg hover:bg-[#212121] transition-colors"
          >
            <img
              src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
              alt="RaOne AI Logo"
              className="w-5 h-5 rounded-full object-cover border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.4)] shrink-0"
            />
            <span>{currentModel.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#9E9E9E]" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#212121] border border-[#333333] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#8E8E8E] uppercase tracking-wider">
                Select RaOne Model Engine
              </div>
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelectModel(m.id);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    selectedModel === m.id ? 'bg-[#2F2F2F] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#2A2A2A]'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white">{m.name}</div>
                    <div className="text-[10px] text-[#8E8E8E]">{m.desc}</div>
                  </div>
                  {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSearching(!isSearching)}
            className="p-1.5 rounded-lg hover:bg-[#212121] text-[#9E9E9E] hover:text-white transition-colors"
            title="Search chats"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#212121] text-[#9E9E9E] hover:text-white transition-colors"
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Optional Search Input */}
      {isSearching && (
        <div className="px-3 py-2 border-b border-[#262626]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-[#212121] border border-[#333333] rounded-lg px-2.5 py-1 text-xs text-white placeholder-[#757575] focus:outline-none"
            autoFocus
          />
        </div>
      )}

      {/* Main Action Links (Matching ChatGPT) */}
      <div className="px-2 py-2 space-y-0.5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[#212121] transition-colors group text-[#ECECEC]"
        >
          <SquarePen className="w-4 h-4 text-[#B4B4B4] group-hover:text-white" />
          <span>New chat</span>
        </button>

        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[#212121] text-[#B4B4B4] hover:text-white transition-colors"
        >
          <Clock className="w-4 h-4" />
          <span>Scheduled</span>
        </button>

        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[#212121] text-[#B4B4B4] hover:text-white transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span>Library</span>
        </button>

        <button
          onClick={() => onOpenStudioHub && onOpenStudioHub('image')}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>RaOne Studio Hub</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">
            Creative
          </span>
        </button>
      </div>

      {/* Scrollable Conversation Lists */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-4">
        {/* Pinned Section */}
        {pinned.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-[#8E8E8E] tracking-wide">
              Pinned
            </div>
            <div className="space-y-0.5 mt-1">
              {pinned.map((item) => {
                const isActive = activeConversationId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`relative w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group cursor-pointer ${
                      isActive ? 'bg-[#212121] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#212121]'
                    }`}
                    onClick={() => onSelectConversation(item.id)}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 pr-2">
                      <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuConvId(activeMenuConvId === item.id ? null : item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2F2F2F] text-[#8E8E8E] hover:text-white transition-opacity"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuConvId === item.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-36 bg-[#262626] border border-[#3A3A3A] rounded-xl shadow-2xl p-1 z-50 text-xs text-[#ECECEC]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onPinConversation && (
                            <button
                              onClick={() => {
                                onPinConversation(item.id);
                                setActiveMenuConvId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#333] flex items-center gap-2"
                            >
                              <Pin className="w-3 h-3 text-amber-400" />
                              <span>Unpin</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartRename(item)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#333] flex items-center gap-2"
                          >
                            <Edit2 className="w-3 h-3 text-slate-300" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={() => {
                              onDeleteConversation(item.id);
                              setActiveMenuConvId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#333] text-red-400 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Projects Section */}
        {projects.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-[#8E8E8E] tracking-wide">
              Projects
            </div>
            <div className="space-y-0.5 mt-1">
              {projects.map((item) => {
                const isActive = activeConversationId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectConversation(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors text-left group truncate ${
                      isActive ? 'bg-[#212121] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#212121]'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-[#8E8E8E] shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recents Section */}
        <div>
          <div className="px-3 py-1 text-[11px] font-semibold text-[#8E8E8E] tracking-wide">
            Recents
          </div>
          <div className="space-y-0.5 mt-1">
            {recents.length === 0 ? (
              <div className="px-3 py-4 text-xs text-[#757575] text-center italic">
                No conversations yet.<br />Start a new chat to begin!
              </div>
            ) : (
              recents.map((item) => {
                const isActive = activeConversationId === item.id;
                const isRenaming = renamingId === item.id;

                if (isRenaming) {
                  return (
                    <div key={item.id} className="px-3 py-1.5">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(item.id)}
                        onBlur={() => handleSaveRename(item.id)}
                        className="w-full bg-[#262626] border border-amber-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        autoFocus
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className={`relative w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group cursor-pointer ${
                      isActive ? 'bg-[#212121] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#212121]'
                    }`}
                    onClick={() => onSelectConversation(item.id)}
                  >
                    <span className="truncate flex-1 pr-2">{item.title}</span>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuConvId(activeMenuConvId === item.id ? null : item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2F2F2F] text-[#8E8E8E] hover:text-white transition-opacity"
                        title="Chat options"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuConvId === item.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-36 bg-[#262626] border border-[#3A3A3A] rounded-xl shadow-2xl p-1 z-50 text-xs text-[#ECECEC]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onPinConversation && (
                            <button
                              onClick={() => {
                                onPinConversation(item.id);
                                setActiveMenuConvId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#333] flex items-center gap-2"
                            >
                              <Pin className="w-3 h-3 text-amber-400" />
                              <span>Pin to top</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartRename(item)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#333] flex items-center gap-2"
                          >
                            <Edit2 className="w-3 h-3 text-slate-300" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={() => {
                              onDeleteConversation(item.id);
                              setActiveMenuConvId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#333] text-red-400 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* User Profile Bar (Matches Screenshot: Shanthapriya Silva / Plus) */}
      <div className="p-3 border-t border-[#262626] bg-[#171717] relative">
        <button
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#212121] transition-colors group"
        >
          <div className="flex items-center gap-3">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="User"
                className="w-8 h-8 rounded-full object-cover border border-amber-500/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#3F3F3F] text-white font-semibold text-xs flex items-center justify-center border border-[#525252]">
                {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'SS'}
              </div>
            )}
            <div className="text-left truncate max-w-[140px]">
              <div className="text-xs font-semibold text-white leading-tight truncate">
                {currentUser?.displayName || currentUser?.email || 'Shanthapriya Silva'}
              </div>
              <div className="text-[10px] text-[#8E8E8E] leading-tight flex items-center gap-1.5 mt-0.5">
                <span className="font-medium text-amber-400">
                  {currentUser ? 'Pro' : 'Plus'}
                </span>
                <span>·</span>
                <img
                  src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                  alt="RaOne"
                  className="w-3.5 h-3.5 rounded-full object-cover inline-block"
                />
                <span>RaOne AI</span>
              </div>
            </div>
          </div>
          <MoreHorizontal className="w-4 h-4 text-[#8E8E8E] group-hover:text-white" />
        </button>

        {/* Profile Popover Menu (Matching ChatGPT User Menu) */}
        {profileMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#212121] border border-[#333333] rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in duration-150">
            <div className="px-3 py-2 border-b border-[#2C2C2C] mb-1">
              <div className="font-semibold text-white truncate">
                {currentUser?.displayName || 'Shanthapriya Silva'}
              </div>
              <div className="text-[11px] text-[#8E8E8E] truncate">
                {currentUser?.email || 'hello.ravanatech@gmail.com'}
              </div>
            </div>

            <button
              onClick={() => {
                onOpenSettings();
                setProfileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[#ECECEC] hover:bg-[#2A2A2A] transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => {
                onOpenSettings();
                setProfileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[#ECECEC] hover:bg-[#2A2A2A] transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Personalization</span>
            </button>

            {onOpenAuth && (
              <button
                onClick={() => {
                  onOpenAuth();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[#ECECEC] hover:bg-[#2A2A2A] transition-colors border-t border-[#2C2C2C] mt-1 pt-2"
              >
                {currentUser ? (
                  <>
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span className="text-red-300">Sign Out</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300">Sign In / Switch Account</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
