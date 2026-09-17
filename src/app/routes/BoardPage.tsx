import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import type { Editor } from 'tldraw';
import { AiTrigger } from '../components/AiTrigger';
import { StudyContextSidebar } from '../components/StudyContextSidebar';
import { UserAvatars } from '../components/UserAvatars';
import { Board } from '../components/Board';
import { ZoomControl } from '../components/ZoomControl';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showGrid, setShowGrid] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);

  const handleMount = useCallback(
    (mountedEditor: Editor) => {
      mountedEditor.user.updateUserPreferences({ colorScheme: theme });
      mountedEditor.updateInstanceState({ isGridMode: showGrid });
      setEditor(mountedEditor);
    },
    // Only the initial theme/grid values matter here; later changes are
    // applied through the change handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleThemeChange = (next: 'light' | 'dark') => {
    setTheme(next);
    editor?.user.updateUserPreferences({ colorScheme: next });
  };

  const handleGridChange = (next: boolean) => {
    setShowGrid(next);
    editor?.updateInstanceState({ isGridMode: next });
  };

  if (!boardId) return null;

  return (
    <div
      className={`relative w-full h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}
    >
      <Board boardId={boardId} onMount={handleMount} />

      {/* Top Left - User Avatars (top-right is reserved for tldraw's native style panel) */}
      <UserAvatars theme={theme} />

      {/* Bottom Left - Zoom Control */}
      <ZoomControl
        theme={theme}
        onThemeChange={handleThemeChange}
        showGrid={showGrid}
        onGridChange={handleGridChange}
        editor={editor}
      />

      {/* Bottom Right - Ask AI (tldraw's own toolbar owns bottom-center) */}
      <AiTrigger />

      {/* Right Sidebar - Study Context */}
      <StudyContextSidebar theme={theme} />
    </div>
  );
}
