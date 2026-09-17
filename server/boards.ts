import { randomUUID } from 'node:crypto';
import { db } from './db';
import { generateSecret, hashSecret, secretMatchesHash } from './secrets';

export interface BoardRecord {
  id: string;
  title: string;
  adminSecretHash: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BoardRow {
  id: string;
  title: string;
  admin_secret_hash: string | null;
  created_at: string;
  updated_at: string;
}

const getBoardStmt = db.prepare<[string], BoardRow>('SELECT * FROM boards WHERE id = ?');
const insertBoardStmt = db.prepare<[string, string, string | null]>(
  'INSERT INTO boards (id, title, admin_secret_hash) VALUES (?, ?, ?)',
);
const deleteBoardStmt = db.prepare<[string]>('DELETE FROM boards WHERE id = ?');
const touchBoardStmt = db.prepare<[string]>("UPDATE boards SET updated_at = datetime('now') WHERE id = ?");

function toRecord(row: BoardRow): BoardRecord {
  return {
    id: row.id,
    title: row.title,
    adminSecretHash: row.admin_secret_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getBoard(id: string): BoardRecord | undefined {
  const row = getBoardStmt.get(id);
  return row ? toRecord(row) : undefined;
}

/** Host-initiated board creation: mints an admin secret returned once, never stored in plaintext. */
export function createBoard(title = 'Untitled board'): { id: string; adminSecret: string } {
  const id = randomUUID();
  const adminSecret = generateSecret();
  insertBoardStmt.run(id, title, hashSecret(adminSecret));
  return { id, adminSecret };
}

/**
 * Guests only ever have the board id (a high-entropy random token, per PLAN.md 4.2), not an
 * admin secret. If a guest opens a board link nobody has "created" through the API yet, we
 * lazily register it with no admin secret so their session can proceed and persist.
 */
export function ensureBoard(id: string): BoardRecord {
  const existing = getBoard(id);
  if (existing) return existing;
  insertBoardStmt.run(id, 'Untitled board', null);
  return getBoard(id)!;
}

export function isAdminSecretValid(id: string, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const board = getBoard(id);
  if (!board?.adminSecretHash) return false;
  return secretMatchesHash(secret, board.adminSecretHash);
}

export function deleteBoard(id: string): void {
  deleteBoardStmt.run(id);
}

export function touchBoard(id: string): void {
  touchBoardStmt.run(id);
}
