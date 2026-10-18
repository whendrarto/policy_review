import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, NETWORK_ERROR, apiRequest, onUnauthorized } from "./api";
import { jsonResponse } from "./test-utils";

describe("apiRequest", () => {
  const unsubscribers: (() => void)[] = [];
  afterEach(() => unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe()));

  it("sends JSON with the session cookie and returns the response body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ id: 1 }, 201));
    await expect(apiRequest("/api/documents", { method: "POST", body: { a: 1 }, fetchImpl })).resolves.toEqual({ id: 1 });
    expect(fetchImpl).toHaveBeenCalledWith("/api/documents", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("sends no body or content type for a GET", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse([]));
    await apiRequest("/api/documents", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("/api/documents", { method: "GET", credentials: "include", headers: undefined, body: undefined });
  });

  it("returns nothing for 204 No Content", async () => {
    await expect(apiRequest("/api/documents/1", { method: "DELETE", fetchImpl: async () => new Response(null, { status: 204 }) })).resolves.toBeUndefined();
  });

  it.each([
    [{ detail: "Document not found." }, "Document not found."],
    [{ detail: [{ msg: "String should have at least 8 characters" }] }, "String should have at least 8 characters"],
    ["<html>oops</html>", "Something went wrong. Please try again."],
  ])("turns an error response into an ApiError with the server's message: %j", async (body, message) => {
    const error = await apiRequest("/x", { fetchImpl: async () => jsonResponse(body, 404) }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message });
  });

  it("reports network failures with status 0", async () => {
    const error = await apiRequest("/x", {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    }).catch((err: unknown) => err);
    expect(error).toMatchObject({ status: 0, message: NETWORK_ERROR });
  });

  it("tells listeners when the session has ended, unless asked not to", async () => {
    const listener = vi.fn();
    unsubscribers.push(onUnauthorized(listener));
    const unauthorized = async () => jsonResponse({ detail: "Not signed in." }, 401);
    await expect(apiRequest("/api/documents", { fetchImpl: unauthorized })).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(apiRequest("/api/auth/signin", { fetchImpl: unauthorized, notifyOn401: false })).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
