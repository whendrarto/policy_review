import { describe, expect, it } from "vitest";
import { GREETING, applyChatResult, applyUpdates, toWireForm, type ChatUpdates, type Draft } from "./chat";
import { DOCUMENTS, defaultForm, getDocument } from "./registry";

const NDA = getDocument("mutual-nda")!;
const PILOT = getDocument("pilot-agreement")!;

// Model output is untrusted, so the tests also feed values the types don't allow.
const untyped = (updates: unknown) => updates as ChatUpdates;

describe("applyUpdates", () => {
  it("leaves the form unchanged for empty updates", () => {
    expect(applyUpdates(NDA, defaultForm(NDA), {})).toEqual(defaultForm(NDA));
  });

  it("applies text, choices and years", () => {
    const form = applyUpdates(NDA, defaultForm(NDA), {
      purpose: "Hiring a contractor",
      governingLaw: "Delaware",
      chosenCourts: "courts located in New Castle, DE",
      modifications: "None",
      mndaTerm: "untilTerminated",
      mndaTermYears: 3,
      confidentialityTerm: "perpetual",
      confidentialityYears: 5,
    });
    expect(form.values).toEqual({
      purpose: "Hiring a contractor",
      effectiveDate: "",
      governingLaw: "Delaware",
      chosenCourts: "courts located in New Castle, DE",
      modifications: "None",
      mndaTerm: "untilTerminated",
      mndaTermYears: 3,
      confidentialityTerm: "perpetual",
      confidentialityYears: 5,
    });
  });

  it("clears a field set to an empty string", () => {
    const start = applyUpdates(NDA, defaultForm(NDA), { governingLaw: "Delaware" });
    expect(applyUpdates(NDA, start, { governingLaw: "" }).values.governingLaw).toBe("");
  });

  it("merges party fields without touching the others", () => {
    const start = { ...defaultForm(NDA), party1: { name: "Jane", title: "CEO", company: "Acme", noticeAddress: "" } };
    const form = applyUpdates(NDA, start, { party1: { noticeAddress: "jane@acme.com" }, party2: { company: "Globex" } });
    expect(form.party1).toEqual({ name: "Jane", title: "CEO", company: "Acme", noticeAddress: "jane@acme.com" });
    expect(form.party2).toEqual({ name: "", title: "", company: "Globex", noticeAddress: "" });
  });

  it.each([0, 100, 1.5, Number.NaN, "3", null])("ignores invalid years: %s", (years) => {
    const form = applyUpdates(NDA, defaultForm(NDA), untyped({ mndaTermYears: years, confidentialityYears: years }));
    expect(form.values.mndaTermYears).toBe(1);
    expect(form.values.confidentialityYears).toBe(1);
  });

  it("ignores unknown choices", () => {
    const form = applyUpdates(NDA, defaultForm(NDA), untyped({ mndaTerm: "forever", confidentialityTerm: "never" }));
    expect(form.values.mndaTerm).toBe("expires");
    expect(form.values.confidentialityTerm).toBe("years");
  });

  it("applies real dates and ignores anything else", () => {
    expect(applyUpdates(NDA, defaultForm(NDA), { effectiveDate: "2028-02-29" }).values.effectiveDate).toBe("2028-02-29");
    for (const effectiveDate of ["2026-02-30", "10/18/2026", "next Monday", "20260-01-01", ""]) {
      expect(applyUpdates(NDA, defaultForm(NDA), { effectiveDate }).values.effectiveDate).toBe("");
    }
  });

  it("ignores null, non-string and unknown values", () => {
    const form = applyUpdates(
      NDA,
      defaultForm(NDA),
      untyped({ purpose: null, governingLaw: 42, party1: "Acme", party2: { company: null, name: 7 }, pilotPeriod: "90 days" }),
    );
    expect(form).toEqual(defaultForm(NDA));
  });

  it("does not mutate its input", () => {
    const start = defaultForm(NDA);
    applyUpdates(NDA, start, { purpose: "Changed", party1: { name: "Jane" } });
    expect(start).toEqual(defaultForm(NDA));
  });
});

describe("applyChatResult", () => {
  const nda: Draft = { doc: NDA, form: applyUpdates(NDA, defaultForm(NDA), { governingLaw: "Delaware", party1: { company: "Acme" } }) };

  it("stays without a document until one is chosen", () => {
    expect(applyChatResult(null, { documentType: null, updates: { governingLaw: "Delaware" } })).toBeNull();
  });

  it("starts the chosen document with the values the AI sent", () => {
    const draft = applyChatResult(null, { documentType: "pilot-agreement", updates: { pilotPeriod: "60 days", party1: { company: "Acme" } } });
    expect(draft?.doc).toBe(PILOT);
    expect(draft?.form.values.pilotPeriod).toBe("60 days");
    expect(draft?.form.party1.company).toBe("Acme");
  });

  it("starts afresh on a switch, keeping only what the backend carried over", () => {
    const draft = applyChatResult(nda, { documentType: "pilot-agreement", updates: { governingLaw: "Delaware" } });
    expect(draft).toEqual({ doc: PILOT, form: { ...defaultForm(PILOT), values: { ...defaultForm(PILOT).values, governingLaw: "Delaware" } } });
  });

  it("updates the current document when the document doesn't change", () => {
    for (const documentType of [undefined, null, "mutual-nda"]) {
      const draft = applyChatResult(nda, { documentType, updates: { purpose: "Hiring" } });
      expect(draft?.doc).toBe(NDA);
      expect(draft?.form.values).toMatchObject({ purpose: "Hiring", governingLaw: "Delaware" });
      expect(draft?.form.party1.company).toBe("Acme");
    }
  });

  it("ignores unknown documents", () => {
    expect(applyChatResult(nda, { documentType: "employment-contract", updates: { purpose: "Hiring" } })).toBe(nda);
    expect(applyChatResult(null, { documentType: "employment-contract", updates: {} })).toBeNull();
  });
});

describe("toWireForm", () => {
  it("sends the values next to the parties", () => {
    const form = defaultForm(PILOT);
    expect(toWireForm(form)).toEqual({ ...form.values, party1: form.party1, party2: form.party2 });
  });
});

describe("GREETING", () => {
  it("asks what to draft and names every document", () => {
    expect(GREETING).toMatch(/What would you like to draft\?/);
    for (const doc of DOCUMENTS) expect(GREETING).toContain(doc.shortName);
    expect(GREETING).toContain("DPA or BAA.");
  });
});
