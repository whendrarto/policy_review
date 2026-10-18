import Link from "next/link";

/** The Prelegal mark: a page with a folded corner and a tick, in the brand colours. */
export function LogoMark({ className = "size-7", light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {/* On a navy background the tile is a lighter wash, so the mark stays visible. */}
      <rect width="32" height="32" rx="7" fill={light ? "#ffffff" : "#032147"} fillOpacity={light ? 0.14 : 1} />
      <path d="M10 7h9l5 5v13a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="#fff" />
      <path d="M19 7v4a1 1 0 0 0 1 1h4Z" fill="#ecad0a" />
      <path d="m12.5 18.5 2.5 2.5 5-5" fill="none" stroke="#209dd7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark and the name, linking to `href`. `light` is for dark backgrounds. */
export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight ${light ? "text-white" : "text-navy"}`}>
      <LogoMark light={light} />
      Prelegal
    </Link>
  );
}
