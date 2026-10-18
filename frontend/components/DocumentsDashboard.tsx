"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { downloadSavedPdf } from "@/lib/documents/pdf";
import { getDocument } from "@/lib/documents/registry";
import { deleteSaved, editorHref, listSaved, type SavedSummary } from "@/lib/documents/saved";
import { formatUpdated } from "@/lib/time";
import { Alert } from "./ui/Alert";
import { Button, ButtonLink } from "./ui/Button";
import { LogoMark } from "./ui/Logo";

type ListState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; documents: SavedSummary[] };

/** The signed-in user's saved documents: continue, download or delete each one. */
export function DocumentsDashboard() {
  const { user } = useAuth();
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    listSaved().then(
      (documents) => current && setList({ status: "ready", documents }),
      (err: unknown) => current && setList({ status: "error", message: err instanceof ApiError ? err.message : "Could not load your documents." }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  function retry() {
    setList({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  const removed = (id: number) =>
    setList((state) => (state.status === "ready" ? { ...state, documents: state.documents.filter((doc) => doc.id !== id) } : state));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">My documents</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {user ? `Welcome back, ${user.name.split(/\s+/)[0]}. ` : ""}Pick up where you left off, or start something new.
          </p>
        </div>
        <ButtonLink href="/editor/" variant="submit">
          New document
        </ButtonLink>
      </div>

      <div className="mt-8">
        {list.status === "loading" && <Skeleton />}
        {list.status === "error" && (
          <Alert className="flex items-center justify-between gap-3">
            <span>{list.message}</span>
            <button type="button" onClick={retry} className="font-medium underline hover:no-underline">
              Retry
            </button>
          </Alert>
        )}
        {list.status === "ready" && list.documents.length === 0 && <EmptyState />}
        {list.status === "ready" && list.documents.length > 0 && (
          <ul className="grid gap-3">
            {list.documents.map((saved) => (
              <DocumentRow key={saved.id} saved={saved} onDeleted={() => removed(saved.id)} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function DocumentRow({ saved, onDeleted }: { saved: SavedSummary; onDeleted: () => void }) {
  const doc = getDocument(saved.documentType);
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The Delete button disappears when asked to confirm, so keep keyboard focus in the row.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  async function download() {
    setBusy("download");
    setError(null);
    try {
      await downloadSavedPdf(saved.id);
    } catch (err) {
      console.error(err);
      setError("Could not generate the PDF.");
    }
    setBusy(null);
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      await deleteSaved(saved.id);
      onDeleted();
    } catch (err) {
      console.error(err);
      setError("Could not delete the document.");
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-4 shadow-xs transition hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LogoMark className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={editorHref(saved.id)} className="block truncate font-semibold text-navy hover:text-primary">
            {saved.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-600">
            {doc && <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">{doc.shortName}</span>}
            <span>Edited {formatUpdated(saved.updatedAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-zinc-700" role="status">
                Delete this document?
              </span>
              <Button size="sm" variant="danger" loading={busy === "delete"} onClick={() => void remove()} aria-label={`Yes, delete ${saved.title}`}>
                Delete
              </Button>
              <Button ref={cancelRef} size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <ButtonLink href={editorHref(saved.id)} size="sm" variant="primary" aria-label={`Continue ${saved.title}`}>
                Continue
              </ButtonLink>
              <Button size="sm" variant="outline" loading={busy === "download"} onClick={() => void download()} aria-label={`Download ${saved.title} as PDF`}>
                Download PDF
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirming(true)} aria-label={`Delete ${saved.title}`}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
      {error && <Alert className="mt-3">{error}</Alert>}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent/15">
        <LogoMark className="size-9" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-navy">No documents yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">
        Tell the assistant about your deal and it will draft the right agreement with you. Your documents are saved here as you go.
      </p>
      <ButtonLink href="/editor/" variant="submit" className="mt-6">
        Draft your first document
      </ButtonLink>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading your documents…
      </p>
      <ul className="grid gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <span className="size-10 animate-pulse rounded-lg bg-zinc-100" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
            <span className="block h-3 w-1/4 animate-pulse rounded bg-zinc-100" />
          </span>
        </li>
      ))}
      </ul>
    </>
  );
}
