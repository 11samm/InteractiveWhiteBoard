import { randomUUID } from 'node:crypto';
import { db } from './db';

export interface ChunkRecord {
  id: string;
  fileId: string;
  boardId: string;
  page: number;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  embedding: number[] | null;
}

interface ChunkRow {
  id: string;
  file_id: string;
  board_id: string;
  page: number;
  chunk_index: number;
  text: string;
  token_count: number;
  embedding_blob: string | null;
}

function toRecord(row: ChunkRow): ChunkRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    boardId: row.board_id,
    page: row.page,
    chunkIndex: row.chunk_index,
    text: row.text,
    tokenCount: row.token_count,
    embedding: row.embedding_blob ? (JSON.parse(row.embedding_blob) as number[]) : null,
  };
}

const insertChunkStmt = db.prepare<
  [string, string, string, number, number, string, number, string | null]
>(
  `INSERT INTO chunks (id, file_id, board_id, page, chunk_index, text, token_count, embedding_blob)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const listByBoardStmt = db.prepare<[string], ChunkRow>('SELECT * FROM chunks WHERE board_id = ?');
const listByFileStmt = db.prepare<[string], ChunkRow>(
  'SELECT * FROM chunks WHERE file_id = ? ORDER BY page ASC, chunk_index ASC',
);

export interface NewChunk {
  fileId: string;
  boardId: string;
  page: number;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  embedding: number[] | null;
}

export function insertChunks(chunks: NewChunk[]): void {
  const insertMany = db.transaction((items: NewChunk[]) => {
    for (const c of items) {
      insertChunkStmt.run(
        randomUUID(),
        c.fileId,
        c.boardId,
        c.page,
        c.chunkIndex,
        c.text,
        c.tokenCount,
        c.embedding ? JSON.stringify(c.embedding) : null,
      );
    }
  });
  insertMany(chunks);
}

export function listChunksForBoard(boardId: string): ChunkRecord[] {
  return listByBoardStmt.all(boardId).map(toRecord);
}

export function listChunksForFile(fileId: string): ChunkRecord[] {
  return listByFileStmt.all(fileId).map(toRecord);
}
