// Calls to the backend's JSON API. The session is an HttpOnly cookie, so every request sends
// credentials, and a 401 from any call means the user has been signed out (for example because
// the server restarted, which resets its database); listeners registered with onUnauthorized
// hear about it.

// Empty in production, where FastAPI serves the site and the API from one origin. Under
// `next dev` set NEXT_PUBLIC_API_BASE=http://localhost:8000 (and CORS_ORIGINS on the backend).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export class ApiError extends Error {
  /** The HTTP status, or 0 when the server couldn't be reached. */
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const NETWORK_ERROR = "Can’t reach the server. Check your connection and try again.";
export const GENERIC_ERROR = "Something went wrong. Please try again.";

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener());
}

/** FastAPI's `detail`: a message, or a list of validation errors. */
function detailOf(body: unknown): string | undefined {
  const detail = typeof body === "object" && body !== null ? (body as { detail?: unknown }).detail : undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return undefined;
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  fetchImpl?: typeof fetch;
  // Off for sign-in and the session check, where a 401 is an answer rather than a lost session.
  notifyOn401?: boolean;
};

export async function apiRequest<T>(path: string, { method = "GET", body, fetchImpl = fetch, notifyOn401 = true }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (response.status === 401 && notifyOn401) notifyUnauthorized();
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(response.status, detailOf(data) ?? GENERIC_ERROR);
  return data as T;
}
