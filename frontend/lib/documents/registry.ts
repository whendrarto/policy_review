import catalog from "../../../templates/catalog.json";
import documents from "../../../templates/documents.json";
import type { DocumentDef, DocumentForm, FieldDef, FieldValue, Party } from "./types";

// The documents the app can draft: the fields in templates/documents.json joined with their
// details from templates/catalog.json. The backend reads the same two files.

export const LICENSE = catalog.license;

export const DOCUMENTS: DocumentDef[] = documents.documents.map((doc) => {
  const entry = catalog.templates.find((template) => template.id === doc.id);
  if (!entry) throw new Error(`${doc.id} is not in catalog.json`);
  return {
    ...(doc as Omit<DocumentDef, "name" | "description" | "version" | "canonicalUrl">),
    name: entry.name,
    description: entry.description,
    version: entry.version,
    canonicalUrl: entry.canonical_url,
  };
});

export function getDocument(id: string | null | undefined): DocumentDef | undefined {
  return DOCUMENTS.find((doc) => doc.id === id);
}

/** A field's value in a new document. */
export function initialValue(field: FieldDef): FieldValue {
  return field.default ?? (field.kind === "choice" ? (field.options?.[0] ?? "") : "");
}

const emptyParty = (): Party => ({ name: "", title: "", company: "", noticeAddress: "" });

export function defaultForm(doc: DocumentDef): DocumentForm {
  return {
    values: Object.fromEntries(doc.fields.map((field) => [field.key, initialValue(field)])),
    party1: emptyParty(),
    party2: emptyParty(),
  };
}

/** The form with blank dates showing `today`, which they follow until a date is chosen. */
export function resolveForm(doc: DocumentDef, form: DocumentForm, today: string): DocumentForm {
  const values = { ...form.values };
  for (const field of doc.fields) {
    if (field.kind === "date" && !values[field.key]) values[field.key] = today;
  }
  return { ...form, values };
}

/** Everything the user typed, for checking that the PDF can print it. */
export function formTexts(form: DocumentForm): string[] {
  return [...Object.values(form.values).map(String), ...[form.party1, form.party2].flatMap((party) => Object.values(party))];
}
