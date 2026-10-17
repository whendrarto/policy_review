// Document model shared by the HTML preview and the PDF renderer.

export type Run =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }
  // A value the user enters on the form; `filled` is false while it still shows the template placeholder.
  | { type: "field"; text: string; filled: boolean }
  // A reference in the Standard Terms to a Cover Page term, e.g. "Purpose".
  | { type: "variable"; text: string };

export type PartyRow = { label: string; note?: string; values: [Run[], Run[]] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; runs: Run[] }
  | { type: "note"; text: string }
  | { type: "numbered"; number: string; runs: Run[] }
  | { type: "option"; checked: boolean; runs: Run[] }
  // Signature table; `intro` is the sentence kept on the same page as the table.
  | { type: "parties"; intro: Run[]; headers: [string, string]; rows: PartyRow[] }
  | { type: "pageBreak" };

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaForm = {
  purpose: string;
  effectiveDate: string; // yyyy-mm-dd
  mndaTerm: "expires" | "untilTerminated";
  mndaTermYears: number;
  confidentialityTerm: "years" | "perpetual";
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

export function defaultForm(): NdaForm {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: "",
    mndaTerm: "expires",
    mndaTermYears: 1,
    confidentialityTerm: "years",
    confidentialityYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: { ...emptyParty },
    party2: { ...emptyParty },
  };
}
