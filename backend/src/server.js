import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import uploadsRoute from "./routes/uploads.js";
import contentRoute from "./routes/content.js";
import studyRoute from "./routes/study.js";
import { cleanupExpiredContent } from "./services/cleanup.js";
import { logger } from "./utils/logger.js";

const app = express();

const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", config.frontendUrl];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...config.corsOrigins]));

app.use(
  cors({
    origin(origin, callback) {
      if (config.allowAllOrigins) {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    }
  })
);

app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const startedAt = Date.now();

  logger.info("HTTP request started", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  res.on("finish", () => {
    logger.info("HTTP request finished", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Legacy LinkVault APIs retained for backward compatibility.
app.use("/api/uploads", uploadsRoute);
app.use("/api/content", contentRoute);

// New Study Assistant APIs.
app.use("/api/study", studyRoute);

app.get("/view/:token", (req, res) => {
  return res.redirect(`${config.frontendUrl}/?token=${req.params.token}`);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(config.port, () => {
  logger.info(`Study Assistant backend running on http://localhost:${config.port}`, {
    logLevel: config.logLevel,
    aiProvider: config.aiProvider,
    geminiModel: config.geminiModel
  });
});

setInterval(() => {
  const cleaned = cleanupExpiredContent();
  if (cleaned > 0) {
    logger.info("Expired content cleaned", { cleaned });
  }
}, config.cleanupIntervalSeconds * 1000);

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    message: error.message,
    stack: error.stack
  });
});
