import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useSync } from '@tldraw/sync';
import { inlineBase64AssetStore, type Editor } from 'tldraw';
import { AiTrigger } from '../components/AiTrigger';
import { StudyContextSidebar } from '../components/StudyContextSidebar';
import { UserAvatars } from '../components/UserAvatars';
import { Board } from '../components/Board';
import { ZoomControl } from '../components/ZoomControl';
import { getSyncUrl } from '../lib/api';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showGrid, setShowGrid] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; color: string }[]>([]);

  // `useSync` owns the websocket connection to the host's authoritative
  // room (server/rooms.ts): initial load, presence, conflict resolution,
  // and automatic reconnect/resend of unconfirmed local changes. We only
  // decide what to render for each connection status.
  //
  // `inlineBase64AssetStore` embeds pasted/dropped media directly in shape
  // records so it still syncs to every client without a real asset host.
  // It's a placeholder: Phase 3 replaces it with the host's own file
  // storage, which will scale to larger files.
  const syncedStore = useSync({
    uri: getSyncUrl(boardId ?? ''),
    assets: inlineBase64AssetStore,
  });

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

  // Real presence: tldraw already renders collaborator cursors on the
  // canvas itself once the store is synced. This just mirrors the same
  // presence records into our own top-left avatar stack.
  useEffect(() => {
    if (!editor) return;

    const syncCollaborators = () => {
      const others = editor.getVisibleCollaboratorsOnCurrentPage().map((presence) => ({
        id: presence.userId,
        name: presence.userName || 'Guest',
        color: presence.color,
      }));
      setCollaborators(others);
    };

    syncCollaborators();
    return editor.store.listen(syncCollaborators, { source: 'all', scope: 'presence' });
  }, [editor]);

  const handleThemeChange = (next: 'light' | 'dark') => {
    setTheme(next);
    editor?.user.updateUserPreferences({ colorScheme: next });
  };

  const handleGridChange = (next: boolean) => {
    setShowGrid(next);
    editor?.updateInstanceState({ isGridMode: next });
  };

  if (!boardId) return null;

  if (syncedStore.status === 'loading') {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Connecting to board…
      </div>
    );
  }

  if (syncedStore.status === 'error') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-300 px-6 text-center">
        <p className="text-lg font-medium text-white">Couldn't connect to this board</p>
        <p className="text-sm text-slate-500 max-w-sm">{syncedStore.error.message}</p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}
    >
      <Board store={syncedStore.store} onMount={handleMount} />

      {syncedStore.connectionStatus === 'offline' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-amber-500/90 text-slate-950 text-sm font-medium shadow-lg">
          Reconnecting… your edits are saved locally and will sync once the connection returns.
        </div>
      )}

      {/* Top Left - User Avatars (top-right is reserved for tldraw's native style panel) */}
      <UserAvatars theme={theme} collaborators={collaborators} />

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
