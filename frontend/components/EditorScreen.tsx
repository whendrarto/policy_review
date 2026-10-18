"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { restoreDraft } from "@/lib/documents/chat";
import { editorHref, getSaved } from "@/lib/documents/saved";
import { DocumentCreator, type SavedDraft } from "./DocumentCreator";
import { Button, ButtonLink } from "./ui/Button";
import { PageSpinner } from "./ui/Spinner";

// The editor: /editor/ starts a new document and /editor/?id=N reopens a saved one. The site is
// static, so the id is a query parameter rather than part of the path.

type Loaded = { visit: string } & ({ status: "ready"; saved: SavedDraft } | { status: "notFound" } | { status: "error" });

function parseId(value: string | null): number | null {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

/**
 * The saved document `id`, fetched afresh for each `visit`: coming back to a document (say with
 * the Back button) must show what was saved since, not what was loaded last time.
 */
function useSavedDraft(id: number | null, visit: string): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (id === null) return;
    let current = true;
    getSaved(id).then(
      (saved) => {
        const draft = restoreDraft(saved.documentType, saved.form);
        if (current) setLoaded(draft ? { visit, status: "ready", saved: { id, draft, messages: saved.messages } } : { visit, status: "error" });
      },
      (err: unknown) => current && setLoaded({ visit, status: err instanceof ApiError && err.status === 404 ? "notFound" : "error" }),
    );
    return () => {
      current = false;
    };
  }, [id, visit]);
  return loaded && loaded.visit === visit ? loaded : null;
}

export function EditorScreen() {
  const param = useSearchParams().get("id");
  const id = parseId(param);

  // A new document gets an id when it is first saved, and the URL is updated to it so a reload
  // reopens it. That URL change must not reload the editor, so the id the editor created is
  // remembered; any other change of URL (such as "New document") starts a fresh editor.
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [lastParam, setLastParam] = useState(param);
  const [generation, setGeneration] = useState(0);
  if (param !== lastParam) {
    setLastParam(param);
    if (id === null || id !== createdId) {
      setCreatedId(null);
      setGeneration((n) => n + 1);
    }
  }

  const [attempt, setAttempt] = useState(0);
  const opening = id !== null && id !== createdId;
  const loaded = useSavedDraft(opening ? id : null, `${id}-${generation}-${attempt}`);

  function created(newId: number) {
    setCreatedId(newId);
    window.history.replaceState(null, "", editorHref(newId));
  }

  if (param !== null && id === null) return <NotFound />;
  if (!opening) return <DocumentCreator key={`new-${generation}`} onCreated={created} />;
  if (!loaded) return <PageSpinner label="Opening your document…" />;
  if (loaded.status === "notFound") return <NotFound />;
  if (loaded.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-sm text-red-700" role="alert">
          Could not open this document. Check your connection and try again.
        </p>
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }
  return <DocumentCreator key={`saved-${id}-${generation}`} initial={loaded.saved} />;
}

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-navy">Document not found</h1>
      <p className="max-w-sm text-sm text-muted">It may have been deleted, or it belongs to another account.</p>
      <ButtonLink href="/documents/" variant="outline" className="mt-2">
        Back to my documents
      </ButtonLink>
    </div>
  );
}
