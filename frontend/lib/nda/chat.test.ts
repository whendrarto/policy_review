import { describe, expect, it } from "vitest";
import { NDA_GREETING, applyNdaUpdates, type NdaUpdates } from "./chat";
import { defaultForm } from "./types";

// Model output is untrusted, so the tests also feed values the types don't allow.
const untyped = (updates: unknown) => updates as NdaUpdates;

describe("applyNdaUpdates", () => {
  it("leaves the form unchanged for empty updates", () => {
    expect(applyNdaUpdates(defaultForm(), {})).toEqual(defaultForm());
  });

  it("applies text, terms and years", () => {
    const form = applyNdaUpdates(defaultForm(), {
      purpose: "Hiring a contractor",
      governingLaw: "Delaware",
      jurisdiction: "courts located in New Castle, DE",
      modifications: "None",
      mndaTerm: "untilTerminated",
      mndaTermYears: 3,
      confidentialityTerm: "perpetual",
      confidentialityYears: 5,
    });
    expect(form).toMatchObject({
      purpose: "Hiring a contractor",
      governingLaw: "Delaware",
      jurisdiction: "courts located in New Castle, DE",
      modifications: "None",
      mndaTerm: "untilTerminated",
      mndaTermYears: 3,
      confidentialityTerm: "perpetual",
      confidentialityYears: 5,
    });
  });

  it("clears a field set to an empty string", () => {
    const form = applyNdaUpdates({ ...defaultForm(), governingLaw: "Delaware" }, { governingLaw: "" });
    expect(form.governingLaw).toBe("");
  });

  it("merges party fields without touching the others", () => {
    const start = { ...defaultForm(), party1: { name: "Jane", title: "CEO", company: "Acme", noticeAddress: "" } };
    const form = applyNdaUpdates(start, { party1: { noticeAddress: "jane@acme.com" }, party2: { company: "Globex" } });
    expect(form.party1).toEqual({ name: "Jane", title: "CEO", company: "Acme", noticeAddress: "jane@acme.com" });
    expect(form.party2).toEqual({ name: "", title: "", company: "Globex", noticeAddress: "" });
  });

  it.each([0, 100, 1.5, Number.NaN, "3", null])("ignores invalid years: %s", (years) => {
    const form = applyNdaUpdates(defaultForm(), untyped({ mndaTermYears: years, confidentialityYears: years }));
    expect(form.mndaTermYears).toBe(1);
    expect(form.confidentialityYears).toBe(1);
  });

  it("ignores unknown term options", () => {
    const form = applyNdaUpdates(defaultForm(), untyped({ mndaTerm: "forever", confidentialityTerm: "never" }));
    expect(form.mndaTerm).toBe("expires");
    expect(form.confidentialityTerm).toBe("years");
  });

  it("applies real dates and ignores anything else", () => {
    expect(applyNdaUpdates(defaultForm(), { effectiveDate: "2028-02-29" }).effectiveDate).toBe("2028-02-29");
    for (const effectiveDate of ["2026-02-30", "10/18/2026", "next Monday", "20260-01-01", ""]) {
      expect(applyNdaUpdates(defaultForm(), { effectiveDate }).effectiveDate).toBe("");
    }
  });

  it("ignores null, non-string and unknown values", () => {
    const form = applyNdaUpdates(
      defaultForm(),
      untyped({ purpose: null, governingLaw: 42, party1: "Acme", party2: { company: null, name: 7 }, extra: "x" }),
    );
    expect(form).toEqual(defaultForm());
  });

  it("does not mutate its input", () => {
    const start = defaultForm();
    applyNdaUpdates(start, { purpose: "Changed", party1: { name: "Jane" } });
    expect(start).toEqual(defaultForm());
  });
});

describe("NDA_GREETING", () => {
  it("asks about the parties", () => {
    expect(NDA_GREETING).toMatch(/parties/);
  });
});
