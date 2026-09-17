import { useState } from 'react';
import { useNavigate } from 'react-router';

/**
 * Landing page. There is no host/server yet (that lands in Phase 2), so
 * "creating" a board just generates a random id and stores it locally via
 * tldraw's own persistence. Once the host process exists, this page will
 * call `POST /api/boards` instead and boards will be shareable across
 * devices on the LAN.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState('');

  const createBoard = () => {
    const id = crypto.randomUUID();
    navigate(`/board/${id}`);
  };

  const joinBoard = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinId.trim();
    if (trimmed) navigate(`/board/${trimmed}`);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-md px-6 text-center">
        <h1 className="text-3xl font-semibold text-white mb-2">Interactive Whiteboard</h1>
        <p className="text-slate-400 mb-8">
          A collaborative, AI-assisted study whiteboard.
        </p>

        <button
          type="button"
          onClick={createBoard}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium mb-4 hover:opacity-90 transition-opacity"
        >
          Create a new board
        </button>

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
          Guests will join with an unguessable board token once the host server exists.
        </p>
      </div>
    </div>
  );
}
