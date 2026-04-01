import { v4 as uuidv4 } from "uuid";
import { extractContentFromSource } from "./contentExtractor.js";
import { generateQuiz, generateRecommendations, generateSummaryPack } from "./learningAgent.js";
import { answerFollowUp } from "./chatAgent.js";
import { evaluateQuizAnswers } from "./quizEvaluator.js";
import { getSession, saveSession, updateSession } from "./sessionStore.js";
import { logger } from "../utils/logger.js";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

const SUPPORTED_CONTENT_TYPES = ["pdf", "video", "audio", "image", "zip", "web"];

export function validateAnalyzeInput(payload) {
  const contentType = (payload?.contentType || "").toLowerCase().trim();
  const sourceLink = (payload?.sourceLink || "").trim();

  if (!SUPPORTED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`Unsupported contentType. Supported values: ${SUPPORTED_CONTENT_TYPES.join(", ")}`);
  }

  if (!sourceLink) {
    throw new Error("sourceLink is required.");
  }

  return { contentType, sourceLink };
}

function quizForClient(quiz) {
  return quiz.map((item) => ({
    id: item.id,
    question: item.question,
    options: item.options
  }));
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function retrieveTopChunks(chunks, query, k = 4) {
  const queryTokens = new Set(tokenize(query));

  return [...chunks]
    .map((doc) => {
      const chunkTokens = tokenize(doc.pageContent);
      let score = 0;
      for (const token of chunkTokens) {
        if (queryTokens.has(token)) score += 1;
      }
      return { doc, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((item) => item.doc);
}

function createTextChunks(text, metadata) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_SIZE);
    const pageContent = text.slice(start, end).trim();
    if (pageContent) {
      chunks.push({ pageContent, metadata });
    }
    if (end >= text.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

export async function createStudySession(input) {
  const startedAt = Date.now();
  logger.info("Study session creation started", {
    contentType: input.contentType,
    sourceLink: input.sourceLink
  });

  const { text, metadata } = await extractContentFromSource(input);
  logger.debug("Content extraction finished", {
    contentLength: text.length,
    metadata
  });

  if (!text || !text.trim()) {
    throw new Error("No text could be extracted from this source.");
  }

  const summary = await generateSummaryPack(text);
  logger.debug("Summary generation finished", {
    topicCount: summary.coreTopics.length,
    takeawayCount: summary.keyTakeaways.length
  });
  const recommendations = await generateRecommendations(summary);
  logger.debug("Recommendation generation finished", {
    recommendationCount: recommendations.length
  });
  const quiz = await generateQuiz(summary);
  logger.debug("Quiz generation finished", {
    questionCount: quiz.length
  });

  const chunks = createTextChunks(text, metadata);
  logger.debug("Chunking finished", {
    chunkCount: chunks.length,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP
  });

  const session = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    input,
    sourceText: text,
    metadata,
    summary,
    recommendations,
    quiz,
    chunks,
    chatHistory: []
  };

  saveSession(session);
  logger.info("Study session creation completed", {
    sessionId: session.id,
    durationMs: Date.now() - startedAt
  });

  return {
    sessionId: session.id,
    createdAt: session.createdAt,
    summary: session.summary,
    recommendations: session.recommendations,
    quiz: quizForClient(session.quiz)
  };
}

export function getSessionOverview(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  logger.debug("Session overview fetched", { sessionId });

  return {
    sessionId: session.id,
    createdAt: session.createdAt,
    input: session.input,
    summary: session.summary,
    recommendations: session.recommendations,
    quiz: quizForClient(session.quiz),
    chatHistory: session.chatHistory
  };
}

export function submitQuiz(sessionId, answers) {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  logger.debug("Evaluating quiz", {
    sessionId,
    answerCount: Array.isArray(answers) ? answers.length : 0
  });

  const result = evaluateQuizAnswers({
    quiz: session.quiz,
    answers
  });
  logger.info("Quiz evaluated", {
    sessionId,
    scorePercent: result.scorePercent,
    correct: result.correct,
    total: result.total
  });
  return result;
}

export async function askStudyQuestion(sessionId, question) {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  const startedAt = Date.now();
  const docs = retrieveTopChunks(session.chunks || [], question, 4);
  logger.debug("Retrieved chunks for chat", {
    sessionId,
    retrievedChunkCount: docs.length
  });
  const answer = await answerFollowUp({
    session,
    question,
    retrievedDocs: docs
  });

  const historyEntry = {
    id: uuidv4(),
    question,
    answer,
    createdAt: new Date().toISOString()
  };

  const nextHistory = [...session.chatHistory, historyEntry].slice(-20);
  updateSession(sessionId, { chatHistory: nextHistory });
  logger.info("Chat question answered", {
    sessionId,
    durationMs: Date.now() - startedAt,
    chatHistorySize: nextHistory.length
  });

  return historyEntry;
}
