"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Logo } from "./ui/Logo";

const NAV = [
  { href: "/documents/", label: "My documents", short: "Documents" },
  { href: "/editor/", label: "New document", short: "New" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppHeader() {
  // Signing out ends the session, and AuthGate then sends the user to the sign-in page.
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <header className="border-b-2 border-accent bg-navy text-white">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Logo href="/documents/" light />
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {NAV.map(({ href, label, short }) => {
            const active = pathname === href || pathname === href.slice(0, -1);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors sm:px-3 ${active ? "bg-white/15 font-medium text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
          {user && (
            <div className="hidden min-w-0 items-center gap-2 sm:flex" title={user.email}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-navy" aria-hidden>
                {initials(user.name)}
              </span>
              <span className="max-w-40 truncate">{user.name}</span>
            </div>
          )}
          <button type="button" onClick={() => void signOut()} className="rounded-md px-2 py-1.5 whitespace-nowrap text-white/75 transition-colors hover:bg-white/10 hover:text-white sm:px-3">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
