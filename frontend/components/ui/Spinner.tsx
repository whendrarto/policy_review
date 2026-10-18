export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A centred spinner for a page or panel that is loading. */
export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-3 py-24 text-sm text-muted" role="status">
      <Spinner className="size-5 text-primary" />
      {label}
    </div>
  );
}
