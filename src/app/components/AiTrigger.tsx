import { Sparkles } from 'lucide-react';
import { useState } from 'react';

interface AiTriggerProps {
  onAskAi?: () => void;
  isOpen?: boolean;
}

/**
 * Floating "ask the AI tutor" button. Tool switching, color, and size are
 * handled by tldraw's own native Toolbar/StylePanel (see `Board.tsx`) so
 * that keyboard shortcuts keep working; this is app-specific chrome layered
 * on top, positioned away from tldraw's own bottom-center toolbar.
 *
 * Opens a typed-question chat panel (`ChatPanel`) — voice is an explicit
 * later extension per PLAN.md 5.4, so this intentionally isn't a mic button.
 */
export function AiTrigger({ onAskAi, isOpen }: AiTriggerProps) {
  const [isActive, setIsActive] = useState(false);

  const handleClick = () => {
    setIsActive(true);
    onAskAi?.();
    setTimeout(() => setIsActive(false), 300);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button
        type="button"
        onClick={handleClick}
        className={`relative p-4 rounded-xl transition-all duration-300 ${isActive ? 'scale-95' : 'scale-100'}`}
        style={{
          background: isActive
            ? 'linear-gradient(135deg, #00F0FF 0%, #00B8D4 100%)'
            : 'linear-gradient(135deg, #00F0FF 0%, #7000FF 100%)',
          boxShadow: isActive
            ? '0 0 15px rgba(0, 240, 255, 0.4), 0 0 25px rgba(0, 184, 212, 0.2)'
            : '0 0 15px rgba(0, 240, 255, 0.3), 0 0 25px rgba(112, 0, 255, 0.2)',
        }}
        aria-label={isOpen ? 'Close the AI tutor' : 'Ask the AI tutor'}
        title={isOpen ? 'Close the AI tutor' : 'Ask the AI tutor'}
      >
        <Sparkles className="w-5 h-5 text-white relative z-10" />
        <div
          className="absolute inset-0 rounded-xl blur-md transition-all duration-300"
          style={{
            background: isActive
              ? 'linear-gradient(135deg, #00F0FF 0%, #00B8D4 100%)'
              : 'linear-gradient(135deg, #00F0FF 0%, #7000FF 100%)',
            opacity: isActive ? 0.6 : 0.4,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
      </button>
    </div>
  );
}
