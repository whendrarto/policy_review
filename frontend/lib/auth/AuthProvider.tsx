"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onUnauthorized } from "../api";
import * as auth from "./api";
import type { User } from "./api";

// The session lives in an HttpOnly cookie the page can't read, so the server says who is signed
// in (GET /api/auth/me) when the app loads. Any later 401 means the session ended.

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = { status: AuthStatus; user: User | null };

type AuthContextValue = AuthState & {
  signIn(input: { email: string; password: string }): Promise<void>;
  signUp(input: { name: string; email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SIGNED_OUT: AuthState = { status: "unauthenticated", user: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  // "loading" while prerendering too, so the static HTML and the first client render match.
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let current = true;
    auth.fetchMe().then(
      (user) => current && setState(user ? { status: "authenticated", user } : SIGNED_OUT),
      // If the server can't be reached, the user can only sign in again once it can.
      () => current && setState(SIGNED_OUT),
    );
    const unsubscribe = onUnauthorized(() => setState(SIGNED_OUT));
    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      async signIn(input) {
        setState({ status: "authenticated", user: await auth.signIn(input) });
      },
      async signUp(input) {
        setState({ status: "authenticated", user: await auth.signUp(input) });
      },
      async signOut() {
        // Signed out here even if the request fails; the server forgets the session on restart anyway.
        await auth.signOut().catch(() => undefined);
        setState(SIGNED_OUT);
      },
    }),
    [state],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth needs an AuthProvider");
  return value;
}
