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
