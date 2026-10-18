"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ChatError, errorMessageFor, sendChat, type ChatMessage } from "@/lib/chat/client";
import { GREETING, applyChatResult, toWireForm, type ChatUpdates, type Draft } from "@/lib/documents/chat";
import { buildDocument, countBlankFields, pdfFileName } from "@/lib/documents/document";
import { unsupportedPdfChars } from "@/lib/documents/pdfFont";
import { DOCUMENTS, formTexts, resolveForm } from "@/lib/documents/registry";
import { loadStandardTerms } from "@/lib/documents/terms";
import { subscribeToDateChange, todayIso } from "@/lib/documents/today";
import type { Block } from "@/lib/documents/types";
import { ChatPanel } from "./ChatPanel";
import { DocumentPreview } from "./DocumentPreview";

/** The Standard Terms of a document: null while they download, "failed" if they couldn't. */
function useStandardTerms(id: string | undefined): Block[] | null | "failed" {
  const [loaded, setLoaded] = useState<{ id: string; terms: Block[] | "failed" } | null>(null);
  useEffect(() => {
    if (!id) return;
    let current = true;
    loadStandardTerms(id).then(
      (terms) => current && setLoaded({ id, terms }),
      (err: unknown) => {
        console.error(err);
        if (current) setLoaded({ id, terms: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [id]);
  return loaded && loaded.id === id ? loaded.terms : null;
}

export function DocumentCreator() {
  // Blank dates follow today until the AI sets one. The date is read on the client only, so
  // the prerendered page (built on another day) hydrates without a mismatch.
  const today = useSyncExternalStore(subscribeToDateChange, () => todayIso(), () => "");
  const [draft, setDraft] = useState<Draft>(null);
  const doc = draft?.doc;

  // The conversation lives only in this page; reloading starts a new draft.
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // `history` ends with the user's message. The input can't send while a reply is pending,
  // so `draft` is still current when the reply arrives.
  async function askAssistant(history: ChatMessage[]) {
    setChatPending(true);
    setChatError(null);
    try {
      const result = await sendChat<Record<string, unknown>, ChatUpdates>({
        messages: history,
        documentType: draft?.doc.id ?? null,
        form: draft ? toWireForm(draft.form) : {},
        today: today || todayIso(),
      });
      setMessages([...history, { role: "assistant", content: result.reply }]);
      setDraft(applyChatResult(draft, result));
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

  const standardTerms = useStandardTerms(doc?.id);
  const form = draft && resolveForm(draft.doc, draft.form, today);
  const blocks = doc && form && Array.isArray(standardTerms) ? buildDocument(doc, form, standardTerms) : null;
  const blankFields = blocks ? countBlankFields(blocks) : 0;
  const unprintable = form ? unsupportedPdfChars(...formTexts(form)) : [];

  async function download() {
    if (!doc || !form || !blocks) return;
    setPdfDownloading(true);
    setPdfError(null);
    try {
      // react-pdf is large and browser-only, so load it on demand.
      const [{ pdf }, { DocumentPdf, registerPdfFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./DocumentPdf")]);
      registerPdfFonts((file) => new URL(`/fonts/${file}`, window.location.href).href);
      const blob = await pdf(<DocumentPdf title={doc.name} blocks={blocks} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName(doc, form);
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
          <h1 className="text-lg font-semibold text-navy">{doc ? doc.name : "Document Creator"}</h1>
          <p className="text-xs text-muted">{doc ? `Common Paper ${doc.shortName} v${doc.version}` : "Tell the assistant what you need"}</p>
        </div>
        {doc && (
          <div className="flex items-center gap-3">
            {blocks && (
              <span className={`text-xs ${blankFields ? "text-amber-700" : "text-emerald-700"}`} aria-live="polite">
                {blankFields ? `${blankFields} field${blankFields === 1 ? "" : "s"} still blank` : "All fields filled in"}
              </span>
            )}
            <button
              type="button"
              onClick={download}
              disabled={pdfDownloading || !blocks}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 disabled:opacity-60"
            >
              {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        )}
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
          {blocks ? (
            <DocumentPreview blocks={blocks} />
          ) : standardTerms === "failed" ? (
            <p role="alert" className="text-center text-sm text-red-700">
              Could not load the {doc?.name}. Check your connection and reload the page.
            </p>
          ) : doc ? (
            <p className="text-center text-sm text-muted">Loading the {doc.name}…</p>
          ) : (
            <DocumentList />
          )}
        </main>
      </div>
    </div>
  );
}

/** What the user can draft, shown until a document is chosen. */
function DocumentList() {
  return (
    <section className="mx-auto max-w-2xl">
      <h2 className="text-base font-semibold text-navy">Documents you can draft</h2>
      <p className="mt-1 text-sm text-muted">Tell the assistant about your deal and it will pick the right one with you.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {DOCUMENTS.map((doc) => (
          <li key={doc.id} className="rounded-md border-l-4 border-primary bg-white p-3 shadow-xs">
            <p className="text-sm font-medium text-navy">{doc.name}</p>
            <p className="mt-1 text-xs text-muted">{doc.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
