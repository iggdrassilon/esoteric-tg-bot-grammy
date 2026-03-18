import type { AnyPgTable } from "drizzle-orm/pg-core";
import { getTableConfig } from "drizzle-orm/pg-core";
import { schema as dbSchema } from "../db";
import { getDumpPool, resetDumpPool } from "../db/dumpPool";
import { logger } from "../../logger";

type TableEntry = {
  tableName: string;
  table: AnyPgTable;
};

function resolveTables(): TableEntry[] {
  const entries: TableEntry[] = [];

  for (const value of Object.values(dbSchema)) {
    try {
      const table = value as AnyPgTable;
      const { name } = getTableConfig(table);
      entries.push({ tableName: name, table });
    } catch {
      continue;
    }
  }

  return entries.sort((a, b) => a.tableName.localeCompare(b.tableName));
}

const tablesCache = resolveTables();

export const dumpRepositoryMeta = import.meta.url;

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isTransientPgError(err: any) {
  const code = err?.code;
  const syscall = err?.syscall;

  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ENETUNREACH" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "57P01" || // admin shutdown
    code === "57P02" || // crash shutdown
    code === "53300" || // too many connections
    syscall === "read"
  );
}

async function queryWithRetry<T>(
  query: { text: string; values?: unknown[] },
  context: { tableName: string; op: string },
  maxAttempts: number = 10
): Promise<T> {
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      const res = await getDumpPool().query(query as any);
      return res as unknown as T;
    } catch (err: any) {
      const transient = isTransientPgError(err);
      logger.warn(
        { ...context, attempt, transient, code: err?.code, message: err?.message },
        "Dump query failed"
      );

      if (!transient || attempt >= maxAttempts) throw err;

      await resetDumpPool(err);
      await sleep(Math.min(5_000, 250 * 2 ** (attempt - 1)));
    }
  }
}

export const dumpRepository = {
  listTables(): string[] {
    return tablesCache.map((t) => t.tableName);
  },

  async *iterateBatches(
    tableName: string,
    batchSize: number = 10
  ): AsyncGenerator<unknown[], void, void> {
    const entry = tablesCache.find((t) => t.tableName === tableName);
    if (!entry) return;

    const effectiveBatchSize = Math.min(10, Math.max(1, Math.floor(batchSize)));

    const idColumn = (entry.table as any).id as unknown;
    const hasIdColumn = typeof idColumn === "object" && idColumn !== null;
    const qTable = quoteIdent(tableName);

    if (hasIdColumn) {
      const idColumnName =
        typeof (idColumn as any)?.name === "string" ? (idColumn as any).name : "id";
      const qId = quoteIdent(idColumnName);
      let lastId: number | null = null;

      while (true) {
        const res =
          lastId === null
            ? await queryWithRetry<any>(
                {
                  text: `select * from ${qTable} order by ${qId} asc limit $1`,
                  values: [effectiveBatchSize],
                },
                { tableName, op: "batch:first" }
              )
            : await queryWithRetry<any>(
                {
                  text: `select * from ${qTable} where ${qId} > $1 order by ${qId} asc limit $2`,
                  values: [lastId, effectiveBatchSize],
                },
                { tableName, op: "batch:next" }
              );

        const rows = res.rows as any[];
        if (!rows.length) return;

        const lastRowId: unknown = rows[rows.length - 1]?.id;
        if (typeof lastRowId !== "number") {
          throw new Error(
            `Can't paginate table "${tableName}": last row doesn't have numeric id`
          );
        }

        lastId = lastRowId;
        yield rows as unknown[];
      }
    }

    let offset = 0;
    while (true) {
      const res = await queryWithRetry<any>(
        {
          text: `select * from ${qTable} limit $1 offset $2`,
          values: [effectiveBatchSize, offset],
        },
        { tableName, op: "offset" }
      );
      const rows = res.rows as unknown[];

      if (!rows.length) return;

      yield rows as unknown[];

      offset += rows.length;
      if (rows.length < effectiveBatchSize) return;
    }
  },

  async *iterateAll(
    tableName: string,
    batchSize: number = 10
  ): AsyncGenerator<unknown, void, void> {
    for await (const batch of dumpRepository.iterateBatches(
      tableName,
      batchSize
    )) {
      for (const row of batch) yield row;
    }
  },

  async getAllTables(): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {};

    for (const { tableName, table } of tablesCache) {
      const rows: unknown[] = [];
      const entry = { tableName, table };
      for await (const row of dumpRepository.iterateAll(entry.tableName)) {
        rows.push(row);
      }
      result[tableName] = rows;
    }

    return result;
  },
};
