import { Tldraw, type Editor, type TLComponents, type TLStore } from 'tldraw';
import 'tldraw/tldraw.css';
import { CustomEraserTool } from '../tldraw/CustomEraserTool';
import { CustomStylePanel } from './CustomStylePanel';

interface BoardProps {
  store: TLStore;
  onMount: (editor: Editor) => void;
}

// We keep tldraw's native Toolbar: it owns tool switching and keyboard
// shortcuts (v/d/g/t/1-9/etc.), which we don't want to reimplement. The
// StylePanel is swapped for `CustomStylePanel`, which hides itself when it
// has nothing relevant to show (e.g. select tool with no selection) and
// adds a real size control for the eraser. Everything else that would
// visually collide with our own floating chrome (avatars, zoom pill, study
// sidebar, AI trigger) is hidden.
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
  StylePanel: CustomStylePanel,
};

// Registering a tool with id "eraser" replaces tldraw's built-in one, giving
// the eraser a real, adjustable radius driven by the size control above.
const tools = [CustomEraserTool];

/**
 * Thin wrapper around tldraw's editor.
 *
 * tldraw owns the shape model, selection, transforms, undo/redo, camera,
 * serialization, and (via the synced `store` passed in from `BoardPage`,
 * see `useSync`) real-time multiplayer sync, presence, and reconnect
 * behavior. This file is app-specific wiring: which pieces of tldraw's own
 * UI we keep vs. hide, and how our custom chrome talks to the editor.
 */
export function Board({ store, onMount }: BoardProps) {
  return (
    <div className="absolute inset-0">
      <Tldraw store={store} components={components} tools={tools} onMount={onMount} />
    </div>
  );
}
