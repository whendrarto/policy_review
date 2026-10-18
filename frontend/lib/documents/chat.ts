import { formatDate, isValidYears } from "./format";
import { DOCUMENTS, defaultForm, getDocument } from "./registry";
import type { DocumentDef, DocumentForm, FieldDef, FieldValue, Party } from "./types";

// The AI chat's side of the documents: the opening message, how the fields the AI learned
// are merged into the form, and switching to the document the AI settled on.

const documentNames = DOCUMENTS.map((doc) => doc.shortName);

export const GREETING = `Hi! I’ll help you draft a legal agreement. What would you like to draft? I can do a ${documentNames.slice(0, -1).join(", ")} or ${documentNames.at(-1)}. Tell me a little about your deal and I’ll suggest the right one.`;

/** The fields the AI set this turn, by key; anything missing is unchanged. */
export type ChatUpdates = Record<string, unknown> & { party1?: unknown; party2?: unknown };

/** The document being drafted, or null until the AI and the user have chosen one. */
export type Draft = { doc: DocumentDef; form: DocumentForm } | null;

const PARTY_FIELDS = ["name", "title", "company", "noticeAddress"] as const;

const isText = (value: unknown): value is string => typeof value === "string";
// formatDate also accepts years beyond 9999 (for date inputs); the AI must send yyyy-mm-dd.
const isIsoDate = (value: unknown): value is string => isText(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatDate(value) !== "";

function isValid(field: FieldDef, value: unknown): value is FieldValue {
  switch (field.kind) {
    case "text":
      return isText(value);
    case "date":
      return isIsoDate(value);
    case "years":
      return isValidYears(value);
    case "choice":
      return isText(value) && (field.options ?? []).includes(value);
  }
}

function mergeParty(party: Party, updates: unknown): Party {
  if (typeof updates !== "object" || updates === null) return party;
  const next = { ...party };
  for (const key of PARTY_FIELDS) {
    const value = (updates as Record<string, unknown>)[key];
    if (isText(value)) next[key] = value;
  }
  return next;
}

/**
 * Applies the AI's updates to the form. The backend already checks them, but they are
 * model output, so anything the document can't use is ignored here too.
 */
export function applyUpdates(doc: DocumentDef, form: DocumentForm, updates: ChatUpdates): DocumentForm {
  const values = { ...form.values };
  for (const field of doc.fields) {
    const value = updates[field.key];
    if (isValid(field, value)) values[field.key] = value;
  }
  return { values, party1: mergeParty(form.party1, updates.party1), party2: mergeParty(form.party2, updates.party2) };
}

/**
 * Applies a chat reply to the draft. When the backend reports a new document, the draft starts
 * that document afresh: its updates then include the values carried over from the old one.
 */
export function applyChatResult(draft: Draft, result: { documentType?: string | null; updates: ChatUpdates }): Draft {
  if (result.documentType && result.documentType !== draft?.doc.id) {
    const doc = getDocument(result.documentType);
    if (!doc) return draft;
    return { doc, form: applyUpdates(doc, defaultForm(doc), result.updates) };
  }
  return draft && { doc: draft.doc, form: applyUpdates(draft.doc, draft.form, result.updates) };
}

/** The form as the backend expects it: the field values plus party1 and party2. */
export function toWireForm(form: DocumentForm): Record<string, unknown> {
  return { ...form.values, party1: form.party1, party2: form.party2 };
}
