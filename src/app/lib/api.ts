export interface CreateBoardResponse {
  id: string;
  adminSecret: string;
}

export interface BoardSummary {
  id: string;
  title: string;
}

/** localStorage key under which a board creator's admin secret is kept, client-side only. */
function adminSecretKey(boardId: string): string {
  return `whiteboard:admin-secret:${boardId}`;
}

export function getStoredAdminSecret(boardId: string): string | null {
  try {
    return localStorage.getItem(adminSecretKey(boardId));
  } catch {
    return null;
  }
}

function storeAdminSecret(boardId: string, secret: string): void {
  try {
    localStorage.setItem(adminSecretKey(boardId), secret);
  } catch {
    // Storage can fail (private browsing, quota); the board still works,
    // the creator just won't be recognized as the admin on this device.
  }
}

export async function createBoard(title?: string): Promise<CreateBoardResponse> {
  const res = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {}),
  });
  if (!res.ok) throw new Error(`Failed to create board (${res.status})`);
  const data = (await res.json()) as CreateBoardResponse;
  storeAdminSecret(data.id, data.adminSecret);
  return data;
}

export async function getBoard(boardId: string): Promise<BoardSummary | null> {
  const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load board (${res.status})`);
  return (await res.json()) as BoardSummary;
}

export function isBoardAdmin(boardId: string): boolean {
  return Boolean(getStoredAdminSecret(boardId));
}

export function getSyncUrl(boardId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/api/sync/${encodeURIComponent(boardId)}`;
}

// --- Host configuration status --------------------------------------------

export interface HostConfigStatus {
  aiConfigured: boolean;
  lanIPv4: string | null;
}

export async function getConfigStatus(): Promise<HostConfigStatus> {
  const res = await fetch('/api/config');
  if (!res.ok) return { aiConfigured: false, lanIPv4: null };
  return (await res.json()) as HostConfigStatus;
}

/** Origin guests on the same Wi-Fi should use (LAN IP when the host UI is on localhost). */
export function buildGuestJoinOrigin(lanIPv4: string | null): string {
  const { protocol, hostname, port } = window.location;
  const portPart = port ? `:${port}` : '';
  const useLan =
    lanIPv4 && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]');
  const host = useLan ? lanIPv4 : hostname;
  return `${protocol}//${host}${portPart}`;
}

// --- Documents (Phase 3) ---------------------------------------------------

export type FileStatus = 'processing' | 'ready' | 'error';

export interface FileSummary {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  status: FileStatus;
  error: string | null;
  createdAt: string;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function listBoardFiles(boardId: string): Promise<FileSummary[]> {
  const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/files`);
  if (!res.ok) throw new Error(`Failed to list files (${res.status})`);
  return (await res.json()) as FileSummary[];
}

export async function uploadBoardFile(boardId: string, file: File): Promise<FileSummary> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/files`, { method: 'POST', body });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string; message?: string });
    throw new UploadError(data.message ?? `Upload failed (${res.status})`, data.error ?? 'unknown');
  }
  return (await res.json()) as FileSummary;
}

export async function deleteBoardFile(fileId: string): Promise<void> {
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete file (${res.status})`);
}

// --- Grounded tutor chat (Phase 4) ------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'error';

export interface CitationDto {
  id: string;
  chunkId: string | null;
  fileId: string | null;
  filename: string;
  page: number;
  excerpt: string;
  retrievalScore: number;
}

export interface MessageDto {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  citations: CitationDto[];
}

export interface UsageDto {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface UsageSummaryDto {
  requestCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalEstimatedCostUsd: number;
  avgLatencyMs: number;
  budgetUsd: number;
  remainingUsd: number;
}

export async function getBoardMessages(boardId: string): Promise<MessageDto[]> {
  const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/messages`);
  if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
  return (await res.json()) as MessageDto[];
}

export async function getBoardUsage(boardId: string): Promise<UsageSummaryDto> {
  const secret = getStoredAdminSecret(boardId);
  const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/usage`, {
    headers: secret ? { 'x-admin-secret': secret } : undefined,
  });
  if (res.status === 403) throw new Error('forbidden');
  if (!res.ok) throw new Error(`Failed to load usage (${res.status})`);
  return (await res.json()) as UsageSummaryDto;
}

export function listKnownAdminBoardIds(): string[] {
  const prefix = 'whiteboard:admin-secret:';
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) ids.push(key.slice(prefix.length));
    }
  } catch {
    // private mode / blocked storage
  }
  return ids;
}

interface ChatStreamHandlers {
  onToken: (text: string) => void;
  onDone: (payload: { messageId: string; citations: CitationDto[]; usage: UsageDto }) => void;
  onError: (payload: { code: string; message: string }) => void;
}

/**
 * Posts a chat turn and reads the server's SSE stream by hand (native
 * `EventSource` can't send a POST body). Each event is a JSON line already
 * shaped like our `onToken`/`onDone`/`onError` handlers.
 */
export async function sendChatMessage(
  boardId: string,
  message: string,
  boardImage: string | undefined,
  handlers: ChatStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, boardImage }),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    handlers.onError({ code: 'network_error', message: 'Could not reach the host.' });
    return;
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}) as { error?: string; message?: string });
    handlers.onError({ code: data.error ?? 'request_failed', message: data.message ?? 'Request failed.' });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine) as
        | { type: 'token'; text: string }
        | { type: 'done'; messageId: string; citations: CitationDto[]; usage: UsageDto }
        | { type: 'error'; code: string; message: string };

      if (payload.type === 'token') handlers.onToken(payload.text);
      else if (payload.type === 'done') handlers.onDone(payload);
      else if (payload.type === 'error') handlers.onError(payload);
    }
  }
}
