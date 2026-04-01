import { z } from "zod";
import axios from "axios";
import { config } from "../config.js";
import { generateJson } from "./model.js";
import { logger } from "../utils/logger.js";

const summarySchema = z.object({
  summary: z.string(),
  coreTopics: z.array(z.string()).min(3).max(8),
  keyTakeaways: z.array(z.string()).min(3).max(8)
});

const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.coerce.string(),
        question: z.string(),
        options: z.array(z.coerce.string()).length(4),
        correctOption: z.coerce.string(),
        explanation: z.string()
      })
    )
    .min(5)
    .max(8)
});

const recommendationsSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      type: z.enum(["article", "video", "course", "reference", "tool"]),
      reason: z.string()
    })
  )
});

export async function generateSummaryPack(sourceText) {
  logger.debug("Summary pack generation started", { sourceLength: sourceText.length });
  const output = await generateJson({
    systemPrompt: "You are a teaching assistant. Produce concise educational outputs with precise terminology and zero fluff.",
    userPrompt:
      "Return strict JSON with keys: summary(string), coreTopics(string[] 3-8), keyTakeaways(string[] 3-8).\n\n" +
      `Material:\n${sourceText}`
  });

  const parsed = summarySchema.parse(output);
  logger.debug("Summary pack generation completed", {
    topicCount: parsed.coreTopics.length,
    takeawayCount: parsed.keyTakeaways.length
  });
  return parsed;
}

async function searchWebForTopic(topic) {
  if (!config.tavilyApiKey) {
    return [];
  }

  const response = await axios.post(
    "https://api.tavily.com/search",
    {
      api_key: config.tavilyApiKey,
      query: `${topic} tutorial lecture explained`,
      search_depth: "basic",
      max_results: 4
    },
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  return response.data?.results || [];
}

function fallbackResourceList(topics) {
  return topics.slice(0, config.maxRecommendedResources).map((topic, index) => ({
    title: `${topic} (YouTube Search)`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " tutorial")}`,
    type: index % 2 === 0 ? "video" : "reference",
    reason: `Search results for ${topic} tutorials, explanations, and walkthroughs.`
  }));
}

export async function generateRecommendations({ summary, coreTopics }) {
  logger.debug("Recommendation generation started", {
    topicCount: coreTopics.length,
    hasTavilyKey: Boolean(config.tavilyApiKey)
  });
  let webCandidates = [];
  if (config.tavilyApiKey) {
    const uniqueTopics = Array.from(new Set(coreTopics)).slice(0, 3);
    for (const topic of uniqueTopics) {
      try {
        const results = await searchWebForTopic(topic);
        webCandidates.push(...results);
      } catch {
        // ignore single search failure
      }
    }
  }

  if (!webCandidates.length) {
    logger.debug("Recommendation fallback used", { reason: "No web candidates available" });
    return fallbackResourceList(coreTopics);
  }

  const shortlist = webCandidates.slice(0, 12).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content
  }));

  const output = await generateJson({
    systemPrompt:
      "Rank and filter resources for a learner. Prefer high-quality explainers, lectures, docs, and practical guides.",
    userPrompt:
      "Return strict JSON with key resources as an array of objects: title,url,type(article|video|course|reference|tool),reason. " +
      `Limit to ${config.maxRecommendedResources}.\n\nSummary:\n${summary}\n\nCore topics: ${coreTopics.join(", ")}\n\n` +
      `Candidate resources:\n${JSON.stringify(shortlist, null, 2)}`
  });

  const parsed = recommendationsSchema.parse(output);
  logger.debug("Recommendation generation completed", {
    candidateCount: shortlist.length,
    outputCount: parsed.resources.length
  });
  return parsed.resources.slice(0, config.maxRecommendedResources);
}

export async function generateQuiz({ summary, coreTopics, keyTakeaways }) {
  logger.debug("Quiz generation started", {
    topicCount: coreTopics.length,
    takeawayCount: keyTakeaways.length
  });
  const output = await generateJson({
    systemPrompt:
      "Create a comprehension quiz. Ensure one unambiguously correct option and rigorous explanation.",
    userPrompt:
      "Return strict JSON with key questions as an array of exactly 5 objects: id,question,options(4 strings),correctOption,explanation.\n\n" +
      `Summary:\n${summary}\n\nTopics: ${coreTopics.join(", ")}\n\nKey takeaways:\n${keyTakeaways.join("\n")}`
  });

  const parsed = quizSchema.parse(output);
  const normalized = parsed.questions.slice(0, 5).map((q, index) => ({
    ...q,
    id: q.id?.trim() ? q.id : `q-${index + 1}`
  }));

  logger.debug("Quiz generation completed", { questionCount: normalized.length });
  return normalized;
}
