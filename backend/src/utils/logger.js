import { config } from "../config.js";

const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const minLevel = levels[config.logLevel] ?? levels.debug;

function shouldLog(level) {
  return levels[level] >= minLevel;
}

function serializeMeta(meta) {
  if (!meta) return "";

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [meta-unserializable]";
  }
}

function log(level, message, meta) {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${message}${serializeMeta(meta)}`;

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message, meta) {
    log("debug", message, meta);
  },
  info(message, meta) {
    log("info", message, meta);
  },
  warn(message, meta) {
    log("warn", message, meta);
  },
  error(message, meta) {
    log("error", message, meta);
  }
};
