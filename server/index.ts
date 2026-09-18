import './env';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { hasGeminiApiKey } from './ai/config';
import { createBoard, deleteBoard, ensureBoard, getBoard, isAdminSecretValid } from './boards';
import { runChatTurn } from './chat';
import { countFiles, createFileRecord, deleteFile, getFile, listFiles, type FileRecord } from './files';
import { ingestFile } from './ingestion';
import { listMessages } from './messages';
import { getOrCreateRoom, persistAllRoomsNow } from './rooms';
import { searchChunks } from './search';
import { getPrimaryLanIPv4 } from './lan';
import { getBoardUsageSummary } from './usage';

const PORT = Number(process.env.PORT ?? 8787);
const isProduction = process.env.NODE_ENV === 'production';

const app = new Hono();
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

// The API is same-origin in production (this process also serves the built
// frontend) and proxied by Vite in dev, but CORS is enabled defensively so
// the host can still be reached directly, e.g. for debugging on the LAN.
app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ ok: true }));

// --- Boards -----------------------------------------------------------
// See PLAN.md 4.5. Guests only ever hold a board id (an unguessable token);
// the admin secret is minted once, here, and only ever shown to the creator.

app.post('/api/boards', async (c) => {
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const rawTitle = typeof body === 'object' && body !== null ? (body as { title?: unknown }).title : undefined;
  const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 200) : undefined;

  const { id, adminSecret } = createBoard(title);
  return c.json({ id, adminSecret }, 201);
});

app.get('/api/boards/:id', (c) => {
  const board = getBoard(c.req.param('id'));
  if (!board) return c.json({ error: 'not_found' }, 404);
  return c.json({ id: board.id, title: board.title });
});

app.delete('/api/boards/:id', (c) => {
  const id = c.req.param('id');
  const forbidden = requireAdmin(c, id);
  if (forbidden) return forbidden;
  deleteBoard(id);
  return c.json({ ok: true });
});

// Host configuration status only — never the key itself. Lets the UI explain
// degraded behavior (keyword-only search, no AI chat) instead of failing
// silently when the host hasn't set GEMINI_API_KEY yet (PLAN.md 5.2).
app.get('/api/config', (c) =>
  c.json({ aiConfigured: hasGeminiApiKey(), lanIPv4: getPrimaryLanIPv4() }),
);

// --- Documents (PLAN.md 4.5, Phase 3) ------------------------------------
// PDF-only for the MVP; OCR for scanned documents is explicitly deferred
// (PLAN.md 9). Any board participant (host or guest) can upload/delete,
// same trust level as editing the board itself — access is the board id.

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_FILES_PER_BOARD = 20;

function toClientFile(file: FileRecord) {
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    pageCount: file.pageCount,
    status: file.status,
    error: file.error,
    createdAt: file.createdAt,
  };
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(-150) || 'file.pdf';
}

function requireAdmin(c: Context, boardId: string): Response | null {
  if (!isAdminSecretValid(boardId, c.req.header('x-admin-secret'))) {
    return c.json({ error: 'forbidden' }, 403);
  }
  return null;
}

app.get('/api/boards/:boardId/files', (c) => {
  return c.json(listFiles(c.req.param('boardId')).map(toClientFile));
});

app.post('/api/boards/:boardId/files', async (c) => {
  const boardId = c.req.param('boardId');
  // Guests only ever hold a board id; register it lazily if nobody has
  // created it through the API yet (same pattern as the sync room).
  ensureBoard(boardId);

  if (countFiles(boardId) >= MAX_FILES_PER_BOARD) {
    return c.json({ error: 'too_many_files', message: `This board already has ${MAX_FILES_PER_BOARD} files.` }, 400);
  }

  const formData = await c.req.formData().catch(() => null);
  const uploaded = formData?.get('file');
  if (!(uploaded instanceof File)) {
    return c.json({ error: 'no_file' }, 400);
  }
  if (uploaded.size === 0) {
    return c.json({ error: 'empty_file' }, 400);
  }
  if (uploaded.size > MAX_FILE_SIZE_BYTES) {
    return c.json({ error: 'file_too_large', message: 'Files must be 20 MB or smaller.' }, 413);
  }
  if (uploaded.type !== 'application/pdf') {
    return c.json({ error: 'unsupported_type', message: 'Only PDF files are supported right now.' }, 415);
  }

  const uploadDir = path.resolve(process.cwd(), 'data', 'uploads', boardId);
  await mkdir(uploadDir, { recursive: true });
  const localPath = path.join(uploadDir, `${randomUUID()}-${sanitizeFilename(uploaded.name)}`);
  await writeFile(localPath, Buffer.from(await uploaded.arrayBuffer()));

  const record = createFileRecord({
    boardId,
    localPath,
    filename: uploaded.name,
    mimeType: uploaded.type,
    sizeBytes: uploaded.size,
  });

  // Fire-and-forget: the client sees `status: "processing"` immediately and
  // polls the files list / status endpoint for completion.
  ingestFile(record).catch((err) => console.error('[ingestion] unhandled error:', err));

  return c.json(toClientFile(record), 201);
});

app.get('/api/files/:id/status', (c) => {
  const file = getFile(c.req.param('id'));
  if (!file) return c.json({ error: 'not_found' }, 404);
  return c.json(toClientFile(file));
});

app.delete('/api/files/:id', async (c) => {
  const file = getFile(c.req.param('id'));
  if (!file) return c.json({ error: 'not_found' }, 404);
  await deleteFile(file.id);
  return c.json({ ok: true });
});

// Internal debug/evaluation endpoint for retrieval (PLAN.md 7 — "Retrieval
// and citations"). Phase 4's chat endpoint will call `searchChunks` directly
// rather than round-tripping through HTTP.
app.post('/api/boards/:boardId/search', async (c) => {
  const boardId = c.req.param('boardId');
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const query = typeof body.query === 'string' ? body.query : '';
  if (!query.trim()) return c.json({ error: 'missing_query' }, 400);
  const results = await searchChunks(boardId, query, 5);
  return c.json({
    results: results.map((r) => ({
      score: r.score,
      fileId: r.chunk.fileId,
      page: r.chunk.page,
      text: r.chunk.text,
    })),
  });
});

// --- Grounded tutor chat (PLAN.md 5.2, Phase 4) --------------------------
// One shared conversation per board. Streamed as SSE so the client can show
// tokens as they arrive; `hono/streaming`'s `stream.onAbort` lets us cancel
// the in-flight Gemini request the moment the client disconnects or the
// user hits "stop".

const MAX_MESSAGE_LENGTH = 4000;

app.get('/api/boards/:boardId/messages', (c) => {
  return c.json(listMessages(c.req.param('boardId')));
});

app.get('/api/boards/:boardId/usage', (c) => {
  const boardId = c.req.param('boardId');
  const forbidden = requireAdmin(c, boardId);
  if (forbidden) return forbidden;
  return c.json(getBoardUsageSummary(boardId));
});

app.post('/api/boards/:boardId/chat', async (c) => {
  const boardId = c.req.param('boardId');
  ensureBoard(boardId);

  const body = await c.req.json().catch(() => null as Record<string, unknown> | null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const boardImage = typeof body?.boardImage === 'string' ? body.boardImage : undefined;

  if (!message) return c.json({ error: 'missing_message' }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: 'message_too_long', message: `Questions must be under ${MAX_MESSAGE_LENGTH} characters.` }, 400);
  }

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    for await (const event of runChatTurn(boardId, message, boardImage, controller.signal)) {
      if (stream.aborted) break;
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    }
  });
});

// --- Realtime sync ------------------------------------------------------
// tldraw's own sync engine (TLSocketRoom) owns conflict resolution, presence,
// and reconnect/resume; this just wires a board id to a room and a socket.

app.get(
  '/api/sync/:boardId',
  upgradeWebSocket((c) => {
    const boardId = c.req.param('boardId')!;
    // `useSync` on the client always appends `sessionId`; the fallback below
    // only matters for manual/non-tldraw websocket connections.
    const sessionId = c.req.query('sessionId') ?? randomUUID();
    const room = getOrCreateRoom(boardId);

    return {
      onOpen(_evt, ws) {
        room.handleSocketConnect({ sessionId, socket: ws.raw! });
      },
    };
  }),
);

// --- Static frontend (production only) ----------------------------------
// In dev, Vite serves the frontend and proxies /api to this process instead.

if (isProduction) {
  const distDir = path.resolve(process.cwd(), 'dist');
  app.use('/*', serveStatic({ root: 'dist' }));
  app.get('*', serveStatic({ path: path.join(distDir, 'index.html') }));
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\nWhiteboard host listening on http://localhost:${info.port}`);
  console.log('Guests on the same network can join with a board link; no provider keys are ever sent to them.\n');
});

injectWebSocket(server);

function shutdown(): void {
  console.log('\nShutting down: saving every board to SQLite...');
  persistAllRoomsNow();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
