// Calls the backend's AI chat endpoint (POST /api/chat). The backend keeps no conversation
// state, so every call sends the whole history plus the current document.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest<Form> = { messages: ChatMessage[]; form: Form; today: string };
export type ChatResult<Updates> = { reply: string; updates: Updates };

export class ChatError extends Error {}

// Limits the backend enforces (backend/app/chat.py). Only the latest messages are sent: the
// current form goes with every request, so the model still sees everything filled in so far.
export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 2000;

// Empty in production, where FastAPI serves the site and the API from one origin. Under
// `next dev` set NEXT_PUBLIC_API_BASE=http://localhost:8000 (and CORS_ORIGINS on the backend).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export function errorMessageFor(status: number): string {
  if (status === 503) return "The AI assistant isn’t configured on this server.";
  if (status === 502) return "The AI assistant had a problem. Please try again.";
  return "Something went wrong. Please try again.";
}

export async function sendChat<Form, Updates>(
  request: ChatRequest<Form>,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResult<Updates>> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, messages: request.messages.slice(-MAX_MESSAGES) }),
    });
  } catch {
    throw new ChatError("Can’t reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw new ChatError(errorMessageFor(response.status));
  try {
    const result = (await response.json()) as ChatResult<Updates>;
    if (typeof result.reply !== "string" || typeof result.updates !== "object" || result.updates === null) throw new Error();
    return result;
  } catch {
    throw new ChatError(errorMessageFor(500));
  }
}
