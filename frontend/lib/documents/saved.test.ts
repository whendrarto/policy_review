import { describe, expect, it, vi } from "vitest";
import { createAutosaver, type SaveStatus } from "./autosave";
import { applyUpdates, restoreDraft, toWireForm } from "./chat";
import { defaultForm, getDocument } from "./registry";
import { createSaved, deleteSaved, getSaved, listSaved, updateSaved, type DraftSnapshot } from "./saved";
import { jsonResponse } from "../test-utils";

const snapshot = (n: number): DraftSnapshot => ({ documentType: "pilot-agreement", form: { pilotPeriod: `${n} days` }, messages: [] });

describe("saved documents API", () => {
  it("calls the backend's document endpoints", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}));
    await listSaved(fetchImpl);
    await getSaved(3, fetchImpl);
    await createSaved(snapshot(1), fetchImpl);
    await updateSaved(3, snapshot(2), fetchImpl);
    await deleteSaved(3, async (...args) => {
      fetchImpl(...args);
      return new Response(null, { status: 204 });
    });
    expect(fetchImpl.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      "GET /api/documents",
      "GET /api/documents/3",
      "POST /api/documents",
      "PUT /api/documents/3",
      "DELETE /api/documents/3",
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[3][1]?.body as string)).toEqual(snapshot(2));
  });
});

/** A save the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(id?: number) {
  const statuses: SaveStatus[] = [];
  const calls: string[] = [];
  const pendingCalls: ReturnType<typeof deferred<{ id: number }>>[] = [];
  const respond = (label: string) => {
    calls.push(label);
    const call = deferred<{ id: number }>();
    pendingCalls.push(call);
    return call.promise;
  };
  const onCreated = vi.fn();
  const saver = createAutosaver({
    create: (s) => respond(`create ${s.form.pilotPeriod}`),
    update: (savedId, s) => respond(`update ${savedId} ${s.form.pilotPeriod}`),
    onCreated,
    onStatus: (status) => statuses.push(status),
    id,
  });
  return { saver, statuses, calls, pendingCalls, onCreated };
}

describe("createAutosaver", () => {
  it("creates the document on the first save and updates it after", async () => {
    const { saver, statuses, calls, pendingCalls, onCreated } = setup();
    const first = saver.save(snapshot(1));
    pendingCalls[0].resolve({ id: 7 });
    await first;
    expect(onCreated).toHaveBeenCalledWith(7);
    const second = saver.save(snapshot(2));
    pendingCalls[1].resolve({ id: 7 });
    await second;
    expect(calls).toEqual(["create 1 days", "update 7 2 days"]);
    expect(statuses).toEqual(["saving", "saved", "saving", "saved"]);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("updates a document that is already saved", async () => {
    const { saver, calls, pendingCalls } = setup(4);
    const done = saver.save(snapshot(1));
    pendingCalls[0].resolve({ id: 4 });
    await done;
    expect(calls).toEqual(["update 4 1 days"]);
  });

  it("saves one at a time and only sends the latest of those that waited", async () => {
    const { saver, calls, pendingCalls } = setup();
    const first = saver.save(snapshot(1));
    void saver.save(snapshot(2));
    const third = saver.save(snapshot(3));
    expect(third).toBe(first);
    expect(calls).toEqual(["create 1 days"]);
    pendingCalls[0].resolve({ id: 7 });
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["create 1 days", "update 7 3 days"]);
    pendingCalls[1].resolve({ id: 7 });
    await third;
  });

  it("starts a new run for a save that comes after the last one finished", async () => {
    const { saver, calls, pendingCalls } = setup();
    const first = saver.save(snapshot(1));
    pendingCalls[0].resolve({ id: 7 });
    await first;
    const second = saver.save(snapshot(2));
    expect(second).not.toBe(first);
    expect(calls).toEqual(["create 1 days", "update 7 2 days"]);
    pendingCalls[1].resolve({ id: 7 });
    await second;
  });

  it("reports a failed save and sends it again on retry", async () => {
    const { saver, statuses, calls, pendingCalls } = setup(4);
    const failed = saver.save(snapshot(1));
    pendingCalls[0].reject(new Error("offline"));
    await failed;
    expect(statuses).toEqual(["saving", "error"]);
    const retried = saver.retry();
    pendingCalls[1].resolve({ id: 4 });
    await retried;
    expect(calls).toEqual(["update 4 1 days", "update 4 1 days"]);
    expect(statuses.at(-1)).toBe("saved");
    // Nothing left to retry.
    await saver.retry();
    expect(calls).toHaveLength(2);
  });
});

describe("restoreDraft", () => {
  it("reopens a saved form exactly as it was", () => {
    for (const id of ["mutual-nda", "pilot-agreement"]) {
      const doc = getDocument(id)!;
      const form = applyUpdates(doc, defaultForm(doc), {
        governingLaw: "Delaware",
        effectiveDate: "2026-11-01",
        party1: { company: "Acme", name: "Ann" },
      });
      expect(restoreDraft(id, toWireForm(form))).toEqual({ doc, form });
    }
  });

  it("drops values that no longer fit and rejects unknown documents", () => {
    const doc = getDocument("mutual-nda")!;
    expect(restoreDraft("mutual-nda", { mndaTerm: "forever", mndaTermYears: 500, purpose: 7 })).toEqual({ doc, form: defaultForm(doc) });
    expect(restoreDraft("employment-contract", {})).toBeNull();
  });
});
