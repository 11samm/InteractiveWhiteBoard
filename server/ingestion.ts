import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { embedTexts } from './ai/embeddings';
import { chunkPageText } from './chunking';
import { insertChunks, type NewChunk } from './chunks';
import { setFileStatus, type FileRecord } from './files';

/**
 * Runs the full extract -> chunk -> embed pipeline for one uploaded file and
 * updates its status in place. Called fire-and-forget right after upload;
 * clients poll `GET /api/files/:id/status` (or the board's file list) to see
 * progress, matching PLAN.md 4.5's shared-ingestion-progress requirement.
 */
export async function ingestFile(file: FileRecord): Promise<void> {
  let parser: PDFParse | undefined;
  try {
    const buffer = await readFile(file.localPath);
    parser = new PDFParse({ data: buffer });
    const { pages, total } = await parser.getText();

    const pageTexts = pages.map((p) => ({ page: p.num, chunks: chunkPageText(p.text) }));
    const allChunkTexts = pageTexts.flatMap((p) => p.chunks.map((c) => c.text));

    if (allChunkTexts.length === 0) {
      // Parsed successfully but no extractable text — almost always a
      // scanned/image-only PDF. OCR is explicitly out of scope for the MVP
      // (PLAN.md 9), so surface this as a clear, actionable failure.
      setFileStatus(file.id, 'error', {
        error: 'No extractable text found (likely a scanned PDF — OCR is not yet supported).',
        pageCount: total,
      });
      return;
    }

    const embeddings = await embedTexts(allChunkTexts);

    const newChunks: NewChunk[] = [];
    let cursor = 0;
    for (const { page, chunks } of pageTexts) {
      chunks.forEach((chunk, chunkIndex) => {
        newChunks.push({
          fileId: file.id,
          boardId: file.boardId,
          page,
          chunkIndex,
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          embedding: embeddings[cursor] ?? null,
        });
        cursor += 1;
      });
    }

    insertChunks(newChunks);
    setFileStatus(file.id, 'ready', { pageCount: total });
  } catch (err) {
    console.error(`[ingestion] failed for file ${file.id} (${file.filename}):`, err);
    setFileStatus(file.id, 'error', {
      error: err instanceof Error ? err.message : 'Failed to process this file.',
    });
  } finally {
    await parser?.destroy().catch(() => {});
  }
}
