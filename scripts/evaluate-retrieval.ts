import { readFile } from 'node:fs/promises';
import path from 'node:path';
import '../server/env';
import { hasGeminiApiKey } from '../server/ai/config';
import { deleteBoard, ensureBoard } from '../server/boards';
import { createFileRecord } from '../server/files';
import { ingestFile } from '../server/ingestion';
import { searchChunks } from '../server/search';

/**
 * Standalone retrieval evaluation (PLAN.md 7): ingests the checked-in
 * fixture PDF into a throwaway board, runs every question in
 * eval/questions.json against `searchChunks`, and reports whether the
 * expected page showed up in the top-K results — without needing the HTTP
 * server running.
 *
 * Run with: npx tsx scripts/evaluate-retrieval.ts
 */

const TOP_K = 5;
const LOW_CONFIDENCE_THRESHOLD = 0.2; // below this, we treat a match as "no relevant source"

interface Question {
  question: string;
  expectedPage: number | null;
}

async function main() {
  console.log(`Provider key configured: ${hasGeminiApiKey() ? 'yes (semantic search)' : 'no (keyword fallback)'}\n`);

  const boardId = `eval-${Date.now()}`;
  ensureBoard(boardId);

  const fixturePath = path.resolve(process.cwd(), 'eval', 'Linear_Algebra_Ch3.pdf');
  const buffer = await readFile(fixturePath);
  const fileRecord = createFileRecord({
    boardId,
    localPath: fixturePath,
    filename: 'Linear_Algebra_Ch3.pdf',
    mimeType: 'application/pdf',
    sizeBytes: buffer.length,
  });

  process.stdout.write('Ingesting fixture (extract, chunk, embed)... ');
  await ingestFile(fileRecord);
  console.log('done.\n');

  const questions = JSON.parse(
    await readFile(path.resolve(process.cwd(), 'eval', 'questions.json'), 'utf-8'),
  ) as Question[];

  let hits = 0;
  let scored = 0;

  for (const { question, expectedPage } of questions) {
    const results = await searchChunks(boardId, question, TOP_K);
    const topScore = results[0]?.score ?? 0;

    if (expectedPage === null) {
      const pass = topScore < LOW_CONFIDENCE_THRESHOLD;
      scored += 1;
      if (pass) hits += 1;
      console.log(
        `${pass ? '✓' : '✗'} [no source expected] "${question}" — top score ${topScore.toFixed(2)}`,
      );
      continue;
    }

    const found = results.some((r) => r.chunk.page === expectedPage);
    scored += 1;
    if (found) hits += 1;
    const gotPages = results.map((r) => `p${r.chunk.page}(${r.score.toFixed(2)})`).join(', ');
    console.log(
      `${found ? '✓' : '✗'} expected p${expectedPage} — "${question}"\n    got: ${gotPages || '(none)'}`,
    );
  }

  console.log(`\n${hits}/${scored} correct (${((hits / scored) * 100).toFixed(0)}%)`);

  deleteBoard(boardId); // cascades to the file + chunk rows created above
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
