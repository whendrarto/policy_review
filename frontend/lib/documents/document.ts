import { buildCoverPage } from "./coverPage";
import type { Block, DocumentDef, DocumentForm, Run } from "./types";

/** The cover page followed by the Standard Terms, unchanged, on a new page. */
export function buildDocument(doc: DocumentDef, form: DocumentForm, standardTerms: Block[]): Block[] {
  return [...buildCoverPage(doc, form), { type: "pageBreak" }, ...standardTerms];
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

export function pdfFileName(doc: DocumentDef, form: DocumentForm): string {
  const slug = (value: string) =>
    value
      .trim()
      // "Société Générale" → "Societe Generale", not "Soci-t-G-n-rale".
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/./g, (char) => TRANSLITERATIONS[char] ?? char)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [slug(doc.shortName), slug(form.party1.company), slug(form.party2.company)].filter(Boolean);
  return `${parts.join("-")}.pdf`;
}
