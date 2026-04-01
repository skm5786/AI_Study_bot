import { createReadStream, createWriteStream, unlinkSync } from "node:fs";
import { extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { load } from "cheerio";
import pdfParse from "pdf-parse";
import AdmZip from "adm-zip";
import axios from "axios";
import { config } from "../config.js";
import { getOpenAIClient } from "./model.js";
import { logger } from "../utils/logger.js";

const HTTP_TIMEOUT_MS = 30000;
const MAX_HTTP_RETRIES = 3;

const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".js",
  ".ts",
  ".py",
  ".java",
  ".c",
  ".cpp"
]);

function trimToLimit(text) {
  if (!text) return "";
  return text.slice(0, config.maxSourceChars);
}

function shouldRetryNetworkError(error) {
  const code = error?.code || error?.cause?.code;
  const status = error?.response?.status;
  return (
    ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN", "ENOTFOUND"].includes(code) ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  );
}

async function withHttpRetry(fn, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt += 1) {
    try {
      if (attempt > 1) {
        logger.warn("Retrying HTTP call", { label, attempt, maxRetries: MAX_HTTP_RETRIES });
      }
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetryNetworkError(error) || attempt === MAX_HTTP_RETRIES) {
        throw error;
      }
      const waitMs = attempt * 700;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function fetchTextFromUrl(url) {
  const response = await withHttpRetry(
    () =>
      axios.get(url, {
        responseType: "text",
        maxContentLength: config.maxFileSizeMb * 1024 * 1024,
        timeout: HTTP_TIMEOUT_MS,
        maxRedirects: 5
      }),
    "fetchTextFromUrl"
  );
  return response.data;
}

async function fetchBufferFromUrl(url) {
  const response = await withHttpRetry(
    () =>
      axios.get(url, {
        responseType: "arraybuffer",
        maxContentLength: config.maxFileSizeMb * 1024 * 1024,
        timeout: HTTP_TIMEOUT_MS,
        maxRedirects: 5
      }),
    "fetchBufferFromUrl"
  );
  return Buffer.from(response.data);
}

async function fetchStreamFromUrl(url) {
  return withHttpRetry(
    () =>
      axios.get(url, {
        responseType: "stream",
        maxContentLength: config.maxFileSizeMb * 1024 * 1024,
        timeout: HTTP_TIMEOUT_MS,
        maxRedirects: 5
      }),
    "fetchStreamFromUrl"
  );
}

async function transcribeMediaUrl(url) {
  if (config.aiProvider !== "openai") {
    throw new Error("Direct audio/video transcription currently requires AI_PROVIDER=openai.");
  }

  const openai = getOpenAIClient();
  const ext = extname(new URL(url).pathname) || ".mp3";
  const tempPath = resolve(tmpdir(), `${randomUUID()}${ext}`);

  try {
    const response = await fetchStreamFromUrl(url);

    await new Promise((resolveWrite, rejectWrite) => {
      const writer = createWriteStream(tempPath);
      response.data.pipe(writer);
      writer.on("finish", resolveWrite);
      writer.on("error", rejectWrite);
    });

    const transcript = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: createReadStream(tempPath)
    });

    return transcript.text || "";
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore cleanup failures
    }
  }
}

function extractTextFromHtml(html) {
  const $ = load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim();
  const mainText = $("body").text().replace(/\s+/g, " ").trim();
  return { title, text: mainText };
}

function isDirectMediaUrl(url) {
  const ext = extname(new URL(url).pathname).toLowerCase();
  return [".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".mov", ".webm"].includes(ext);
}

async function extractFromImage(url) {
  if (config.aiProvider !== "openai") {
    throw new Error("Image analysis is not enabled for AI_PROVIDER=gemini in this build. Use PDF/WEB/ZIP or switch to AI_PROVIDER=openai.");
  }

  return `Image source: ${url}. OCR/vision path is only enabled with AI_PROVIDER=openai.`;
}

function extractFromZipBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const pieces = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryExt = extname(entry.entryName).toLowerCase();
    if (!TEXT_FILE_EXTENSIONS.has(entryExt)) continue;

    const content = entry.getData().toString("utf8").trim();
    if (!content) continue;

    pieces.push(`File: ${entry.entryName}\n${content}`);
    if (pieces.join("\n\n").length > config.maxSourceChars) {
      break;
    }
  }

  return pieces.join("\n\n");
}

function validateUrl(sourceLink) {
  try {
    const parsed = new URL(sourceLink);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only HTTP/HTTPS URLs are supported.");
    }
    return parsed;
  } catch {
    throw new Error("Invalid source link. Please provide a valid URL.");
  }
}

function normalizePdfUrl(sourceLink) {
  const parsed = new URL(sourceLink);
  const isArxivPdfPath = parsed.hostname.includes("arxiv.org") && parsed.pathname.startsWith("/pdf/");
  if (isArxivPdfPath && !parsed.pathname.endsWith(".pdf")) {
    parsed.pathname = `${parsed.pathname}.pdf`;
  }
  return parsed.toString();
}

export async function extractContentFromSource({ contentType, sourceLink }) {
  validateUrl(sourceLink);
  const startedAt = Date.now();
  logger.info("Content extraction started", { contentType, sourceLink });

  if (contentType === "pdf") {
    const normalizedPdfUrl = normalizePdfUrl(sourceLink);
    logger.debug("PDF extraction path selected", { normalizedPdfUrl });
    const buffer = await fetchBufferFromUrl(normalizedPdfUrl);
    const parsed = await pdfParse(buffer);
    logger.info("Content extraction completed", {
      contentType,
      method: "pdf-parse",
      textLength: parsed.text?.length || 0,
      durationMs: Date.now() - startedAt
    });
    return {
      text: trimToLimit(parsed.text),
      metadata: { method: "pdf-parse", sourceLink: normalizedPdfUrl }
    };
  }

  if (contentType === "web") {
    logger.debug("Web extraction path selected");
    const html = await fetchTextFromUrl(sourceLink);
    const { title, text } = extractTextFromHtml(html);
    logger.info("Content extraction completed", {
      contentType,
      method: "html-scrape",
      title,
      textLength: text.length,
      durationMs: Date.now() - startedAt
    });
    return {
      text: trimToLimit(text),
      metadata: { method: "html-scrape", title, sourceLink }
    };
  }

  if (contentType === "image") {
    logger.debug("Image extraction path selected");
    const text = await extractFromImage(sourceLink);
    logger.info("Content extraction completed", {
      contentType,
      method: "vision-model",
      textLength: text.length,
      durationMs: Date.now() - startedAt
    });
    return {
      text: trimToLimit(text),
      metadata: { method: "vision-model", sourceLink }
    };
  }

  if (contentType === "audio" || contentType === "video") {
    logger.debug("Media extraction path selected", { isDirectMediaUrl: isDirectMediaUrl(sourceLink) });
    let text = "";
    if (isDirectMediaUrl(sourceLink)) {
      text = await transcribeMediaUrl(sourceLink);
    } else {
      const html = await fetchTextFromUrl(sourceLink);
      const parsed = extractTextFromHtml(html);
      text = `This media URL was not a direct file stream. Extracted page context:\n\n${parsed.text}`;
    }

    logger.info("Content extraction completed", {
      contentType,
      method: "transcription-or-page-context",
      textLength: text.length,
      durationMs: Date.now() - startedAt
    });
    return {
      text: trimToLimit(text),
      metadata: { method: "transcription-or-page-context", sourceLink }
    };
  }

  if (contentType === "zip") {
    logger.debug("ZIP extraction path selected");
    const buffer = await fetchBufferFromUrl(sourceLink);
    const zipText = extractFromZipBuffer(buffer);
    logger.info("Content extraction completed", {
      contentType,
      method: "zip-text-extraction",
      textLength: zipText.length,
      durationMs: Date.now() - startedAt
    });
    return {
      text: trimToLimit(zipText),
      metadata: { method: "zip-text-extraction", sourceLink }
    };
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}
