import { useMemo, useState } from "react";
import { analyzeSource, askQuestion, submitQuiz } from "./lib/api";

const contentTypes = [
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Image" },
  { value: "zip", label: "ZIP" },
  { value: "web", label: "Web Page" }
];

const cardClass = "rounded-xl2 border border-border bg-panel p-5 shadow-glow";

export default function App() {
  const [contentType, setContentType] = useState("pdf");
  const [sourceLink, setSourceLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studyData, setStudyData] = useState(null);

  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [quizBusy, setQuizBusy] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const sessionId = studyData?.sessionId || "";

  const resetStateForNewSession = () => {
    setAnswers({});
    setQuizResult(null);
    setChatHistory([]);
    setChatInput("");
  };

  async function handleAnalyze(event) {
    event.preventDefault();
    setError("");

    if (!sourceLink.trim()) {
      setError("Source link is required.");
      return;
    }

    try {
      setLoading(true);
      const result = await analyzeSource({
        contentType,
        sourceLink: sourceLink.trim()
      });
      setStudyData(result);
      resetStateForNewSession();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
  }

  async function handleQuizSubmit() {
    if (!sessionId) return;

    try {
      setQuizBusy(true);
      setError("");
      const payload = studyData.quiz.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] || ""
      }));
      const result = await submitQuiz(sessionId, payload);
      setQuizResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuizBusy(false);
    }
  }

  async function handleAskQuestion(event) {
    event.preventDefault();
    if (!sessionId || !chatInput.trim()) return;

    try {
      setChatBusy(true);
      setError("");
      const userMessage = {
        role: "user",
        text: chatInput.trim(),
        id: `u-${Date.now()}`
      };

      setChatHistory((prev) => [...prev, userMessage]);
      setChatInput("");

      const response = await askQuestion(sessionId, userMessage.text);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: response.answer,
          id: response.id
        }
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setChatBusy(false);
    }
  }

  const quizCompletion = useMemo(() => {
    if (!studyData?.quiz?.length) return 0;
    const answered = studyData.quiz.filter((q) => answers[q.id]).length;
    return Math.round((answered / studyData.quiz.length) * 100);
  }, [answers, studyData]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">LangChain AI Agents</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Personalized Study Help ChatBot</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted md:text-base">
          Ingest a source link (PDF, video, audio, image, ZIP, or web page), generate structured learning insights,
          discover relevant resources, take a quiz, and ask follow-up questions.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleAnalyze} className={cardClass}>
          <h2 className="text-lg font-medium">1) Analyze Learning Content</h2>

          <label className="mt-4 block text-sm text-muted">Content type</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-panelSoft p-2.5"
          >
            {contentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm text-muted">Source link (URL)</label>
          <input
            type="url"
            value={sourceLink}
            onChange={(e) => setSourceLink(e.target.value)}
            placeholder="https://example.com/content.pdf"
            className="mt-2 w-full rounded-lg border border-border bg-panelSoft p-2.5"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accentHover"
          >
            {loading ? "Analyzing..." : "Run AI Study Pipeline"}
          </button>

          {error ? <p className="mt-4 rounded-lg bg-danger/20 p-3 text-sm text-red-200">{error}</p> : null}
        </form>

        <div className={cardClass}>
          <h2 className="text-lg font-medium">2) Summary + Topic Map</h2>
          {!studyData ? (
            <p className="mt-4 text-sm text-muted">Run analysis to view summary, core topics, and key takeaways.</p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Session ID</p>
                <p className="break-all">{studyData.sessionId}</p>
              </div>

              <div>
                <p className="font-medium">Summary</p>
                <p className="mt-1 text-muted">{studyData.summary.summary}</p>
              </div>

              <div>
                <p className="font-medium">Core Topics</p>
                <ul className="mt-2 space-y-1 text-muted">
                  {studyData.summary.coreTopics.map((topic) => (
                    <li key={topic}>• {topic}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-medium">Key Takeaways</p>
                <ul className="mt-2 space-y-1 text-muted">
                  {studyData.summary.keyTakeaways.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-medium">3) Resource Recommendations</h2>
          {!studyData ? (
            <p className="mt-4 text-sm text-muted">Recommendations are generated after source analysis.</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {studyData.recommendations.map((item) => (
                <article key={`${item.title}-${item.url}`} className="rounded-lg border border-border bg-panelSoft p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">{item.type}</p>
                  <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block font-medium hover:underline">
                    {item.title}
                  </a>
                  <p className="mt-1 text-muted">{item.reason}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-medium">4) Interactive Quiz</h2>
          {!studyData ? (
            <p className="mt-4 text-sm text-muted">Quiz appears when analysis is complete.</p>
          ) : (
            <div className="mt-4">
              <p className="text-xs text-muted">Completion: {quizCompletion}%</p>
              <div className="mt-3 space-y-4">
                {studyData.quiz.map((q, index) => (
                  <div key={q.id} className="rounded-lg border border-border bg-panelSoft p-3">
                    <p className="font-medium">
                      Q{index + 1}. {q.question}
                    </p>
                    <div className="mt-2 space-y-2">
                      {q.options.map((option) => (
                        <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === option}
                            onChange={() => setAnswer(q.id, option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleQuizSubmit}
                disabled={quizBusy}
                className="mt-4 rounded-lg border border-border bg-panelSoft px-4 py-2.5 text-sm font-semibold hover:bg-panel"
              >
                {quizBusy ? "Evaluating..." : "Submit Quiz"}
              </button>

              {quizResult ? (
                <div className="mt-4 space-y-3 rounded-lg border border-border bg-panelSoft p-3 text-sm">
                  <p className="font-medium">
                    Score: {quizResult.correct}/{quizResult.total} ({quizResult.scorePercent}%)
                  </p>
                  {quizResult.details.map((item) => (
                    <article key={item.questionId} className="rounded border border-border bg-panel p-2.5">
                      <p className="font-medium">{item.question}</p>
                      <p className="mt-1 text-muted">
                        Your answer: {item.selectedAnswer || "No answer"} | Correct: {item.correctAnswer}
                      </p>
                      <p className={`mt-1 ${item.isCorrect ? "text-green-300" : "text-red-300"}`}>
                        {item.isCorrect ? "Correct" : "Incorrect"}
                      </p>
                      <p className="mt-1 text-muted">Why: {item.explanation}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className={`mt-6 ${cardClass}`}>
        <h2 className="text-lg font-medium">5) Follow-up Chatbot</h2>
        {!studyData ? (
          <p className="mt-4 text-sm text-muted">Chat is enabled after session creation.</p>
        ) : (
          <>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-border bg-panelSoft p-3 text-sm">
              {chatHistory.length === 0 ? (
                <p className="text-muted">Ask a question about the analyzed source to start the conversation.</p>
              ) : (
                chatHistory.map((message) => (
                  <div key={message.id} className="rounded-md border border-border bg-panel p-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted">{message.role}</p>
                    <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Explain one topic with an example"
                className="w-full rounded-lg border border-border bg-panelSoft p-2.5"
              />
              <button
                type="submit"
                disabled={chatBusy}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accentHover"
              >
                {chatBusy ? "Thinking..." : "Ask"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
