import { Pool } from "pg";
import { config } from "../../config";
import { logger } from "../../logger";

let pool: Pool | null = null;

function createDumpPool() {
  const created = new Pool({
    connectionString: config.pgUrl,
    statement_timeout: 60_000,
    query_timeout: 0,
    max: 1,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    options: "-c lock_timeout=5000",
  });

  created.on("error", (err: any) => {
    logger.error({ err }, "Unexpected error on dump pool idle client");
  });

  return created;
}

export function getDumpPool(): Pool {
  if (!pool) pool = createDumpPool();
  return pool;
}

export async function resetDumpPool(err?: unknown) {
  const oldPool = pool;
  pool = createDumpPool();

  if (oldPool) {
    try {
      await oldPool.end();
    } catch (endErr) {
      logger.warn({ endErr }, "Failed to end previous dump pool");
    }
  }

  logger.warn({ err }, "Dump pool was reset");
}

export async function waitForDumpDbReady(params?: {
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const timeoutMs = params?.timeoutMs ?? 120_000;
  const intervalMs = params?.intervalMs ?? 1_000;
  const startedAt = Date.now();

  while (true) {
    try {
      await getDumpPool().query("select 1");
      return;
    } catch (err) {
      await resetDumpPool(err);

      if (Date.now() - startedAt >= timeoutMs) {
        throw err;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
