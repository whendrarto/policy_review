import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { DRAFT_NOTICE, buildCoverPage } from "./coverPage";
import { blockRuns, buildDocument, countBlankFields, pdfFileName } from "./document";
import { formatDate } from "./format";
import { parseStandardTerms } from "./parse";
import { PDF_FONT_FILES, PDF_FONT_RANGES, unsupportedPdfChars } from "./pdfFont";
import { DOCUMENTS, defaultForm, getDocument, resolveForm } from "./registry";
import { TERMS_LOADERS, loadStandardTerms } from "./terms";
import type { Block, DocumentDef, DocumentForm } from "./types";

const templatesDir = path.join(import.meta.dirname, "../../../templates");
const termsMarkdown = (id: string) => readFileSync(path.join(templatesDir, id, "standard-terms.md"), "utf8");
const catalog = JSON.parse(readFileSync(path.join(templatesDir, "catalog.json"), "utf8"));

const NDA = getDocument("mutual-nda")!;
const PILOT = getDocument("pilot-agreement")!;

const party = (n: number) => ({ name: `Signer ${n}`, title: "CEO", company: `Company ${n}`, noticeAddress: `legal@company${n}.com` });

function filledNda(values: DocumentForm["values"] = {}): DocumentForm {
  const form = defaultForm(NDA);
  return {
    values: { ...form.values, effectiveDate: "2026-10-17", governingLaw: "Delaware", chosenCourts: "courts located in New Castle, DE", ...values },
    party1: party(1),
    party2: party(2),
  };
}

/** Every required field of `doc` filled in. */
function filled(doc: DocumentDef): DocumentForm {
  const form = defaultForm(doc);
  for (const field of doc.fields) {
    if (field.kind === "date") form.values[field.key] = "2026-10-17";
    else if (field.kind === "text" && !form.values[field.key]) form.values[field.key] = `${field.label} value`;
  }
  return { ...form, party1: party(1), party2: party(2) };
}

const textOf = (blocks: Block[]) =>
  blocks
    .flatMap(blockRuns)
    .map((r) => r.text)
    .join("");

describe("the registry", () => {
  it("lists every catalog document with its details", () => {
    expect(DOCUMENTS.map((doc) => doc.id)).toEqual(catalog.templates.map((t: { id: string }) => t.id));
    expect(PILOT).toMatchObject({
      name: "Pilot Agreement",
      version: "1.1",
      partyRoles: ["Provider", "Customer"],
      canonicalUrl: "https://commonpaper.com/standards/pilot-agreement/1.1",
    });
    expect(getDocument("employment-contract")).toBeUndefined();
    expect(getDocument(null)).toBeUndefined();
  });

  it("starts each field at its default", () => {
    expect(defaultForm(NDA).values).toMatchObject({ mndaTerm: "expires", mndaTermYears: 1, confidentialityTerm: "years", governingLaw: "" });
    expect(defaultForm(PILOT)).toEqual({
      values: { effectiveDate: "", pilotPeriod: "", generalCapAmount: "", governingLaw: "", chosenCourts: "" },
      party1: { name: "", title: "", company: "", noticeAddress: "" },
      party2: { name: "", title: "", company: "", noticeAddress: "" },
    });
  });

  it("shows blank dates as today", () => {
    expect(resolveForm(PILOT, defaultForm(PILOT), "2026-10-18").values.effectiveDate).toBe("2026-10-18");
    const chosen = { ...defaultForm(PILOT), values: { ...defaultForm(PILOT).values, effectiveDate: "2027-01-01" } };
    expect(resolveForm(PILOT, chosen, "2026-10-18").values.effectiveDate).toBe("2027-01-01");
  });
});

describe("loadStandardTerms", () => {
  it("has a loader for every document", () => {
    expect(Object.keys(TERMS_LOADERS).sort()).toEqual(DOCUMENTS.map((doc) => doc.id).sort());
  });

  it("loads the bundled Standard Terms from templates/ once", async () => {
    const terms = await loadStandardTerms("pilot-agreement");
    expect(terms).toEqual(parseStandardTerms(termsMarkdown("pilot-agreement")));
    expect(await loadStandardTerms("pilot-agreement")).toBe(terms);
  });

  it("rejects unknown documents", async () => {
    await expect(loadStandardTerms("employment-contract")).rejects.toThrow();
  });
});

describe("the Mutual NDA cover page", () => {
  it("fills in the form values", () => {
    const text = textOf(buildCoverPage(NDA, filledNda()));
    expect(text).toContain("October 17, 2026");
    expect(text).toContain("Delaware");
    expect(text).toContain("courts located in New Castle, DE");
    expect(text).toContain("Company 2");
    expect(text).toContain("None.");
    expect(text).toContain("commonpaper.com/standards/mutual-nda/1.0");
  });

  it("shows template placeholders for blank fields", () => {
    const blocks = buildCoverPage(NDA, defaultForm(NDA));
    const text = textOf(blocks);
    expect(text).toContain("[Fill in state]");
    expect(text).toContain("[Today’s date]");
    // Effective Date, Governing Law, Jurisdiction and 4 fields for each party.
    expect(countBlankFields(blocks)).toBe(11);
    expect(countBlankFields(buildCoverPage(NDA, filledNda()))).toBe(0);
  });

  it("ticks the chosen term options and pluralises years", () => {
    const options = buildCoverPage(NDA, filledNda({ mndaTermYears: 2, confidentialityTerm: "perpetual" })).filter((b) => b.type === "option");
    expect(options.map((o) => o.checked)).toEqual([true, false, false, true]);
    expect(textOf([options[0]])).toBe("Expires 2 years from Effective Date.");
  });

  it("treats an invalid year count as blank", () => {
    for (const years of [NaN, 0, 1.5, 100, 150, -2]) {
      expect(textOf(buildCoverPage(NDA, filledNda({ mndaTermYears: years })))).toContain("Expires [1 year(s)] from");
    }
    expect(textOf(buildCoverPage(NDA, filledNda({ mndaTermYears: 99 })))).toContain("Expires 99 years from");
  });

  it("does not count blanks in options that are not selected", () => {
    const values = { mndaTermYears: NaN, confidentialityYears: 0 };
    expect(countBlankFields(buildCoverPage(NDA, filledNda(values)))).toBe(2);
    expect(countBlankFields(buildCoverPage(NDA, filledNda({ ...values, mndaTerm: "untilTerminated", confidentialityTerm: "perpetual" })))).toBe(0);
  });

  it("keeps the signing sentence with the signature table", () => {
    const parties = buildCoverPage(NDA, filledNda()).find((b) => b.type === "parties");
    expect(parties && textOf([{ type: "paragraph", runs: parties.intro }])).toMatch(/^By signing this Cover Page/);
    expect(parties?.type === "parties" && parties.headers).toEqual(["PARTY 1", "PARTY 2"]);
  });
});

describe("generated Key Terms pages", () => {
  const others = DOCUMENTS.filter((doc) => doc.id !== "mutual-nda");

  it.each(others.map((doc) => [doc.id, doc] as const))("%s has a heading and value per field", (_, doc) => {
    const blocks = buildCoverPage(doc, filled(doc));
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: doc.name });
    const headings = blocks.filter((b) => b.type === "heading" && b.level === 3).map((b) => b.type === "heading" && b.text);
    expect(headings).toEqual(doc.fields.map((field) => field.label));
    expect(textOf(blocks)).toContain(doc.canonicalUrl.replace("https://", ""));
    expect(countBlankFields(blocks)).toBe(0);
    const parties = blocks.find((b) => b.type === "parties");
    expect(parties?.type === "parties" && parties.headers).toEqual(doc.partyRoles.map((role) => role.toUpperCase()));
    expect(blocks.at(-1)).toMatchObject({ type: "paragraph", runs: [{ text: `Common Paper ${doc.name} (Version ${doc.version}) free to use under ` }, { href: catalog.license.url }, { text: "." }] });
  });

  it.each(others.map((doc) => [doc.id, doc] as const))("%s counts required fields and parties as blank", (_, doc) => {
    const required = doc.fields.filter((field) => !field.optional).length;
    expect(countBlankFields(buildCoverPage(doc, defaultForm(doc)))).toBe(required + 8);
  });

  it("shows placeholders, dates and None. for blank optional fields", () => {
    const text = textOf(buildCoverPage(PILOT, defaultForm(PILOT)));
    expect(text).toContain("[e.g. 90 days from the Effective Date]");
    expect(text).toContain("[Today’s date]");
    const filledText = textOf(buildCoverPage(PILOT, filled(PILOT)));
    expect(filledText).toContain("October 17, 2026");
    expect(filledText).toContain("Pilot Period value");

    const ai = getDocument("ai-addendum")!;
    expect(textOf(buildCoverPage(ai, defaultForm(ai)))).toContain("None.");
  });

  it("groups fields under their section", () => {
    const csa = getDocument("cloud-service-agreement")!;
    const headings = buildCoverPage(csa, defaultForm(csa)).filter((b) => b.type === "heading").map((b) => b.type === "heading" && b.text);
    expect(headings.indexOf("KEY TERMS")).toBeLessThan(headings.indexOf("Effective Date"));
    expect(headings.indexOf("ORDER FORM")).toBeLessThan(headings.indexOf("Order Date"));
    expect(headings.indexOf("ORDER FORM")).toBeGreaterThan(headings.indexOf("Effective Date"));
  });

  it("dates the signatures by the effective date when the document has one", () => {
    const intro = (doc: DocumentDef) => {
      const parties = buildCoverPage(doc, defaultForm(doc)).find((b) => b.type === "parties");
      return parties?.type === "parties" ? textOf([{ type: "paragraph", runs: parties.intro }]) : "";
    };
    expect(intro(PILOT)).toBe("By signing these Key Terms, each party agrees to enter into this Pilot Agreement as of the Effective Date.");
    expect(intro(getDocument("business-associate-agreement")!)).toContain("as of the BAA Effective Date.");
    expect(intro(getDocument("service-level-agreement")!)).toBe("By signing these Key Terms, each party agrees to be bound by this Service Level Agreement.");
  });
});

describe("the draft notice", () => {
  it.each(DOCUMENTS.map((doc) => [doc.id, doc] as const))("sits under the title of the %s cover page", (_, doc) => {
    const blocks = buildCoverPage(doc, defaultForm(doc));
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toBe(DRAFT_NOTICE);
    expect(blocks.filter((block) => block.type === "notice")).toHaveLength(1);
  });

  it("says the document is a draft for legal review, in characters the PDF can print", () => {
    expect(DRAFT_NOTICE).toMatchObject({ type: "notice", title: "DRAFT - SUBJECT TO LEGAL REVIEW" });
    const notice = DRAFT_NOTICE.type === "notice" ? `${DRAFT_NOTICE.title} ${DRAFT_NOTICE.text}` : "";
    expect(notice).toMatch(/not legal advice/);
    expect(unsupportedPdfChars(notice)).toEqual([]);
  });

  it("leaves the Standard Terms and the blank-field count alone", () => {
    const terms = parseStandardTerms(termsMarkdown("mutual-nda"));
    const doc = buildDocument(NDA, defaultForm(NDA), terms);
    expect(doc.slice(doc.findIndex((b) => b.type === "pageBreak") + 1)).toEqual(terms);
    expect(countBlankFields(doc)).toBe(11);
  });
});

describe("buildDocument", () => {
  it("puts the Standard Terms after the cover page on a new page", () => {
    const terms = parseStandardTerms(termsMarkdown("mutual-nda"));
    const doc = buildDocument(NDA, filledNda(), terms);
    const pageBreak = doc.findIndex((b) => b.type === "pageBreak");
    expect(doc.slice(0, pageBreak)).toEqual(buildCoverPage(NDA, filledNda()));
    expect(doc.slice(pageBreak + 1)).toEqual(terms);
  });
});

describe("formatDate", () => {
  it("formats ISO dates without time zone drift and rejects invalid input", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("")).toBe("");
  });

  it("rejects dates that are not on the calendar instead of rolling them over", () => {
    expect(formatDate("2026-02-31")).toBe("");
    expect(formatDate("2026-13-01")).toBe("");
    expect(formatDate("2025-02-29")).toBe("");
    expect(formatDate("2024-02-29")).toBe("February 29, 2024");
    expect(formatDate("0000-01-01")).toBe("");
  });

  it("shows years beyond 9999 rather than treating them as blank", () => {
    expect(formatDate("20266-01-01")).toBe("January 1, 20266");
  });
});

describe("pdfFileName", () => {
  it("uses the document and company names", () => {
    const form = filledNda();
    form.party1.company = "Acme, Inc.";
    form.party2.company = "Globex";
    expect(pdfFileName(NDA, form)).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(pdfFileName(NDA, defaultForm(NDA))).toBe("Mutual-NDA.pdf");
    expect(pdfFileName(getDocument("data-processing-agreement")!, form)).toBe("DPA-Acme-Inc-Globex.pdf");
  });

  it("drops accents instead of turning accented letters into hyphens", () => {
    const form = filledNda();
    form.party1.company = "Société Générale";
    form.party2.company = "Łódź Straße ApS";
    expect(pdfFileName(NDA, form)).toBe("Mutual-NDA-Societe-Generale-Lodz-Strasse-ApS.pdf");
  });
});

describe("PDF font coverage", () => {
  const fontsDir = path.join(import.meta.dirname, "../../public/fonts");

  it("matches the characters the font files can draw", () => {
    const [regular, bold, italic] = Object.values(PDF_FONT_FILES).map(
      (file) => new Set((fontkit.openSync(path.join(fontsDir, file)) as fontkit.Font).characterSet),
    );
    for (const [start, end] of PDF_FONT_RANGES) {
      for (let cp = start; cp <= end; cp++) {
        expect(regular.has(cp) && bold.has(cp) && italic.has(cp), `U+${cp.toString(16)}`).toBe(true);
      }
    }
  });

  it.each(DOCUMENTS.map((doc) => [doc.id, doc] as const))("covers the legal text and cover page of %s", (id, doc) => {
    expect(unsupportedPdfChars(termsMarkdown(id), textOf(buildCoverPage(doc, defaultForm(doc))))).toEqual([]);
  });

  it("covers accented names and reports characters it cannot draw", () => {
    expect(unsupportedPdfChars("Łukasz Żak", "Ştefan SRL", "Société Générale", "Ζωή", "Дмитрий", "Line 1\nLine 2")).toEqual([]);
    expect(unsupportedPdfChars("李明 Co.", "Hi 😀")).toEqual(["李", "明", "😀"]);
  });
});
