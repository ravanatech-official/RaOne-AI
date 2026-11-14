/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatHeader } from './components/ChatHeader.tsx';
import { ChatMessageItem } from './components/ChatMessageItem.tsx';
import { ChatInputDock } from './components/ChatInputDock.tsx';
import { OutputDrawer } from './components/OutputDrawer.tsx';
import { VoiceModal } from './components/VoiceModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AIStudioHubModal } from './components/AIStudioHubModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import { useRaOneVoice } from './hooks/useRaOneVoice.ts';
import { Conversation, ChatMessage, ProjectItem } from './types/index.ts';
import { subscribeToAuth } from './lib/firebase.ts';
import {
  readLocalLlmConfig,
  streamLocalLlmFromBrowser,
  isLoopbackUrl,
} from './utils/localLlmClient.ts';
import {
  parseSseBuffer,
  flushSseBuffer,
  extractSseTextDelta,
} from './utils/sseParser.ts';

const SettingsModal = React.lazy(() =>
  import('./components/SettingsModal.tsx').then((m) => ({ default: m.SettingsModal }))
);
const UpgradeModal = React.lazy(() =>
  import('./components/UpgradeModal.tsx').then((m) => ({ default: m.UpgradeModal }))
);
const GoogleAIStudioWorkbench = React.lazy(() =>
  import('./components/GoogleAIStudioWorkbench.tsx').then((m) => ({
    default: m.GoogleAIStudioWorkbench,
  }))
);
const LeonardoVisionStudio = React.lazy(() =>
  import('./components/LeonardoVisionStudio.tsx').then((m) => ({
    default: m.LeonardoVisionStudio,
  }))
);
const LeonardoMotionStudio = React.lazy(() =>
  import('./components/LeonardoMotionStudio.tsx').then((m) => ({
    default: m.LeonardoMotionStudio,
  }))
);
const SunoAudioStudio = React.lazy(() =>
  import('./components/SunoAudioStudio.tsx').then((m) => ({ default: m.SunoAudioStudio }))
);
const DocumentAIStudio = React.lazy(() =>
  import('./components/DocumentAIStudio.tsx').then((m) => ({ default: m.DocumentAIStudio }))
);
const LibraryWindow = React.lazy(() =>
  import('./components/LibraryWindow.tsx').then((m) => ({ default: m.LibraryWindow }))
);

function getConversationsStorageKey(uid?: string | null): string {
  return `raone_conversations_v2_${uid || 'guest'}`;
}

function sanitizeConversationList(raw: unknown): Conversation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is Conversation =>
        Boolean(c && typeof c === 'object' && typeof (c as any).id === 'string')
    )
    .map((c) => ({
      ...c,
      title: typeof c.title === 'string' && c.title.trim() ? c.title : 'Chat',
      section:
        c.section === 'pinned' || c.section === 'projects' || c.section === 'recents'
          ? c.section
          : 'recents',
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : 'Today',
      updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : 'Just now',
      modelId: typeof c.modelId === 'string' ? c.modelId : 'gemini-4-hydrogen',
      messages: Array.isArray(c.messages)
        ? c.messages.filter(
            (m): m is ChatMessage =>
              Boolean(m && typeof m === 'object' && typeof (m as any).id === 'string' && typeof (m as any).content === 'string')
          )
        : [],
    }));
}

function readCachedConversations(uid?: string | null): Conversation[] {
  try {
    const saved = localStorage.getItem(getConversationsStorageKey(uid));
    if (saved) {
      const parsed = JSON.parse(saved);
      const sanitized = sanitizeConversationList(parsed);
      if (sanitized.length > 0) return sanitized;
    }
  } catch (e) {
    console.warn('LocalStorage reading error:', e);
  }
  return [];
}

export default function App() {
  // Real conversations persisted per-tenant in LocalStorage & Backend (Zero hardcoded mock data)
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    readCachedConversations('guest')
  );

  const [activeId, setActiveId] = useState<string>(() => {
    return conversations[0]?.id || 'new';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isOutputsOpen, setIsOutputsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [activeProvider, setActiveProvider] = useState<'auto' | 'gemini' | 'groq' | 'local'>('auto');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState<boolean>(false);
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
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'plus' | 'ultimate'>('free');
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const [inputFocusTrigger, setInputFocusTrigger] = useState<number>(0);
  const [isTemporaryChat, setIsTemporaryChat] = useState<boolean>(false);
  const [temporaryMessages, setTemporaryMessages] = useState<ChatMessage[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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
        setIsLibraryOpen(false);
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

  const activeUid = currentUser?.uid || null;

  // Hydrate tenant workspace data from backend whenever the authenticated user changes
  useEffect(() => {
    let cancelled = false;
    const tenantCached = readCachedConversations(activeUid);
    setConversations(tenantCached);
    setActiveId(tenantCached[0]?.id || 'new');
    setActiveProjectId(null);

    if (!activeUid) {
      setCurrentPlan('free');
      setProjects([]);
    }

    fetch('/api/user/plan')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.plan && ['free', 'plus', 'ultimate'].includes(data.plan)) {
          setCurrentPlan(data.plan);
        }
      })
      .catch((err) => console.warn('Plan fetch note:', err));

    fetch('/api/user/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data?.activeProvider && ['auto', 'gemini', 'groq', 'local'].includes(data.activeProvider)) {
          setActiveProvider(data.activeProvider);
        }
        if (data?.selectedModel && typeof data.selectedModel === 'string') {
          setSelectedModel(data.selectedModel);
        }
      })
      .catch((err) => console.warn('Settings hydration note:', err));

    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setProjects(data);
        }
      })
      .catch((err) => console.warn('Projects hydration note:', err));

    fetch('/api/conversations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const sanitized = sanitizeConversationList(data);
        if (!cancelled && sanitized.length > 0) {
          setConversations((prev) => {
            if (prev.length === 0) {
              setActiveId(sanitized[0].id);
              return sanitized;
            }
            return prev;
          });
        }
      })
      .catch((err) => console.warn('Backend conversations sync note:', err));

    return () => {
      cancelled = true;
    };
  }, [activeUid]);

  // Sync to UID-scoped localStorage
  useEffect(() => {
    try {
      localStorage.setItem(getConversationsStorageKey(activeUid), JSON.stringify(conversations));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [conversations, activeUid]);

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

  const lastMessageContentLength =
    activeConversation.messages[activeConversation.messages.length - 1]?.content?.length || 0;

  useEffect(() => {
    if (!showScrollDown) {
      scrollToBottom(isLoading ? 'smooth' : 'auto');
    }
  }, [activeConversation.messages.length, lastMessageContentLength, isLoading, showScrollDown]);

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
        setIsVoiceModalOpen(false);
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

      const streamChatRequest = async (
        payload: Record<string, any>,
        onChunk: (accumulatedText: string, meta?: any) => void
      ) => {
        const startMs = Date.now();
        const localCfg = readLocalLlmConfig(activeUid);
        const wantsLocal =
          payload.provider === 'local' ||
          String(payload.model || '').startsWith('local:');

        const shouldUseBrowserDirect =
          wantsLocal &&
          (localCfg.transport === 'browser_direct' ||
            (isLoopbackUrl(localCfg.baseUrl) && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'));

        if (shouldUseBrowserDirect) {
          const overrideModel = String(payload.model || '').startsWith('local:')
            ? String(payload.model).replace(/^local:/, '')
            : localCfg.modelId;
          return await streamLocalLlmFromBrowser({
            config: { ...localCfg, modelId: overrideModel || localCfg.modelId },
            prompt: payload.prompt || '',
            messages: payload.messages || [],
            systemContext: payload.context || '',
            onChunk,
          });
        }

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const contentType = response.headers.get('content-type') || '';

        // If backend returned JSON (e.g. non-streaming fallback or error), handle cleanly
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (!response.ok || data.source === 'error') {
            throw new Error(data?.error || `Backend request failed (${response.status}).`);
          }
          const textOut = data.text || '';
          onChunk(textOut, {
            ...data,
            elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
          });
          return {
            text: textOut,
            meta: { ...data, elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1) },
          };
        }

        if (!response.ok && !contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
          const errSnippet = await response.text().catch(() => '');
          throw new Error(
            `Backend API returned error (${response.status}): ${errSnippet.slice(0, 180) || 'Unable to stream response.'}`
          );
        }

        if (!contentType.includes('text/event-stream') || !response.body) {
          throw new Error(
            `Backend API returned non-JSON/non-SSE response (${response.status}). Make sure the RaOne backend server (server.ts) is deployed and connected.`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let finalMeta: any = {};

        const processSseEvent = (evt: any) => {
          if (!evt || typeof evt !== 'object') return;
          if (evt.type === 'error') {
            throw new Error(evt.error || 'AI streaming error');
          }
          if (evt.type === 'start') {
            finalMeta = {
              ...finalMeta,
              source: evt.source ?? finalMeta.source,
              verifiedModel: evt.model ?? finalMeta.verifiedModel,
            };
          }
          const deltaText = extractSseTextDelta(evt);
          if (deltaText) {
            accumulated += deltaText;
            onChunk(accumulated, finalMeta);
          }
          if (evt.type === 'done') {
            finalMeta = {
              ...finalMeta,
              ...evt,
              elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
            };
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // Flush any trailing UTF-8 bytes and unterminated SSE frame at EOF
            buffer += decoder.decode();
            for (const parsedEvt of flushSseBuffer(buffer)) {
              processSseEvent(parsedEvt.json);
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSseBuffer(buffer);
          buffer = rest;

          for (const parsedEvt of events) {
            processSseEvent(parsedEvt.json);
          }
        }

        if (!accumulated) {
          throw new Error('Empty response received from AI provider.');
        }

        return { text: accumulated, meta: finalMeta };
      };

      const buildThoughtProcess = (meta: any) => {
        const lines = [
          `Verified Brain: ${
            meta?.source === 'gemini'
              ? 'Google Gemini API (Live)'
              : meta?.source === 'groq'
              ? 'Groq Cloud LPU (Meta Llama Live)'
              : meta?.source === 'local_llm_direct'
              ? 'Local Model Engine (Browser Direct · llama.cpp / Ollama)'
              : meta?.source === 'local_llm'
              ? 'Local Model Engine (Backend Bridge · llama.cpp)'
              : meta?.source || 'Verified Provider'
          }`,
          `Model Executed: ${meta?.verifiedModel || meta?.model || selectedModel}`,
        ];
        if (meta?.modelVersion) lines.push(`Model Version: ${meta.modelVersion}`);
        if (meta?.responseId) lines.push(`Response ID: ${meta.responseId}`);
        if (meta?.usage?.totalTokens) {
          lines.push(
            `Tokens: ${meta.usage.promptTokens ?? 0} prompt + ${meta.usage.candidateTokens ?? 0} output = ${meta.usage.totalTokens} total`
          );
        }
        if (typeof meta?.latencyMs === 'number') {
          lines.push(`Server Latency: ${meta.latencyMs}ms`);
        }
        lines.push(`Grounding: Search (${Boolean(options?.enableSearch)}), Maps (${Boolean(options?.enableMaps)})`);
        return lines.join('\n');
      };

      // In-Memory Temporary Private Chat: Zero persistence to disk or backend
      if (isTemporaryChat) {
        const tempMsgId = `m-${Date.now()}`;
        setTemporaryMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);
        setIsSearchingWeb(Boolean(options?.enableSearch));

        try {
          const history = temporaryMessages.slice(-6);
          let insertedPlaceholder = false;

          const activeProject = projects.find((p) => p.id === activeProjectId) || null;
          const projectContextText = activeProject
            ? `Active Workspace Project: ${activeProject.name}${activeProject.description ? `\nDescription: ${activeProject.description}` : ''}${activeProject.instructions ? `\nInstructions: ${activeProject.instructions}` : ''}`
            : '';

          const { text: replyText, meta } = await streamChatRequest(
            {
              prompt: text,
              mode: 'chat',
              context: projectContextText,
              model: selectedModel,
              provider: activeProvider,
              enableSearch: options?.enableSearch,
              enableMaps: options?.enableMaps,
              isTemporary: true,
              messages: history.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
            (partialText, partialMeta) => {
              if (!insertedPlaceholder) {
                insertedPlaceholder = true;
                setIsLoading(false);
                setTemporaryMessages((prev) => [
                  ...prev,
                  {
                    id: tempMsgId,
                    role: 'model',
                    content: partialText,
                    model: partialMeta?.verifiedModel || selectedModel,
                    verifiedSource: partialMeta?.source,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isTemporary: true,
                  },
                ]);
              } else {
                setTemporaryMessages((prev) =>
                  prev.map((m) => (m.id === tempMsgId ? { ...m, content: partialText } : m))
                );
              }
            }
          );

          const finalMsg: ChatMessage = {
            id: tempMsgId,
            role: 'model',
            content: replyText,
            model: meta?.verifiedModel || meta?.model || selectedModel,
            verifiedSource: meta?.source,
            modelVersion: meta?.modelVersion,
            responseId: meta?.responseId,
            tokenUsage: meta?.usage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            thinkingTime: `${meta?.elapsedSec || '0.5'}s`,
            thoughtProcess: buildThoughtProcess(meta),
            searchQueries: meta?.searchQueries,
            groundingSources: meta?.groundingSources,
            mapsSources: meta?.mapsSources,
            isTemporary: true,
          };

          setTemporaryMessages((prev) =>
            insertedPlaceholder
              ? prev.map((m) => (m.id === tempMsgId ? finalMsg : m))
              : [...prev, finalMsg]
          );

          if (isVoiceModalOpen) {
            voice.speakText(replyText);
          }
        } catch (err: any) {
          console.error('Temporary chat error:', err);
          const errorMessage: ChatMessage = {
            id: `m-err-${Date.now()}`,
            role: 'model',
            content: `⚠️ **Backend / Gemini Error:** ${err?.message || 'Unable to reach RaOne AI server.'}`,
            model: selectedModel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isTemporary: true,
          };
          setTemporaryMessages((prev) => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
          setIsSearchingWeb(false);
        }
        return;
      }

      const activeProject = projects.find((p) => p.id === activeProjectId) || null;
      const projectContextText = activeProject
        ? `Active Workspace Project: ${activeProject.name}${activeProject.description ? `\nDescription: ${activeProject.description}` : ''}${activeProject.instructions ? `\nInstructions: ${activeProject.instructions}` : ''}`
        : '';

      if (isNewConv) {
        currentConvId = `conv-${Date.now()}`;
        const newConversation: Conversation = {
          id: currentConvId,
          title: autoTitle,
          section: activeProject ? 'projects' : 'recents',
          projectName: activeProject?.name,
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
      setIsSearchingWeb(Boolean(options?.enableSearch));

      try {
        const history = isNewConv ? [] : activeConversation.messages.slice(-6);
        const streamMsgId = `m-${Date.now()}`;
        let insertedPlaceholder = false;

        const { text: replyText, meta } = await streamChatRequest(
          {
            prompt: text,
            mode: 'chat',
            context: projectContextText,
            model: selectedModel,
            provider: activeProvider,
            enableSearch: options?.enableSearch,
            enableMaps: options?.enableMaps,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
          (partialText, partialMeta) => {
            if (!insertedPlaceholder) {
              insertedPlaceholder = true;
              setIsLoading(false);
              const initialModelMsg: ChatMessage = {
                id: streamMsgId,
                role: 'model',
                content: partialText,
                model: partialMeta?.verifiedModel || selectedModel,
                verifiedSource: partialMeta?.source,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              };
              setConversations((prev) => {
                const exists = prev.some((c) => c.id === currentConvId);
                if (!exists) {
                  return [
                    {
                      id: currentConvId,
                      title: autoTitle,
                      section: activeProject ? 'projects' : 'recents',
                      projectName: activeProject?.name,
                      createdAt: 'Today',
                      updatedAt: 'Just now',
                      modelId: selectedModel,
                      messages: [userMessage, initialModelMsg],
                    },
                    ...prev,
                  ];
                }
                return prev.map((c) =>
                  c.id === currentConvId
                    ? { ...c, messages: [...c.messages, initialModelMsg], updatedAt: 'Just now' }
                    : c
                );
              });
            } else {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === currentConvId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === streamMsgId
                            ? {
                                ...m,
                                content: partialText,
                                model: partialMeta?.verifiedModel || m.model,
                                verifiedSource: partialMeta?.source || m.verifiedSource,
                              }
                            : m
                        ),
                      }
                    : c
                )
              );
            }
          }
        );

        const modelMessage: ChatMessage = {
          id: streamMsgId,
          role: 'model',
          content: replyText,
          model: meta?.verifiedModel || meta?.model || selectedModel,
          verifiedSource: meta?.source,
          modelVersion: meta?.modelVersion,
          responseId: meta?.responseId,
          tokenUsage: meta?.usage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          thinkingTime: `${meta?.elapsedSec || '0.5'}s`,
          thoughtProcess: buildThoughtProcess(meta),
          searchQueries: meta?.searchQueries,
          groundingSources: meta?.groundingSources,
          mapsSources: meta?.mapsSources,
        };

        setConversations((prev) => {
          const updated = prev.map((c) => {
            if (c.id === currentConvId) {
              const nextMessages = insertedPlaceholder
                ? c.messages.map((m) => (m.id === streamMsgId ? modelMessage : m))
                : [...c.messages, modelMessage];
              const updatedConv = {
                ...c,
                messages: nextMessages,
                updatedAt: 'Just now',
              };
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
        const errorMessage: ChatMessage = {
          id: `m-err-${Date.now()}`,
          role: 'model',
          content: `⚠️ **Backend / Gemini Error:** ${err?.message || 'Unable to reach RaOne AI server.'}`,
          model: selectedModel,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, messages: [...c.messages, errorMessage], updatedAt: 'Just now' }
              : c
          )
        );
      } finally {
        setIsLoading(false);
        setIsSearchingWeb(false);
      }
    },
    [
      activeConversation.messages,
      activeId,
      activeProjectId,
      activeProvider,
      activeUid,
      conversations,
      isLoading,
      isTemporaryChat,
      isVoiceModalOpen,
      projects,
      selectedModel,
      temporaryMessages,
      voice,
    ]
  );

  const handleCreateProject = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data?.project) {
        setProjects((prev) => [data.project, ...prev]);
        setActiveProjectId(data.project.id);
      }
    } catch (err) {
      console.warn('Could not create project:', err);
    }
  }, []);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(() => {});
    },
    [activeProjectId]
  );

  // New Chat action (Exact ChatGPT behavior)
  const handleNewChat = () => {
    setIsLibraryOpen(false);
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
          setIsLibraryOpen(false);
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
        isLibraryOpen={isLibraryOpen}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={(id) => {
          setIsLibraryOpen(false);
          setActiveProjectId(id);
        }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Chat Workspace or Library Window */}
      {isLibraryOpen ? (
        <Suspense fallback={null}>
          <LibraryWindow
            isSidebarOpen={isSidebarOpen}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            onOpenVisionStudio={() => setIsVisionStudioOpen(true)}
            onOpenMotionStudio={() => setIsMotionStudioOpen(true)}
            onOpenAudioStudio={() => setIsAudioStudioOpen(true)}
            onOpenDocumentStudio={() => setIsDocumentStudioOpen(true)}
            onOpenAIStudio={() => setIsGoogleAIStudioOpen(true)}
          />
        </Suspense>
      ) : (
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
              onOpenLibrary={() => setIsLibraryOpen(true)}
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
              {activeConversation.messages.map((message, idx) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  onSpeak={voice.speakText}
                  onRegenerate={() => {
                    const prevUserMsg = activeConversation.messages
                      .slice(0, idx)
                      .reverse()
                      .find((m) => m.role === 'user');
                    const queryToRetry = prevUserMsg?.content || message.content;
                    handleSendMessage(queryToRetry, {
                      enableSearch: Boolean(message.groundingSources?.length || message.searchQueries?.length),
                    });
                  }}
                  isSpeaking={voice.isSpeaking}
                />
              ))}

              {/* Thinking / Web Search indicator */}
              {isLoading && (
                <div className="my-5 max-w-[760px] mx-auto px-4">
                  <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                    <div className={`w-2 h-2 rounded-full animate-ping ${isSearchingWeb ? 'bg-sky-400' : 'bg-white'}`} />
                    <span className="font-mono">
                      {isSearchingWeb ? 'Searching Google for real-time information...' : 'Thinking...'}
                    </span>
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
              onOpenLibrary={() => setIsLibraryOpen(true)}
              inputFocusTrigger={inputFocusTrigger}
              isTemporary={isTemporaryChat}
            />
          </>
        )}
      </div>
      )}

      {/* Outputs / Artifacts Drawer (Right Rail matching screenshot) */}
      <OutputDrawer
        isOpen={isOutputsOpen}
        onClose={() => setIsOutputsOpen(false)}
        outputs={
          activeConversation.messages.flatMap((m) => m.outputs || [])
        }
      />

      {/* Settings Modal (100% ChatGPT Settings Center) */}
      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            uid={activeUid}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            activeProvider={activeProvider}
            onSelectProvider={setActiveProvider}
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
        )}
      </Suspense>

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
        onSendVoiceQuery={(query) => {
          voice.clearTranscript();
          handleSendMessage(query);
        }}
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

      <Suspense fallback={null}>
        {/* Subscription Plans Modal (Free, Plus, Ultimate) */}
        {isUpgradeModalOpen && (
          <UpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            currentPlan={currentPlan}
            onPlanChanged={(newPlan) => setCurrentPlan(newPlan)}
          />
        )}

        {/* Google AI Studio Developer Workbench & Model Playground */}
        {isGoogleAIStudioOpen && (
          <GoogleAIStudioWorkbench
            isOpen={isGoogleAIStudioOpen}
            onClose={() => setIsGoogleAIStudioOpen(false)}
          />
        )}

        {/* Leonardo AI Vision Studio (Silicon Valley Grade T2I Engine) */}
        {isVisionStudioOpen && (
          <LeonardoVisionStudio
            isOpen={isVisionStudioOpen}
            onClose={() => setIsVisionStudioOpen(false)}
          />
        )}

        {/* RaOne Cinema Studio (Leonardo AI Motion & Video Diffusion Engine) */}
        {isMotionStudioOpen && (
          <LeonardoMotionStudio
            isOpen={isMotionStudioOpen}
            onClose={() => setIsMotionStudioOpen(false)}
          />
        )}

        {/* RaOne Suno Audio Studio (AI Music & Vocals Synthesis) */}
        {isAudioStudioOpen && (
          <SunoAudioStudio
            isOpen={isAudioStudioOpen}
            onClose={() => setIsAudioStudioOpen(false)}
          />
        )}

        {/* RaOne DocuStudio (NotebookLM + Gamma App + Microsoft Copilot) */}
        {isDocumentStudioOpen && (
          <DocumentAIStudio
            isOpen={isDocumentStudioOpen}
            onClose={() => setIsDocumentStudioOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
