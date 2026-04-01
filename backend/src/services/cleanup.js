import db from "../db.js";
import { removeStoredFile } from "../storage.js";

export function cleanupExpiredContent() {
  const expired = db
    .prepare("SELECT token, type, stored_name FROM shares WHERE datetime(expires_at) <= datetime('now')")
    .all();

  if (!expired.length) return 0;

  const del = db.prepare("DELETE FROM shares WHERE token = ?");

  for (const item of expired) {
    if (item.type === "file") removeStoredFile(item.stored_name);
    del.run(item.token);
  }

  return expired.length;
}
