import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { extname, resolve } from "node:path";
import multer from "multer";
import { config } from "./config.js";

const uploadDirAbsolute = resolve(process.cwd(), config.uploadDir);
if (!existsSync(uploadDirAbsolute)) {
  mkdirSync(uploadDirAbsolute, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDirAbsolute);
  },
  filename(_req, file, cb) {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${suffix}${extname(file.originalname || "")}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 }
});

export function removeStoredFile(storedName) {
  if (!storedName) return;
  const abs = resolve(uploadDirAbsolute, storedName);
  if (existsSync(abs)) unlinkSync(abs);
}

export function getStoredFilePath(storedName) {
  return resolve(uploadDirAbsolute, storedName);
}
