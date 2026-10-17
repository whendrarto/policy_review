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

function yearsField(years: number): Run {
  const valid = Number.isInteger(years) && years > 0;
  return field(valid ? `${years} ${years === 1 ? "year" : "years"}` : "", "1 year(s)");
}

export function formatDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
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

/** Number of fields still showing a template placeholder, ignoring options that aren't selected. */
export function countBlankFields(blocks: Block[]): number {
  const runs = blocks.flatMap((block) => {
    if (block.type === "parties") return block.rows.flatMap((row) => row.values.flat());
    if (block.type === "option" && !block.checked) return [];
    return "runs" in block ? block.runs : [];
  });
  return runs.filter((run) => run.type === "field" && !run.filled).length;
}

export function pdfFileName(form: NdaForm): string {
  const slug = (value: string) =>
    value
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = ["Mutual-NDA", slug(form.party1.company), slug(form.party2.company)].filter(Boolean);
  return `${parts.join("-")}.pdf`;
}
