import fs from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../logger";

export function ensureUploadsDir() {
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    logger.info({ dir: config.uploadsDir }, "Created uploads dir");
  }
}

export async function saveScreenshot(buffer: Buffer, filename: string) {
  ensureUploadsDir();
  const filepath = path.join(config.uploadsDir, filename);

  fs.writeFileSync(filepath, buffer);
  logger.debug({ filepath }, "Saved screenshot");

  return filepath;
}

export function deleteFile(filepath: string) {
  try {
    if (!filepath) return;

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info({ filepath }, "Deleted file from storage");
    } else {
      logger.warn({ filepath }, "File not found for deletion");
    }
  } catch (err) {
    logger.error({ err, filepath }, "Failed to delete file");
  }
}
