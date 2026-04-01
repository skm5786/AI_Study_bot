import OpenAI from "openai";
import axios from "axios";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const LLM_TIMEOUT_MS = 60000;
const GEMINI_BASE_URLS = [
  "https://generativelanguage.googleapis.com/v1beta",
  "https://generativelanguage.googleapis.com/v1"
];
const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash"
];
const MAX_GEMINI_RETRIES = 3;

function requireGeminiKey() {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to backend/.env");
  }
}

function extractTextFromGeminiResponse(data) {
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string");
  if (!part?.text) {
    throw new Error("Gemini returned an empty response.");
  }
  return part.text;
}

function buildModelCandidates() {
  const fromConfig = (config.geminiModel || "").trim();
  const all = [fromConfig, ...GEMINI_MODEL_FALLBACKS].filter(Boolean);
  return Array.from(new Set(all));
}

function buildGeminiError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.error?.status ||
    error?.message ||
    "Unknown Gemini API error";
  return new Error(`Gemini API error (${status || "n/a"}): ${apiMessage}`);
}

function shouldRetryGeminiError(error) {
  const code = error?.code || error?.cause?.code;
  const status = error?.response?.status;
  return (
    ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN", "ENOTFOUND"].includes(code) ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  );
}

async function postGeminiWithRetry({ url, body, headers, model, baseUrl }) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_GEMINI_RETRIES; attempt += 1) {
    try {
      if (attempt > 1) {
        logger.warn("Retrying Gemini call", { baseUrl, model, attempt, maxRetries: MAX_GEMINI_RETRIES });
      }
      return await axios.post(url, body, {
        headers,
        timeout: LLM_TIMEOUT_MS
      });
    } catch (error) {
      lastError = error;
      if (!shouldRetryGeminiError(error) || attempt === MAX_GEMINI_RETRIES) {
        throw error;
      }
      const waitMs = attempt * 700;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function callGemini({ systemPrompt, userPrompt, responseMimeType }) {
  const models = buildModelCandidates();
  let lastError = null;

  for (const baseUrl of GEMINI_BASE_URLS) {
    for (const model of models) {
      try {
        logger.debug("Trying Gemini endpoint", { baseUrl, model });
        const response = await postGeminiWithRetry({
          url: `${baseUrl}/models/${model}:generateContent?key=${config.geminiApiKey}`,
          body: {
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              ...(responseMimeType ? { responseMimeType } : {})
            }
          },
          headers: { "Content-Type": "application/json" },
          model,
          baseUrl
        });

        logger.debug("Gemini endpoint succeeded", { baseUrl, model });
        return response;
      } catch (error) {
        const status = error?.response?.status;
        const apiMessage = error?.response?.data?.error?.message || error?.message;
        logger.warn("Gemini endpoint attempt failed", {
          baseUrl,
          model,
          status,
          apiMessage
        });
        lastError = error;
      }
    }
  }

  throw buildGeminiError(lastError);
}

export async function generateJson({ systemPrompt, userPrompt }) {
  requireGeminiKey();
  const startedAt = Date.now();
  logger.debug("Gemini JSON generation started", {
    model: config.geminiModel,
    userPromptLength: userPrompt.length
  });

  let response;
  try {
    response = await callGemini({
      systemPrompt,
      userPrompt,
      responseMimeType: "application/json"
    });
  } catch (error) {
    logger.error("Gemini JSON generation failed", {
      model: config.geminiModel,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt
    });
    throw error;
  }

  const text = extractTextFromGeminiResponse(response.data);

  try {
    const parsed = JSON.parse(text);
    logger.debug("Gemini JSON generation completed", {
      model: config.geminiModel,
      durationMs: Date.now() - startedAt
    });
    return parsed;
  } catch {
    logger.error("Gemini JSON parse failed", {
      model: config.geminiModel,
      responseTextPreview: text.slice(0, 300)
    });
    throw new Error("Failed to parse JSON response from Gemini.");
  }
}

export async function generateText({ systemPrompt, userPrompt }) {
  requireGeminiKey();
  const startedAt = Date.now();
  logger.debug("Gemini text generation started", {
    model: config.geminiModel,
    userPromptLength: userPrompt.length
  });

  let response;
  try {
    response = await callGemini({
      systemPrompt,
      userPrompt
    });
  } catch (error) {
    logger.error("Gemini text generation failed", {
      model: config.geminiModel,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt
    });
    throw error;
  }

  const text = extractTextFromGeminiResponse(response.data);
  logger.debug("Gemini text generation completed", {
    model: config.geminiModel,
    durationMs: Date.now() - startedAt,
    responseLength: text.length
  });
  return text;
}

// Kept for legacy paths that still rely on OpenAI-only audio transcription.
export function getOpenAIClient() {
  if (config.aiProvider !== "openai") {
    throw new Error("OpenAI client is only available when AI_PROVIDER=openai.");
  }

  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to backend/.env");
  }

  return new OpenAI({ apiKey: config.openaiApiKey });
}
