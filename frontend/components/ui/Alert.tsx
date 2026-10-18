import type { ReactNode } from "react";

const TONES = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

/** An error or warning, announced to screen readers. */
export function Alert({ tone = "error", children, className = "" }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}
