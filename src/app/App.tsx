import { useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { StudyContextSidebar } from './components/StudyContextSidebar';
import { UserAvatars } from './components/UserAvatars';
import { Canvas } from './components/Canvas';
import { ZoomControl } from './components/ZoomControl';

export default function App() {
  const [activeTool, setActiveTool] = useState('cursor');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showGrid, setShowGrid] = useState(true);

  return (
    <div className={`relative w-full h-screen overflow-hidden ${
      theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
    }`}>
      {/* Background grid pattern */}
      {showGrid && (
        <div 
          className={theme === 'dark' ? 'absolute inset-0 opacity-20' : 'absolute inset-0 opacity-30'}
          style={{
            backgroundImage: `
              linear-gradient(${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(71, 85, 105, 0.1)'} 1px, transparent 1px),
              linear-gradient(90deg, ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(71, 85, 105, 0.1)'} 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      )}

      {/* Canvas Area */}
      <div className="relative w-full h-full">
        <Canvas activeTool={activeTool} theme={theme} />
      </div>

      {/* Top Right - User Avatars */}
      <UserAvatars theme={theme} />

      {/* Bottom Left - Zoom Control */}
      <ZoomControl theme={theme} onThemeChange={setTheme} showGrid={showGrid} onGridChange={setShowGrid} />

      {/* Bottom Center - Toolbar */}
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} theme={theme} />

      {/* Right Sidebar - Study Context */}
      <StudyContextSidebar theme={theme} />
    </div>
  );
}