"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth, type AuthStatus } from "@/lib/auth/AuthProvider";
import { PageSpinner } from "./ui/Spinner";

// The pages are static files, so who may see them can only be checked in the browser; the API
// enforces it for the data.

function Gate({ allow, redirectTo, children }: { allow: AuthStatus; redirectTo: string; children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "loading" && status !== allow) router.replace(redirectTo);
  }, [status, allow, redirectTo, router]);

  return status === allow ? children : <PageSpinner />;
}

/** Shows its children only to a signed-in user, sending anyone else to the sign-in page. */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <Gate allow="authenticated" redirectTo="/signin/">
      {children}
    </Gate>
  );
}

/** Shows its children only when signed out (sign in, sign up), sending users to their documents. */
export function GuestGate({ children }: { children: ReactNode }) {
  return (
    <Gate allow="unauthenticated" redirectTo="/documents/">
      {children}
    </Gate>
  );
}
