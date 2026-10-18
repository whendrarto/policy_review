"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ComponentProps, type FormEvent } from "react";
import { validateLogin, type LoginErrors } from "@/lib/auth/session";
import { useSession } from "@/lib/auth/useSession";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none";

function Field({ label, error, ...input }: { label: string; error?: string } & ComponentProps<"input">) {
  const errorId = useId();
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <input className={inputClass} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...input} />
      {error && (
        <span id={errorId} className="block text-xs text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { status, signIn } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});

  // Signing in updates the session, which brings the user into the platform.
  useEffect(() => {
    if (status === "authenticated") router.replace("/documents");
  }, [status, router]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateLogin({ name, email });
    if (result.ok) signIn(result.session);
    else setErrors(result.errors);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border-t-4 border-accent bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-navy">Prelegal</h1>
        <p className="mt-1 text-sm text-muted">Draft common legal agreements in minutes.</p>

        <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
          <Field label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <button
            type="submit"
            disabled={status !== "unauthenticated"}
            className="w-full rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 disabled:opacity-60"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">Demo sign-in: no password is needed yet.</p>
      </div>
    </main>
  );
}
