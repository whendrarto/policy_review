import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDocument } from "@/lib/documents/document";
import { defaultForm, getDocument } from "@/lib/documents/registry";
import { loadStandardTerms } from "@/lib/documents/terms";
import type { DocumentDef, DocumentForm } from "@/lib/documents/types";
import { DocumentPdf, registerPdfFonts } from "./DocumentPdf";

registerPdfFonts((file) => path.join(import.meta.dirname, "../public/fonts", file));

const NDA = getDocument("mutual-nda")!;

async function render(doc: DocumentDef, form: DocumentForm) {
  return renderToBuffer(<DocumentPdf title={doc.name} blocks={buildDocument(doc, form, await loadStandardTerms(doc.id))} />);
}

const pageCount = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;

describe("DocumentPdf", () => {
  afterEach(() => vi.restoreAllMocks());

  it("embeds the Tinos font instead of the Latin-1-only built-in fonts", async () => {
    const form = defaultForm(NDA);
    form.party1 = { name: "Łukasz Żak", title: "Prezes", company: "Ştefan SRL", noticeAddress: "legal@example.pl" };
    const pdf = (await render(NDA, form)).toString("latin1");
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Tinos-Regular/);
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Tinos-Bold/);
    expect(pdf).not.toMatch(/\/BaseFont \/Times/);
  });

  it("lets a signature table taller than a page continue on the next page", async () => {
    const warn = vi.spyOn(console, "warn");
    const address = Array.from({ length: 60 }, (_, i) => `Address line ${i + 1}`).join("\n");
    const form = defaultForm(NDA);
    form.party1 = { ...form.party1, noticeAddress: address };
    form.party2 = { ...form.party2, noticeAddress: address };

    const pdf = await render(NDA, form);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("can't wrap between pages"));
    expect(pageCount(pdf)).toBeGreaterThan(pageCount(await render(NDA, defaultForm(NDA))));
  });

  it("renders a document with four levels of nested clauses", async () => {
    const dpa = getDocument("data-processing-agreement")!;
    expect(pageCount(await render(dpa, defaultForm(dpa)))).toBeGreaterThan(3);
  });
});
