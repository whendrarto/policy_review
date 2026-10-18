// Helpers for the unit tests.

/** A JSON response, as the backend sends. */
export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
