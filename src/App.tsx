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

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    title: 'සවිස්තරාත්මක Build Prompt',
    section: 'recents',
    createdAt: 'Today',
    updatedAt: 'Just now',
    modelId: 'gemini-3.8-flash',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: `මගේ තේරීම: RAVANA NEXUS — කතා කරද්දී "Ravana" කියලා ලේසියෙන් භාවිත කරන්නත් පුළුවන්. 
මේවා creative name suggestions; domain සහ trademark availability තවම පරීක්ෂා කරලා නැහැ.`,
        timestamp: '12:48 PM',
      },
      {
        id: 'msg-2',
        role: 'user',
        content: 'natham sudda RaOne vage dammoth kohomada',
        timestamp: '12:50 PM',
      },
      {
        id: 'msg-3',
        role: 'model',
        content: `RaOne නම හොඳයි සුද්දා! 🔥 කෙටියි, මතක තියාගන්න ලේසියි, “Hey RaOne” කියලා voice assistant එකට කතා කරන්නත් ගැළපෙනවා.

හැබැයි "Ra.One" චිත්‍රපටයේ නමත් එක්ක සමාන නිසා, අපේම වෙනස් brand identity එකක් හදාගන්න එක බලාගන්න පුළුවන්. Commercial launch එකට කලින් trademark සහ domain availability පරීක්ෂා කරන්න ඕනේ.

අපේ brand එක මෙහෙම ගන්න පුළුවන්:
• Brand: RaOne
• Product name: RaOne AI
• Brand meaning: Ravana + One — One AI for Your World.
• Voice activation phrase: “Hey RaOne”
• Tagline: Think. Create. Act.
• Brand signature: RaOne AI by RavanaTec

මගේ අදහස: "RaOne AI" ඔයාගේ personal assistant + creative platform එකට හොඳට ගැළපෙන නමක්.`,
        timestamp: '12:51 PM',
      },
      {
        id: 'msg-4',
        role: 'user',
        content: 'mekata hariyana supirima supiri Logo ekakuth hadala diyan sudda',
        timestamp: '12:54 PM',
      },
      {
        id: 'msg-5',
        role: 'model',
        thinkingTime: '58s',
        thoughtProcess: `1. Deconstruct Brand Core: Ravana + One (Unified sovereign intelligence).
2. Synthesizing the Ten Facets of Knowledge into a single crest.
3. Palette Invariants: Deep Obsidian (#080B11), Solar Amber (#F59E0B), Electric Cyan (#06B6D4).
4. Geometry: Ten concentric quantum rings revolving around a central singularity.
5. Render Specification: RaOne AI emblem rendered and saved to /src/assets/images/raone_core_symbol.jpg.`,
        content: `අනිවාර්යයෙන්ම සුද්දා! RaOne AI by RavanaTec සඳහා සුපිරිම සුපිරි Futuristic Minimalist Logo එක සහ Design Brand Identity එක මෙන්න:

1. Brand Core Vision:
- Ravana + One = රාවණ රජුගේ දස මහා ඥානය (Ten Disciplines of Strategy, Flight, Science, Architecture, Linguistics) තනි සුපිරි AI Core එකක් බවට පත් කිරීම: One AI for Your World.

2. Visual Symbolism:
- Central Quantum Crest: අනාගත අභ්‍යවකාශ ක්ෂේත්‍රය හා Dandumonara තාක්ෂණය සිහිපත් කරන දස මුහුණැති ජ්‍යාමිතික කේන්ද්‍රය.
- Golden Amber & Electric Cyan Circuit Lines: අඳුරු කළු (Deep Obsidian) පසුබිම මත දීප්තිමත් වන විශ්වීය ශක්තිය.
- Voice Wave Matrix: "Hey RaOne" හඬ ප්‍රතිචාරය සඳහා සක්‍රීය වන අභ්‍යන්තර නාද තරංග.

Outputs පැනලයෙන් සජීවීව Logo Image එක හා Brand System Specifications බලන්න පුළුවන්! 🔥

RaOne AI by RavanaTec — Think. Create. Act.`,
        timestamp: '12:56 PM',
        outputs: [
          {
            id: 'spec-logo',
            title: 'RaOne AI Master Brand & Logo Spec',
            type: 'artifact',
            content: `Brand: RaOne
Product name: RaOne AI
Brand meaning: Ravana + One — One AI for Your World.
Voice activation phrase: “Hey RaOne”
Tagline: Think. Create. Act.
Brand signature: RaOne AI by RavanaTec

Symbolic Geometry:
- Central Quantum Crest: 10-spoke celestial glyph
- Color Matrix: Celestial Electric Cyan (#06B6D4) & Deep Solar Amber (#F59E0B)
- Typography: Outfit Display Bold + JetBrains Tabular Monospace`,
          },
          {
            id: 'spec-firebase',
            title: 'Firebase Architecture & Config (raoneai)',
            type: 'blueprint',
            content: `Project Name: RaOne
Project ID: raoneai
Project Number: 348832701843
Billing Plan: Blaze Plan (Pay-as-you-go)

Activated Services:
1. Firebase Authentication:
   - Email Sign-in (Active)
   - Google Sign-in (Active)
   - Authorized Domains: localhost, raoneai.firebaseapp.com, raoneai.web.app
2. Cloud Firestore:
   - Database: (default) (FIRESTORE_NATIVE)
   - Location: nam5 (US Multi-region)
3. Firebase Realtime Database:
   - Instance: raoneai-default-rtdb (Active)
   - URL: https://raoneai-default-rtdb.firebaseio.com
4. AI Logic & Gemini Integration:
   - Gemini Developer API (Active)
   - Vertex AI Gemini API (Active)
5. Google Analytics:
   - Property ID: 563366712
   - Measurement ID: G-04CTJ02EJ7`,
          },
        ],
      },
    ],
  },
  {
    id: 'conv-pinned-1',
    title: 'RavanaAIHub',
    section: 'pinned',
    createdAt: 'Yesterday',
    updatedAt: 'Yesterday',
    modelId: 'gemini-3.8-flash',
    messages: [
      {
        id: 'p1',
        role: 'user',
        content: 'Review RavanaAIHub infrastructure and sovereign model deployment.',
        timestamp: 'Yesterday',
      },
      {
        id: 'p2',
        role: 'model',
        content: 'RavanaAIHub is configured with sovereign edge cluster and Gemini 3.8 Flash inference pipelines.',
        timestamp: 'Yesterday',
      },
    ],
  },
  {
    id: 'conv-pinned-2',
    title: 'RavanaTec',
    section: 'pinned',
    createdAt: '2 days ago',
    updatedAt: '2 days ago',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-pinned-3',
    title: 'My Study Room (History)',
    section: 'pinned',
    createdAt: '3 days ago',
    updatedAt: '3 days ago',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-proj-1',
    title: '📁 MCP Setup',
    section: 'projects',
    createdAt: 'Nov 4',
    updatedAt: 'Nov 4',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-proj-2',
    title: 'MCP Server Setup',
    section: 'projects',
    createdAt: 'Nov 5',
    updatedAt: 'Nov 5',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-proj-3',
    title: 'Windows 10 Setup Summary',
    section: 'projects',
    createdAt: 'Nov 6',
    updatedAt: 'Nov 6',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-rec-2',
    title: 'Site Launch Check',
    section: 'recents',
    createdAt: 'Yesterday',
    updatedAt: 'Yesterday',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-rec-3',
    title: 'MCP Server Setup',
    section: 'recents',
    createdAt: 'Yesterday',
    updatedAt: 'Yesterday',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
  {
    id: 'conv-rec-4',
    title: 'Windows 10 Setup Summary',
    section: 'recents',
    createdAt: '2 days ago',
    updatedAt: '2 days ago',
    modelId: 'gemini-3.8-flash',
    messages: [],
  },
];

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string>('conv-1');
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
  const [studioHubTab, setStudioHubTab] = useState<'image' | 'music' | 'video' | 'transcribe' | 'cloudguide'>('image');

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeId) || conversations[0];

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
  }, [activeConversation?.messages, isLoading]);

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
      // If hovering over an aside (Sidebar or OutputDrawer) or modal or multiline textarea, let it handle its own scroll
      if (
        target?.closest('aside') ||
        target?.closest('.modal-content') ||
        target?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // If hovering over header, padding, or bottom dock, forward the scroll to chat messages
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

  // Send message
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

      const updatedMessages = [...activeConversation.messages, userMessage];

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, messages: updatedMessages, updatedAt: 'Just now' }
            : c
        )
      );

      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            mode: 'think',
            model: selectedModel,
            enableSearch: options?.enableSearch,
            enableMaps: options?.enableMaps,
            messages: updatedMessages.slice(-6).map((m) => ({
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
          thinkingTime: '12s',
          thoughtProcess: `Cognitive synthesis across RaOne AI vectors:\n- Model: ${data.model || selectedModel}\n- Multimodal groundings: Search (${Boolean(options?.enableSearch)}), Maps (${Boolean(options?.enableMaps)})\n- Invariant check: RaOne AI by RavanaTec — Think. Create. Act.`,
          groundingSources: data.groundingSources,
          mapsSources: data.mapsSources,
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? { ...c, messages: [...updatedMessages, modelMessage] }
              : c
          )
        );

        if (isVoiceModalOpen) {
          voice.speakText(replyText);
        }
      } catch (err: any) {
        console.error('Chat error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversation, activeId, isLoading, isVoiceModalOpen, selectedModel, voice]
  );

  // New Chat
  const handleNewChat = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: 'New chat',
      section: 'recents',
      createdAt: 'Just now',
      updatedAt: 'Just now',
      modelId: selectedModel,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newId);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      }
    }
  };

  const handleRenameTitle = (newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, title: newTitle } : c))
    );
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const hasOutputs = activeConversation.messages.some((m) => m.outputs && m.outputs.length > 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121] text-[#ECECEC] font-sans antialiased">
      {/* Sidebar (Exact ChatGPT Layout) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={(id) => setActiveId(id)}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
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
          <div className="absolute top-16 right-4 z-40 bg-[#2F2F2F] border border-amber-500/40 text-amber-300 text-xs px-3.5 py-2 rounded-xl shadow-2xl animate-in fade-in duration-150">
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
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center px-4">
              <div className="relative mb-4 group">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.35)] flex items-center justify-center bg-black">
                  <img
                    src="/src/assets/images/raone_core_symbol_1794208556087.jpg"
                    alt="RaOne AI Logo"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2 font-display">
                What can I help with?
              </h1>
              <p className="text-xs text-[#8E8E8E] max-w-sm mb-6">
                RaOne AI by RavanaTec — One AI for Your World. Think. Create. Act.
              </p>

              {/* Quick Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
                <button
                  onClick={() =>
                    handleSendMessage('sudda hama menu ekakma ChatGPT ekata samana karala hadala denna')
                  }
                  className="p-3.5 rounded-xl border border-[#2F2F2F] hover:bg-[#2A2A2A] transition-all text-xs text-[#B4B4B4]"
                >
                  <div className="font-semibold text-white mb-0.5">ChatGPT UI Experience</div>
                  <div className="text-[11px] text-[#8E8E8E]">Exact menus, sidebar, and layout</div>
                </button>
                <button
                  onClick={() =>
                    handleSendMessage('RaOne AI Logo එක සහ Brand identity එක ගැන සවිස්තරාත්මකව කියන්න')
                  }
                  className="p-3.5 rounded-xl border border-[#2F2F2F] hover:bg-[#2A2A2A] transition-all text-xs text-[#B4B4B4]"
                >
                  <div className="font-semibold text-white mb-0.5">RaOne Logo & Brand Specs</div>
                  <div className="text-[11px] text-[#8E8E8E]">Ravana + One design philosophy</div>
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

          {/* Loading indicator matching ChatGPT */}
          {isLoading && (
            <div className="my-6 max-w-3xl mx-auto px-4">
              <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="font-mono">RaOne is thinking...</span>
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
        isContinuousWakeListening={voice.isContinuousWakeListening}
        onToggleContinuousWake={voice.toggleContinuousWakeListening}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
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

      {/* Firebase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
      />

      {/* RaOne AI Studio Hub Modal (Image, Music, Video, Transcribe, Cloud Guide) */}
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
