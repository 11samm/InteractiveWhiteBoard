import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * The host's single SQLite database. Per PLAN.md 4.4, this holds board
 * metadata and persisted room snapshots so a restarted host restores every
 * board. Files/chunks/messages/citations tables are added in later phases.
 */
const dataDir = path.resolve(process.cwd(), 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'whiteboard.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled board',
    admin_secret_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS board_snapshots (
    board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
    state_blob TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
