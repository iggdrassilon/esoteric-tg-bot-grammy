import { config } from "dotenv";
import type { Config } from "drizzle-kit";
import env from "./src/env";

config();

export default {
  schema: "./src/infrastructure/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,
  introspect: {
    casing: 'preserve',
  },
  schemaFilter: ['public'],
} satisfies Config;
