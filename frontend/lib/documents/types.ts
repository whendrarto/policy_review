// Document model shared by the HTML preview and the PDF renderer.

export type Run =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }
  // A value the user enters on the form; `filled` is false while it still shows the template placeholder.
  | { type: "field"; text: string; filled: boolean }
  // A reference in the Standard Terms to a cover page term, e.g. "Purpose".
  | { type: "variable"; text: string };

export type PartyRow = { label: string; note?: string; values: [Run[], Run[]] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; runs: Run[] }
  | { type: "note"; text: string }
  // A clause of the Standard Terms. `number` is its full section number ("5.3.a"), `label`
  // what is printed before it ("1.", "5.3", "a.") and `level` how deeply it is nested (0 to 3).
  | { type: "numbered"; number: string; label: string; level: number; runs: Run[] }
  | { type: "option"; checked: boolean; runs: Run[] }
  // A boxed notice, such as the draft disclaimer on every cover page.
  | { type: "notice"; title: string; text: string }
  // Signature table; `intro` is the sentence kept on the same page as the table.
  | { type: "parties"; intro: Run[]; headers: [string, string]; rows: PartyRow[] }
  | { type: "pageBreak" };

// The fillable fields of each document, from templates/documents.json (see its "about").

export type FieldKind = "text" | "date" | "years" | "choice";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  description: string;
  placeholder?: string;
  group?: string;
  // A blank optional field reads "None." rather than counting as missing.
  optional?: boolean;
  default?: string | number;
  // Kept when the user switches to another document with a field of the same key.
  carry?: boolean;
  options?: string[];
};

export type DocumentDef = {
  id: string;
  shortName: string;
  // The roles of party1 and party2, e.g. Provider and Customer.
  partyRoles: [string, string];
  fields: FieldDef[];
  // From templates/catalog.json.
  name: string;
  description: string;
  version: string;
  canonicalUrl: string;
};

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type FieldValue = string | number;

// `values` holds a value for each field, by key; a date is yyyy-mm-dd, or blank for today.
export type DocumentForm = {
  values: Record<string, FieldValue>;
  party1: Party;
  party2: Party;
};
