import express from "express";
import mime from "mime-types";
import db from "../db.js";
import { getStoredFilePath } from "../storage.js";

const router = express.Router();

function getActiveShare(token) {
  const share = db
    .prepare("SELECT * FROM shares WHERE token = ?")
    .get(token);

  if (!share) return null;
  const expired = new Date(share.expires_at).getTime() <= Date.now();
  if (expired) return null;
  return share;
}

router.get("/:token", (req, res) => {
  const share = getActiveShare(req.params.token);
  if (!share) {
    return res.status(403).json({ message: "Invalid or expired link." });
  }

  if (share.type === "text") {
    return res.status(200).json({
      type: "text",
      text: share.text_content,
      expiresAt: share.expires_at
    });
  }

  return res.status(200).json({
    type: "file",
    fileName: share.original_name,
    mimeType: share.mime_type,
    sizeBytes: share.size_bytes,
    expiresAt: share.expires_at
  });
});

router.get("/:token/download", (req, res) => {
  const share = getActiveShare(req.params.token);
  if (!share) {
    return res.status(403).json({ message: "Invalid or expired link." });
  }

  if (share.type !== "file") {
    return res.status(400).json({ message: "This link contains text, not a file." });
  }

  const filePath = getStoredFilePath(share.stored_name);
  const contentType = share.mime_type || mime.lookup(share.original_name) || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${share.original_name || "download"}"`);
  return res.sendFile(filePath);
});

export default router;
