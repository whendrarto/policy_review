import { formatDate, isValidYears } from "./document";
import type { NdaForm, Party } from "./types";

// The AI chat's side of the Mutual NDA: the opening message and how the fields the AI
// learned are merged into the form.

export const NDA_GREETING =
  "Hi! I’ll help you draft a Mutual Non-Disclosure Agreement. To start, who are the two parties? Tell me each company, and if you know them, the name, title and email or address of the person signing for it.";

/** The fields the AI set this turn; anything missing is unchanged. */
export type NdaUpdates = Partial<Omit<NdaForm, "party1" | "party2">> & {
  party1?: Partial<Party>;
  party2?: Partial<Party>;
};

const TEXT_FIELDS = ["purpose", "governingLaw", "jurisdiction", "modifications"] as const;
const YEAR_FIELDS = ["mndaTermYears", "confidentialityYears"] as const;
const PARTY_FIELDS = ["name", "title", "company", "noticeAddress"] as const;

const isText = (value: unknown): value is string => typeof value === "string";
const isYears = (value: unknown): value is number => typeof value === "number" && isValidYears(value);
// formatDate also accepts years beyond 9999 (for date inputs); the AI must send yyyy-mm-dd.
const isIsoDate = (value: unknown): value is string => isText(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatDate(value) !== "";

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
export function applyNdaUpdates(form: NdaForm, updates: NdaUpdates): NdaForm {
  const next = { ...form };
  for (const key of TEXT_FIELDS) {
    const value = updates[key];
    if (isText(value)) next[key] = value;
  }
  for (const key of YEAR_FIELDS) {
    const value = updates[key];
    if (isYears(value)) next[key] = value;
  }
  if (isIsoDate(updates.effectiveDate)) next.effectiveDate = updates.effectiveDate;
  if (updates.mndaTerm === "expires" || updates.mndaTerm === "untilTerminated") next.mndaTerm = updates.mndaTerm;
  if (updates.confidentialityTerm === "years" || updates.confidentialityTerm === "perpetual") {
    next.confidentialityTerm = updates.confidentialityTerm;
  }
  next.party1 = mergeParty(form.party1, updates.party1);
  next.party2 = mergeParty(form.party2, updates.party2);
  return next;
}
