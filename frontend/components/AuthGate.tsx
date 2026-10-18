"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/auth/useSession";

/** Shows its children only to a signed-in user, sending anyone else to the login page. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useSession();

  // The pages are static files, so the check can only happen in the browser.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <p className="flex flex-1 items-center justify-center text-sm text-muted" role="status">
        Loading…
      </p>
    );
  }
  return children;
}
