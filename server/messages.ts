import { randomUUID } from 'node:crypto';
import { db } from './db';

export type MessageRole = 'user' | 'assistant' | 'error';

export interface CitationRecord {
  id: string;
  messageId: string;
  chunkId: string | null;
  fileId: string | null;
  filename: string;
  page: number;
  excerpt: string;
  retrievalScore: number;
}

export interface MessageRecord {
  id: string;
  boardId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  citations: CitationRecord[];
}

interface MessageRow {
  id: string;
  board_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

interface CitationRow {
  id: string;
  message_id: string;
  chunk_id: string | null;
  file_id: string | null;
  filename: string;
  page: number;
  excerpt: string;
  retrieval_score: number;
}

function toCitation(row: CitationRow): CitationRecord {
  return {
    id: row.id,
    messageId: row.message_id,
    chunkId: row.chunk_id,
    fileId: row.file_id,
    filename: row.filename,
    page: row.page,
    excerpt: row.excerpt,
    retrievalScore: row.retrieval_score,
  };
}

const insertMessageStmt = db.prepare<[string, string, MessageRole, string]>(
  'INSERT INTO messages (id, board_id, role, content) VALUES (?, ?, ?, ?)',
);
const listMessagesStmt = db.prepare<[string], MessageRow>(
  'SELECT * FROM messages WHERE board_id = ? ORDER BY created_at ASC',
);
const listRecentMessagesStmt = db.prepare<[string, number], MessageRow>(
  'SELECT * FROM messages WHERE board_id = ? ORDER BY created_at DESC LIMIT ?',
);
const listCitationsForMessagesStmt = (n: number) =>
  db.prepare<string[], CitationRow>(
    `SELECT * FROM citations WHERE message_id IN (${Array(n).fill('?').join(',')}) ORDER BY retrieval_score DESC`,
  );
const insertCitationStmt = db.prepare<[string, string, string | null, string | null, string, number, string, number]>(
  `INSERT INTO citations (id, message_id, chunk_id, file_id, filename, page, excerpt, retrieval_score)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

export function createMessage(boardId: string, role: MessageRole, content: string): MessageRecord {
  const id = randomUUID();
  insertMessageStmt.run(id, boardId, role, content);
  return { id, boardId, role, content, createdAt: new Date().toISOString(), citations: [] };
}

export interface NewCitation {
  chunkId: string | null;
  fileId: string | null;
  filename: string;
  page: number;
  excerpt: string;
  retrievalScore: number;
}

export function addCitations(messageId: string, citations: NewCitation[]): void {
  const insertMany = db.transaction((items: NewCitation[]) => {
    for (const c of items) {
      insertCitationStmt.run(
        randomUUID(),
        messageId,
        c.chunkId,
        c.fileId,
        c.filename,
        c.page,
        c.excerpt,
        c.retrievalScore,
      );
    }
  });
  insertMany(citations);
}

function attachCitations(rows: MessageRow[]): MessageRecord[] {
  if (rows.length === 0) return [];
  const citationsByMessage = new Map<string, CitationRecord[]>();
  const ids = rows.map((r) => r.id);
  for (const row of listCitationsForMessagesStmt(ids.length).all(...ids)) {
    const citation = toCitation(row);
    const list = citationsByMessage.get(citation.messageId) ?? [];
    list.push(citation);
    citationsByMessage.set(citation.messageId, list);
  }
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    citations: citationsByMessage.get(row.id) ?? [],
  }));
}

/** Full board transcript, oldest first — used by the chat UI. */
export function listMessages(boardId: string): MessageRecord[] {
  return attachCitations(listMessagesStmt.all(boardId));
}

/** Most recent N turns, oldest first — used to build model context without unbounded history. */
export function listRecentMessages(boardId: string, limit: number): MessageRecord[] {
  return attachCitations(listRecentMessagesStmt.all(boardId, limit)).reverse();
}
