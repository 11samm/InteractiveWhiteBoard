import { TLSocketRoom } from '@tldraw/sync-core';
import { ensureBoard, touchBoard } from './boards';
import { loadRoomSnapshot, saveRoomSnapshot } from './snapshots';

/**
 * One Node process owns every board room in memory (per PLAN.md 4.1/4.2). Each
 * `TLSocketRoom` is tldraw's own authoritative CRDT-ish sync room: it accepts
 * client websockets, resolves concurrent edits, and tracks presence. This
 * module is the app-specific part: which room belongs to which board, and
 * how room state is loaded from / persisted to SQLite so a host restart
 * restores every board.
 */
const rooms = new Map<string, TLSocketRoom>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

const PERSIST_DEBOUNCE_MS = 1500;

function schedulePersist(boardId: string, room: TLSocketRoom): void {
  const existing = persistTimers.get(boardId);
  if (existing) clearTimeout(existing);

  persistTimers.set(
    boardId,
    setTimeout(() => {
      persistTimers.delete(boardId);
      saveRoomSnapshot(boardId, room.getCurrentSnapshot());
      touchBoard(boardId);
    }, PERSIST_DEBOUNCE_MS),
  );
}

export function getOrCreateRoom(boardId: string): TLSocketRoom {
  const existing = rooms.get(boardId);
  if (existing) return existing;

  ensureBoard(boardId);
  const initialSnapshot = loadRoomSnapshot(boardId);

  let room!: TLSocketRoom;
  room = new TLSocketRoom({
    initialSnapshot,
    onDataChange: () => schedulePersist(boardId, room),
    onSessionRemoved: (_room, { numSessionsRemaining }) => {
      // Flush immediately once the last participant leaves instead of waiting
      // out the debounce, so a host restart right after everyone leaves
      // can't lose the last few seconds of edits.
      if (numSessionsRemaining === 0) {
        const timer = persistTimers.get(boardId);
        if (timer) clearTimeout(timer);
        persistTimers.delete(boardId);
        saveRoomSnapshot(boardId, room.getCurrentSnapshot());
        touchBoard(boardId);
      }
    },
  });

  rooms.set(boardId, room);
  return room;
}

/** Flushes every in-memory room to SQLite. Used on graceful shutdown. */
export function persistAllRoomsNow(): void {
  for (const [boardId, room] of rooms) {
    const timer = persistTimers.get(boardId);
    if (timer) clearTimeout(timer);
    persistTimers.delete(boardId);
    saveRoomSnapshot(boardId, room.getCurrentSnapshot());
  }
}
