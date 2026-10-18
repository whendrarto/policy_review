import { ApiError, apiRequest } from "../api";

// The backend's account endpoints (backend/app/auth_api.py).

export type User = { id: number; name: string; email: string };

export const signUp = (input: { name: string; email: string; password: string }, fetchImpl?: typeof fetch) =>
  apiRequest<User>("/api/auth/signup", { method: "POST", body: input, fetchImpl, notifyOn401: false });

export const signIn = (input: { email: string; password: string }, fetchImpl?: typeof fetch) =>
  apiRequest<User>("/api/auth/signin", { method: "POST", body: input, fetchImpl, notifyOn401: false });

export const signOut = (fetchImpl?: typeof fetch) => apiRequest<void>("/api/auth/signout", { method: "POST", fetchImpl, notifyOn401: false });

/** The signed-in user, or null when there is no session. */
export async function fetchMe(fetchImpl?: typeof fetch): Promise<User | null> {
  try {
    return await apiRequest<User>("/api/auth/me", { fetchImpl, notifyOn401: false });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
