// Checks on the sign-in and sign-up forms, matching the backend's (backend/app/auth_api.py), so
// most mistakes are caught before a request is sent.

export type AuthErrors = { name?: string; email?: string; password?: string };

export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Result<T> = { ok: true; value: T } | { ok: false; errors: AuthErrors };

const result = <T>(value: T, errors: AuthErrors): Result<T> => (Object.keys(errors).length ? { ok: false, errors } : { ok: true, value });

export function validateSignIn(input: { email: string; password: string }): Result<{ email: string; password: string }> {
  const value = { email: input.email.trim(), password: input.password };
  const errors: AuthErrors = {};
  if (!EMAIL_PATTERN.test(value.email)) errors.email = "Enter a valid email address.";
  if (!value.password) errors.password = "Enter your password.";
  return result(value, errors);
}

export function validateSignUp(input: { name: string; email: string; password: string }): Result<{ name: string; email: string; password: string }> {
  const value = { name: input.name.trim(), email: input.email.trim(), password: input.password };
  const errors: AuthErrors = {};
  if (!value.name) errors.name = "Enter your name.";
  else if (value.name.length > 100) errors.name = "Use at most 100 characters.";
  if (!EMAIL_PATTERN.test(value.email) || value.email.length > 254) errors.email = "Enter a valid email address.";
  if (value.password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (value.password.length > MAX_PASSWORD) errors.password = `Use at most ${MAX_PASSWORD} characters.`;
  return result(value, errors);
}
