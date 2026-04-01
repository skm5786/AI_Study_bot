import express from "express";
import db from "../db.js";
import { config } from "../config.js";
import { generateToken } from "../utils/id.js";
import { upload } from "../storage.js";

const router = express.Router();

function computeExpiryDate(expiresAt) {
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed.getTime() <= Date.now()) return null;
    return parsed;
  }

  const fallback = new Date();
  fallback.setMinutes(fallback.getMinutes() + config.defaultExpiryMinutes);
  return fallback;
}

router.post("/", upload.single("file"), (req, res) => {
  const text = (req.body?.text || "").trim();
  const file = req.file;

  if (!text && !file) {
    return res.status(400).json({ message: "Provide either text or file." });
  }

  if (text && file) {
    return res.status(400).json({ message: "Send either text or file, not both." });
  }

  const expiry = computeExpiryDate(req.body?.expiresAt);
  if (!expiry) {
    return res.status(400).json({ message: "Invalid expiry date/time." });
  }

  const token = generateToken();
  const type = file ? "file" : "text";

  db.prepare(
    `INSERT INTO shares (
      token, type, text_content, original_name, stored_name, mime_type, size_bytes, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    token,
    type,
    text || null,
    file?.originalname || null,
    file?.filename || null,
    file?.mimetype || null,
    file?.size || null,
    expiry.toISOString()
  );

  return res.status(201).json({
    token,
    type,
    expiresAt: expiry.toISOString(),
    shareUrl: `${config.baseUrl}/view/${token}`
  });
});

export default router;
