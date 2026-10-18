import Link from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./Spinner";

// Buttons in the brand colours: purple for submitting, blue for primary actions (CLAUDE.md).

const VARIANTS = {
  submit: "bg-secondary text-white shadow-sm hover:bg-secondary/90",
  primary: "bg-primary text-white shadow-sm hover:bg-primary/90",
  outline: "border border-zinc-300 bg-white text-navy shadow-xs hover:border-zinc-400 hover:bg-zinc-50",
  ghost: "text-navy hover:bg-zinc-100",
  // A quiet button on the navy background.
  onDark: "text-white ring-1 ring-white/30 hover:bg-white/10",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-base",
} as const;

type ButtonStyle = { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES };

function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}, extra = ""): string {
  return `inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant,
  size,
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonStyle & { loading?: boolean } & ComponentProps<"button">) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass({ variant, size }, className)} {...props}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className = "", ...props }: ButtonStyle & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
