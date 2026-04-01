import dotenv from "dotenv";

dotenv.config();

function parseCsv(value) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 3000),
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  allowAllOrigins: (process.env.ALLOW_ALL_ORIGINS || "true").toLowerCase() === "true",
  corsOrigins: parseCsv(process.env.CORS_ORIGINS),

  defaultExpiryMinutes: Number(process.env.DEFAULT_EXPIRY_MINUTES || 10),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 25),
  dbPath: process.env.DB_PATH || "./src/data/linkvault.db",
  uploadDir: process.env.UPLOAD_DIR || "./src/uploads",
  cleanupIntervalSeconds: Number(process.env.CLEANUP_INTERVAL_SECONDS || 60),
  logLevel: (process.env.LOG_LEVEL || "debug").toLowerCase(),

  aiProvider: (process.env.AI_PROVIDER || "gemini").toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  maxSourceChars: Number(process.env.MAX_SOURCE_CHARS || 30000),
  maxRecommendedResources: Number(process.env.MAX_RECOMMENDED_RESOURCES || 6)
};
