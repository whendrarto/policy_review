import { describe, expect, it, vi } from "vitest";
import { ChatError, MAX_MESSAGES, errorMessageFor, sendChat } from "./client";

const request = {
  messages: [{ role: "user" as const, content: "Hi" }],
  documentType: "mutual-nda",
  form: { purpose: "" },
  today: "2026-10-18",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("sendChat", () => {
  it("posts the request and returns the reply", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ reply: "Hello", updates: { purpose: "Hiring" } }));
    await expect(sendChat(request, fetchImpl)).resolves.toEqual({ reply: "Hello", updates: { purpose: "Hiring" } });
    expect(fetchImpl).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  });

  it("returns the document the AI switched to", async () => {
    const result = { reply: "Let's draft a pilot agreement.", documentType: "pilot-agreement", updates: {} };
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(result));
    await expect(sendChat({ ...request, documentType: null, form: {} }, fetchImpl)).resolves.toEqual(result);
    expect(JSON.parse(fetchImpl.mock.calls[0][1]?.body as string)).toMatchObject({ documentType: null });
  });

  it("sends only the latest messages of a long conversation", async () => {
    const messages = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => ({
      role: i % 2 ? ("user" as const) : ("assistant" as const),
      content: `message ${i}`,
    }));
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ reply: "Hello", updates: {} }));
    await sendChat({ ...request, messages }, fetchImpl);
    const sent = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(sent.messages).toEqual(messages.slice(-MAX_MESSAGES));
    expect(sent.messages.at(-1).content).toBe(`message ${MAX_MESSAGES + 4}`);
  });

  it.each([
    [503, "isn’t configured"],
    [502, "had a problem"],
    [422, "Something went wrong"],
  ])("turns HTTP %i into a ChatError", async (status, message) => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: "server detail" }, status));
    const error = await sendChat(request, fetchImpl).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ChatError);
    expect((error as ChatError).message).toContain(message);
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(sendChat(request, fetchImpl)).rejects.toThrow("Can’t reach the server");
  });

  it.each([
    new Response("<html>not json</html>"),
    jsonResponse({ reply: 3 }),
    jsonResponse({ reply: "Hi", updates: null }),
    jsonResponse({ reply: "Hi", documentType: 7, updates: {} }),
  ])(
    "rejects malformed responses",
    async (response) => {
      await expect(sendChat(request, vi.fn(async () => response))).rejects.toBeInstanceOf(ChatError);
    },
  );
});

describe("errorMessageFor", () => {
  it("falls back to a generic message", () => {
    expect(errorMessageFor(500)).toBe("Something went wrong. Please try again.");
  });
});
