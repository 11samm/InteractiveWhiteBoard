import { Tldraw, type Editor, type TLComponents } from 'tldraw';
import 'tldraw/tldraw.css';

interface BoardProps {
  boardId: string;
  onMount: (editor: Editor) => void;
}

// We keep tldraw's native Toolbar and StylePanel: they own tool switching,
// keyboard shortcuts (v/d/g/t/1-9/etc.), and the color/size/dash/fill
// pickers, none of which we want to reimplement. Everything else that
// would visually collide with our own floating chrome (avatars, zoom pill,
// study sidebar, AI trigger) is hidden.
const components: TLComponents = {
  MainMenu: null,
  PageMenu: null,
  NavigationPanel: null,
  HelpMenu: null,
  ZoomMenu: null,
  DebugMenu: null,
  DebugPanel: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  CursorChatBubble: null,
  Minimap: null,
};

/**
 * Thin wrapper around tldraw's editor.
 *
 * tldraw owns the shape model, selection, transforms, undo/redo, camera,
 * serialization, and local persistence (via `persistenceKey`, backed by
 * IndexedDB). This file is app-specific wiring: which board is loaded, how
 * our custom chrome (Toolbar/ZoomControl) talks to the editor instance, and
 * which pieces of tldraw's own UI we keep vs. hide.
 */
export function Board({ boardId, onMount }: BoardProps) {
  return (
    <div className="absolute inset-0">
      <Tldraw components={components} persistenceKey={`whiteboard-${boardId}`} onMount={onMount} />
    </div>
  );
}
