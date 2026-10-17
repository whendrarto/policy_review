import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCoverPage, buildNdaDocument, countBlankFields, formatDate, pdfFileName } from "./document";
import { parseInline, parseStandardTerms } from "./parse";
import { defaultForm, type Block, type NdaForm } from "./types";

const termsMarkdown = readFileSync(path.join(import.meta.dirname, "../../../templates/mutual-nda/standard-terms.md"), "utf8");

function filledForm(): NdaForm {
  const party = (n: number) => ({ name: `Signer ${n}`, title: "CEO", company: `Company ${n}`, noticeAddress: `legal@company${n}.com` });
  return {
    ...defaultForm(),
    effectiveDate: "2026-10-17",
    governingLaw: "Delaware",
    jurisdiction: "courts located in New Castle, DE",
    party1: party(1),
    party2: party(2),
  };
}

const textOf = (blocks: Block[]) =>
  blocks
    .flatMap((b) => ("runs" in b ? b.runs : b.type === "parties" ? b.rows.flatMap((r) => r.values.flat()) : []))
    .map((r) => r.text)
    .join("");

describe("parseInline", () => {
  it("splits bold, variables and links", () => {
    expect(parseInline('the **MNDA** for the <span class="coverpage_link">Purpose</span>, see [site](https://x.y).')).toEqual([
      { type: "text", text: "the " },
      { type: "bold", text: "MNDA" },
      { type: "text", text: " for the " },
      { type: "variable", text: "Purpose" },
      { type: "text", text: ", see " },
      { type: "link", text: "site", href: "https://x.y" },
      { type: "text", text: "." },
    ]);
  });
});

describe("parseStandardTerms", () => {
  const blocks = parseStandardTerms(termsMarkdown);

  it("parses the heading, the 11 clauses and the license footer", () => {
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Standard Terms" });
    expect(blocks.filter((b) => b.type === "numbered").map((b) => b.type === "numbered" && b.number)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i + 1)),
    );
    expect(blocks.at(-1)?.type).toBe("paragraph");
  });

  it("keeps the legal text verbatim apart from markup", () => {
    const plain = termsMarkdown
      .replace(/<[^>]+>|\*\*|^#+ |^\d+\. /gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, "");
    expect(blocks.map((b) => (b.type === "heading" ? b.text : textOf([b]))).join("").replace(/\s+/g, "")).toBe(plain);
  });

  it("handles CRLF line endings", () => {
    expect(parseStandardTerms(termsMarkdown.replace(/\n/g, "\r\n"))).toEqual(blocks);
  });
});

describe("buildCoverPage", () => {
  it("fills in the form values", () => {
    const text = textOf(buildCoverPage(filledForm()));
    expect(text).toContain("October 17, 2026");
    expect(text).toContain("Delaware");
    expect(text).toContain("courts located in New Castle, DE");
    expect(text).toContain("Company 2");
    expect(text).toContain("None.");
  });

  it("shows template placeholders for blank fields", () => {
    const blocks = buildCoverPage(defaultForm());
    const text = textOf(blocks);
    expect(text).toContain("[Fill in state]");
    expect(text).toContain("[Today’s date]");
    // Effective Date, Governing Law, Jurisdiction and 4 fields for each party.
    expect(countBlankFields(blocks)).toBe(11);
    expect(countBlankFields(buildCoverPage(filledForm()))).toBe(0);
  });

  it("ticks the chosen term options and pluralises years", () => {
    const options = buildCoverPage({ ...filledForm(), mndaTermYears: 2, confidentialityTerm: "perpetual" }).filter(
      (b) => b.type === "option",
    );
    expect(options.map((o) => o.checked)).toEqual([true, false, false, true]);
    expect(textOf([options[0]])).toBe("Expires 2 years from Effective Date.");
  });

  it("treats an invalid year count as blank", () => {
    expect(textOf(buildCoverPage({ ...filledForm(), mndaTermYears: NaN }))).toContain("Expires [1 year(s)] from");
  });

  it("does not count blanks in options that are not selected", () => {
    const form = { ...filledForm(), mndaTermYears: NaN, confidentialityYears: 0 };
    expect(countBlankFields(buildCoverPage(form))).toBe(2);
    expect(countBlankFields(buildCoverPage({ ...form, mndaTerm: "untilTerminated", confidentialityTerm: "perpetual" }))).toBe(0);
  });

  it("keeps the signing sentence with the signature table", () => {
    const parties = buildCoverPage(filledForm()).find((b) => b.type === "parties");
    expect(parties && textOf([{ type: "paragraph", runs: parties.intro }])).toMatch(/^By signing this Cover Page/);
  });
});

describe("buildNdaDocument", () => {
  it("puts the Standard Terms after the Cover Page on a new page", () => {
    const terms = parseStandardTerms(termsMarkdown);
    const doc = buildNdaDocument(filledForm(), terms);
    const pageBreak = doc.findIndex((b) => b.type === "pageBreak");
    expect(doc.slice(pageBreak + 1)).toEqual(terms);
  });
});

describe("formatDate", () => {
  it("formats ISO dates without time zone drift and rejects invalid input", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("")).toBe("");
  });
});

describe("pdfFileName", () => {
  it("uses the company names", () => {
    const form = filledForm();
    form.party1.company = "Acme, Inc.";
    form.party2.company = "Globex";
    expect(pdfFileName(form)).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(pdfFileName(defaultForm())).toBe("Mutual-NDA.pdf");
  });
});
