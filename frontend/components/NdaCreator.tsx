"use client";

import { useState, useSyncExternalStore } from "react";
import { buildNdaDocument, countBlankFields, pdfFileName } from "@/lib/nda/document";
import { defaultForm, type Block, type NdaForm as NdaFormValues } from "@/lib/nda/types";
import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const noSubscription = () => () => {};

export function NdaCreator({ standardTerms }: { standardTerms: Block[] }) {
  // The Effective Date defaults to today. The date is read on the client only, so the
  // prerendered page (built on another day) still hydrates without a mismatch.
  const today = useSyncExternalStore(noSubscription, todayIso, () => "");
  const [draft, setDraft] = useState<NdaFormValues | null>(null);
  const form = draft ?? { ...defaultForm(), effectiveDate: today };
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocks = buildNdaDocument(form, standardTerms);
  const blankFields = countBlankFields(blocks);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      // react-pdf is large and browser-only, so load it on demand.
      const [{ pdf }, { NdaPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./NdaPdf")]);
      const blob = await pdf(<NdaPdf blocks={blocks} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName(form);
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error(err);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Mutual NDA Creator</h1>
          <p className="text-xs text-zinc-500">Common Paper Mutual NDA v1.0</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${blankFields ? "text-amber-700" : "text-emerald-700"}`} aria-live="polite">
            {blankFields ? `${blankFields} field${blankFields === 1 ? "" : "s"} still blank` : "All fields filled in"}
          </span>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
        {error && (
          <p role="alert" className="w-full text-sm text-red-700">
            {error}
          </p>
        )}
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(340px,440px)_1fr]">
        <aside className="border-zinc-200 bg-white px-6 py-6 lg:overflow-y-auto lg:border-r">
          <NdaForm form={form} onChange={setDraft} />
        </aside>
        <main className="bg-zinc-100 px-4 py-8 lg:overflow-y-auto" aria-label="Document preview">
          <NdaPreview blocks={blocks} />
        </main>
      </div>
    </div>
  );
}
