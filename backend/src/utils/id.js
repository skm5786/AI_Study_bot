import { randomBytes } from "node:crypto";

export function generateToken() {
  return randomBytes(16)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20);
}
