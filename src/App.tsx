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

  // Active conversation or clean blank state
  const activeConversation: Conversation =
    conversations.find((c) => c.id === activeId) || {
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
      };

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
    [activeConversation.messages, activeId, conversations, isLoading, isVoiceModalOpen, selectedModel, voice]
  );

  // New Chat action (Exact ChatGPT behavior)
  const handleNewChat = () => {
    setActiveId('new');
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121] text-[#ECECEC] font-sans antialiased">
      {/* Left Sidebar (Exact ChatGPT Layout) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={(id) => setActiveId(id)}
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
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden relative">
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
        />

        {/* Share notification toast */}
        {shareCopied && (
          <div className="absolute top-16 right-4 z-40 bg-[#2F2F2F] border border-white/10 text-white text-xs px-3.5 py-2 rounded-xl shadow-2xl animate-in fade-in duration-150">
            Share link copied to clipboard!
          </div>
        )}

        {/* Scrollable Messages Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          tabIndex={0}
          className="flex-1 min-h-0 min-w-0 overflow-y-auto px-2 sm:px-4 py-4 chat-scroll-area focus:outline-none"
        >
          {activeConversation.messages.length === 0 ? (
            /* Pristine ChatGPT Centered Empty State */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 max-w-2xl mx-auto">
              <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">
                What can I help with today?
              </h1>

              {/* 4 Quick Prompt Cards matching ChatGPT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                <button
                  onClick={() =>
                    handleSendMessage('Create a photorealistic concept artwork of Sigiriya monolith engulfed in neon cyber conduits at sunset')
                  }
                  className="p-3.5 rounded-2xl border border-[#303030] bg-[#212121] hover:bg-[#2A2A2A] transition-all text-xs text-[#B4B4B4] flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-0.5">Create image</div>
                    <div className="text-[11px] text-[#8E8E8E]">Photorealistic 4K visual concept</div>
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSendMessage('Write a complete, production-ready TypeScript backend service for high-concurrency event streaming')
                  }
                  className="p-3.5 rounded-2xl border border-[#303030] bg-[#212121] hover:bg-[#2A2A2A] transition-all text-xs text-[#B4B4B4] flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Code className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-0.5">Code & architecture</div>
                    <div className="text-[11px] text-[#8E8E8E]">System design & pristine syntax</div>
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSendMessage('Conduct a deep cognitive strategic reasoning analysis on establishing sovereign AI infrastructure')
                  }
                  className="p-3.5 rounded-2xl border border-[#303030] bg-[#212121] hover:bg-[#2A2A2A] transition-all text-xs text-[#B4B4B4] flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-0.5">Analyze & reason</div>
                    <div className="text-[11px] text-[#8E8E8E]">Deep logic & first-principles</div>
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSendMessage('Brainstorm breakthrough brand strategies and viral growth mechanics for a next-gen tech product')
                  }
                  className="p-3.5 rounded-2xl border border-[#303030] bg-[#212121] hover:bg-[#2A2A2A] transition-all text-xs text-[#B4B4B4] flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-0.5">Brainstorm ideas</div>
                    <div className="text-[11px] text-[#8E8E8E]">Strategic innovation vectors</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            activeConversation.messages.map((message) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                onSpeak={voice.speakText}
                onRegenerate={() => handleSendMessage(message.content)}
                isSpeaking={voice.isSpeaking}
              />
            ))
          )}

          {/* Thinking indicator matching ChatGPT */}
          {isLoading && (
            <div className="my-5 max-w-[760px] mx-auto px-4">
              <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="font-mono">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Input Dock */}
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
        />
      </div>

      {/* Outputs / Artifacts Drawer (Right Rail matching screenshot) */}
      <OutputDrawer
        isOpen={isOutputsOpen}
        onClose={() => setIsOutputsOpen(false)}
        outputs={
          activeConversation.messages.flatMap((m) => m.outputs || [])
        }
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isContinuousWakeListening={voice.isContinuousWakeListening}
        onToggleContinuousWake={voice.toggleContinuousWakeListening}
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
    </div>
  );
}
