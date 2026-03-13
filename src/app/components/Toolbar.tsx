import { MousePointer2, Pencil, Square, Type, Mic } from 'lucide-react';
import { useState } from 'react';

interface ToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  theme: 'light' | 'dark';
}

export function Toolbar({ activeTool, onToolChange, theme }: ToolbarProps) {
  const [isMicActive, setIsMicActive] = useState(false);
  
  const tools = [
    { id: 'cursor', icon: MousePointer2, label: 'Cursor' },
    { id: 'pencil', icon: Pencil, label: 'Pencil' },
    { id: 'shapes', icon: Square, label: 'Shapes' },
    { id: 'text', icon: Type, label: 'Text' },
  ];

  const handleMicClick = () => {
    setIsMicActive(true);
    onToolChange('ai');
    setTimeout(() => setIsMicActive(false), 300);
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl backdrop-blur-xl shadow-2xl border ${
        theme === 'dark'
          ? 'bg-white/10 border-white/20'
          : 'bg-slate-900/10 border-slate-900/20'
      }`}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`p-3 rounded-lg transition-all ${
                activeTool === tool.id
                  ? theme === 'dark'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-900/20 text-slate-900'
                  : theme === 'dark'
                    ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-900'
              }`}
              aria-label={tool.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
        
        <div className={`w-px h-8 mx-2 ${
          theme === 'dark' ? 'bg-white/20' : 'bg-slate-900/20'
        }`} />
        
        <button
          onClick={handleMicClick}
          className={`relative p-4 rounded-xl transition-all duration-300 ${
            isMicActive ? 'scale-95' : 'scale-100'
          }`}
          style={{
            background: isMicActive 
              ? 'linear-gradient(135deg, #00F0FF 0%, #00B8D4 100%)'
              : 'linear-gradient(135deg, #00F0FF 0%, #7000FF 100%)',
            boxShadow: isMicActive 
              ? '0 0 15px rgba(0, 240, 255, 0.4), 0 0 25px rgba(0, 184, 212, 0.2)'
              : '0 0 15px rgba(0, 240, 255, 0.3), 0 0 25px rgba(112, 0, 255, 0.2)'
          }}
          aria-label="Speak to AI"
        >
          <Mic className="w-5 h-5 text-white relative z-10" />
          <div 
            className="absolute inset-0 rounded-xl blur-md transition-all duration-300"
            style={{
              background: isMicActive
                ? 'linear-gradient(135deg, #00F0FF 0%, #00B8D4 100%)'
                : 'linear-gradient(135deg, #00F0FF 0%, #7000FF 100%)',
              opacity: isMicActive ? 0.6 : 0.4,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          />
        </button>
      </div>
    </div>
  );
}