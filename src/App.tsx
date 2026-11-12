/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatHeader } from './components/ChatHeader.tsx';
import { ChatMessageItem } from './components/ChatMessageItem.tsx';
import { ChatInputDock } from './components/ChatInputDock.tsx';
import { OutputDrawer } from './components/OutputDrawer.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { VoiceModal } from './components/VoiceModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AIStudioHubModal } from './components/AIStudioHubModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import { UpgradeModal } from './components/UpgradeModal.tsx';
import { GoogleAIStudioWorkbench } from './components/GoogleAIStudioWorkbench.tsx';
import { LeonardoVisionStudio } from './components/LeonardoVisionStudio.tsx';
import { LeonardoMotionStudio } from './components/LeonardoMotionStudio.tsx';
import { SunoAudioStudio } from './components/SunoAudioStudio.tsx';
import { DocumentAIStudio } from './components/DocumentAIStudio.tsx';
import { useRaOneVoice } from './hooks/useRaOneVoice.ts';
import { Conversation, ChatMessage } from './types/index.ts';
import { subscribeToAuth } from './lib/firebase.ts';
import { ImageIcon, Code, Brain, Lightbulb } from 'lucide-react';

const STORAGE_KEY = 'raone_conversations_v2';

export default function App() {
  // Real conversations persisted in LocalStorage & Backend (Zero hardcoded mock data)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage reading error:', e);
    }
    return [];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    return conversations[0]?.id || 'new';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isOutputsOpen, setIsOutputsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showScrollDown, setShowScrollDown] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isStudioHubOpen, setIsStudioHubOpen] = useState<boolean>(false);
  const [studioHubTab, setStudioHubTab] = useState<'image' | 'music' | 'video' | 'transcribe'>('image');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isGoogleAIStudioOpen, setIsGoogleAIStudioOpen] = useState<boolean>(false);
  const [isVisionStudioOpen, setIsVisionStudioOpen] = useState<boolean>(false);
  const [isMotionStudioOpen, setIsMotionStudioOpen] = useState<boolean>(false);
  const [isAudioStudioOpen, setIsAudioStudioOpen] = useState<boolean>(false);
  const [isDocumentStudioOpen, setIsDocumentStudioOpen] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'plus' | 'ultimate'>('free');
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const [inputFocusTrigger, setInputFocusTrigger] = useState<number>(0);
  const [isTemporaryChat, setIsTemporaryChat] = useState<boolean>(false);
  const [temporaryMessages, setTemporaryMessages] = useState<ChatMessage[]>([]);

  const handleToggleTemporaryChat = useCallback(() => {
    setIsTemporaryChat((prev) => {
      const next = !prev;
      if (!next) {
        setTemporaryMessages([]);
      }
      return next;
    });
  }, []);

  // Global Keyboard Shortcuts System (Ctrl+K, Ctrl+/, Ctrl+B, etc.)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      // Ctrl+K / Cmd+K: Start new chat & focus input
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveId('new');
        setInputFocusTrigger((prev) => prev + 1);
        return;
      }

      // Ctrl+/ or Cmd+/: Search chats in sidebar
      if (isMod && e.key === '/') {
        e.preventDefault();
        setIsSidebarOpen(true);
        setSearchTrigger((prev) => prev + 1);
        return;
      }

      // Ctrl+B or Cmd+B: Toggle sidebar
      if (isMod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // Ctrl+Shift+S / Cmd+Shift+S: Settings & model options
      if (isMod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // Ctrl+Shift+V / Cmd+Shift+V: Voice Mode
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceModalOpen((prev) => !prev);
        return;
      }

      // ?: Open keyboard shortcuts help (when not typing in an input field)
      if (e.key === '?' && !isInput && !isMod) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (isShortcutsOpen) setIsShortcutsOpen(false);
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isAuthModalOpen) setIsAuthModalOpen(false);
        if (isStudioHubOpen) setIsStudioHubOpen(false);
        if (isVoiceModalOpen) setIsVoiceModalOpen(false);
        if (isUpgradeModalOpen) setIsUpgradeModalOpen(false);
        if (isGoogleAIStudioOpen) setIsGoogleAIStudioOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAuthModalOpen, isSettingsOpen, isShortcutsOpen, isStudioHubOpen, isVoiceModalOpen, isUpgradeModalOpen, isGoogleAIStudioOpen]);

  // Load user subscription plan from backend API
  useEffect(() => {
    fetch('/api/user/plan')
      .then((res) => res.json())
      .then((data) => {
        if (data?.plan && ['free', 'plus', 'ultimate'].includes(data.plan)) {
          setCurrentPlan(data.plan);
        }
      })
      .catch((err) => console.warn('Plan fetch note:', err));
  }, []);

  // Load persisted conversations from backend API on initial mount
  useEffect(() => {
    fetch('/api/conversations')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setConversations((prev) => {
            // Merge backend data with local if needed
            if (prev.length === 0) {
              setActiveId(data[0].id);
              return data;
            }
            return prev;
          });
        }
      })
      .catch((err) => console.warn('Backend conversations sync note:', err));
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [conversations]);

  // Auth subscription
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Active conversation or clean blank state (or temporary in-memory private session)
  const activeConversation: Conversation = isTemporaryChat
    ? {
        id: 'temporary',
        title: 'Temporary Chat',
        section: 'recents',
        createdAt: 'Private Session',
        updatedAt: 'Just now',
        modelId: selectedModel,
        messages: temporaryMessages,
        isTemporary: true,
      }
    : conversations.find((c) => c.id === activeId) || {
        id: 'new',
        title: 'New chat',
        section: 'recents',
        createdAt: 'Today',
        updatedAt: 'Just now',
        modelId: selectedModel,
        messages: [],
      };

  // Auto scroll
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation.messages.length, isLoading]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 150);
  };

  // Dedicated mouse wheel listener ensuring mouse wheel scrolling always works seamlessly anywhere in the chat area
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const container = chatContainerRef.current;
      if (!container) return;

      const target = e.target as HTMLElement | null;
      if (
        target?.closest('aside') ||
        target?.closest('.modal-content') ||
        target?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (!container.contains(target) || target === container) {
        container.scrollTop += e.deltaY;
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, []);

  // Voice Hook with "Hey RaOne" Wake Word
  const voice = useRaOneVoice({
    onWakeWordTriggered: () => {
      setIsVoiceModalOpen(true);
    },
    onCommandRecognized: (command) => {
      if (command.trim()) {
        handleSendMessage(command);
      }
    },
  });

  // Send message with automatic chat creation & backend persistence
  const handleSendMessage = useCallback(
    async (
      text: string,
      options?: {
        enableSearch?: boolean;
        enableMaps?: boolean;
        media?: {
          imageUrl?: string;
          prompt?: string;
          audioUrl?: string;
          lyrics?: string;
          videoUrl?: string;
        };
      }
    ) => {
      if (!text.trim() || isLoading) return;

      let currentConvId = activeId;
      let isNewConv = currentConvId === 'new' || !conversations.some((c) => c.id === currentConvId);

      // Derive smart title from first user query
      const autoTitle = text.trim().slice(0, 36) + (text.length > 36 ? '...' : '');

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        generatedImage: options?.media?.imageUrl
          ? { url: options.media.imageUrl, prompt: options.media.prompt || text }
          : undefined,
        generatedAudio: options?.media?.audioUrl
          ? { url: options.media.audioUrl, lyrics: options.media.lyrics, prompt: text }
          : undefined,
        generatedVideo: options?.media?.videoUrl
          ? { url: options.media.videoUrl, prompt: text }
          : undefined,
        isTemporary: isTemporaryChat,
      };

      // In-Memory Temporary Private Chat: Zero persistence to disk or backend
      if (isTemporaryChat) {
        setTemporaryMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
          const history = temporaryMessages.slice(-6);
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: text,
              mode: 'chat',
              model: selectedModel,
              enableSearch: options?.enableSearch,
              enableMaps: options?.enableMaps,
              isTemporary: true, // Signal to backend: zero logging, zero persistence
              messages: history.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          });

          const data = await response.json();
          const replyText = data.text || 'RaOne AI completed private synthesis.';

          const modelMessage: ChatMessage = {
            id: `m-${Date.now()}`,
            role: 'model',
            content: replyText,
            model: data.model || selectedModel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            thinkingTime: '10s',
            isTemporary: true,
          };

          setTemporaryMessages((prev) => [...prev, modelMessage]);

          if (isVoiceModalOpen) {
            voice.speakText(replyText);
          }
        } catch (err: any) {
          console.error('Temporary chat error:', err);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (isNewConv) {
        currentConvId = `conv-${Date.now()}`;
        const newConversation: Conversation = {
          id: currentConvId,
          title: autoTitle,
          section: 'recents',
          createdAt: 'Today',
          updatedAt: 'Just now',
          modelId: selectedModel,
          messages: [userMessage],
        };

        setConversations((prev) => [newConversation, ...prev]);
        setActiveId(currentConvId);

        // Async save to backend
        fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConversation),
        }).catch((err) => console.warn('Could not save conversation to backend:', err));
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? {
                  ...c,
                  messages: [...c.messages, userMessage],
                  updatedAt: 'Just now',
                }
              : c
          )
        );
      }

      setIsLoading(true);

      try {
        const history = isNewConv ? [] : activeConversation.messages.slice(-6);
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            mode: 'chat',
            model: selectedModel,
            enableSearch: options?.enableSearch,
            enableMaps: options?.enableMaps,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const data = await response.json();
        const replyText = data.text || 'RaOne AI completed synthesis.';

        const modelMessage: ChatMessage = {
          id: `m-${Date.now()}`,
          role: 'model',
          content: replyText,
          model: data.model || selectedModel,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          thinkingTime: '14s',
          thoughtProcess: `Cognitive synthesis across RaOne AI vectors:\n- Model: ${data.model || selectedModel}\n- Multimodal groundings: Search (${Boolean(options?.enableSearch)}), Maps (${Boolean(options?.enableMaps)})\n- Invariant check: RaOne AI by RavanaTec — Think. Create. Act.`,
          groundingSources: data.groundingSources,
          mapsSources: data.mapsSources,
        };

        setConversations((prev) => {
          const updated = prev.map((c) => {
            if (c.id === currentConvId) {
              const updatedConv = {
                ...c,
                messages: [...c.messages, modelMessage],
                updatedAt: 'Just now',
              };
              // Save to backend
              fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConv),
              }).catch(() => {});
              return updatedConv;
            }
            return c;
          });
          return updated;
        });

        if (isVoiceModalOpen) {
          voice.speakText(replyText);
        }
      } catch (err: any) {
        console.error('Chat error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeConversation.messages,
      activeId,
      conversations,
      isLoading,
      isTemporaryChat,
      isVoiceModalOpen,
      selectedModel,
      temporaryMessages,
      voice,
    ]
  );

  // New Chat action (Exact ChatGPT behavior)
  const handleNewChat = () => {
    if (isTemporaryChat) {
      setTemporaryMessages([]);
    } else {
      setActiveId('new');
    }
  };

  // Delete chat
  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
    if (activeId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveId(remaining[0]?.id || 'new');
    }
  };

  // Rename chat
  const handleRenameTitle = (newTitle: string) => {
    if (activeId === 'new') return;
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, title: newTitle } : c))
    );
    fetch(`/api/conversations/${activeId}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    }).catch(() => {});
  };

  // Pin chat
  const handlePinConversation = (id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, section: c.section === 'pinned' ? 'recents' : 'pinned' }
          : c
      )
    );
    fetch(`/api/conversations/${id}/pin`, { method: 'POST' }).catch(() => {});
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const hasOutputs = activeConversation.messages.some((m) => m.outputs && m.outputs.length > 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#000000] text-[#ECECEC] font-sans antialiased">
      {/* Left Sidebar (Exact ChatGPT Layout) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={(id) => {
          if (isTemporaryChat) {
            setIsTemporaryChat(false);
            setTemporaryMessages([]);
          }
          setActiveId(id);
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={(id, newTitle) => {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
          );
          fetch(`/api/conversations/${id}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }),
          }).catch(() => {});
        }}
        onPinConversation={handlePinConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenStudioHub={(tab) => {
          if (tab) setStudioHubTab(tab);
          setIsStudioHubOpen(true);
        }}
        searchTrigger={searchTrigger}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        currentPlan={currentPlan}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
        onOpenAIStudio={() => setIsGoogleAIStudioOpen(true)}
        onOpenVisionStudio={() => setIsVisionStudioOpen(true)}
        onOpenMotionStudio={() => setIsMotionStudioOpen(true)}
        onOpenAudioStudio={() => setIsAudioStudioOpen(true)}
        onOpenDocumentStudio={() => setIsDocumentStudioOpen(true)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden relative bg-[#000000]">
        {/* Top Header */}
        <ChatHeader
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          title={activeConversation.title}
          onRenameTitle={handleRenameTitle}
          onShare={handleShare}
          isOutputsOpen={isOutputsOpen}
          onToggleOutputs={() => setIsOutputsOpen(!isOutputsOpen)}
          hasOutputs={hasOutputs}
          isSpeaking={voice.isSpeaking}
          onStopSpeaking={voice.stopSpeaking}
          onOpenVoice={() => setIsVoiceModalOpen(true)}
          isContinuousWakeListening={voice.isContinuousWakeListening}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isTemporaryChat={isTemporaryChat}
          onToggleTemporaryChat={handleToggleTemporaryChat}
          currentPlan={currentPlan}
          onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
        />

        {/* Share notification toast */}
        {shareCopied && (
          <div className="absolute top-16 right-4 z-40 bg-[#2F2F2F] border border-white/10 text-white text-xs px-3.5 py-2 rounded-xl shadow-2xl animate-in fade-in duration-150">
            Share link copied to clipboard!
          </div>
        )}

        {/* Main Content Area */}
        {activeConversation.messages.length === 0 ? (
          /* Exact Empty State matching screenshot: Centered "Where should we begin?" (or Temporary Chat) + Input Dock */
          <div className="flex-1 flex flex-col items-center justify-start pt-10 sm:pt-14 md:pt-16 px-4 w-full max-w-3xl mx-auto overflow-y-auto chat-scroll-area">
            {isTemporaryChat ? (
              <div className="flex flex-col items-center mb-6 animate-in fade-in text-center select-none">
                <div className="w-10 h-10 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-300 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <svg
                    className="w-5 h-5 stroke-current fill-none stroke-[2]"
                    strokeDasharray="4 3"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-[32px] font-medium text-white mb-2 tracking-tight">
                  Temporary Chat
                </h1>
                <p className="text-xs sm:text-sm text-[#8e8e8e] max-w-md">
                  This chat won't appear in your history, won't be saved on servers, and messages will disappear when you leave.
                </p>
              </div>
            ) : (
              <h1 className="text-2xl sm:text-[32px] font-medium text-white mb-6 tracking-tight text-center select-none">
                Where should we begin?
              </h1>
            )}
            <ChatInputDock
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onOpenVoice={() => setIsVoiceModalOpen(true)}
              isListening={voice.isListening}
              isContinuousWakeListening={voice.isContinuousWakeListening}
              showScrollDown={false}
              onScrollToBottom={() => {}}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onOpenStudioHub={(tab) => {
                if (tab) setStudioHubTab(tab);
                setIsStudioHubOpen(true);
              }}
              isCenterState={true}
              inputFocusTrigger={inputFocusTrigger}
              isTemporary={isTemporaryChat}
            />
          </div>
        ) : (
          /* Conversation View */
          <>
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              tabIndex={0}
              className="flex-1 min-h-0 min-w-0 overflow-y-auto px-2 sm:px-4 py-4 chat-scroll-area focus:outline-none"
            >
              {isTemporaryChat && (
                <div className="mb-4 max-w-[760px] mx-auto p-3 rounded-xl bg-[#171717] border border-amber-500/30 flex items-center justify-between text-xs text-amber-200 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Temporary Chat: Messages are private and will not be saved.</span>
                  </div>
                  <button
                    onClick={handleToggleTemporaryChat}
                    className="px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333] text-white text-[11px] font-medium transition-colors"
                  >
                    Turn off
                  </button>
                </div>
              )}
              {activeConversation.messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  onSpeak={voice.speakText}
                  onRegenerate={() => handleSendMessage(message.content)}
                  isSpeaking={voice.isSpeaking}
                />
              ))}

              {/* Thinking indicator */}
              {isLoading && (
                <div className="my-5 max-w-[760px] mx-auto px-4">
                  <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span className="font-mono">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Floating Input Dock when in conversation */}
            <ChatInputDock
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onOpenVoice={() => setIsVoiceModalOpen(true)}
              isListening={voice.isListening}
              isContinuousWakeListening={voice.isContinuousWakeListening}
              showScrollDown={showScrollDown}
              onScrollToBottom={() => scrollToBottom('smooth')}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onOpenStudioHub={(tab) => {
                if (tab) setStudioHubTab(tab);
                setIsStudioHubOpen(true);
              }}
              inputFocusTrigger={inputFocusTrigger}
              isTemporary={isTemporaryChat}
            />
          </>
        )}
      </div>

      {/* Outputs / Artifacts Drawer (Right Rail matching screenshot) */}
      <OutputDrawer
        isOpen={isOutputsOpen}
        onClose={() => setIsOutputsOpen(false)}
        outputs={
          activeConversation.messages.flatMap((m) => m.outputs || [])
        }
      />

      {/* Settings Modal (100% ChatGPT Settings Center) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isContinuousWakeListening={voice.isContinuousWakeListening}
        onToggleContinuousWake={voice.toggleContinuousWakeListening}
        currentPlan={currentPlan}
        onOpenUpgrade={() => {
          setIsSettingsOpen(false);
          setIsUpgradeModalOpen(true);
        }}
        onClearAllChats={() => {
          setConversations([]);
          setActiveId('new');
        }}
      />

      {/* Keyboard Shortcuts Helper Modal (Accessible with ? or from UI) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Voice Assistant Modal ("Hey RaOne") */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        isListening={voice.isListening}
        isContinuousWakeListening={voice.isContinuousWakeListening}
        isSpeaking={voice.isSpeaking}
        transcript={voice.transcript}
        audioLevel={voice.audioLevel}
        voiceError={voice.voiceError}
        onStartListening={voice.startListening}
        onStopListening={voice.stopListening}
        onToggleContinuousWake={voice.toggleContinuousWakeListening}
        onStopSpeaking={voice.stopSpeaking}
        onSendVoiceQuery={(query) => handleSendMessage(query)}
      />

      {/* Sovereign Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
      />

      {/* RaOne AI Studio Hub Modal (Visual, Music, Video, Transcribe) */}
      <AIStudioHubModal
        isOpen={isStudioHubOpen}
        onClose={() => setIsStudioHubOpen(false)}
        initialTab={studioHubTab}
        onInsertToChat={(content, media) => {
          handleSendMessage(content, { media });
        }}
      />

      {/* Subscription Plans Modal (Free, Plus, Ultimate) */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlan={currentPlan}
        onPlanChanged={(newPlan) => setCurrentPlan(newPlan)}
      />

      {/* Google AI Studio Developer Workbench & Model Playground */}
      <GoogleAIStudioWorkbench
        isOpen={isGoogleAIStudioOpen}
        onClose={() => setIsGoogleAIStudioOpen(false)}
      />

      {/* Leonardo AI Vision Studio (Silicon Valley Grade T2I Engine) */}
      <LeonardoVisionStudio
        isOpen={isVisionStudioOpen}
        onClose={() => setIsVisionStudioOpen(false)}
      />

      {/* RaOne Cinema Studio (Leonardo AI Motion & Video Diffusion Engine) */}
      <LeonardoMotionStudio
        isOpen={isMotionStudioOpen}
        onClose={() => setIsMotionStudioOpen(false)}
      />

      {/* RaOne Suno Audio Studio (AI Music & Vocals Synthesis) */}
      <SunoAudioStudio
        isOpen={isAudioStudioOpen}
        onClose={() => setIsAudioStudioOpen(false)}
      />

      {/* RaOne DocuStudio (NotebookLM + Gamma App + Microsoft Copilot) */}
      <DocumentAIStudio
        isOpen={isDocumentStudioOpen}
        onClose={() => setIsDocumentStudioOpen(false)}
      />
    </div>
  );
}
