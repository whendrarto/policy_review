import { restoreDraft } from "./chat";
import { buildDocument, pdfFileName } from "./document";
import { resolveForm } from "./registry";
import { getSaved } from "./saved";
import { loadStandardTerms } from "./terms";
import { todayIso } from "./today";
import type { Block, DocumentDef, DocumentForm } from "./types";

/** Renders the document as a PDF in the browser and downloads it. */
export async function downloadPdf(doc: DocumentDef, form: DocumentForm, blocks: Block[]): Promise<void> {
  // react-pdf is large and browser-only, so load it on demand.
  const [{ pdf }, { DocumentPdf, registerPdfFonts }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/DocumentPdf")]);
  registerPdfFonts((file) => new URL(`/fonts/${file}`, window.location.href).href);
  const blob = await pdf(<DocumentPdf title={doc.name} blocks={blocks} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFileName(doc, form);
  link.click();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads a saved document's PDF without opening it; blank dates show today, as in the editor. */
export async function downloadSavedPdf(id: number): Promise<void> {
  const saved = await getSaved(id);
  const draft = restoreDraft(saved.documentType, saved.form);
  if (!draft) throw new Error(`Unknown document type ${saved.documentType}`);
  const form = resolveForm(draft.doc, draft.form, todayIso());
  await downloadPdf(draft.doc, form, buildDocument(draft.doc, form, await loadStandardTerms(draft.doc.id)));
}
