"use client";

import { useState, useSyncExternalStore } from "react";
import { ChatError, errorMessageFor, sendChat, type ChatMessage } from "@/lib/chat/client";
import { NDA_GREETING, applyNdaUpdates, type NdaUpdates } from "@/lib/nda/chat";
import { buildNdaDocument, countBlankFields, pdfFileName } from "@/lib/nda/document";
import { unsupportedPdfChars } from "@/lib/nda/pdfFont";
import { subscribeToDateChange, todayIso } from "@/lib/nda/today";
import { defaultForm, type Block, type NdaForm } from "@/lib/nda/types";
import { ChatPanel } from "./ChatPanel";
import { NdaPreview } from "./NdaPreview";

export function NdaCreator({ standardTerms }: { standardTerms: Block[] }) {
  // The Effective Date follows today until the AI sets one. The date is read on the
  // client only, so the prerendered page (built on another day) hydrates without a mismatch.
  const today = useSyncExternalStore(subscribeToDateChange, () => todayIso(), () => "");
  const [draft, setDraft] = useState<NdaForm>(defaultForm);
  const [chosenEffectiveDate, setChosenEffectiveDate] = useState<string | null>(null);
  const form = { ...draft, effectiveDate: chosenEffectiveDate ?? today };

  function updateForm(next: NdaForm) {
    if (next.effectiveDate !== form.effectiveDate) setChosenEffectiveDate(next.effectiveDate);
    setDraft(next);
  }

  // The conversation lives only in this page; reloading starts a new draft.
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: NDA_GREETING }]);
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // `history` ends with the user's message. The input can't send while a reply is pending,
  // so `form` is still current when the reply arrives.
  async function askAssistant(history: ChatMessage[]) {
    setChatPending(true);
    setChatError(null);
    try {
      const { reply, updates } = await sendChat<NdaForm, NdaUpdates>({ messages: history, form, today: today || todayIso() });
      setMessages([...history, { role: "assistant", content: reply }]);
      updateForm(applyNdaUpdates(form, updates));
    } catch (err) {
      // sendChat reports its own failures as ChatError; anything else is a bug here.
      if (err instanceof ChatError) setChatError(err.message);
      else {
        console.error(err);
        setChatError(errorMessageFor(500));
      }
    } finally {
      setChatPending(false);
    }
  }

  function sendMessage(text: string) {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    void askAssistant(history);
  }

  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const blocks = buildNdaDocument(form, standardTerms);
  const blankFields = countBlankFields(blocks);
  const unprintable = unsupportedPdfChars(
    form.purpose,
    form.governingLaw,
    form.jurisdiction,
    form.modifications,
    ...[form.party1, form.party2].flatMap((party) => Object.values(party)),
  );

  async function download() {
    setPdfDownloading(true);
    setPdfError(null);
    try {
      // react-pdf is large and browser-only, so load it on demand.
      const [{ pdf }, { NdaPdf, registerPdfFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./NdaPdf")]);
      registerPdfFonts((file) => new URL(`/fonts/${file}`, window.location.href).href);
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
      setPdfError("Could not generate the PDF. Please try again.");
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-navy">Mutual NDA Creator</h1>
          <p className="text-xs text-muted">Common Paper Mutual NDA v1.0</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${blankFields ? "text-amber-700" : "text-emerald-700"}`} aria-live="polite">
            {blankFields ? `${blankFields} field${blankFields === 1 ? "" : "s"} still blank` : "All fields filled in"}
          </span>
          <button
            type="button"
            onClick={download}
            disabled={pdfDownloading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
        {unprintable.length > 0 && (
          <p role="alert" className="w-full text-sm text-amber-800">
            These characters can’t be printed in the PDF and will be missing from it: {unprintable.join(" ")}
          </p>
        )}
        {pdfError && (
          <p role="alert" className="w-full text-sm text-red-700">
            {pdfError}
          </p>
        )}
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(340px,440px)_1fr]">
        <aside className="flex flex-col border-zinc-200 bg-white lg:min-h-0 lg:border-r" aria-label="Chat with the drafting assistant">
          <ChatPanel
            messages={messages}
            pending={chatPending}
            error={chatError}
            onSend={sendMessage}
            onRetry={() => void askAssistant(messages)}
          />
        </aside>
        <main className="bg-zinc-100 px-4 py-8 lg:overflow-y-auto" aria-label="Document preview">
          <NdaPreview blocks={blocks} />
        </main>
      </div>
    </div>
  );
}
