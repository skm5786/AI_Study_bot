# Personalized Study Help ChatBot

End-to-end AI learning assistant that ingests source content, explains it, expands learning resources, tests comprehension, and supports follow-up Q&A.

## Design Implementation (Top-Level)

### 1) Content Ingestion Layer
- Input: `contentType` + `sourceLink`
- Supported types: `pdf`, `web`, `zip` (primary for Gemini flow)
- Extraction pipeline:
  - URL validation
  - source download with timeout + redirect limit
  - parser by type (PDF parser, HTML extraction, ZIP text extraction)
  - text trimming via `MAX_SOURCE_CHARS`

### 2) AI Understanding Layer
- Generates a structured learning pack:
  - concise summary
  - core topics
  - key takeaways
- Uses Gemini API JSON outputs with schema validation.

### 3) Learning Expansion Layer
- Builds additional resource recommendations.
- If `TAVILY_API_KEY` is set: ranks real web results.
- If not: fallback educational YouTube/search links per topic.

### 4) Assessment Layer
- Generates quiz questions (MCQ).
- Evaluates answers and returns:
  - correct/incorrect
  - expected answer
  - explanation
  - total score.

### 5) Follow-up Chat Layer
- Stores extracted text chunks in memory.
- Retrieves top relevant chunks using keyword scoring.
- Answers user follow-up questions grounded in session context.

### 6) UI Layer
- Single workflow UI:
  1. Analyze content
  2. Read summary/topic map
  3. Open recommendations
  4. Take quiz + see evaluation
  5. Ask follow-up questions

## Design Decisions and Tradeoffs

1. `Gemini free tier` as default provider
- Decision: reduce local setup friction and avoid paid dependency.
- Tradeoff: model availability differs by account/region; fallback model probing was added.

2. `Model + endpoint fallback` for Gemini
- Decision: automatically try multiple model IDs and API versions (`v1beta`, `v1`).
- Benefit: avoids hard-failure when one model alias is unavailable.

3. `Schema-first outputs (Zod)`
- Decision: enforce structured AI outputs for summary/recommendations/quiz.
- Benefit: predictable API responses.
- Hardening: type coercion for quiz IDs/options to tolerate model variability.

4. `Keyword retrieval instead of vector DB`
- Decision: remove dependency complexity and install conflicts.
- Benefit: faster setup and reliable local execution.
- Tradeoff: less semantic retrieval quality than embeddings.

5. `Timeouts + failure visibility`
- Decision: add timeouts in frontend, backend route, and external fetches.
- Benefit: no silent freezes; explicit error messages.

6. `Structured logging everywhere`
- Decision: request-level + stage-level logs with request ID and timing.
- Benefit: quick debugging of where failures happen (extract vs model vs schema).

7. `In-memory sessions`
- Decision: optimize iteration speed.
- Tradeoff: sessions reset on backend restart.

## Current Architecture

### Backend (`/backend`)
- `POST /api/study/analyze`
  - ingestion + extraction + summary + recommendations + quiz
- `POST /api/study/quiz/:sessionId/submit`
  - quiz evaluation
- `POST /api/study/chat/:sessionId`
  - follow-up Q&A
- `GET /api/study/session/:sessionId`
  - session details

### Frontend (`/frontend`)
- React + Vite single-page app with 5 modules mapped to the backend workflow.

## Key Backend Modules
- `/Users/sumit/Documents/New project/backend/src/ai/contentExtractor.js`
- `/Users/sumit/Documents/New project/backend/src/ai/model.js`
- `/Users/sumit/Documents/New project/backend/src/ai/learningAgent.js`
- `/Users/sumit/Documents/New project/backend/src/ai/studyWorkflow.js`
- `/Users/sumit/Documents/New project/backend/src/ai/chatAgent.js`
- `/Users/sumit/Documents/New project/backend/src/ai/quizEvaluator.js`
- `/Users/sumit/Documents/New project/backend/src/routes/study.js`
- `/Users/sumit/Documents/New project/backend/src/utils/logger.js`

## Prerequisites
- Node.js 18+
- npm 10+
- Gemini API key (Google AI Studio free tier)
- Optional: Tavily API key

## Setup

### 1) Backend
```bash
cd /Users/sumit/Documents/New\ project/backend
npm install
cp .env.example .env
```

Set in `/Users/sumit/Documents/New project/backend/.env`:
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
LOG_LEVEL=debug
```

### 2) Frontend
```bash
cd /Users/sumit/Documents/New\ project/frontend
npm install
```

Ensure `/Users/sumit/Documents/New project/frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

## Run

### Terminal A
```bash
cd /Users/sumit/Documents/New\ project/backend
npm run dev
```

### Terminal B
```bash
cd /Users/sumit/Documents/New\ project/frontend
npm run dev
```

Open: `http://localhost:5173`

## Example Usage

### UI Example
1. Content type: `PDF`
2. Source link: `https://arxiv.org/pdf/2006.11239.pdf`
3. Click `Run AI Study Pipeline`
4. Review summary, topics, and takeaways
5. Submit quiz and inspect correctness/explanations
6. Ask follow-up: `Explain one core topic with an example`

### API Example: Analyze
```bash
curl -X POST http://localhost:3000/api/study/analyze \
  -H "Content-Type: application/json" \
  -d '{"contentType":"pdf","sourceLink":"https://arxiv.org/pdf/2006.11239.pdf"}'
```

### API Example: Quiz Submit
```bash
curl -X POST http://localhost:3000/api/study/quiz/<SESSION_ID>/submit \
  -H "Content-Type: application/json" \
  -d '{"answers":[{"questionId":"q-1","answer":"Option A"}]}'
```

### API Example: Chat
```bash
curl -X POST http://localhost:3000/api/study/chat/<SESSION_ID> \
  -H "Content-Type: application/json" \
  -d '{"message":"Summarize topic 2 in simple terms"}'
```

## Supported Content Notes
- Best supported now in Gemini flow: `pdf`, `web`, `zip`
- `image` and direct `audio/video` transcription paths are OpenAI-only in current build.

## Troubleshooting

1. `GEMINI_API_KEY is missing`
- Verify:
```bash
cd /Users/sumit/Documents/New\ project/backend
node -e "require('dotenv').config(); console.log(process.env.AI_PROVIDER, (process.env.GEMINI_API_KEY||'').length)"
```

2. `Request failed with status code 404` from Gemini
- Usually model alias mismatch; backend already auto-falls back across model names/endpoints.

3. Frontend stuck on analyze with no backend logs
- Check `/Users/sumit/Documents/New project/frontend/.env` points to `http://localhost:3000`
- Restart frontend after `.env` changes.

4. Session missing after restart
- Sessions are in-memory by design.
