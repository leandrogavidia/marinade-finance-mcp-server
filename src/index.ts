import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { start } from "./server.js";
import { McpLogger } from "./logger.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const originalWrite = process.stdout.write;

process.stdout.write = () => true;

dotenv.config({ path: path.resolve(currentDir, "../.env") });

process.stdout.write = originalWrite;

start().catch((err) => {
    McpLogger.error("Fatal error:", String(err));
    process.exit(1);
});