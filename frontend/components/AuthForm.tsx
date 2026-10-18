"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MIN_PASSWORD, validateSignIn, validateSignUp, type AuthErrors } from "@/lib/auth/validate";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";

const COPY = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to continue drafting your agreements.",
    submit: "Sign in",
    switchText: "New to Prelegal?",
    switchLink: { href: "/signup/", label: "Create an account" },
  },
  signup: {
    title: "Create your account",
    subtitle: "Draft your first agreement in minutes.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: { href: "/signin/", label: "Sign in" },
  },
} as const;

/** The sign-in or sign-up form. Once signed in, GuestGate takes the user to their documents. */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp } = useAuth();
  const copy = COPY[mode];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AuthErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Shows the errors and moves focus to the first field that needs fixing.
  function reject(found: AuthErrors) {
    setErrors(found);
    const first = found.name ? nameRef : found.email ? emailRef : found.password ? passwordRef : null;
    first?.current?.focus();
  }

  async function attempt(request: () => Promise<void>) {
    setErrors({});
    setPending(true);
    try {
      await request();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    if (mode === "signup") {
      const result = validateSignUp({ name, email, password });
      if (result.ok) void attempt(() => signUp(result.value));
      else reject(result.errors);
    } else {
      const result = validateSignIn({ email, password });
      if (result.ok) void attempt(() => signIn(result.value));
      else reject(result.errors);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border-t-4 border-accent bg-white p-8 shadow-lg ring-1 ring-zinc-200 sm:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{copy.title}</h1>
      <p className="mt-1.5 text-sm text-muted">{copy.subtitle}</p>

      <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        {mode === "signup" && (
          <Field ref={nameRef} label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        )}
        <Field ref={emailRef} label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field
          ref={passwordRef}
          label="Password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={mode === "signup" ? `At least ${MIN_PASSWORD} characters.` : undefined}
        />
        <Button type="submit" variant="submit" size="lg" loading={pending} className="w-full">
          {copy.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {copy.switchText}{" "}
        <Link href={copy.switchLink.href} className="font-medium text-primary hover:underline">
          {copy.switchLink.label}
        </Link>
      </p>
    </div>
  );
}
