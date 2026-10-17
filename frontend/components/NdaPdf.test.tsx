import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNdaDocument } from "@/lib/nda/document";
import { loadStandardTerms } from "@/lib/nda/template";
import { defaultForm, type NdaForm } from "@/lib/nda/types";
import { NdaPdf, registerPdfFonts } from "./NdaPdf";

registerPdfFonts((file) => path.join(import.meta.dirname, "../public/fonts", file));

function render(form: NdaForm) {
  return renderToBuffer(<NdaPdf blocks={buildNdaDocument(form, loadStandardTerms())} />);
}

const pageCount = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;

describe("NdaPdf", () => {
  afterEach(() => vi.restoreAllMocks());

  it("embeds the Tinos font instead of the Latin-1-only built-in fonts", async () => {
    const form = defaultForm();
    form.party1 = { name: "Łukasz Żak", title: "Prezes", company: "Ştefan SRL", noticeAddress: "legal@example.pl" };
    const pdf = (await render(form)).toString("latin1");
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Tinos-Regular/);
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Tinos-Bold/);
    expect(pdf).not.toMatch(/\/BaseFont \/Times/);
  });

  it("lets a signature table taller than a page continue on the next page", async () => {
    const warn = vi.spyOn(console, "warn");
    const address = Array.from({ length: 60 }, (_, i) => `Address line ${i + 1}`).join("\n");
    const form = defaultForm();
    form.party1 = { ...form.party1, noticeAddress: address };
    form.party2 = { ...form.party2, noticeAddress: address };

    const pdf = await render(form);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("can't wrap between pages"));
    expect(pageCount(pdf)).toBeGreaterThan(pageCount(await render(defaultForm())));
  });
});
