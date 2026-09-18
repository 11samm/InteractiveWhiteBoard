import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  buildGuestJoinOrigin,
  getBoard,
  getBoardUsage,
  getConfigStatus,
  getStoredAdminSecret,
  listKnownAdminBoardIds,
  type UsageSummaryDto,
} from '../lib/api';

const NOT_CREATOR_MESSAGE =
  'This browser did not create this board, so host metrics are unavailable. Open the dashboard on the device that clicked Create a new board.';

function formatUsd(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '') || '0';
}

export default function HostSetupPage() {
  const { boardId } = useParams<{ boardId?: string }>();
  const navigate = useNavigate();

  const [copyOk, setCopyOk] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [boardTitle, setBoardTitle] = useState<string | null>(null);
  const [boardMissing, setBoardMissing] = useState(false);
  const [usage, setUsage] = useState<UsageSummaryDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lanIPv4, setLanIPv4] = useState<string | null>(null);

  const hasSecret = boardId ? Boolean(getStoredAdminSecret(boardId)) : false;

  const loadDashboard = useCallback(async () => {
    if (!boardId || !hasSecret) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      const [config, board, usageData] = await Promise.all([
        getConfigStatus(),
        getBoard(boardId),
        getBoardUsage(boardId),
      ]);
      setAiConfigured(config.aiConfigured);
      setLanIPv4(config.lanIPv4);
      if (board === null) {
        setBoardMissing(true);
        setBoardTitle(null);
      } else {
        setBoardMissing(false);
        setBoardTitle(board.title);
      }
      setUsage(usageData);
    } catch (err) {
      if (err instanceof Error && err.message === 'forbidden') {
        setLoadError(NOT_CREATOR_MESSAGE);
      } else {
        setLoadError('Could not load dashboard data. Is the host running?');
      }
      setUsage(null);
    } finally {
      setRefreshing(false);
    }
  }, [boardId, hasSecret]);

  useEffect(() => {
    if (!boardId || !hasSecret) return;
    void loadDashboard();
    const id = window.setInterval(() => void loadDashboard(), 5000);
    return () => window.clearInterval(id);
  }, [boardId, hasSecret, loadDashboard]);

  const handleCopyJoinUrl = async (joinUrl: string) => {
    if (!boardId) return;
    const url = joinUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setCopyOk(false);
    }
  };

  if (!boardId) {
    const ids = listKnownAdminBoardIds();
    return (
      <div className="relative w-full min-h-screen overflow-auto bg-slate-950 flex items-center justify-center py-12">
        <div className="w-full max-w-md px-6 text-center">
          <h1 className="text-3xl font-semibold text-white mb-2">Host dashboard</h1>
          <p className="text-slate-400 mb-8">Pick a board you created on this browser.</p>
          {ids.length === 0 ? (
            <>
              <p className="text-slate-300 mb-6">
                Create a board first, then open the host dashboard from that board.
              </p>
              <Link
                to="/"
                className="inline-block py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                Go to home
              </Link>
            </>
          ) : (
            <ul className="flex flex-col gap-2">
              {ids.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/host/${id}`)}
                    className="w-full py-2 px-4 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-sm truncate hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    title={id}
                  >
                    {id}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-xs text-slate-500">
            The API key stays in the host <code className="text-slate-400">.env</code>. This page never accepts or
            displays it.
          </p>
        </div>
      </div>
    );
  }

  if (!hasSecret || loadError === NOT_CREATOR_MESSAGE) {
    return (
      <div className="relative w-full min-h-screen overflow-auto bg-slate-950 flex items-center justify-center py-12">
        <div className="w-full max-w-md px-6 text-center">
          <h1 className="text-2xl font-semibold text-white mb-4">Host dashboard</h1>
          <p className="text-slate-300 mb-6">{NOT_CREATOR_MESSAGE}</p>
          <Link to="/" className="text-sm text-slate-500 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const displayTitle = boardMissing ? 'Board not found' : boardTitle || 'Host dashboard';
  const guestOrigin = buildGuestJoinOrigin(lanIPv4);
  const joinUrl = `${guestOrigin}/board/${boardId}`;

  return (
    <div className="relative w-full min-h-screen overflow-auto bg-slate-950 py-10 px-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-semibold text-white mb-1">{displayTitle}</h1>
        <p
          className="font-mono text-sm text-slate-500 truncate mb-8"
          title={boardId}
        >
          {boardId}
        </p>

        {loadError && loadError !== NOT_CREATOR_MESSAGE && (
          <p className="text-sm text-red-400 mb-4">{loadError}</p>
        )}

        <section className="mb-8 rounded-xl border border-white/20 bg-white/5 p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Guest join URL</h2>
          <p className="font-mono text-xs text-slate-400 break-all mb-3">{joinUrl}</p>
          <button
            type="button"
            onClick={() => void handleCopyJoinUrl(joinUrl)}
            className="py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-sm font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Copy guest join URL"
            title="Copy guest join URL"
          >
            {copyOk ? 'Copied' : 'Copy link'}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Open this link on phones or other devices on the same Wi-Fi. Guests never receive the provider key.
            {lanIPv4 === null && (
              <>
                {' '}
                Could not detect a LAN address — run <code className="text-slate-400">ipconfig</code> and use your
                Wi-Fi IPv4 with port {window.location.port || '(default)'}.
              </>
            )}
            {lanIPv4 !== null && window.location.hostname === 'localhost' && (
              <>
                {' '}
                If the phone cannot connect, run the dev client with <code className="text-slate-400">vite --host</code>{' '}
                and allow inbound firewall access on port {window.location.port || '5173'}.
              </>
            )}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-300 mb-2">AI provider</h2>
          {aiConfigured === null ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : aiConfigured ? (
            <p className="text-slate-300 text-sm">Configured on the host</p>
          ) : (
            <p className="text-slate-400 text-sm">
              Not configured — set GEMINI_API_KEY in the host <code className="text-slate-300">.env</code> and restart.
              The tutor is unavailable and search falls back to keywords.
            </p>
          )}
        </section>

        {usage && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-300">Usage (this session)</h2>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                disabled={refreshing}
                className="text-xs text-slate-400 hover:text-white underline focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                aria-label="Refresh usage"
                title="Refresh usage"
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <UsageCard label="Requests" value={String(usage.requestCount)} />
              <UsageCard label="Avg latency" value={`${Math.round(usage.avgLatencyMs)} ms`} />
              <UsageCard label="Prompt tokens" value={String(usage.totalPromptTokens)} />
              <UsageCard label="Completion tokens" value={String(usage.totalCompletionTokens)} />
              <UsageCard label="Estimated spend" value={`$${formatUsd(usage.totalEstimatedCostUsd)}`} />
              <UsageCard label="Budget" value={`$${formatUsd(usage.budgetUsd)}`} />
              <UsageCard label="Remaining" value={`$${formatUsd(usage.remainingUsd)}`} className="col-span-2" />
            </div>
          </section>
        )}

        <Link
          to={`/board/${boardId}`}
          className="inline-block py-2 px-4 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          Back to board
        </Link>

        <p className="mt-8 text-xs text-slate-500">
          The API key stays in the host <code className="text-slate-400">.env</code>. This page never accepts or
          displays it.
        </p>
      </div>
    </div>
  );
}

function UsageCard({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 px-3 py-2 ${className}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}
