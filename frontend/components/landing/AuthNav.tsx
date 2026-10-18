"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { ButtonLink } from "../ui/Button";

/** The landing page's account links: "My documents" when signed in, else sign in and sign up. */
export function AuthNav({ size = "md", onDark = false }: { size?: "md" | "lg"; onDark?: boolean }) {
  const { status } = useAuth();
  if (status === "authenticated") {
    return (
      <ButtonLink href="/documents/" variant="submit" size={size}>
        Go to my documents
      </ButtonLink>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <ButtonLink href="/signin/" variant={onDark ? "onDark" : "ghost"} size={size}>
        Sign in
      </ButtonLink>
      <ButtonLink href="/signup/" variant="submit" size={size}>
        Get started
      </ButtonLink>
    </div>
  );
}
