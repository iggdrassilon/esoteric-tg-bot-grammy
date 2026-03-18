import { startBot } from "./bot";
import { startCron, startTestCron } from "./cron";
import { logger } from "./logger";
// import { dumpAllTablesToJson } from "./services/dbDumpService";

async function main() {
  logger.info("Starting application...");
  // try {
  //   await dumpAllTablesToJson();
  // } catch (err) {
  //   logger.error({ err }, "DB dump failed");
  // }
  await startBot();
  startCron();
  startTestCron();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
