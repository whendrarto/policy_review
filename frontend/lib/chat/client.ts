import { ApiError, GENERIC_ERROR, apiRequest } from "../api";

// Calls the backend's AI chat endpoint (POST /api/chat), which needs a signed-in user. The
// backend keeps no conversation state, so every call sends the whole history plus the document
// being drafted, if any.

export type ChatMessage = { role: "user" | "assistant"; content: string };

// `documentType` is a catalog id, or null before a document is chosen.
export type ChatRequest<Form> = { messages: ChatMessage[]; documentType: string | null; form: Form; today: string };
// `documentType` is set when the AI switched documents this turn.
export type ChatResult<Updates> = { reply: string; documentType?: string | null; updates: Updates };

export class ChatError extends Error {}

// Limits the backend enforces (backend/app/chat.py). Only the latest messages are sent: the
// current form goes with every request, so the model still sees everything filled in so far.
export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 2000;

export function errorMessageFor(status: number): string {
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 503) return "The AI assistant isn’t configured on this server.";
  if (status === 502) return "The AI assistant had a problem. Please try again.";
  return GENERIC_ERROR;
}

const isChatResult = (value: unknown): value is ChatResult<unknown> => {
  const result = value as ChatResult<unknown> | undefined;
  return (
    typeof result?.reply === "string" &&
    typeof result.updates === "object" &&
    result.updates !== null &&
    (result.documentType == null || typeof result.documentType === "string")
  );
};

export async function sendChat<Form, Updates>(
  request: ChatRequest<Form>,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResult<Updates>> {
  let result: unknown;
  try {
    result = await apiRequest("/api/chat", { method: "POST", body: { ...request, messages: request.messages.slice(-MAX_MESSAGES) }, fetchImpl });
  } catch (err) {
    // A network failure (status 0) keeps apiRequest's message; HTTP errors get the chat's own.
    throw new ChatError(err instanceof ApiError && err.status === 0 ? err.message : errorMessageFor(err instanceof ApiError ? err.status : 500));
  }
  if (!isChatResult(result)) throw new ChatError(errorMessageFor(500));
  return result as ChatResult<Updates>;
}
