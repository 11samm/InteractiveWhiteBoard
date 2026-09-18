# Handoff — Interactive Whiteboard

**Date:** 2026-09-18
**Repo:** https://github.com/11samm/InteractiveWhiteBoard  
**Starting commit for this follow-up:** `6133103` (`Enable LAN guest joining and add automatic build checks`)

**Current work:** Phase 6 AI annotation changes are in the working tree; check `git status` before switching machines.

This is a resume/portfolio project: a LAN-collaborative study whiteboard. Students draw together, upload course PDFs, and ask a host-funded AI tutor about both the live board and the documents. The product vision, phases, and out-of-scope list live in [`PLAN.md`](PLAN.md).

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
| 5 LAN join + CI | Dev LAN bind, URL parsing, local LAN smoke check, GitHub Actions | Implemented; user confirmed the guest link works on a second device |
| **5 remaining** | **Full two-device demo, README, narrated clip, remaining reliability checks** | **Next work** |
| 6 | AI board annotations | In progress; required before the owner shares the project |
| 7 | Voice, OCR, public hosting, extra providers | Out of scope for the portfolio release |

The dashboard's LAN-IP link has opened successfully on a second physical device. `npm run dev` binds Vite and the API host to `0.0.0.0`. The owner wants AI board annotations working before sharing the project; finish and verify Phase 6, then complete the demo and recruiting package.

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

The original machine used **Node v24.14.0** and **npm 11.9.0**. `better-sqlite3` is a native addon. On this Windows machine, Node v24.15.0 lacked a matching prebuilt addon and source compilation needed a Windows SDK; Node v22.23.2 successfully installed a prebuilt addon.

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

If `better-sqlite3` fails to build, use a Node LTS with a matching prebuilt addon or install Visual Studio C++ tools with the Windows SDK, then rerun `npm i`. Do not check `node_modules` into git.

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
| `src/app/components/AnnotationComposer.tsx` | Annotation prompt, review, apply/discard |
| `src/app/annotations.ts` | Capture selection/board bounds and apply one undoable tldraw batch |
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
| `server/ai/annotations.ts` | Gemini JSON proposal over board image and retrieved passages |
| `shared/annotationSchema.ts` | Strict action validation for note, text, arrow, highlight |
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

### P0 — IP/LAN join verified

Implemented: Vite and the API host listen on `0.0.0.0`; Vite prints a Network URL; the dashboard copies an IPv4 link and notes firewall/adapter issues; the home join field accepts a full board URL; `LAN_IPV4` can override the detected adapter. The dev client still proxies `/api` and the sync WebSocket to the Node host.

Local smoke check on 2026-09-17: Vite advertised `http://192.168.10.132:5173/`. A request to that address returned the app (HTTP 200), `/api/health` returned `{ ok: true }`, creating a board through that address succeeded, and a WebSocket connection to `/api/sync/:boardId` reached `Open`. This proves the bind and local proxy path, **not** cross-device connectivity.

The user subsequently opened the copied dashboard link on a second physical device and reported that it worked. The device/browser and two-way edits, presence, and reconnect steps were not separately recorded; capture those with the final demo. Plain HTTP is expected for this LAN demo; voice remains deferred.

### P0.5 — Finish synchronized AI annotations

The new **Annotate board** tab proposes up to four notes, text labels, arrows, or highlights. The server validates model JSON; the requester reviews the proposal before applying it to the synced tldraw store. AI-authored shapes carry metadata; notes, text, and arrow labels use a star marker, while highlights have no overlay label. Notes now use wider small-type boxes with alternating colors; highlights use a low-opacity yellow fill. The implementation passes type checking, build, and annotation-schema tests. The no-key API path returned `no_api_key` (HTTP 503), and a live provider request returned one valid 106-character note. The owner generated a note and highlight and reported visual problems in a screenshot; the style changes above address those in code but have not yet been visually verified.

A mobile test of “add some literary theory notes from the pdf then draw a dotted arrow to the most important part” returned an empty proposal. The model prompt now directs partial fulfillment, PDF overview retrieval, and arrows to newly created notes when the PDF is not visible on the board. Arrow actions accept a validated dotted style, and missing PDF passages produce a specific error. A read-only live API proposal on a board with a ready literary theory PDF returned two notes and one dotted arrow (HTTP 200), with no board mutation. The revised behavior still needs a mobile UI check.

A later mobile request for notes from the Apple PDF failed with a generic generation error. Reproduction with the supplied screenshot as image context showed the provider cutting JSON off mid-object under the 1,600 output-token limit. The annotation limit is now 4,096 and PDF-grounded proposals retry once without the board image if the image response is invalid. A read-only live API request with the same prompt and screenshot returned two notes and one dotted arrow (HTTP 200); the user still needs to verify the restarted host and mobile UI.

The owner then showed the dotted arrow pointing from a generated “Key Topics” note into empty space. New PDF takeaway plans now identify the first note as one central takeaway, and the server anchors the arrow to that note. The client creates notes before arrows, reverses a misplaced tail when needed, and binds the arrow tip to the note so moving the note keeps the arrow attached. Geometry and schema tests cover the reversed-arrow case; visual verification on the board is pending.

Still required: visually check the revised note and highlight on the board, confirm both devices see the same shapes, and verify one Undo removes the batch while leaving earlier edits intact. Record the device, browser, prompt, shapes, sync, and undo result. Do not label Phase 6 complete until these checks pass.

### P1 — Finish Phase 5 recruiting package

After the AI annotation workflow is verified:

1. Replace `README.md` with: one-sentence product, demo, three capabilities, architecture, measured results, local setup, trust model, limitations, tldraw attribution. Lead with evidence, not the roadmap.
2. GitHub Actions runs type checking, annotation-schema tests, and build in `.github/workflows/ci.yml`; check the first remote run after pushing. Retrieval eval is omitted because CI has no provider key.
3. Record a 60–90s narrated demo: two devices, PDF upload, grounded answer with a page citation.
4. Fill remaining reliability rows if easy: R4 (true WS drop), oversized PDF, one-page scanned PDF. Do not invent Pass/Fail.

### P2 — Small product/quality gaps (only if they help the demo)

- Retrieval off-topic miss: “boiling point of water on Mars” still scored 0.51 vs reject threshold 0.2 (`docs/evaluation.md`). Optional: raise threshold or add a no-hit cutoff used by chat.
- Citations shown are **all retrieved chunks**, not only ones the model marked `[n]`. PLAN.md allows “chunk was in the request”; a PDF page viewer is explicitly out of scope.
- Chat history is per board, not live-synced across tabs except on reload (`GET /api/boards/:id/messages`).
- `inlineBase64AssetStore` for pasted images — fine for demo, not a real asset host.
- `PLAN.md` §3 has been updated to reflect the implemented app.

### Do not do yet

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
POST   /api/boards/:id/annotations  JSON proposal; client reviews and applies
WS     /api/sync/:boardId
GET    /api/health
```

---

## 10. How to continue in a new Cursor chat

Paste this:

> Read HANDOFF.md and PLAN.md. LAN joining and CI are complete. The owner wants synchronized AI annotations before sharing this project. Phase 6 code is in progress: a separate annotation endpoint proposes bounded shapes, the browser reviews them, and tldraw applies them to the shared board. Validate with a real provider key and two devices, including one-step undo. Then finish the README and narrated demo. Do not claim unrecorded reliability checks passed.

Finish and verify Phase 6, then record the full two-device demo and Phase 5 package.

---

## 11. Conventions

- TypeScript strict on both `tsconfig.json` and `tsconfig.server.json`. Run `npm run typecheck` after server or client changes.
- Dark floating UI: `bg-slate-950`, cyan→violet primary buttons, `focus:ring-2 focus:ring-cyan-500`. Match existing surfaces.
- Provider keys only on the host. No key inputs in the UI.
- Failures must be named user-facing states, not silent empty chat.
- tldraw owns editing and sync; this repo owns hosting, persistence, ingest, retrieval, tutor context, and access control.
