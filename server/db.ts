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

  -- Phase 3: document ingestion (PLAN.md 4.4). One row per uploaded file;
  -- 'status' tracks the async extract -> chunk -> embed pipeline so both
  -- clients can show shared processing progress.
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    local_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    page_count INTEGER,
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing' | 'ready' | 'error'
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_files_board_id ON files(board_id);

  -- One row per chunk of extracted, page-aware text. embedding_blob is a
  -- JSON-encoded number array (or NULL when no provider key is configured,
  -- in which case search falls back to keyword matching).
  CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    page INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    embedding_blob TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_board_id ON chunks(board_id);
  CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id);

  -- Phase 4: grounded tutor chat (PLAN.md 4.4/5.2). One row per turn, shared
  -- across every participant on the board (there is one conversation per
  -- board, not per user).
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' | 'assistant' | 'error'
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_board_id ON messages(board_id);

  -- Citations are denormalized (filename/page/excerpt copied at answer time)
  -- rather than living purely behind a foreign key to chunks, so a citation
  -- a user already saw stays meaningful even after the source file is later
  -- deleted (chunk_id is kept only as a best-effort pointer, not enforced).
  CREATE TABLE IF NOT EXISTS citations (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id TEXT,
    file_id TEXT,
    filename TEXT NOT NULL,
    page INTEGER NOT NULL,
    excerpt TEXT NOT NULL,
    retrieval_score REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_citations_message_id ON citations(message_id);

  -- One row per model call, for the host-visible latency/usage/cost the
  -- Phase 4 done-criteria call for. Costs are rough estimates from
  -- configurable per-1K-token rates (server/ai/config.ts), not billing data.
  CREATE TABLE IF NOT EXISTS usage (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    message_id TEXT,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    estimated_cost_usd REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_usage_board_id ON usage(board_id);
`);
