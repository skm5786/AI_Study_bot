import express from "express";
import {
  askStudyQuestion,
  createStudySession,
  getSessionOverview,
  submitQuiz,
  validateAnalyzeInput
} from "../ai/studyWorkflow.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const ANALYZE_TIMEOUT_MS = 180000;

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

router.post("/analyze", async (req, res) => {
  const requestId = req.requestId || "n/a";
  try {
    logger.info("Analyze request received", {
      requestId,
      contentType: req.body?.contentType,
      sourceLink: req.body?.sourceLink
    });
    const input = validateAnalyzeInput(req.body);
    const result = await withTimeout(
      createStudySession(input),
      ANALYZE_TIMEOUT_MS,
      "Analysis timed out. Try a smaller/faster source URL."
    );
    logger.info("Analyze request completed", {
      requestId,
      sessionId: result.sessionId
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze source";
    const status = message.includes("timed out") ? 504 : 400;
    logger.error("Analyze request failed", {
      requestId,
      status,
      message,
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(status).json({ message });
  }
});

router.get("/session/:sessionId", (req, res) => {
  const requestId = req.requestId || "n/a";
  const session = getSessionOverview(req.params.sessionId);
  if (!session) {
    logger.warn("Session lookup failed", { requestId, sessionId: req.params.sessionId });
    return res.status(404).json({ message: "Session not found." });
  }

  logger.info("Session lookup success", { requestId, sessionId: req.params.sessionId });
  return res.status(200).json(session);
});

router.post("/quiz/:sessionId/submit", (req, res) => {
  const requestId = req.requestId || "n/a";
  try {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    logger.info("Quiz submit received", {
      requestId,
      sessionId: req.params.sessionId,
      answerCount: answers.length
    });
    const result = submitQuiz(req.params.sessionId, answers);
    logger.info("Quiz submit completed", {
      requestId,
      sessionId: req.params.sessionId,
      scorePercent: result.scorePercent
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate quiz";
    const status = message === "Session not found." ? 404 : 400;
    logger.error("Quiz submit failed", {
      requestId,
      sessionId: req.params.sessionId,
      status,
      message,
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(status).json({ message });
  }
});

router.post("/chat/:sessionId", async (req, res) => {
  const requestId = req.requestId || "n/a";
  try {
    const question = (req.body?.message || "").trim();
    if (!question) {
      logger.warn("Chat rejected: empty message", { requestId, sessionId: req.params.sessionId });
      return res.status(400).json({ message: "message is required." });
    }

    logger.info("Chat request received", {
      requestId,
      sessionId: req.params.sessionId,
      questionLength: question.length
    });
    const answer = await askStudyQuestion(req.params.sessionId, question);
    logger.info("Chat request completed", {
      requestId,
      sessionId: req.params.sessionId,
      answerId: answer.id
    });
    return res.status(200).json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question";
    const status = message === "Session not found." ? 404 : 400;
    logger.error("Chat request failed", {
      requestId,
      sessionId: req.params.sessionId,
      status,
      message,
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(status).json({ message });
  }
});

export default router;
