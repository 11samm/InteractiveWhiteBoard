import { embedQuery } from './ai/embeddings';
import { listChunksForBoard, type ChunkRecord } from './chunks';
import { listFiles } from './files';

export interface SearchResult {
  chunk: ChunkRecord;
  score: number;
}

const OVERVIEW_TOP_K = 8;

const STOPWORDS = new Set([
  'the',
  'and',
  'but',
  'for',
  'are',
  'was',
  'were',
  'what',
  'whats',
  'about',
  'this',
  'that',
  'these',
  'those',
  'how',
  'why',
  'when',
  'where',
  'who',
  'which',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
  'let',
  'know',
  'please',
  'tell',
  'give',
  'you',
  'your',
  'our',
  'its',
  'from',
  'with',
  'into',
  'over',
  'just',
  'some',
  'any',
  'more',
  'most',
  'also',
]);

const LOGISTICS_RE =
  /\b(exams?|midterms?|finals?|grading|grades?|office hours|late policy|attendance|syllabus|due dates?|points possible)\b/i;

/**
 * Topic / "what is this lecture about?" questions. These have almost no
 * content words, so similarity search latches onto meta slides (exams,
 * grading, "in class lectures") instead of the lecture's actual subject.
 */
export function isOverviewQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /what.{0,80}(lecture|document|pdf|slides?|file|chapter|reading|notes?|material).{0,40}(about|cover)/i.test(q) ||
    /what (?:is|are) (?:this|the) (?:lecture|document|pdf|slides?)/i.test(q) ||
    /\b(summar(?:y|ize)|overview|main topics?)\b/i.test(q)
  );
}

/**
 * In-process retrieval over one board's chunks (PLAN.md 4.3 — fine at this
 * document scale; a real vector DB would only matter at much higher volume).
 *
 * When a chunk has no stored embedding (no provider key was configured at
 * ingestion time, or one wasn't set at query time either), we fall back to
 * a simple keyword overlap score instead of returning nothing — degraded,
 * but still useful, and it never silently drops a board's only files.
 */
export async function searchChunks(boardId: string, query: string, topK = 5): Promise<SearchResult[]> {
  const chunks = listChunksForBoard(boardId);
  if (chunks.length === 0) return [];

  const filenames = new Map(listFiles(boardId).map((f) => [f.id, f.filename]));
  const overview = isOverviewQuery(query);
  const k = overview ? Math.max(topK, OVERVIEW_TOP_K) : topK;
  const searchText = overview
    ? `${query}\nmain topics, learning objectives, key concepts, lecture overview`
    : query;

  const queryEmbedding = await embedQuery(searchText).catch(() => null);

  const scored: SearchResult[] = chunks.map((chunk) => {
    if (queryEmbedding && chunk.embedding) {
      return { chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) };
    }
    const filename = filenames.get(chunk.fileId) ?? '';
    return { chunk, score: keywordScore(query, chunk.text, filename) };
  });

  if (overview) return selectOverviewChunks(chunks, scored, k);

  return scored
    .filter((r) => r.score > 0)
    .sort(compareResults)
    .slice(0, k);
}

function compareResults(a: SearchResult, b: SearchResult): number {
  return b.score - a.score || a.chunk.page - b.chunk.page || a.chunk.chunkIndex - b.chunk.chunkIndex;
}

/**
 * Overview questions need coverage of the lecture, not the single slide
 * that happened to mention the word "lecture". Prefer title/intro pages,
 * sample later content, and skip exam/grading logistics.
 */
function selectOverviewChunks(chunks: ChunkRecord[], scored: SearchResult[], k: number): SearchResult[] {
  const byId = new Map(scored.map((r) => [r.chunk.id, r]));
  const picked = new Map<string, SearchResult>();

  const add = (chunk: ChunkRecord, score: number) => {
    if (picked.has(chunk.id) || picked.size >= k) return;
    const existing = byId.get(chunk.id);
    picked.set(chunk.id, { chunk, score: Math.max(existing?.score ?? 0, score) });
  };

  const byFile = new Map<string, ChunkRecord[]>();
  for (const chunk of chunks) {
    const list = byFile.get(chunk.fileId) ?? [];
    list.push(chunk);
    byFile.set(chunk.fileId, list);
  }

  const fileCount = Math.max(1, byFile.size);
  const introPerFile = fileCount === 1 ? 3 : 2;
  const samplePerFile = Math.max(1, Math.floor((k - introPerFile * fileCount) / fileCount));

  for (const fileChunks of byFile.values()) {
    const ordered = [...fileChunks].sort(
      (a, b) => a.page - b.page || a.chunkIndex - b.chunkIndex,
    );
    for (let i = 0; i < Math.min(introPerFile, ordered.length); i++) {
      add(ordered[i], 0.95 - i * 0.02);
    }

    const rest = ordered.slice(introPerFile).filter((c) => !isLogisticsChunk(c.text));
    if (rest.length === 0) continue;
    const samples = Math.min(samplePerFile, rest.length);
    for (let s = 0; s < samples; s++) {
      const idx = Math.round(((s + 1) / (samples + 1)) * (rest.length - 1));
      add(rest[idx], 0.8);
    }
  }

  const ranked = [...scored].sort(compareResults);
  for (const result of ranked) {
    if (picked.size >= k) break;
    if (result.score <= 0 || isLogisticsChunk(result.chunk.text)) continue;
    add(result.chunk, result.score);
  }

  if (picked.size === 0) {
    return ranked.filter((r) => r.score > 0).slice(0, k);
  }

  return [...picked.values()].sort(compareResults).slice(0, k);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Fraction of distinct content words from the query that appear in the chunk. */
function keywordScore(query: string, text: string, filename = ''): number {
  const words = contentWords(query);
  if (words.length === 0) return 0;
  const haystack = `${filenameSearchText(filename)} ${text}`.toLowerCase();
  const hits = words.filter((w) => haystack.includes(w)).length;
  return hits / words.length;
}

function contentWords(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  );
}

function filenameSearchText(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const spaced = stem.replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)([a-zA-Z])/g, '$1 $2');
  return `${stem} ${spaced}`;
}

function isLogisticsChunk(text: string): boolean {
  return LOGISTICS_RE.test(text);
}
