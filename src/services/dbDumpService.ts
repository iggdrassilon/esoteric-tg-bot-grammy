import fs from "fs";
import fsp from "fs/promises";
import { once } from "events";
import path from "path";
import { config } from "../config";
import { logger } from "../logger";
import {
  dumpRepository,
  dumpRepositoryMeta,
} from "../infrastructure/repository/dumpRepository";
import { waitForDumpDbReady } from "../infrastructure/db/dumpPool";

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function writeToStream(stream: fs.WriteStream, chunk: string) {
  if (!stream.write(chunk)) {
    await once(stream, "drain");
  }
}

async function dumpTableToJson(params: {
  dumpDir: string;
  tableName: string;
  dumpedAt: string;
  batchSize: number;
  delayMs: number;
}): Promise<{ filepath: string; count: number }> {
  const { dumpDir, tableName, dumpedAt, batchSize, delayMs } = params;

  const filepath = path.join(dumpDir, `${tableName}.json`);
  const tmpPath = `${filepath}.tmp`;

  const stream = fs.createWriteStream(tmpPath, { encoding: "utf8" });
  let count = 0;
  let first = true;

  try {
    await writeToStream(stream, "{\n");
    await writeToStream(stream, `"table": ${JSON.stringify(tableName)},\n`);
    await writeToStream(stream, `"dumpedAt": ${JSON.stringify(dumpedAt)},\n`);
    await writeToStream(stream, `"rows": [\n`);

    for await (const batch of dumpRepository.iterateBatches(
      tableName,
      batchSize
    )) {
      for (const row of batch) {
        const rowJson = JSON.stringify(row, jsonReplacer);
        await writeToStream(stream, `${first ? "" : ",\n"}${rowJson}`);
        first = false;
        count += 1;
      }

      if (delayMs > 0) await sleep(delayMs);
    }

    await writeToStream(stream, `\n],\n`);
    await writeToStream(stream, `"count": ${count}\n`);
    await writeToStream(stream, "}\n");

    await new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      stream.on("finish", resolve);
      stream.end();
    });

    await fsp.rename(tmpPath, filepath);
  } catch (err) {
    stream.destroy();
    try {
      await fsp.unlink(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }

  return { filepath, count };
}

export async function dumpAllTablesToJson(
  batchSize: number = 10,
  delayMs: number = 500,
  tableDelayMs: number = 1000
) {
  const effectiveBatchSize = Math.min(10, Math.max(1, Math.floor(batchSize)));
  const effectiveDelayMs = Math.max(0, Math.floor(delayMs));
  const effectiveTableDelayMs = Math.max(0, Math.floor(tableDelayMs));

  const dumpDir = path.join(config.uploadsDir, "db-dumps");
  await fsp.mkdir(dumpDir, { recursive: true });

  const tableNames = dumpRepository.listTables();
  const dumpedAt = new Date().toISOString();

  try {
    await waitForDumpDbReady();
  } catch (err) {
    logger.error({ err }, "Dump DB is not ready, skipping dump");
    return;
  }

  logger.info(
    {
      dumpService: import.meta.url,
      dumpRepository: dumpRepositoryMeta,
      dumpDir,
      tables: tableNames,
      batchSize: effectiveBatchSize,
      delayMs: effectiveDelayMs,
      tableDelayMs: effectiveTableDelayMs,
    },
    "Starting DB dump to JSON"
  );

  for (let i = 0; i < tableNames.length; i += 1) {
    const tableName = tableNames[i]!;
    try {
      const { filepath, count } = await dumpTableToJson({
        dumpDir,
        tableName,
        dumpedAt,
        batchSize: effectiveBatchSize,
        delayMs: effectiveDelayMs,
      });
      logger.debug({ tableName, count, filepath }, "Dumped table");
    } catch (err) {
      logger.error({ err, tableName }, "Failed to dump table");
    }

    if (effectiveTableDelayMs > 0 && i < tableNames.length - 1) {
      await sleep(effectiveTableDelayMs);
    }
  }

  logger.info({ dumpDir }, "DB dump finished");
}
