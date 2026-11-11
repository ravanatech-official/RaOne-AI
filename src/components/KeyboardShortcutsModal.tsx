import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const isMac =
    typeof window !== 'undefined' &&
    (/Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      navigator.userAgent.includes('Mac'));

  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutGroups = [
    {
      category: 'Navigation & Chats',
      shortcuts: [
        { keys: [modKey, 'K'], description: 'Start a new chat' },
        { keys: [modKey, '/'], description: 'Search chats in sidebar' },
        { keys: [modKey, 'B'], description: 'Toggle left sidebar' },
        { keys: ['Esc'], description: 'Close menus, modals & dropdowns' },
      ],
    },
    {
      category: 'Input & Interaction',
      shortcuts: [
        { keys: ['Enter'], description: 'Send message' },
        { keys: ['Shift', 'Enter'], description: 'Add new line in input' },
        { keys: [modKey, 'Shift', 'V'], description: 'Open voice assistant' },
        { keys: [modKey, 'Shift', 'S'], description: 'Open settings & models' },
        { keys: ['?'], description: 'Show keyboard shortcuts helper' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2d2d2d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-white">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
              <p className="text-[11px] text-[#8e8e8e]">Quick navigation for power users</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8e8e] hover:text-white hover:bg-[#2a2a2a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts content */}
        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto chat-scroll-area">
          {shortcutGroups.map((group, idx) => (
            <div key={idx}>
              <div className="text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider mb-2.5">
                {group.category}
              </div>
              <div className="space-y-2">
                {group.shortcuts.map((sc, scIdx) => (
                  <div
                    key={scIdx}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#262626] transition-colors"
                  >
                    <span className="text-xs text-[#ececec]">{sc.description}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          <kbd className="px-2 py-0.5 min-w-[24px] text-center bg-[#2b2b2b] border border-[#3a3a3a] rounded text-[11px] font-mono text-white shadow-sm">
                            {k}
                          </kbd>
                          {kIdx < sc.keys.length - 1 && (
                            <span className="text-[10px] text-[#666]">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2d2d2d] bg-[#1a1a1a] flex items-center justify-between text-xs text-[#8e8e8e]">
          <span>Press <kbd className="px-1.5 py-0.5 bg-[#2b2b2b] rounded text-[10px] text-white">Esc</kbd> to close</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#2f2f2f] hover:bg-[#3a3a3a] text-white text-xs rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
