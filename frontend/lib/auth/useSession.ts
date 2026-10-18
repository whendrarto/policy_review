"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createSessionStore, parseSession, type Session, type SessionStore } from "./session";

// Created on first use, because sessionStorage does not exist while pages are prerendered.
let browserStore: SessionStore | undefined;
const store = () => (browserStore ??= createSessionStore(() => window.sessionStorage));

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useSession() {
  // undefined until hydrated, so the prerendered HTML and the first client render match.
  const raw = useSyncExternalStore(
    (listener) => store().subscribe(listener),
    () => store().readRaw(),
    () => undefined,
  );
  const session = useMemo(() => (raw === undefined ? null : parseSession(raw)), [raw]);
  const status: SessionStatus = raw === undefined ? "loading" : session ? "authenticated" : "unauthenticated";
  return {
    status,
    session,
    signIn: (next: Session) => store().save(next),
    signOut: () => store().clear(),
  };
}
