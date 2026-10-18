"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChatError, errorMessageFor, sendChat, type ChatMessage } from "@/lib/chat/client";
import { createAutosaver, type SaveStatus } from "@/lib/documents/autosave";
import { GREETING, applyChatResult, toWireForm, type ChatUpdates, type Draft } from "@/lib/documents/chat";
import { buildDocument, countBlankFields } from "@/lib/documents/document";
import { downloadPdf } from "@/lib/documents/pdf";
import { unsupportedPdfChars } from "@/lib/documents/pdfFont";
import { DOCUMENTS, formTexts, resolveForm } from "@/lib/documents/registry";
import { createSaved, updateSaved } from "@/lib/documents/saved";
import { loadStandardTerms } from "@/lib/documents/terms";
import { subscribeToDateChange, todayIso } from "@/lib/documents/today";
import type { Block } from "@/lib/documents/types";
import { ChatPanel } from "./ChatPanel";
import { DocumentPreview } from "./DocumentPreview";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";

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

/** A saved document reopened in the editor. */
export type SavedDraft = { id: number; draft: Draft; messages: ChatMessage[] };

export function DocumentCreator({ initial, onCreated }: { initial?: SavedDraft; onCreated?: (id: number) => void }) {
  // Blank dates follow today until the AI sets one. The date is read on the client only, so
  // the prerendered page (built on another day) hydrates without a mismatch.
  const today = useSyncExternalStore(subscribeToDateChange, () => todayIso(), () => "");
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? null);
  const doc = draft?.doc;

  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages.length ? initial.messages : [{ role: "assistant", content: GREETING }]);
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Once a document is chosen, the draft and the conversation are saved after every reply.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initial ? "saved" : "idle");
  const [autosaver] = useState(() =>
    createAutosaver({ create: createSaved, update: updateSaved, onCreated, onStatus: setSaveStatus, id: initial?.id }),
  );

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
      const nextMessages: ChatMessage[] = [...history, { role: "assistant", content: result.reply }];
      const nextDraft = applyChatResult(draft, result);
      setMessages(nextMessages);
      setDraft(nextDraft);
      if (nextDraft) void autosaver.save({ documentType: nextDraft.doc.id, form: toWireForm(nextDraft.form), messages: nextMessages });
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
      await downloadPdf(doc, form, blocks);
    } catch (err) {
      console.error(err);
      setPdfError("Could not generate the PDF. Please try again.");
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-xs text-zinc-600">
            <Link href="/documents/" className="hover:text-navy hover:underline">
              My documents
            </Link>
            <span aria-hidden> / </span>
            <span>{doc ? doc.shortName : "New document"}</span>
          </nav>
          <h1 className="truncate text-lg font-semibold text-navy">{doc ? doc.name : "New document"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {doc && <SaveIndicator status={saveStatus} onRetry={() => void autosaver.retry()} />}
          {blocks && (
            <span className={`text-xs font-medium ${blankFields ? "text-amber-700" : "text-emerald-700"}`} aria-live="polite">
              {blankFields ? `${blankFields} field${blankFields === 1 ? "" : "s"} to fill in` : "All fields filled in"}
            </span>
          )}
          {doc && (
            <Button variant="submit" onClick={download} loading={pdfDownloading} disabled={!blocks}>
              {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
            </Button>
          )}
        </div>
        {unprintable.length > 0 && (
          <Alert tone="warning" className="w-full">
            These characters can’t be printed in the PDF and will be missing from it: {unprintable.join(" ")}
          </Alert>
        )}
        {pdfError && <Alert className="w-full">{pdfError}</Alert>}
      </div>

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
            <Alert className="mx-auto max-w-md text-center">Could not load the {doc?.name}. Check your connection and reload the page.</Alert>
          ) : doc ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted" role="status">
              <Spinner className="size-4 text-primary" /> Loading the {doc.name}…
            </p>
          ) : (
            <DocumentList onPick={(name) => sendMessage(`I’d like to draft ${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}.`)} disabled={chatPending} />
          )}
        </main>
      </div>
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <span className="flex items-center gap-2 text-xs font-medium text-red-700" role="alert">
        Not saved
        <button type="button" onClick={onRetry} className="underline hover:no-underline">
          Retry
        </button>
      </span>
    );
  }
  const label = { idle: "Not saved yet", saving: "Saving…", saved: "Saved" }[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-600" aria-live="polite">
      {status === "saving" ? <Spinner className="size-3" /> : <span className={`size-2 rounded-full ${status === "saved" ? "bg-emerald-500" : "bg-zinc-300"}`} />}
      {label}
    </span>
  );
}

/** What the user can draft, shown until a document is chosen; picking one asks the assistant for it. */
function DocumentList({ onPick, disabled }: { onPick: (name: string) => void; disabled: boolean }) {
  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="text-lg font-semibold text-navy">What would you like to draft?</h2>
      <p className="mt-1 text-sm text-muted">Describe your deal in the chat, or pick a document to start with.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {DOCUMENTS.map((doc) => (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => onPick(doc.name)}
              disabled={disabled}
              className="h-full w-full rounded-lg border border-zinc-200 border-l-4 border-l-primary bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-navy">{doc.name}</span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-600">{doc.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
