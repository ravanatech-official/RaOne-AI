import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Mic,
  Brain,
  Paperclip,
  ImageIcon,
  Globe,
  Folder,
  Compass,
  Check,
} from 'lucide-react';

interface ChatInputDockProps {
  onSendMessage: (
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
  ) => void;
  isLoading: boolean;
  onOpenVoice: () => void;
  isListening?: boolean;
  isContinuousWakeListening?: boolean;
  showScrollDown?: boolean;
  onScrollToBottom?: () => void;
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  onOpenStudioHub?: (tab?: 'image' | 'music' | 'video' | 'transcribe') => void;
  onOpenLibrary?: () => void;
  isCenterState?: boolean;
  inputFocusTrigger?: number;
  isTemporary?: boolean;
}

interface AttachedUploadItem {
  id: string;
  file: File;
  status: 'extracting' | 'ready' | 'error';
  extractedText?: string;
  charCount?: number;
  error?: string;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  onSendMessage,
  isLoading,
  onOpenVoice,
  onOpenStudioHub,
  onOpenLibrary,
  isCenterState = false,
  inputFocusTrigger = 0,
  isTemporary = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isThinkingActive, setIsThinkingActive] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedUploadItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // Focus input when inputFocusTrigger changes (e.g. from Ctrl+K)
  useEffect(() => {
    if (inputFocusTrigger > 0) {
      textareaRef.current?.focus();
    }
  }, [inputFocusTrigger]);

  const menuItems = [
    {
      id: 'files',
      title: 'Add photos & files',
      desc: 'Upload from computer',
      icon: <Paperclip className="w-4 h-4 text-[#e0e0e0] shrink-0" />,
    },
    {
      id: 'library',
      title: 'Add from library',
      desc: 'Browse and search your files',
      icon: (
        <img
          src="/assets/aistudio/RaOne_Library_4c928d53.png"
          alt="RaOne Library Logo"
          className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]"
        />
      ),
    },
    {
      id: 'image',
      title: 'Create image',
      desc: 'Visualize anything',
      icon: (
        <div className="w-4 h-4 rounded bg-[#10b981] flex items-center justify-center shrink-0">
          <ImageIcon className="w-2.5 h-2.5 text-white" />
        </div>
      ),
    },
    {
      id: 'search',
      title: 'Web search',
      desc: 'Find real-time news and info',
      icon: <Globe className="w-4 h-4 text-[#38bdf8] shrink-0" />,
    },
    {
      id: 'project',
      title: 'Work in a project',
      desc: 'Start a chat in a project',
      icon: <Folder className="w-4 h-4 text-[#e0e0e0] shrink-0" />,
    },
    {
      id: 'research',
      title: 'Deep research',
      desc: 'Get a detailed report',
      icon: <Compass className="w-4 h-4 text-[#e0e0e0] shrink-0" />,
    },
    {
      id: 'sketch',
      title: 'Sketch',
      desc: 'Draw and attach an image',
      icon: (
        <svg
          className="w-4 h-4 text-[#22d3ee] shrink-0 fill-none stroke-current stroke-[2]"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 18c2-4 4-8 7-8s4 6 7 4 2-8 2-8" />
        </svg>
      ),
    },
    {
      id: 'thinking',
      title: 'Thinking',
      desc: 'For detailed answers',
      icon: <Brain className="w-4 h-4 text-[#e0e0e0] shrink-0" />,
    },
    {
      id: 'plugin',
      title: 'Plugin Creator',
      desc: 'Create and edit plugins',
      icon: (
        <img
          src="/assets/aistudio/RaOne_Plugins_4adb9c36.png"
          alt="RaOne Plugins Logo"
          className="w-4 h-4 object-contain rounded shrink-0 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]"
        />
      ),
    },
  ];

  // Close dropdown on outside click or handle arrow keys
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        plusButtonRef.current &&
        !plusButtonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setActiveItemIndex(-1);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDropdownOpen) return;

      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setActiveItemIndex(-1);
        textareaRef.current?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveItemIndex((prev) => (prev + 1) % menuItems.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveItemIndex((prev) => (prev <= 0 ? menuItems.length - 1 : prev - 1));
      } else if (event.key === 'Enter' && activeItemIndex >= 0) {
        event.preventDefault();
        handleSelectMenuItem(menuItems[activeItemIndex].id);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen, activeItemIndex]);

  const isExtractingFiles = attachedFiles.some((f) => f.status === 'extracting');

  const handleSend = () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isLoading || isExtractingFiles) return;

    const readyAttachments = attachedFiles.filter((f) => f.status === 'ready');
    let promptToSend = inputText.trim();
    if (readyAttachments.length > 0) {
      const blocks = readyAttachments
        .map((item) => {
          const excerpt = (item.extractedText || '').trim();
          return excerpt
            ? `--- Attached File: ${item.file.name} (${item.charCount || excerpt.length} chars) ---\n${excerpt}`
            : `[Attached file: ${item.file.name}]`;
        })
        .join('\n\n');
      promptToSend = promptToSend ? `${blocks}\n\n${promptToSend}` : blocks;
    }

    if (!promptToSend) {
      setUploadError('Please enter a message or wait for a valid file to finish extracting.');
      return;
    }

    onSendMessage(promptToSend, {
      enableSearch: isSearchActive,
    });

    setInputText('');
    setAttachedFiles([]);
    setUploadError(null);
    setIsDropdownOpen(false);
    setActiveItemIndex(-1);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const extractSingleFile = async (itemId: string, file: File) => {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/uploads/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to extract text from ${file.name}`);
      }

      setAttachedFiles((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'ready',
                extractedText: data.extractedText || '',
                charCount: data.charCount || (data.extractedText || '').length,
              }
            : item
        )
      );
    } catch (err: any) {
      const errMsg = err?.message || `Unable to parse ${file.name}`;
      setUploadError(errMsg);
      setAttachedFiles((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: 'error', error: errMsg } : item
        )
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setUploadError(null);
      const newItems: AttachedUploadItem[] = filesArray.map((file, idx) => ({
        id: `att-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        status: 'extracting',
      }));
      setAttachedFiles((prev) => [...prev, ...newItems]);
      newItems.forEach((item) => {
        void extractSingleFile(item.id, item.file);
      });
      e.target.value = '';
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
    }
  };

  const handleSelectMenuItem = (action: string) => {
    if (action === 'files') {
      fileInputRef.current?.click();
    } else if (action === 'image') {
      setInputText((prev) => (prev ? `${prev} ` : '') + 'Create an image of ');
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
      textareaRef.current?.focus();
    } else if (action === 'search') {
      setIsSearchActive((prev) => !prev);
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
    } else if (action === 'thinking') {
      setIsThinkingActive((prev) => !prev);
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
    } else if (action === 'research') {
      setInputText((prev) => (prev ? `${prev} ` : '') + 'Conduct deep research on ');
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
      textareaRef.current?.focus();
    } else if (action === 'sketch') {
      setInputText((prev) => (prev ? `${prev} ` : '') + 'Sketch concept: ');
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
      textareaRef.current?.focus();
    } else if (action === 'library') {
      if (onOpenLibrary) onOpenLibrary();
      else if (onOpenStudioHub) onOpenStudioHub('transcribe');
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
    } else if (action === 'project') {
      setInputText((prev) => (prev ? `${prev} ` : '') + 'In this project, ');
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
      textareaRef.current?.focus();
    } else if (action === 'plugin') {
      if (onOpenStudioHub) onOpenStudioHub('image');
      setIsDropdownOpen(false);
      setActiveItemIndex(-1);
    }
  };

  return (
    <div className="relative w-full max-w-[760px] mx-auto px-4 pb-2 select-none">
      {/* Hidden file input for "Add photos & files" */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.yml,.yaml,.sql,.xml"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Pill Dock */}
      <div className="relative bg-[#212121] border border-[#303030] rounded-[28px] px-3 py-2 flex items-center gap-2 shadow-2xl transition-all z-20">
        {/* + Button (Toggles Dropdown Menu) */}
        <button
          ref={plusButtonRef}
          onClick={() => {
            setIsDropdownOpen(!isDropdownOpen);
            setActiveItemIndex(-1);
          }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
            isDropdownOpen
              ? 'bg-[#383838] text-white rotate-45'
              : 'bg-[#2b2b2b] hover:bg-[#343434] text-white'
          }`}
          title="Add attachment or features"
        >
          <Plus className="w-4 h-4 transition-transform duration-200" />
        </button>

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isTemporary
              ? 'Ask anything privately (Temporary Chat)...'
              : isSearchActive
              ? 'Search the web in real time with RaOne...'
              : 'Ask ChatGPT'
          }
          className="w-full bg-transparent text-[#ECECEC] placeholder-[#8E8E8E] text-[15px] focus:outline-none resize-none px-1 py-1 max-h-40 leading-normal font-normal"
        />

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Web Search Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSearchActive(!isSearchActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isSearchActive
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-[#8E8E8E] hover:text-white hover:bg-white/5'
            }`}
            title="Search the web for real-time information"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          {/* Think Button */}
          <button
            type="button"
            onClick={() => setIsThinkingActive(!isThinkingActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isThinkingActive
                ? 'bg-white/10 text-white'
                : 'text-[#8E8E8E] hover:text-white hover:bg-white/5'
            }`}
            title="Thinking mode"
          >
            <Brain className="w-4 h-4" />
            <span>Think</span>
          </button>

          {/* Microphone Icon */}
          <button
            onClick={onOpenVoice}
            className="p-1.5 rounded-full text-[#8E8E8E] hover:text-white hover:bg-white/5 transition-colors"
            title="Dictate with voice"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Blue Voice Mode Pill Button */}
          <button
            onClick={onOpenVoice}
            className="w-8 h-8 rounded-full bg-[#1d63ed] hover:bg-[#1953ca] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
            title="Voice mode"
          >
            <div className="flex items-center gap-[2px] h-3.5">
              <span className="w-[2px] h-2 bg-white rounded-full animate-pulse" />
              <span className="w-[2px] h-3.5 bg-white rounded-full" />
              <span className="w-[2px] h-2 bg-white rounded-full animate-pulse" />
            </div>
          </button>
        </div>
      </div>

      {/* Floating Dropdown Menu (Full view without truncation) */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className={`absolute left-4 right-4 z-50 bg-[#212121] border border-[#333333] rounded-2xl shadow-[0_12px_44px_rgba(0,0,0,0.9)] p-1.5 overflow-y-auto chat-scroll-area animate-in fade-in zoom-in-95 duration-150 ${
            isCenterState
              ? 'top-full mt-2 max-h-[min(380px,calc(100vh-250px))]'
              : 'bottom-full mb-2 max-h-[min(380px,calc(100vh-140px))]'
          }`}
        >
          {menuItems.map((item, index) => {
            const isHighlighted = activeItemIndex === index;
            const isItemActive =
              (item.id === 'search' && isSearchActive) ||
              (item.id === 'thinking' && isThinkingActive);
            return (
              <button
                key={item.id}
                onClick={() => handleSelectMenuItem(item.id)}
                onMouseEnter={() => setActiveItemIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left group ${
                  isHighlighted ? 'bg-[#2e2e2e]' : 'hover:bg-[#2c2c2c]'
                }`}
              >
                {item.icon}
                <div className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium text-white shrink-0">
                    {item.title}
                  </span>
                  <span className="text-xs text-[#8e8e8e] truncate">{item.desc}</span>
                </div>
                {isItemActive && (
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Attached files indicator badge */}
      {(attachedFiles.length > 0 || uploadError) && (
        <div className="mt-2 space-y-1.5 px-2">
          {uploadError && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1">
              {uploadError}
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedFiles.map((item) => (
                <span
                  key={item.id}
                  title={item.error || `${item.file.name} (${item.status})`}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                    item.status === 'error'
                      ? 'bg-red-950/50 border-red-500/40 text-red-200'
                      : item.status === 'extracting'
                      ? 'bg-[#262626] border-amber-500/40 text-amber-200'
                      : 'bg-[#262626] border-emerald-500/40 text-white'
                  }`}
                >
                  <Paperclip className="w-3 h-3 text-[#8e8e8e]" />
                  <span className="truncate max-w-[160px]">{item.file.name}</span>
                  <span className="text-[10px] opacity-80">
                    {item.status === 'extracting'
                      ? 'extracting...'
                      : item.status === 'error'
                      ? 'failed'
                      : `${Math.max(1, Math.round((item.charCount || 0) / 100) / 10)}k`}
                  </span>
                  <button
                    onClick={() =>
                      setAttachedFiles((prev) => prev.filter((x) => x.id !== item.id))
                    }
                    className="text-[#8e8e8e] hover:text-white ml-0.5"
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
