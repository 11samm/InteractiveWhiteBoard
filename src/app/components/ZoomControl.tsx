import { useState } from 'react';
import { Minus, Plus, MoreVertical, Sun, Moon, Grid3x3, Search } from 'lucide-react';

interface ZoomControlProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  showGrid: boolean;
  onGridChange: (show: boolean) => void;
}

export function ZoomControl({ theme, onThemeChange, showGrid, onGridChange }: ZoomControlProps) {
  const [zoom, setZoom] = useState(100);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleZoomIn = () => {
    setZoom(Math.min(200, zoom + 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(50, zoom - 10));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  return (
    <div className="fixed bottom-8 left-8 z-50">
      {/* Settings dropdown */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsMenuOpen(false)}
          />
          <div className={`absolute bottom-full mb-2 left-0 min-w-[200px] p-3 rounded-xl backdrop-blur-xl shadow-2xl border z-50 ${
            theme === 'dark' 
              ? 'bg-slate-900/95 border-white/20' 
              : 'bg-white/95 border-slate-900/20'
          }`}>
            <div className="space-y-3">
              {/* Theme Toggle */}
              <div>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>Theme</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                      theme === 'light'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                      theme === 'dark'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                </div>
              </div>

              <div className={`h-px ${
                theme === 'dark' ? 'bg-white/10' : 'bg-slate-900/10'
              }`} />

              {/* Grid Toggle */}
              <button
                onClick={() => onGridChange(!showGrid)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  theme === 'dark'
                    ? 'hover:bg-white/10 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4" />
                  <span className="text-sm">Grid Lines</span>
                </div>
                <div className={`w-9 h-5 rounded-full transition-all ${
                  showGrid 
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600' 
                    : theme === 'dark' 
                      ? 'bg-white/20' 
                      : 'bg-slate-300'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform shadow-sm ${
                    showGrid ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Zoom control pill */}
      <div className={`flex items-center gap-1 px-3 py-2 rounded-full backdrop-blur-xl shadow-2xl border ${
        theme === 'dark'
          ? 'bg-white/10 border-white/20'
          : 'bg-slate-900/10 border-slate-900/20'
      }`}>
        <button
          onClick={handleZoomOut}
          className={`p-1.5 rounded-full transition-all ${
            theme === 'dark'
              ? 'text-slate-300 hover:bg-white/10 hover:text-white'
              : 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-900'
          }`}
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleResetZoom}
          className={`p-1.5 rounded-full transition-all ${
            zoom === 100
              ? theme === 'dark'
                ? 'text-slate-500'
                : 'text-slate-400'
              : theme === 'dark'
                ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                : 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-900'
          }`}
          aria-label="Reset zoom"
          title={`${zoom}%`}
        >
          <Search className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleZoomIn}
          className={`p-1.5 rounded-full transition-all ${
            theme === 'dark'
              ? 'text-slate-300 hover:bg-white/10 hover:text-white'
              : 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-900'
          }`}
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className={`w-px h-5 mx-1 ${
          theme === 'dark' ? 'bg-white/20' : 'bg-slate-900/20'
        }`} />

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-1.5 rounded-full transition-all ${
            isMenuOpen
              ? theme === 'dark'
                ? 'bg-white/20 text-white'
                : 'bg-slate-900/20 text-slate-900'
              : theme === 'dark'
                ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                : 'text-slate-600 hover:bg-slate-900/10 hover:text-slate-900'
          }`}
          aria-label="Settings"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}