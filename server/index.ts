import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBoard, deleteBoard, getBoard, isAdminSecretValid } from './boards';
import { getOrCreateRoom, persistAllRoomsNow } from './rooms';

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
  const secret = c.req.header('x-admin-secret');
  if (!isAdminSecretValid(id, secret)) {
    // Sanitized error: never reveals whether the board exists vs. the secret was wrong.
    return c.json({ error: 'forbidden' }, 403);
  }
  deleteBoard(id);
  return c.json({ ok: true });
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
