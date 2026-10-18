// The V1 foundation has a fake login: the user gives a name and email, which are kept in
// sessionStorage for the tab. Real authentication will replace the store's backing and
// validateLogin without changing the components that use them.

export type Session = { name: string; email: string };
export type LoginErrors = { name?: string; email?: string };
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const SESSION_KEY = "prelegal.session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: Session): { ok: true; session: Session } | { ok: false; errors: LoginErrors } {
  const session = { name: input.name.trim(), email: input.email.trim() };
  const errors: LoginErrors = {};
  if (!session.name) errors.name = "Enter your name.";
  if (!EMAIL_PATTERN.test(session.email)) errors.email = "Enter a valid email address.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, session };
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { name, email } = value as Record<string, unknown>;
    return typeof name === "string" && name && typeof email === "string" && email ? { name, email } : null;
  } catch {
    return null;
  }
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/**
 * A session store with a subscribe/snapshot pair for useSyncExternalStore. `storage` is a getter
 * because browsers that block storage throw on access; the session then lasts only as long as
 * the page.
 */
export function createSessionStore(storage: () => StorageLike) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  let fallback: string | null = null;
  const write = (raw: string | null) => {
    fallback = raw;
    try {
      if (raw === null) storage().removeItem(SESSION_KEY);
      else storage().setItem(SESSION_KEY, raw);
    } catch {
      // Keep the in-memory fallback.
    }
    notify();
  };
  return {
    /** The stored string, which stays referentially stable while the session is unchanged. */
    readRaw(): string | null {
      try {
        return storage().getItem(SESSION_KEY);
      } catch {
        return fallback;
      }
    },
    save: (session: Session) => write(JSON.stringify(session)),
    clear: () => write(null),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
