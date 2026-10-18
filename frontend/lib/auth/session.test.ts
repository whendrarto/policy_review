import { describe, expect, it, vi } from "vitest";
import { SESSION_KEY, createSessionStore, parseSession, validateLogin, type StorageLike } from "./session";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("validateLogin", () => {
  it("accepts a name and email, trimming them", () => {
    expect(validateLogin({ name: "  Ada Lovelace ", email: " ada@example.com " })).toEqual({
      ok: true,
      session: { name: "Ada Lovelace", email: "ada@example.com" },
    });
  });

  it("requires a name", () => {
    expect(validateLogin({ name: "   ", email: "ada@example.com" })).toEqual({ ok: false, errors: { name: "Enter your name." } });
  });

  it.each(["", "ada", "ada@example", "ada @example.com", "@example.com"])("rejects the email %j", (email) => {
    expect(validateLogin({ name: "Ada", email })).toEqual({ ok: false, errors: { email: "Enter a valid email address." } });
  });

  it("reports both errors at once", () => {
    const result = validateLogin({ name: "", email: "" });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["email", "name"]);
  });
});

describe("parseSession", () => {
  it("parses a stored session", () => {
    expect(parseSession('{"name":"Ada","email":"ada@example.com"}')).toEqual({ name: "Ada", email: "ada@example.com" });
  });

  it.each([null, "", "not json", "null", "42", '"Ada"', '{"name":"Ada"}', '{"name":"","email":"a@b.co"}', '{"name":1,"email":"a@b.co"}'])(
    "returns null for %j",
    (raw) => {
      expect(parseSession(raw)).toBeNull();
    },
  );
});

describe("createSessionStore", () => {
  const ada = { name: "Ada", email: "ada@example.com" };

  it("saves and clears the session in storage", () => {
    const storage = memoryStorage();
    const store = createSessionStore(() => storage);
    expect(store.readRaw()).toBeNull();
    store.save(ada);
    expect(parseSession(store.readRaw())).toEqual(ada);
    expect(JSON.parse(storage.data.get(SESSION_KEY)!)).toEqual(ada);
    store.clear();
    expect(store.readRaw()).toBeNull();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });

  it("keeps the raw snapshot stable while the session is unchanged", () => {
    const storage = memoryStorage();
    const store = createSessionStore(() => storage);
    store.save(ada);
    expect(store.readRaw()).toBe(store.readRaw());
  });

  it("keeps the session in memory when storage is blocked", () => {
    const store = createSessionStore(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(store.readRaw()).toBeNull();
    store.save(ada);
    expect(parseSession(store.readRaw())).toEqual(ada);
    store.clear();
    expect(store.readRaw()).toBeNull();
  });

  it("notifies subscribers on save and clear until they unsubscribe", () => {
    const storage = memoryStorage();
    const store = createSessionStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.save(ada);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.save(ada);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
