const STORAGE_PREFIX = 'wb:name:';

/**
 * Per-board display name, remembered locally so a refresh (or the host
 * navigating straight from `HomePage`) doesn't re-prompt for a name that
 * was already given. Guests opening a fresh link for a board they haven't
 * visited before will still see the naming screen.
 */
export function getStoredName(boardId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + boardId);
  } catch {
    return null;
  }
}

export function setStoredName(boardId: string, name: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + boardId, name);
  } catch {
    // Ignore storage failures (e.g. private browsing) — the name just
    // won't be remembered for next time.
  }
}
