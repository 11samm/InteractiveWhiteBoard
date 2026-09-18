import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createBoard as createBoardOnHost } from '../lib/api';
import { setStoredName } from '../lib/userName';
import { NamePrompt } from '../components/NamePrompt';

const BOARD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boardIdFromInput(input: string): string | null {
  const value = input.trim();
  if (BOARD_ID_PATTERN.test(value)) return value;

  try {
    const url = new URL(value, window.location.origin);
    const match = /^\/board\/([^/]+)\/?$/.exec(url.pathname);
    const id = match ? decodeURIComponent(match[1]) : '';
    return BOARD_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Landing page. Boards are created on the host (`POST /api/boards`) so they
 * are shareable with other devices on the LAN and survive a host restart;
 * see PLAN.md 4.2/4.5. The creator's admin secret is stored locally by
 * `createBoardOnHost` and never shown to guests who just open the link.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNamingHost, setIsNamingHost] = useState(false);

  const handleCreate = async (hostName: string) => {
    setIsCreating(true);
    setError(null);
    try {
      const { id } = await createBoardOnHost();
      setStoredName(id, hostName);
      navigate(`/board/${id}`);
    } catch {
      setError('Could not reach the host. Is the server running?');
      setIsCreating(false);
      setIsNamingHost(false);
    }
  };

  const joinBoard = (e: React.FormEvent) => {
    e.preventDefault();
    const id = boardIdFromInput(joinId);
    if (id) {
      setError(null);
      navigate(`/board/${id}`);
    } else {
      setError('Paste a board link or a valid board ID.');
    }
  };

  if (isNamingHost) {
    return (
      <NamePrompt
        title="What should we call you?"
        description="Shown to guests as the host's name on the board."
        placeholder="Host"
        confirmLabel={isCreating ? 'Creating…' : 'Create board'}
        onSubmit={handleCreate}
      />
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-md px-6 text-center">
        <h1 className="text-3xl font-semibold text-white mb-2">Interactive Whiteboard</h1>
        <p className="text-slate-400 mb-8">
          A collaborative, AI-assisted study whiteboard.
        </p>

        <button
          type="button"
          onClick={() => setIsNamingHost(true)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium mb-4 hover:opacity-90 transition-opacity"
        >
          Create a new board
        </button>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <form onSubmit={joinBoard} className="flex gap-2">
          <label htmlFor="join-board-id" className="sr-only">
            Board id or link
          </label>
          <input
            id="join-board-id"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Paste a board id or link"
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            Join
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Anyone with the board link can join and draw — the link itself is the guest token.
        </p>
        <Link to="/host" className="mt-2 inline-block text-xs text-slate-500 hover:underline">
          Host dashboard
        </Link>
      </div>
    </div>
  );
}
