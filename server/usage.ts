import { randomUUID } from 'node:crypto';
import { db } from './db';

export interface NewUsage {
  boardId: string;
  messageId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface UsageSummary {
  requestCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalEstimatedCostUsd: number;
  avgLatencyMs: number;
}

const insertUsageStmt = db.prepare<[string, string, string | null, string, number, number, number, number]>(
  `INSERT INTO usage (id, board_id, message_id, model, prompt_tokens, completion_tokens, latency_ms, estimated_cost_usd)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const sumSpendStmt = db.prepare<[string], { total: number | null }>(
  'SELECT SUM(estimated_cost_usd) as total FROM usage WHERE board_id = ?',
);
const summaryStmt = db.prepare<
  [string],
  { count: number; prompt: number | null; completion: number | null; cost: number | null; avgLatency: number | null }
>(
  `SELECT COUNT(*) as count, SUM(prompt_tokens) as prompt, SUM(completion_tokens) as completion,
          SUM(estimated_cost_usd) as cost, AVG(latency_ms) as avgLatency
   FROM usage WHERE board_id = ?`,
);

export function recordUsage(usage: NewUsage): void {
  insertUsageStmt.run(
    randomUUID(),
    usage.boardId,
    usage.messageId,
    usage.model,
    usage.promptTokens,
    usage.completionTokens,
    usage.latencyMs,
    usage.estimatedCostUsd,
  );
}

/** Cumulative estimated spend for a board — checked against the configured budget cap. */
export function getBoardSpendUsd(boardId: string): number {
  return sumSpendStmt.get(boardId)?.total ?? 0;
}

/** Host-visible aggregate for the demo session (PLAN.md Phase 4 done-criteria). */
export function getBoardUsageSummary(boardId: string): UsageSummary {
  const row = summaryStmt.get(boardId);
  return {
    requestCount: row?.count ?? 0,
    totalPromptTokens: row?.prompt ?? 0,
    totalCompletionTokens: row?.completion ?? 0,
    totalEstimatedCostUsd: row?.cost ?? 0,
    avgLatencyMs: row?.avgLatency ?? 0,
  };
}
