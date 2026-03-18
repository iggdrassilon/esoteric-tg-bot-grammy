import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index";
import { config } from "../../config";
import { logger } from "../../logger";

const pool = new Pool({
  connectionString: config.pgUrl,
  statement_timeout: 25000,
  query_timeout: 25000,
  // ssl: { rejectUnauthorized: false },
});

if (!config.pgUrl) {
  logger.error("POSTGRESQL_URL env variable is required");
}

const url = new URL(config.pgUrl!);

logger.info(
  `Postgres connection from env: host=${url.hostname}, port=${url.port}, db=${url.pathname.slice(1)}`,
);

pool.on("error", (err: any) => {
  console.error("Unexpected error on idle client", err);
});

export const db = drizzle({ client: pool });
export const dbPool = pool;
export { schema };
