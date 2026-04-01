const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const ANALYZE_TIMEOUT_MS = 180000;

async function parseResponse(response, fallbackMessage) {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(err.message || fallbackMessage);
  }
  return response.json();
}

export async function analyzeSource(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/api/study/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    return parseResponse(response, "Failed to analyze source");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Analysis request timed out after 3 minutes.");
    }
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach backend at ${API_BASE}. Check backend server and VITE_API_BASE_URL.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function submitQuiz(sessionId, answers) {
  const response = await fetch(`${API_BASE}/api/study/quiz/${sessionId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers })
  });

  return parseResponse(response, "Failed to evaluate quiz");
}

export async function askQuestion(sessionId, message) {
  const response = await fetch(`${API_BASE}/api/study/chat/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

  return parseResponse(response, "Failed to fetch chatbot answer");
}
