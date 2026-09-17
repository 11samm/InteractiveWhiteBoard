import type { RoomSnapshot } from '@tldraw/sync-core';
import { db } from './db';

interface SnapshotRow {
  state_blob: string;
}

const getSnapshotStmt = db.prepare<[string], SnapshotRow>(
  'SELECT state_blob FROM board_snapshots WHERE board_id = ?',
);

const upsertSnapshotStmt = db.prepare<[string, string]>(`
  INSERT INTO board_snapshots (board_id, state_blob, version, updated_at)
  VALUES (?, ?, 1, datetime('now'))
  ON CONFLICT(board_id) DO UPDATE SET
    state_blob = excluded.state_blob,
    version = board_snapshots.version + 1,
    updated_at = datetime('now')
`);

export function loadRoomSnapshot(boardId: string): RoomSnapshot | undefined {
  const row = getSnapshotStmt.get(boardId);
  if (!row) return undefined;
  try {
    return JSON.parse(row.state_blob) as RoomSnapshot;
  } catch {
    // Corrupt or unreadable snapshot: start the room fresh rather than crash the host.
    return undefined;
  }
}

export function saveRoomSnapshot(boardId: string, snapshot: RoomSnapshot): void {
  upsertSnapshotStmt.run(boardId, JSON.stringify(snapshot));
}
