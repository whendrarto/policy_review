import { formatDate, isValidYears } from "./format";
import { LICENSE } from "./registry";
import type { Block, DocumentDef, DocumentForm, FieldDef, Party, PartyRow, Run } from "./types";

// Builds a document's cover page from the form. The Mutual NDA follows its template,
// templates/mutual-nda/cover-page.md; the other templates have none, so they get a generated
// Key Terms page in the same style. Blank fields show a bracketed placeholder so the user can
// see what is still missing.

const text = (value: string): Run => ({ type: "text", text: value });
const bold = (value: string): Run => ({ type: "bold", text: value });

function fill(value: string, placeholder: string): Run {
  const trimmed = value.trim();
  return trimmed ? { type: "field", text: trimmed, filled: true } : { type: "field", text: `[${placeholder}]`, filled: false };
}

function yearsField(years: unknown): Run {
  return fill(isValidYears(years) ? `${years} ${years === 1 ? "year" : "years"}` : "", "1 year(s)");
}

const valueOf = (form: DocumentForm, key: string): string => String(form.values[key] ?? "");

const standardTermsLink = (doc: DocumentDef): Run => ({
  type: "link",
  text: doc.canonicalUrl.replace(/^https:\/\//, ""),
  href: doc.canonicalUrl,
});

function attribution(doc: DocumentDef): Block {
  return {
    type: "paragraph",
    runs: [
      text(`Common Paper ${doc.name} (Version ${doc.version}) free to use under `),
      { type: "link", text: LICENSE.name, href: LICENSE.url },
      text("."),
    ],
  };
}

function signatureTable(form: DocumentForm, intro: string, headers: [string, string]): Block {
  const partyRow = (label: string, key: keyof Party, placeholder: string, note?: string): PartyRow => ({
    label,
    note,
    values: [[fill(form.party1[key], placeholder)], [fill(form.party2[key], placeholder)]],
  });
  return {
    type: "parties",
    intro: [text(intro)],
    headers,
    rows: [
      { label: "Signature", values: [[], []] },
      partyRow("Print Name", "name", "Name"),
      partyRow("Title", "title", "Title"),
      partyRow("Company", "company", "Company"),
      partyRow("Notice Address", "noticeAddress", "Email or postal address", "Use either email or postal address"),
      { label: "Date", values: [[], []] },
    ],
  };
}

function buildMutualNdaCoverPage(doc: DocumentDef, form: DocumentForm): Block[] {
  const modifications = valueOf(form, "modifications");
  return [
    { type: "heading", level: 1, text: doc.name },
    { type: "heading", level: 2, text: "USING THIS MUTUAL NON-DISCLOSURE AGREEMENT" },
    {
      type: "paragraph",
      runs: [
        text("This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“"),
        bold("Cover Page"),
        text(`”) and (2) the Common Paper Mutual NDA Standard Terms Version ${doc.version} (“`),
        bold("Standard Terms"),
        text("”) identical to those posted at "),
        standardTermsLink(doc),
        text(". Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms."),
      ],
    },

    { type: "heading", level: 3, text: "Purpose" },
    { type: "note", text: "How Confidential Information may be used" },
    { type: "paragraph", runs: [fill(valueOf(form, "purpose"), "Evaluating whether to enter into a business relationship with the other party.")] },

    { type: "heading", level: 3, text: "Effective Date" },
    { type: "paragraph", runs: [fill(formatDate(valueOf(form, "effectiveDate")), "Today’s date")] },

    { type: "heading", level: 3, text: "MNDA Term" },
    { type: "note", text: "The length of this MNDA" },
    {
      type: "option",
      checked: form.values.mndaTerm === "expires",
      runs: [text("Expires "), yearsField(form.values.mndaTermYears), text(" from Effective Date.")],
    },
    {
      type: "option",
      checked: form.values.mndaTerm === "untilTerminated",
      runs: [text("Continues until terminated in accordance with the terms of the MNDA.")],
    },

    { type: "heading", level: 3, text: "Term of Confidentiality" },
    { type: "note", text: "How long Confidential Information is protected" },
    {
      type: "option",
      checked: form.values.confidentialityTerm === "years",
      runs: [
        yearsField(form.values.confidentialityYears),
        text(" from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws."),
      ],
    },
    { type: "option", checked: form.values.confidentialityTerm === "perpetual", runs: [text("In perpetuity.")] },

    { type: "heading", level: 3, text: "Governing Law & Jurisdiction" },
    { type: "paragraph", runs: [text("Governing Law: "), fill(valueOf(form, "governingLaw"), "Fill in state")] },
    {
      type: "paragraph",
      runs: [text("Jurisdiction: "), fill(valueOf(form, "chosenCourts"), "Fill in city or county and state, i.e. “courts located in New Castle, DE”")],
    },

    { type: "heading", level: 3, text: "MNDA Modifications" },
    { type: "note", text: "List any modifications to the MNDA" },
    // Modifications are optional, so a blank one reads "None." rather than counting as missing.
    { type: "paragraph", runs: [modifications.trim() ? fill(modifications, "") : text("None.")] },

    signatureTable(form, "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.", ["PARTY 1", "PARTY 2"]),
    attribution(doc),
  ];
}

function keyTermValue(field: FieldDef, form: DocumentForm): Run {
  const value = valueOf(form, field.key);
  if (field.kind === "date") return fill(formatDate(value), "Today’s date");
  if (field.optional && !value.trim()) return text("None.");
  return fill(value, field.placeholder ?? `Fill in ${field.label}`);
}

function buildKeyTermsPage(doc: DocumentDef, form: DocumentForm): Block[] {
  const blocks: Block[] = [
    { type: "heading", level: 1, text: doc.name },
    { type: "heading", level: 2, text: `USING THIS ${doc.name.toUpperCase()}` },
    {
      type: "paragraph",
      runs: [
        text(`This ${doc.name} consists of: (1) these Key Terms (“`),
        bold("Key Terms"),
        text(`”) and (2) the Common Paper ${doc.name} Standard Terms Version ${doc.version} (“`),
        bold("Standard Terms"),
        text("”) identical to those posted at "),
        standardTermsLink(doc),
        text(". Any modifications of the Standard Terms should be made in the Key Terms, which will control over conflicts with the Standard Terms."),
      ],
    },
  ];
  let group: string | undefined;
  for (const field of doc.fields) {
    if (field.group && field.group !== group) {
      group = field.group;
      blocks.push({ type: "heading", level: 2, text: group.toUpperCase() });
    }
    blocks.push(
      { type: "heading", level: 3, text: field.label },
      { type: "note", text: field.description },
      { type: "paragraph", runs: [keyTermValue(field, form)] },
    );
  }
  const date = doc.fields.find((field) => field.kind === "date");
  const intro = date
    ? `By signing these Key Terms, each party agrees to enter into this ${doc.name} as of the ${date.label}.`
    : `By signing these Key Terms, each party agrees to be bound by this ${doc.name}.`;
  const [role1, role2] = doc.partyRoles;
  blocks.push(signatureTable(form, intro, [role1.toUpperCase(), role2.toUpperCase()]), attribution(doc));
  return blocks;
}

export function buildCoverPage(doc: DocumentDef, form: DocumentForm): Block[] {
  return doc.id === "mutual-nda" ? buildMutualNdaCoverPage(doc, form) : buildKeyTermsPage(doc, form);
}
