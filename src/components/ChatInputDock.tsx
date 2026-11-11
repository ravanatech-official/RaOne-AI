import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Mic,
  Brain,
  Paperclip,
  FileText,
  ImageIcon,
  Globe,
  Folder,
  Compass,
  Puzzle,
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
  isCenterState?: boolean;
  inputFocusTrigger?: number;
  isTemporary?: boolean;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  onSendMessage,
  isLoading,
  onOpenVoice,
  onOpenStudioHub,
  isCenterState = false,
  inputFocusTrigger = 0,
  isTemporary = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isThinkingActive, setIsThinkingActive] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
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
      icon: <FileText className="w-4 h-4 text-[#e0e0e0] shrink-0" />,
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
      icon: <Puzzle className="w-4 h-4 text-[#e0e0e0] shrink-0" />,
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

  const handleSend = () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isLoading) return;

    let promptToSend = inputText.trim();
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map((f) => f.name).join(', ');
      promptToSend = `[Attached files: ${fileNames}] ${promptToSend}`;
    }

    onSendMessage(promptToSend, {
      enableSearch: isSearchActive,
    });

    setInputText('');
    setAttachedFiles([]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...filesArray]);
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
      if (onOpenStudioHub) onOpenStudioHub('transcribe');
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
            isTemporary ? 'Ask anything privately (Temporary Chat)...' : 'Ask ChatGPT'
          }
          className="w-full bg-transparent text-[#ECECEC] placeholder-[#8E8E8E] text-[15px] focus:outline-none resize-none px-1 py-1 max-h-40 leading-normal font-normal"
        />

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Think Button */}
          <button
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
              </button>
            );
          })}
        </div>
      )}

      {/* Attached files indicator badge */}
      {attachedFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 px-2">
          {attachedFiles.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 bg-[#262626] border border-[#383838] text-white text-xs px-2.5 py-1 rounded-full"
            >
              <Paperclip className="w-3 h-3 text-[#8e8e8e]" />
              <span className="truncate max-w-[150px]">{f.name}</span>
              <button
                onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-[#8e8e8e] hover:text-white ml-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
