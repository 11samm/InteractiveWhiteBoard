# Handoff — Interactive Whiteboard

**Date:** 2026-09-17  
**Repo:** https://github.com/11samm/InteractiveWhiteBoard  
**Branch:** `main` at `a9305fa` (`host dashboard plus reliable. URGENT: ip based connecting easy`)  
**Working tree:** clean except this file (commit it before switching machines)

This is a resume/portfolio project: a LAN-collaborative study whiteboard. Students draw together, upload course PDFs, and ask a host-funded AI tutor about both the live board and the documents. The product vision, phases, and out-of-scope list live in [`PLAN.md`](PLAN.md). **Section 3 of `PLAN.md` (“Current state”) is stale** — it still describes the original Figma canvas mock. Trust the code and this document instead.

---

## 1. Where the project actually is

| Phase | PLAN.md name | Status |
| --- | --- | --- |
| 0 | TypeScript baseline, routing | Done |
| 1 | tldraw board | Done (native toolbar + custom style panel / eraser) |
| 2 | Authoritative multiplayer + SQLite persistence | Done |
| 3 | PDF ingest, chunking, embeddings, retrieval eval | Done |
| 4 | Grounded streaming tutor + citations + limits | Done |
| 5 items 1–3 | Host dashboard, reliability checklist, measurements | Done (localhost two-tab) |
| **5 remaining** | **Easy LAN/IP guest join, two-device demo, README, CI, narrated clip** | **Next work** |
| 6 | AI board annotations | Explicitly deferred — do not start before Phase 5 is recruiter-ready |
| 7 | Voice, OCR, public hosting, extra providers | Out of scope for the portfolio release |

The last commit message is the current priority: **make joining from another device by IP easy**. The dashboard already copies a LAN-IP URL, but `npm run dev` still binds Vite to localhost, so a phone on the same Wi-Fi cannot load that link without extra flags and firewall holes.

---

## 2. What you must copy off this machine (not in git)

`.env` is gitignored. Without it, chat is disabled and search falls back to keywords.

On the new PC:

1. Clone the repo.
2. Copy `.env` from this machine (or create it from `.env.example` and paste a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey)).
3. Do **not** commit `.env`.

Typical `.env` on this machine:

```env
GEMINI_API_KEY=<host-only key>
# optional:
# GEMINI_CHAT_MODEL=gemini-3.8-flash
# GEMINI_EMBEDDING_MODEL=gemini-embedding-001
# CHAT_MAX_REQUESTS_PER_WINDOW=8
# CHAT_WINDOW_MS=300000
# CHAT_BUDGET_USD_PER_BOARD=1.0
```

Also gitignored and **will not transfer**:

- `data/whiteboard.sqlite` and WAL files — local boards, files, messages, usage
- `data/uploads/` — uploaded PDFs

Admin recognition is **per browser**: `localStorage` key `whiteboard:admin-secret:<boardId>`. Creating a board on PC A does not make you the host on PC B. Create a new board on the new machine.

Display names use `wb:name:<boardId>` in `localStorage`.

---

## 3. Setup on the other PC

This machine used **Node v24.14.0** and **npm 11.9.0**. `better-sqlite3` is a native addon; `npm i` must compile it for that Node version.

```powershell
git clone https://github.com/11samm/InteractiveWhiteBoard.git
cd InteractiveWhiteBoard
npm i
copy .env.example .env   # then paste GEMINI_API_KEY
npm run dev
```

- Vite client: http://localhost:5173 (proxies `/api` and the sync WebSocket to the host)
- Host API: http://localhost:8787 (`GET /api/health` → `{ "ok": true }`)

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Client + server together |
| `npm run typecheck` | Frontend + server `tsc` |
| `npm run build` | Typecheck + Vite production bundle |
| `npm start` | Host only (`tsx server/index.ts`). In `NODE_ENV=production` it also serves `dist/` |
| `npm run eval:retrieval` | Ingests `eval/Linear_Algebra_Ch3.pdf`, scores `eval/questions.json` |

If `better-sqlite3` fails to build, install Windows build tools / a matching Node LTS and rerun `npm i`. Do not check `node_modules` into git.

Restart the host after any `.env` change (`process.loadEnvFile` runs at process start).

---

## 4. Architecture (what *this* repo owns vs tldraw)

Do not present tldraw’s editor or sync engine as original work. Attribution: [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) (Figma/shadcn/Unsplash). tldraw licensing for a public portfolio still needs an explicit README note (Phase 5 leftover).

```text
Browser(s)  --HTTP+WS-->  Vite :5173 (dev proxy)
                              |
                              v
                         Node host :8787  (Hono)
                              |
         +--------------------+--------------------+
         |                    |                    |
   TLSocketRoom         SQLite (data/)        Gemini (server-only)
   per boardId          boards, snapshots,    chat + embeddings
                        files, chunks,        key never leaves host
                        messages, citations,
                        usage
         |
   data/uploads/<boardId>/...
```

Trust model:

- Board URL `/board/<uuid>` **is** the guest token. Anyone with it can draw, upload PDFs, delete files, and chat.
- Creator gets a one-time `adminSecret` from `POST /api/boards`, hashed in SQLite, stored only in that browser. Required for `DELETE /api/boards/:id` and `GET /api/boards/:id/usage` via `x-admin-secret`.
- Guests never receive the Gemini key. `/api/config` returns `{ aiConfigured, lanIPv4 }` only.
- Upload limits: PDF only, 20 MB, 20 files/board.
- Chat: 4000-char cap, in-memory per-board rate limit, per-board USD budget (defaults in `server/ai/config.ts`).

Persistence:

- tldraw room snapshots debounce 1.5s to SQLite; flush immediately when the last session leaves; flush all rooms on SIGINT/SIGTERM.
- File delete removes the disk asset and cascaded chunks. Citations keep denormalized filename/page/excerpt so old answers still make sense.

---

## 5. Key files

### Frontend (`src/`)

| File | Role |
| --- | --- |
| `src/app/App.tsx` | Routes: `/`, `/board/:boardId`, `/host/:boardId?` |
| `src/app/routes/HomePage.tsx` | Create board / join field |
| `src/app/routes/BoardPage.tsx` | `useSync`, presence, reconnect banner, chrome |
| `src/app/routes/HostSetupPage.tsx` | Creator dashboard: LAN join URL, AI status, usage |
| `src/app/components/Board.tsx` | tldraw wrapper; hides colliding chrome |
| `src/app/components/ChatPanel.tsx` | SSE tutor, markdown, citations, board PNG snapshot |
| `src/app/components/StudyContextSidebar.tsx` | PDF upload, shared processing poll, delete |
| `src/app/lib/api.ts` | REST + SSE client, admin secret storage, `buildGuestJoinOrigin` |
| `src/app/tldraw/CustomEraserTool.ts` | Size-aware eraser |

### Host (`server/`)

| File | Role |
| --- | --- |
| `server/index.ts` | Hono routes, SSE chat, WS upgrade, static `dist` in prod |
| `server/rooms.ts` | `TLSocketRoom` map + snapshot persist |
| `server/db.ts` | SQLite schema |
| `server/chat.ts` | One grounded turn: limits → retrieve → stream → store |
| `server/ai/chat.ts` | Gemini stream + tutoring system prompt |
| `server/ai/config.ts` | Models, costs, rate/budget env knobs |
| `server/ai/embeddings.ts` | Batch embed; null → keyword fallback |
| `server/ingestion.ts` | pdf-parse → chunk → embed; scanned PDF = clear error |
| `server/search.ts` | Cosine (or keyword) + overview-query coverage |
| `server/lan.ts` | First private IPv4 for join links |
| `server/env.ts` | Loads `.env` first |

### Eval / docs

| File | Role |
| --- | --- |
| `eval/Linear_Algebra_Ch3.pdf` | 5-page fixture |
| `eval/questions.json` | 16 questions (15 page-grounded + 1 off-topic) |
| `scripts/evaluate-retrieval.ts` | Offline retrieval score |
| `docs/evaluation.md` | Measured numbers (2026-09-17) |
| `docs/reliability.md` | Two-tab checklist (2026-09-17) |

`README.md` is still the Figma Make stub. Replacing it is Phase 5 packaging, not done.

---

## 6. Implemented product surface

Working today on localhost:

- Create board → tldraw draw/shapes/text/select/pan/zoom/undo, custom eraser size
- Two tabs share one board, presence avatars + tldraw cursors
- Refresh / host restart restore shapes and uploaded files (debounced persist; wait ~2s after last edit before killing the process)
- PDF upload with processing/ready/error; invalid type rejected; empty/scanned PDFs fail with a readable message
- Shared chat thread; streamed tokens; markdown; page citations with excerpts
- Optional board snapshot in the chat request (toggle in the panel)
- Stop generation (AbortController)
- Failure codes: `no_api_key`, `rate_limited`, `budget_exceeded`, `model_failed`, `cancelled`, plus upload errors
- Host dashboard for the creating browser only
- Retrieval eval **15/16 (94%)** semantic, Gemini embeddings

Chat timing is logged in the browser console as `[chat timing]` (TTFB + server `latencyMs`).

---

## 7. Next work (do this in order)

### P0 — Easy IP/LAN join (the URGENT item)

Goal: host copies a link, guest on another device on the same Wi-Fi opens it and draws. No manual `ipconfig` or `localhost` swap.

Current gaps:

1. **Vite is localhost-only.** `vite.config.ts` has no `server.host`. `npm run dev` does not listen on `0.0.0.0`. Dashboard already tells the user to run `vite --host`.
2. **Windows Firewall** will block inbound 5173 (and 8787 if you expose the API directly).
3. **Home join field is naive.** Pasting `http://192.168.x.x:5173/board/<uuid>` navigates to `/board/http://...` because `HomePage` uses the raw string as the id. Guests should open the copied URL directly; if they paste it on `/`, parse pathname `/board/:id` (and ignore origin).
4. **Dev is two processes.** Guests must reach Vite (5173), which then proxies `/api` to 8787. Binding only the Node server is not enough in `npm run dev`. Production (`vite build` + `NODE_ENV=production npm start`) is one process on 8787 — often easier for a two-device demo if that process listens on `0.0.0.0`.
5. **Some campus/dorm APs isolate clients.** Same-machine two-browser remains the fallback (already proven). Document that in the README when you write it.
6. **LAN detector** (`server/lan.ts`) picks the first private IPv4. VPNs / extra adapters can pick the wrong NIC.

Suggested implementation (keep it small):

- Set Vite `server.host: true` (or `0.0.0.0`) and print the Network URL from `npm run dev`.
- Confirm Hono `serve()` hostname is `0.0.0.0` (not loopback).
- Make `npm run dev` the one command that is LAN-reachable.
- Parse pasted join URLs on the home page.
- Optional: a short “Windows Firewall: allow Node and Vite” note on the host dashboard (already partially there).
- Verify with a phone or second laptop. That is the resume-ready two-device clip.

Do not add HTTPS/voice to “fix” LAN. Plain HTTP on LAN is expected; microphone APIs will not work for guests (PLAN.md 5.4).

### P1 — Finish Phase 5 recruiting package

Only after LAN join works (or is honestly documented as blocked by AP isolation):

1. Replace `README.md` with: one-sentence product, demo, three capabilities, architecture, measured results, local setup, trust model, limitations, tldraw attribution. Lead with evidence, not the roadmap.
2. GitHub Actions: `npm run typecheck` and `npm run build` (and retrieval eval if a key can be supplied as a secret; otherwise skip eval in CI).
3. Record a 60–90s narrated demo: two devices, PDF upload, grounded answer with a page citation.
4. Fill remaining reliability rows if easy: R4 (true WS drop), oversized PDF, one-page scanned PDF. Do not invent Pass/Fail.

### P2 — Small product/quality gaps (only if they help the demo)

- Retrieval off-topic miss: “boiling point of water on Mars” still scored 0.51 vs reject threshold 0.2 (`docs/evaluation.md`). Optional: raise threshold or add a no-hit cutoff used by chat.
- Citations shown are **all retrieved chunks**, not only ones the model marked `[n]`. PLAN.md allows “chunk was in the request”; a PDF page viewer is explicitly out of scope.
- Chat history is per board, not live-synced across tabs except on reload (`GET /api/boards/:id/messages`).
- `inlineBase64AssetStore` for pasted images — fine for demo, not a real asset host.
- `PLAN.md` §3 should be updated or deleted so it does not contradict the README.

### Do not do yet

- Phase 6 AI notes/arrows/highlights
- Voice
- OCR
- Extra model providers
- Visual redesign
- Public cloud hosting
- Committing `data/`, `.env`, or `node_modules`

---

## 8. Reliability and measurements (already recorded)

Source: [`docs/reliability.md`](docs/reliability.md), [`docs/evaluation.md`](docs/evaluation.md). Conditions: Windows 10, two localhost tabs, Node 24, `gemini-3.8-flash` + `gemini-embedding-001`.

Reliability:

- Pass: concurrent edits, PDF ingest + `.txt` reject, refresh + host restart, board+doc chat + citations + Stop, no-key / rate-limit / budget SSE errors, usage 403, host vs guest dashboard
- Skipped: R4 isolated WS drop, oversized file, scanned PDF fixture

Eval:

- Retrieval 15/16 (94%); miss is the intentional no-source question
- Chat n=3, TTFB ~2.0–2.4s, total ~2.0–2.7s
- Sync: visual only, five short strokes, perceived under 100ms, no duplicates

Re-run eval after embedding/chunking changes: `npm run eval:retrieval`. Do not invent numbers.

---

## 9. API surface

```text
POST   /api/boards
GET    /api/boards/:id
DELETE /api/boards/:id          (admin)
GET    /api/config              { aiConfigured, lanIPv4 }
GET    /api/boards/:id/files
POST   /api/boards/:id/files    multipart field "file"
GET    /api/files/:id/status
DELETE /api/files/:id
POST   /api/boards/:id/search   debug/eval
GET    /api/boards/:id/messages
GET    /api/boards/:id/usage    (admin)
POST   /api/boards/:id/chat     SSE: token | done | error
WS     /api/sync/:boardId
GET    /api/health
```

---

## 10. How to continue in a new Cursor chat

Paste this:

> Read HANDOFF.md and PLAN.md. We are at Phase 5. Phases 0–4 and Phase 5 items 1–3 are done. Next is P0: make LAN/IP guest join work from `npm run dev` without manual localhost replacement (Vite host bind, firewall/docs, parse pasted join URLs). Do not start Phase 6. Do not rewrite the README until a second device can join or we document why the AP blocks it.

Then implement P0 and verify on a real second device if one is available.

---

## 11. Conventions

- TypeScript strict on both `tsconfig.json` and `tsconfig.server.json`. Run `npm run typecheck` after server or client changes.
- Dark floating UI: `bg-slate-950`, cyan→violet primary buttons, `focus:ring-2 focus:ring-cyan-500`. Match existing surfaces.
- Provider keys only on the host. No key inputs in the UI.
- Failures must be named user-facing states, not silent empty chat.
- tldraw owns editing and sync; this repo owns hosting, persistence, ingest, retrieval, tutor context, and access control.
