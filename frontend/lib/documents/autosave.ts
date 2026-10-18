import type { DraftSnapshot } from "./saved";

// Saves the draft after each chat reply. The first save creates the document and later ones
// update it. Saves run one at a time, in order; if more arrive while one is running, only the
// latest is sent next, since each holds the whole draft.

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type Autosaver = {
  save(snapshot: DraftSnapshot): Promise<void>;
  /** Sends the snapshot that last failed again. */
  retry(): Promise<void>;
};

export function createAutosaver(options: {
  create(snapshot: DraftSnapshot): Promise<{ id: number }>;
  update(id: number, snapshot: DraftSnapshot): Promise<unknown>;
  onCreated?(id: number): void;
  onStatus?(status: SaveStatus): void;
  /** The id of a document that is already saved. */
  id?: number;
}): Autosaver {
  let id = options.id;
  let pending: DraftSnapshot | undefined;
  let failed: DraftSnapshot | undefined;
  let running: Promise<void> | undefined;

  async function run() {
    try {
      while (pending) {
        const snapshot = pending;
        pending = undefined;
        options.onStatus?.("saving");
        try {
          if (id === undefined) {
            id = (await options.create(snapshot)).id;
            options.onCreated?.(id);
          } else {
            await options.update(id, snapshot);
          }
          failed = undefined;
        } catch {
          // A newer snapshot supersedes the failed one.
          failed = pending ?? snapshot;
          pending = undefined;
          options.onStatus?.("error");
          return;
        }
      }
      options.onStatus?.("saved");
    } finally {
      // Runs in the same step as the last check of `pending`, so a later save() starts a new run.
      running = undefined;
    }
  }

  function save(snapshot: DraftSnapshot): Promise<void> {
    pending = snapshot;
    running ??= run();
    return running;
  }

  return {
    save,
    retry: () => (failed ? save(failed) : Promise.resolve()),
  };
}
