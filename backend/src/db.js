import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const dbAbsolutePath = resolve(process.cwd(), config.dbPath);
mkdirSync(dirname(dbAbsolutePath), { recursive: true });

const db = new Database(dbAbsolutePath);

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../sql/schema.sql");
const schema = readFileSync(schemaPath, "utf8");
db.exec(schema);

export default db;
