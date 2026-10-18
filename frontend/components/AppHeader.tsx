"use client";

import { useSession } from "@/lib/auth/useSession";

export function AppHeader() {
  // Signing out ends the session, and AuthGate then sends the user back to the login page.
  const { session, signOut } = useSession();

  return (
    <header className="flex items-center justify-between gap-4 border-b-2 border-accent bg-navy px-6 py-2 text-white">
      <span className="text-base font-semibold tracking-tight">Prelegal</span>
      <div className="flex items-center gap-4 text-sm">
        {session && (
          <span className="truncate" title={session.email}>
            {session.name}
          </span>
        )}
        <button type="button" onClick={signOut} className="rounded-md px-2 py-1 text-primary hover:bg-white/10 hover:text-white">
          Sign out
        </button>
      </div>
    </header>
  );
}
