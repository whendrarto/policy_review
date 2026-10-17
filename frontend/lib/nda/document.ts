import type { Block, NdaForm, Party, PartyRow, Run } from "./types";

// Builds the Cover Page from the form, following templates/mutual-nda/cover-page.md,
// and appends the Standard Terms unchanged. Blank fields show the template's
// bracketed placeholder so the user can see what is still missing.

const STANDARD_TERMS_URL = "https://commonpaper.com/standards/mutual-nda/1.0";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

const text = (value: string): Run => ({ type: "text", text: value });
const bold = (value: string): Run => ({ type: "bold", text: value });

function field(value: string, placeholder: string): Run {
  const trimmed = value.trim();
  return trimmed ? { type: "field", text: trimmed, filled: true } : { type: "field", text: `[${placeholder}]`, filled: false };
}

export const MIN_YEARS = 1;
export const MAX_YEARS = 99;

export function isValidYears(years: number): boolean {
  return Number.isInteger(years) && years >= MIN_YEARS && years <= MAX_YEARS;
}

function yearsField(years: number): Run {
  return field(isValidYears(years) ? `${years} ${years === 1 ? "year" : "years"}` : "", "1 year(s)");
}

/** "2026-01-01" → "January 1, 2026"; "" for anything that isn't a real calendar date. */
export function formatDate(isoDate: string): string {
  // Date inputs allow years beyond 9999, so show those rather than treating them as blank.
  const match = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls over impossible dates (Feb 31 → Mar 3) and maps years below 100 to 19xx.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export function buildCoverPage(form: NdaForm): Block[] {
  const partyRow = (label: string, key: keyof Party, placeholder: string, note?: string): PartyRow => ({
    label,
    note,
    values: [[field(form.party1[key], placeholder)], [field(form.party2[key], placeholder)]],
  });

  return [
    { type: "heading", level: 1, text: "Mutual Non-Disclosure Agreement" },
    { type: "heading", level: 2, text: "USING THIS MUTUAL NON-DISCLOSURE AGREEMENT" },
    {
      type: "paragraph",
      runs: [
        text("This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“"),
        bold("Cover Page"),
        text("”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“"),
        bold("Standard Terms"),
        text("”) identical to those posted at "),
        { type: "link", text: "commonpaper.com/standards/mutual-nda/1.0", href: STANDARD_TERMS_URL },
        text(". Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms."),
      ],
    },

    { type: "heading", level: 3, text: "Purpose" },
    { type: "note", text: "How Confidential Information may be used" },
    { type: "paragraph", runs: [field(form.purpose, "Evaluating whether to enter into a business relationship with the other party.")] },

    { type: "heading", level: 3, text: "Effective Date" },
    { type: "paragraph", runs: [field(formatDate(form.effectiveDate), "Today’s date")] },

    { type: "heading", level: 3, text: "MNDA Term" },
    { type: "note", text: "The length of this MNDA" },
    {
      type: "option",
      checked: form.mndaTerm === "expires",
      runs: [text("Expires "), yearsField(form.mndaTermYears), text(" from Effective Date.")],
    },
    {
      type: "option",
      checked: form.mndaTerm === "untilTerminated",
      runs: [text("Continues until terminated in accordance with the terms of the MNDA.")],
    },

    { type: "heading", level: 3, text: "Term of Confidentiality" },
    { type: "note", text: "How long Confidential Information is protected" },
    {
      type: "option",
      checked: form.confidentialityTerm === "years",
      runs: [
        yearsField(form.confidentialityYears),
        text(" from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws."),
      ],
    },
    { type: "option", checked: form.confidentialityTerm === "perpetual", runs: [text("In perpetuity.")] },

    { type: "heading", level: 3, text: "Governing Law & Jurisdiction" },
    { type: "paragraph", runs: [text("Governing Law: "), field(form.governingLaw, "Fill in state")] },
    {
      type: "paragraph",
      runs: [text("Jurisdiction: "), field(form.jurisdiction, "Fill in city or county and state, i.e. “courts located in New Castle, DE”")],
    },

    { type: "heading", level: 3, text: "MNDA Modifications" },
    { type: "note", text: "List any modifications to the MNDA" },
    // Modifications are optional, so a blank one reads "None." rather than counting as missing.
    { type: "paragraph", runs: [form.modifications.trim() ? field(form.modifications, "") : text("None.")] },

    {
      type: "parties",
      intro: [text("By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.")],
      headers: ["PARTY 1", "PARTY 2"],
      rows: [
        { label: "Signature", values: [[], []] },
        partyRow("Print Name", "name", "Name"),
        partyRow("Title", "title", "Title"),
        partyRow("Company", "company", "Company"),
        partyRow("Notice Address", "noticeAddress", "Email or postal address", "Use either email or postal address"),
        { label: "Date", values: [[], []] },
      ],
    },
    {
      type: "paragraph",
      runs: [
        text("Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under "),
        { type: "link", text: "CC BY 4.0", href: LICENSE_URL },
        text("."),
      ],
    },
  ];
}

export function buildNdaDocument(form: NdaForm, standardTerms: Block[]): Block[] {
  return [...buildCoverPage(form), { type: "pageBreak" }, ...standardTerms];
}

/** The runs of a block's body; for the signature table, its cells. */
export function blockRuns(block: Block): Run[] {
  if (block.type === "parties") return block.rows.flatMap((row) => row.values.flat());
  return "runs" in block ? block.runs : [];
}

/** Number of fields still showing a template placeholder, ignoring options that aren't selected. */
export function countBlankFields(blocks: Block[]): number {
  const runs = blocks.flatMap((block) => (block.type === "option" && !block.checked ? [] : blockRuns(block)));
  return runs.filter((run) => run.type === "field" && !run.filled).length;
}

// Letters that Unicode normalisation doesn't split into a base letter plus an accent.
const TRANSLITERATIONS: Record<string, string> = {
  ł: "l", Ł: "L", ø: "o", Ø: "O", đ: "d", Đ: "D", ı: "i", ß: "ss", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", þ: "th", Þ: "Th",
};

export function pdfFileName(form: NdaForm): string {
  const slug = (value: string) =>
    value
      .trim()
      // "Société Générale" → "Societe Generale", not "Soci-t-G-n-rale".
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/./g, (char) => TRANSLITERATIONS[char] ?? char)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = ["Mutual-NDA", slug(form.party1.company), slug(form.party2.company)].filter(Boolean);
  return `${parts.join("-")}.pdf`;
}
