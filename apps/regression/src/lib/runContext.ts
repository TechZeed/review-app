import { randomUUID } from "node:crypto";
import type { Client } from "pg";

export type RunContext = { testRunId: string; startedAt: Date };

export function createRunContext(): RunContext {
  return { testRunId: randomUUID(), startedAt: new Date() };
}

/** Delete every row tagged with this run's testRunId, in FK-reverse order. */
export async function cleanup(client: Client, ctx: RunContext): Promise<void> {
  const tables = ["review_media", "reviews", "review_tokens", "role_requests", "subscriptions"] as const;
  for (const t of tables) {
    await client.query(`DELETE FROM ${t} WHERE test_run_id = $1`, [ctx.testRunId]);
  }
}
