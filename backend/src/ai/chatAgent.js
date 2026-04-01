import { generateText } from "./model.js";
import { logger } from "../utils/logger.js";

export async function answerFollowUp({ session, question, retrievedDocs }) {
  const context = retrievedDocs.map((doc, index) => `Chunk ${index + 1}: ${doc.pageContent}`).join("\n\n");
  logger.debug("Chat answer generation started", {
    sessionId: session.id,
    questionLength: question.length,
    contextLength: context.length
  });

  const response = await generateText({
    systemPrompt:
      "You are a personal learning assistant. Answer with accuracy, use only the supplied study context, and state uncertainty if context is missing.",
    userPrompt:
      `Summary:\n${session.summary.summary}\n\nCore topics: ${session.summary.coreTopics.join(", ")}\n\n` +
      `Reference context:\n${context}\n\nQuestion: ${question}`
  });
  logger.debug("Chat answer generation completed", {
    sessionId: session.id,
    responseLength: response.length
  });
  return response;
}
