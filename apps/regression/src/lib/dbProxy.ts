import { Client } from "pg";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const PROXY_PORT = 6199;

function waitForPort(port: number, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => { s.end(); resolve(); });
      s.once("error", () => {
        s.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`cloud-sql-proxy didn't open :${port} in ${timeoutMs}ms`));
        else setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

export type DbCtx = { client: Client; proxy: ChildProcess };

/**
 * Starts cloud-sql-proxy and opens a pg client.
 * Env required: CLOUDSQL_CONNECTION_NAME, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD.
 */
export async function openDb(): Promise<DbCtx> {
  const cn = process.env.CLOUDSQL_CONNECTION_NAME;
  if (!cn) throw new Error("CLOUDSQL_CONNECTION_NAME not set");
  const proxy = spawn("cloud-sql-proxy", [cn, `--port=${PROXY_PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForPort(PROXY_PORT);
  const client = new Client({
    host: "localhost",
    port: PROXY_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  return { client, proxy };
}

export async function closeDb(ctx: DbCtx): Promise<void> {
  try { await ctx.client.end(); } catch {}
  ctx.proxy.kill("SIGTERM");
}
