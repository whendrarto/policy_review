import { useId, type ComponentProps } from "react";

export const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none aria-invalid:border-red-500";

/** A labelled input with an optional hint and error message. */
export function Field({ label, hint, error, ...input }: { label: string; hint?: string; error?: string } & ComponentProps<"input">) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input id={id} className={`${inputClass} w-full`} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-zinc-600">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
