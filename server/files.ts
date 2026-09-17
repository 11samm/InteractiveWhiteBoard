import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { db } from './db';

export type FileStatus = 'processing' | 'ready' | 'error';

export interface FileRecord {
  id: string;
  boardId: string;
  localPath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  status: FileStatus;
  error: string | null;
  createdAt: string;
}

interface FileRow {
  id: string;
  board_id: string;
  local_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  status: FileStatus;
  error: string | null;
  created_at: string;
}

function toRecord(row: FileRow): FileRecord {
  return {
    id: row.id,
    boardId: row.board_id,
    localPath: row.local_path,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  };
}

const insertFileStmt = db.prepare<[string, string, string, string, string, number]>(
  'INSERT INTO files (id, board_id, local_path, filename, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)',
);
const getFileStmt = db.prepare<[string], FileRow>('SELECT * FROM files WHERE id = ?');
const listFilesStmt = db.prepare<[string], FileRow>(
  'SELECT * FROM files WHERE board_id = ? ORDER BY created_at ASC',
);
const countFilesStmt = db.prepare<[string], { count: number }>(
  'SELECT COUNT(*) as count FROM files WHERE board_id = ?',
);
const updateStatusStmt = db.prepare<[FileStatus, string | null, number | null, string]>(
  'UPDATE files SET status = ?, error = ?, page_count = ? WHERE id = ?',
);
const deleteFileStmt = db.prepare<[string]>('DELETE FROM files WHERE id = ?');

export function createFileRecord(input: {
  boardId: string;
  localPath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): FileRecord {
  const id = randomUUID();
  insertFileStmt.run(id, input.boardId, input.localPath, input.filename, input.mimeType, input.sizeBytes);
  return getFile(id)!;
}

export function getFile(id: string): FileRecord | undefined {
  const row = getFileStmt.get(id);
  return row ? toRecord(row) : undefined;
}

export function listFiles(boardId: string): FileRecord[] {
  return listFilesStmt.all(boardId).map(toRecord);
}

export function countFiles(boardId: string): number {
  return countFilesStmt.get(boardId)?.count ?? 0;
}

export function setFileStatus(
  id: string,
  status: FileStatus,
  opts: { error?: string | null; pageCount?: number | null } = {},
): void {
  updateStatusStmt.run(status, opts.error ?? null, opts.pageCount ?? null, id);
}

/** Removes the DB row (cascades to chunks) and the file on disk. */
export async function deleteFile(id: string): Promise<void> {
  const file = getFile(id);
  deleteFileStmt.run(id);
  if (file) {
    await unlink(file.localPath).catch(() => {
      // Already gone or never written — deleting the DB row is what matters for correctness.
    });
  }
}
