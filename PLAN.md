# Interactive Whiteboard — Recruiter-Ready Build Plan

Last updated: September 2026.

## 1. Product vision

A collaborative, AI-assisted study whiteboard. Students draw together, upload course material, and ask an AI tutor questions about both the live board and their documents.

This project must demonstrate a complete technical story:

- **Real-time collaboration:** multiple clients share one authoritative, persistent board.
- **Multimodal tutoring:** the tutor reasons about a board image and retrieved course material in the same request.
- **Grounded answers:** responses cite the uploaded source and page.
- **Trust boundaries:** provider keys stay on the host while guests can draw, upload, and chat.
- **Production-minded behavior:** reconnects, failed uploads, deletion, usage limits, and provider failures are handled deliberately.

GlowProtocol demonstrates native iOS development and InterviewPilot demonstrates real-time audio. This project's distinct contribution is shared state: multiple clients, one durable board, and an AI participant that understands that shared world.

## 2. Resume-ready finish line

The project is ready for applications when this workflow succeeds reliably:

> Two browsers join one board and edit concurrently. Either participant uploads a PDF. After a restart or reconnect, the board and file remain available. A participant asks a typed question about the drawing and document, and the tutor streams an answer with a valid page citation. The tutor can also propose notes, arrows, and highlights; a participant applies them to the shared board and removes the full set with one undo.

Record the final demo using two physical devices on the same network. Use two browser windows on one machine for development and repeatable testing.

These features are extensions and do not block applications:

- Voice conversation
- OCR for scanned documents
- Public cloud hosting
- Multiple model providers
- Session recaps and quiz modes

## 3. Current state

Phases 0–4 are implemented. The app has a tldraw board, authoritative WebSocket rooms with SQLite snapshots, shared PDF ingestion and retrieval, and a streaming tutor with board-image context and page citations. The host dashboard shows a LAN join link and usage.

Phase 5 LAN bind, guest-link parsing, and GitHub Actions are implemented. A same-machine LAN IPv4 smoke check passed, and the owner opened the dashboard guest link on a second physical device. The product README is in `README.md`. A narrated clip and the skipped reliability rows (isolated WebSocket drop, oversized PDF, scanned fixture) remain optional packaging.

Phase 6 is implemented: schema-validated notes, text, arrows, and highlights; human review; one undoable tldraw batch on the shared room. See `README.md` for the pipeline and known limitations (capture-time bounds, empty plans). Keep the dark, floating visual identity and address accessibility or structural debt when touching related components.

Code map and trust model: `README.md`. Machine secrets and leftover packaging: `HANDOFF.md`. Measurements: `docs/evaluation.md`.

## 4. Architecture

### 4.1 Board and synchronization

Use tldraw for the shape model, selection, transformations, undo/redo, camera behavior, serialization, image export, and synchronization primitives. The portfolio contribution is the surrounding system: hosting, durable room state, guest access, reconnect behavior, file ingestion, retrieval, multimodal context assembly, and synchronized AI actions.

One Node process on the host owns each board room. Clients connect through WebSockets. Room state is persisted to SQLite and restored after restart.

Document which guarantees come from tldraw and which are implemented in this repository. Do not present its editing or synchronization engine as work built from scratch.

### 4.2 Host and guest model

The host process:

- Serves the application to the local network.
- Owns board rooms and persists their state.
- Stores uploaded files and extracted text.
- Calls model providers with server-held credentials.
- Prints the guest join URL and a separate administrator secret or URL.

Guests:

- Join with a random, unguessable board token.
- Can draw, upload supported files, and use the tutor.
- Cannot access provider credentials or administrator operations.

The boundary must be enforced by the server. Hiding host controls in the interface is not authorization. Treat dorm, school, and shared Wi-Fi networks as untrusted.

MVP controls:

- Random board identifiers with sufficient entropy
- A separate administrator secret available only to the host
- Loopback-only administrator endpoints where practical, or endpoints protected by the administrator secret
- Upload type, size, and file-count limits
- Per-board chat rate limits and a configurable spending cap
- Sanitized errors that never reveal credentials
- No provider keys in client bundles, page source, API responses, logs, or WebSocket payloads

### 4.3 Components

**Frontend**

- React, Vite, TypeScript, and Tailwind
- tldraw with a small set of custom controls
- Board routes such as `/board/:boardId`
- Shared presence, Files panel, and Chat panel
- Streaming responses and source citations

**Host server**

- Node, Hono, and WebSockets
- One authoritative synchronization room per board
- SQLite persistence
- Upload, parsing, chunking, and indexing
- Server-side model requests and streamed responses
- Join-link and host-administration helpers

**Storage**

- Disk for uploaded documents and board assets
- SQLite for metadata, room persistence, chunks, messages, citations, and later usage records
- In-process vector search or vectors stored alongside chunks for the initial document scale

### 4.4 Initial data model

Start with only the data needed by the resume-ready workflow:

```sql
boards (
  id, title, guest_token_hash, created_at, updated_at
)

board_snapshots (
  board_id, state_blob, version, updated_at
)

files (
  id, board_id, local_path, filename, mime_type, size_bytes,
  page_count, status, error, created_at
)

chunks (
  id, file_id, page, chunk_index, text, token_count, embedding_blob
)

messages (
  id, board_id, role, content, created_at
)

citations (
  message_id, chunk_id, retrieval_score
)
```

Add a `usage` table after model calls work and actual measurements are available. Store provider credentials outside the application database in a gitignored host configuration or operating-system-backed secret store.

Deleting a file must remove its stored asset, chunks, and embeddings. Historical citations must either remain as unavailable references or be removed according to a documented policy.

### 4.5 Minimal API surface

```text
POST   /api/boards
GET    /api/boards/:id

POST   /api/boards/:id/files
GET    /api/files/:id/status
DELETE /api/files/:id

POST   /api/boards/:id/chat
GET    /api/boards/:id/messages

WS     /sync/:boardId
```

Host configuration uses a separate loopback-only interface or administrator-protected endpoints. Credentials may be accepted for storage but are never returned.

## 5. AI design

### 5.1 Model strategy

Use one configurable multimodal chat provider and one embedding path. Keep provider and model identifiers in environment configuration rather than hard-coding changing model names, benchmarks, and prices in this plan.

Add another provider only when measurements show a real quality, reliability, or cost problem. The project should emphasize context construction, citations, and failure handling rather than the number of external APIs connected.

### 5.2 Grounded typed chat

Each chat request assembles:

1. A concise tutoring instruction with a citation requirement.
2. Recent conversation turns.
3. Top retrieved chunks filtered to the current board's files.
4. A board image when the question refers to the drawing or the board changed materially.

The server streams the response and stores the completed message. Each displayed citation must refer to a chunk actually included in the model request. Selecting a citation opens the source at the relevant page or shows its excerpt.

The interface distinguishes these failure cases:

- No provider key configured
- Unsupported, scanned, or oversized file
- Extraction failed
- File still processing
- No relevant passage found
- Model request timed out or failed
- Rate or spending limit reached

### 5.3 AI board actions — extension

After typed chat is reliable, the tutor may return validated structured actions for a deliberately small shape set:

- Text
- Sticky notes
- Arrows
- Highlights

Actions are schema-validated, visibly attributed to the tutor, synchronized to all participants, and reversible as one undo operation. Never execute arbitrary code or unbounded editor commands from a model response.

### 5.4 Voice — later extension

Voice does not block the portfolio release because InterviewPilot already demonstrates live audio.

Plain HTTP on another device's LAN address is generally not a secure browser context, so microphone capture cannot be assumed to work for guests. Before implementing voice, choose one supported approach:

- Local HTTPS with trusted certificates
- A secure tunnel or hosted origin
- Voice restricted to the host device

Only stream audio or board frames during an explicit session. Show persistent listening and board-visibility indicators and stop capture immediately when the session ends.

## 6. Implementation roadmap

Each phase ends with a demonstrable capability. Estimates assume solo, part-time work and should be adjusted using actual velocity.

### Phase 0 — Build baseline (1–2 days)

- Add type checking while retaining the production build.
- Remove only dead dependencies that obstruct the migration.
- Add routes for a board and host setup.

Done when:

- Production build and type checking pass.
- The project has a short local setup path.
- No broad visual redesign has delayed board work.

### Phase 1 — Functional tldraw board (3–5 days)

- Replace the raw canvas with tldraw.
- Support drawing, shapes, text, selection, pan, zoom, and undo/redo.
- Preserve a focused version of the existing toolbar and visual identity.
- Restore a local board after refresh.

Done when:

- Every visible tool works.
- Reloading restores the board.
- Custom controls have keyboard access and accessible labels.

### Phase 2 — Authoritative multiplayer and persistence (1–1.5 weeks)

- Add the Node host and WebSocket room.
- Synchronize two clients with real presence and cursors.
- Persist room state to SQLite and restore it after restart.
- Implement guest tokens and protected host administration.
- Handle reconnects and temporary network interruption.

Done when:

- Two clients edit concurrently and converge on the same state.
- A disconnected client reconnects without duplicating or losing confirmed shapes.
- Server restart restores the board.
- Guests cannot retrieve credentials or access host-only operations.

This is the first major portfolio milestone. Record a short proof clip when it works.

### Phase 3 — Document ingestion and retrieval (about 1 week)

- Upload PDFs from either client with explicit type, size, and count limits.
- Store source files on the host.
- Extract page-aware text, chunk it, create embeddings, and index it.
- Display shared ingestion progress and actionable failures.
- Delete files and derived data consistently.
- Add a small checked-in evaluation fixture with questions and expected pages.

OCR for image-only documents is deferred. The MVP identifies unsupported scans clearly.

Done when:

- Both clients see an uploaded file and its processing state.
- Restart preserves the file and index.
- Evaluation queries return relevant chunks from expected pages.
- Invalid, scanned, and oversized files fail clearly.

### Phase 4 — Board-aware grounded tutor (1–1.5 weeks)

- Add server-side streaming chat.
- Combine retrieved passages with a tldraw board image.
- Store thread history.
- Render verifiable page citations.
- Add cancellation, timeout, rate limits, and a configurable budget.
- Record latency, token usage, and errors without logging sensitive content or credentials.

Done when:

- The tutor answers a question requiring both the board and an uploaded document.
- Every displayed citation maps to context supplied to the model.
- Expected failures produce useful user-facing states.
- The host can inspect measured latency and usage for a demo session.

The grounded tutor is complete; synchronized AI board annotations are part of the current release target.

### Phase 5 — Reliability and recruiting package (3–5 days)

- Run the complete workflow on two physical devices.
- Test reconnects, refreshes, restarts, concurrent edits, deleted files, invalid uploads, missing keys, timeouts, and exhausted budgets.
- Measure synchronization latency, retrieval correctness, chat time to first token, and observed failures.
- Record a 60–90 second narrated demo.
- Replace the starter README with product, demo, architecture, setup, measurements, security model, attribution, and known limitations. **Done** — see `README.md`.
- Add visible CI for build, type checking, and focused tests. **Done** — `.github/workflows/ci.yml`.

Done when:

- A reviewer understands the project in under one minute.
- A developer can reproduce the two-client workflow from the README.
- Every resume claim is supported by code, tests, measurements, or user evidence.

Remaining Phase 5 packaging: narrated 60–90s clip and skipped reliability rows, recorded only with real evidence.

### Phase 6 — Synchronized AI annotations (about 1 week)

- Add schema-validated notes, text, arrows, and highlights.
- Mark AI-authored shapes visibly.
- Apply one response as one undoable operation.
- Synchronize the result through the authoritative room.

Done when:

- The tutor explains a correction directly on the board.
- Both clients see the annotation.
- One undo removes the full AI action without affecting unrelated edits.

### Phase 7 — Optional extensions

Choose extensions based on observed user needs:

- Voice with an explicit secure-origin strategy
- OCR for scanned notes and slides
- Study-session recaps
- Quiz mode grounded in selected files
- Board export
- Public hosting
- Provider fallback

Do not implement an extension solely to lengthen the technology list.

## 7. Evaluation plan

Keep results in the README or `docs/evaluation.md`. Report the device and network setup, sample size, and method with every number.

### Collaboration

- Measure local edit propagation latency over repeated edits.
- Disconnect one client, edit on the other, reconnect, and verify convergence.
- Restart the server and compare the restored board with the last confirmed state.
- Attempt simultaneous editing and deletion of the same shape.

### Retrieval and citations

- Maintain at least 15 representative questions across several pages of a known PDF.
- Record whether an expected page appears in the top retrieved results.
- Verify every rendered citation was present in the supplied context.
- Include questions that should return “no relevant source found.”

### AI response

- Measure time to first streamed token and total completion time.
- Track request failures and timeouts during repeated demo runs.
- Evaluate questions that require the board, the document, and both together.

### Security and resilience

- Verify guest responses, bundles, logs, and WebSocket traffic contain no raw provider keys.
- Verify upload type and size enforcement.
- Verify chat rate and spending limits.
- Verify cleanup after file deletion.

Choose targets after baseline measurements. Do not invent performance claims in advance; publish measured results and explain the conditions.

## 8. Recruiting presentation

The repository should lead with evidence rather than its roadmap. **`README.md` is that front door.** Remaining recruiter packaging is a narrated clip if you want one on GitHub.

1. One-sentence product description
2. 60–90 second demo
3. Three technically significant capabilities
4. Compact architecture diagram
5. Measured results and evaluation method
6. Local setup
7. Security and trust model
8. Known limitations and attribution

Potential resume framing after implementation and measurement:

- Built a LAN-collaborative study whiteboard with authoritative WebSocket synchronization, SQLite persistence, presence, and reconnect recovery across multiple clients.
- Developed a multimodal tutoring pipeline that combined live board snapshots with page-aware retrieval over uploaded PDFs and streamed answers with verifiable citations.
- Designed server-enforced guest access, upload limits, request budgets, and credential isolation so collaborators could use host-funded AI without receiving provider keys.

Replace words such as “fast,” “secure,” and “accurate” with measured results before using these bullets.

## 9. Risks to validate early

- **tldraw licensing:** documented in `README.md` and `ATTRIBUTIONS.md`. Production still needs a tldraw license key; hobby keeps the watermark. Dev/localhost is the intended demo until a key is added.
- **Persistence contract:** confirm the supported way to serialize and restore synchronization state before dependent work.
- **LAN networking:** test Windows Firewall and client-isolation Wi-Fi early; document the same-machine fallback.
- **Secure browser context:** plain LAN HTTP is insufficient for some device APIs, including microphone access.
- **Document quality:** handwriting and scanned PDFs may require OCR; fail clearly until that extension exists.
- **Model variability:** keep model names configurable and retain evaluation fixtures so provider changes can be compared.
- **Scope pressure:** visual redesign, voice, and extra providers must not delay the resume-ready workflow.

## 10. Out of scope for the portfolio release

- Billing and subscriptions
- Public user accounts and organizations
- LMS integrations
- Native mobile clients
- Fine-tuning
- Global multi-region collaboration
- Unlimited public sharing
- Multiple vector databases or model routers
- Rebuilding tldraw's editor or synchronization engine

The project succeeds when its central workflow is reliable, measurable, understandable, and easy to demonstrate—not when every possible feature exists.
