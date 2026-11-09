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
  onOpenSettings: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  currentUser?: any;
  onOpenAuth?: () => void;
  onOpenStudioHub?: (tab?: 'image' | 'music' | 'video' | 'transcribe' | 'cloudguide') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
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

  if (!isOpen) return null;

  const models = [
    { id: 'gemini-3.8-flash', name: 'RaOne AI (Gemini 3.8 Flash)', desc: 'Fast, multimodal & intelligent' },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra Medium', desc: 'Deep reasoning & agentic execution' },
    { id: 'raone-thinker', name: 'RaOne Thinker (Ten Facets)', desc: 'Extreme strategic synthesis' },
  ];

  const pinned = conversations.filter((c) => c.section === 'pinned');
  const projects = conversations.filter((c) => c.section === 'projects');
  const recents = conversations.filter(
    (c) =>
      c.section === 'recents' &&
      (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            <span>RaOne</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#9E9E9E]" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-60 bg-[#212121] border border-[#333333] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150">
              <div className="px-2 py-1 text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">
                Model Engine
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
                    <div className="font-semibold">{m.name}</div>
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

      {/* Main Action Links */}
      <div className="px-2 py-2 space-y-0.5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[#212121] transition-colors group"
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
            AI Suite
          </span>
        </button>

        <button
          onClick={() => onOpenStudioHub && onOpenStudioHub('cloudguide')}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-[#212121] text-[#B4B4B4] hover:text-amber-300 transition-colors"
        >
          <Compass className="w-4 h-4 text-amber-400" />
          <span>Firebase & GCP Setup</span>
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
                  <button
                    key={item.id}
                    onClick={() => onSelectConversation(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors text-left group truncate ${
                      isActive ? 'bg-[#212121] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#212121]'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5 text-[#8E8E8E] shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </button>
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
            {recents.map((item) => {
              const isActive = activeConversationId === item.id;
              return (
                <div
                  key={item.id}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group cursor-pointer ${
                    isActive ? 'bg-[#212121] text-white font-medium' : 'text-[#B4B4B4] hover:bg-[#212121]'
                  }`}
                  onClick={() => onSelectConversation(item.id)}
                >
                  <span className="truncate flex-1 pr-2">{item.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Profile Bar (Matches Screenshot: Shanthapriya Silva / Plus) */}
      <div className="p-3 border-t border-[#262626] bg-[#171717]">
        <button
          onClick={onOpenSettings}
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
                  {currentUser ? 'Firebase' : 'Plus'}
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
      </div>
    </aside>
  );
};
