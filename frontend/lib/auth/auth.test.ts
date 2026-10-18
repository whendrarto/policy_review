import { afterEach, describe, expect, it, vi } from "vitest";
import { onUnauthorized } from "../api";
import { fetchMe, signIn, signOut, signUp } from "./api";
import { validateSignIn, validateSignUp } from "./validate";
import { jsonResponse } from "../test-utils";

const ann = { id: 1, name: "Ann Lee", email: "ann@example.com" };

describe("account API", () => {
  const unsubscribers: (() => void)[] = [];
  afterEach(() => unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe()));

  it("signs up, in and out at the backend's endpoints", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(ann));
    await expect(signUp({ name: "Ann Lee", email: "ann@example.com", password: "correct horse" }, fetchImpl)).resolves.toEqual(ann);
    await expect(signIn({ email: "ann@example.com", password: "correct horse" }, fetchImpl)).resolves.toEqual(ann);
    const calls = fetchImpl.mock.calls.map(([url, init]) => [url, init?.method, JSON.parse(init?.body as string)]);
    expect(calls).toEqual([
      ["/api/auth/signup", "POST", { name: "Ann Lee", email: "ann@example.com", password: "correct horse" }],
      ["/api/auth/signin", "POST", { email: "ann@example.com", password: "correct horse" }],
    ]);
    const signOutFetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    await signOut(signOutFetch);
    expect(signOutFetch).toHaveBeenCalledWith("/api/auth/signout", expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("reports who is signed in, or null without a session", async () => {
    await expect(fetchMe(async () => jsonResponse(ann))).resolves.toEqual(ann);
    await expect(fetchMe(async () => jsonResponse({ detail: "Not signed in." }, 401))).resolves.toBeNull();
    await expect(fetchMe(async () => jsonResponse({ detail: "boom" }, 500))).rejects.toMatchObject({ status: 500 });
  });

  it("does not treat a wrong password or a missing session as a lost session", async () => {
    const listener = vi.fn();
    unsubscribers.push(onUnauthorized(listener));
    const unauthorized = async () => jsonResponse({ detail: "Incorrect email or password." }, 401);
    await expect(signIn({ email: "ann@example.com", password: "nope" }, unauthorized)).rejects.toMatchObject({ message: "Incorrect email or password." });
    await fetchMe(unauthorized);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("validateSignIn", () => {
  it("trims the email and needs a password", () => {
    expect(validateSignIn({ email: " ann@example.com ", password: "x" })).toEqual({ ok: true, value: { email: "ann@example.com", password: "x" } });
    expect(validateSignIn({ email: "ann", password: "" })).toEqual({
      ok: false,
      errors: { email: "Enter a valid email address.", password: "Enter your password." },
    });
  });
});

describe("validateSignUp", () => {
  it("accepts a name, an email and a long enough password", () => {
    expect(validateSignUp({ name: " Ann Lee ", email: "ann@example.com", password: "12345678" })).toEqual({
      ok: true,
      value: { name: "Ann Lee", email: "ann@example.com", password: "12345678" },
    });
  });

  it.each([
    [{ name: "  ", email: "ann@example.com", password: "12345678" }, { name: "Enter your name." }],
    [{ name: "x".repeat(101), email: "ann@example.com", password: "12345678" }, { name: "Use at most 100 characters." }],
    [{ name: "Ann", email: "ann@example", password: "12345678" }, { email: "Enter a valid email address." }],
    [{ name: "Ann", email: "ann@example.com", password: "1234567" }, { password: "Use at least 8 characters." }],
    [{ name: "Ann", email: "ann@example.com", password: "x".repeat(129) }, { password: "Use at most 128 characters." }],
  ])("explains what is wrong: %j", (input, errors) => {
    expect(validateSignUp(input)).toEqual({ ok: false, errors });
  });

  it("does not trim the password", () => {
    expect(validateSignUp({ name: "Ann", email: "ann@example.com", password: "  pass  " })).toMatchObject({ value: { password: "  pass  " } });
  });
});
