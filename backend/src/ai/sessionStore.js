const sessions = new Map();

export function saveSession(session) {
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function updateSession(sessionId, updates) {
  const existing = getSession(sessionId);
  if (!existing) return null;

  const next = { ...existing, ...updates };
  sessions.set(sessionId, next);
  return next;
}
