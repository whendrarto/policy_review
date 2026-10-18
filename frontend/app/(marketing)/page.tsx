import { AuthNav } from "@/components/landing/AuthNav";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { DOCUMENTS } from "@/lib/documents/registry";

const STEPS = [
  {
    title: "Describe your deal",
    text: "Tell the assistant what you need in plain English. It picks the right Common Paper agreement and asks only what it still needs to know.",
    icon: "M4 5h16v10H8l-4 4V5Z",
  },
  {
    title: "Watch it come together",
    text: "Every answer fills in the agreement live, with the parts still to complete highlighted so nothing is missed.",
    icon: "M5 4h10l4 4v12H5V4Zm4 8h6m-6 4h6m-6-8h3",
  },
  {
    title: "Download and keep going",
    text: "Download a PDF draft whenever you like. Your drafts are saved, so you can come back and pick up where you left off.",
    icon: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

/** A static picture of the editor for the hero: a chat beside a page being filled in. */
function ProductPreview() {
  return (
    <div className="relative rounded-2xl bg-white/5 p-2 ring-1 ring-white/15 backdrop-blur" aria-hidden>
      <div className="grid overflow-hidden rounded-xl bg-white text-left shadow-2xl sm:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3 border-zinc-100 bg-zinc-50 p-4 sm:border-r">
          <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs text-zinc-700 shadow-xs">What would you like to draft?</p>
          <p className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-xs text-navy">
            An NDA with Globex. We&apos;re exploring a partnership.
          </p>
          <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs text-zinc-700 shadow-xs">
            Great, a Mutual NDA. Which state&apos;s law should govern it?
          </p>
        </div>
        <div className="space-y-2 p-5 font-serif text-[11px] leading-relaxed text-zinc-800">
          <p className="text-center text-sm font-bold">Mutual Non-Disclosure Agreement</p>
          <p className="rounded-sm border-l-2 border-accent bg-accent/10 px-2 py-1 font-sans text-[10px] text-navy">DRAFT - SUBJECT TO LEGAL REVIEW</p>
          <p>
            <span className="font-bold">Purpose:</span> <mark className="rounded-sm bg-sky-100 px-0.5">Exploring a partnership</mark>
          </p>
          <p>
            <span className="font-bold">Parties:</span> <mark className="rounded-sm bg-sky-100 px-0.5">Acme, Inc.</mark> and{" "}
            <mark className="rounded-sm bg-sky-100 px-0.5">Globex Corp.</mark>
          </p>
          <p>
            <span className="font-bold">Governing law:</span> <mark className="rounded-sm bg-amber-100 px-0.5 text-amber-800 italic">[Fill in state]</mark>
          </p>
          <div className="space-y-1 pt-1">
            <span className="block h-1.5 w-full rounded bg-zinc-100" />
            <span className="block h-1.5 w-11/12 rounded bg-zinc-100" />
            <span className="block h-1.5 w-4/5 rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-6">
            <div className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
              <a href="#how-it-works" className="hover:text-navy">
                How it works
              </a>
              <a href="#documents" className="hover:text-navy">
                Documents
              </a>
            </div>
            <AuthNav />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-navy text-white">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">
                <span className="size-1.5 rounded-full bg-accent" />
                11 standard agreements, drafted by chat
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Draft legal agreements <span className="text-accent">in minutes</span>, not days.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/75">
                Chat with an AI assistant that fills in Common Paper&apos;s standard templates for you, from NDAs to cloud service agreements,
                then download a draft PDF to review with your lawyer.
              </p>
              <div className="mt-8">
                <AuthNav size="lg" onDark />
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-navy">How it works</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">From a sentence about your deal to a draft agreement, ready for legal review.</p>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon path={step.icon} />
                  </span>
                  <p className="mt-5 text-xs font-semibold tracking-wider text-accent uppercase">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-navy">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="documents" className="scroll-mt-16 bg-zinc-50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-navy">Documents you can draft</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
              Built on Common Paper&apos;s widely used, openly licensed standard agreements (CC BY 4.0).
            </p>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DOCUMENTS.map((doc) => (
                <li key={doc.id} className="rounded-lg border border-zinc-200 border-l-4 border-l-primary bg-white p-5 shadow-xs">
                  <h3 className="font-semibold text-navy">{doc.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{doc.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-2xl bg-navy px-6 py-14 text-center text-white">
            <LogoMark className="size-12" light />
            <h2 className="text-3xl font-semibold tracking-tight">Ready to draft your first agreement?</h2>
            <p className="max-w-xl text-white/75">Create an account and have a draft ready for review in minutes.</p>
            <AuthNav size="lg" onDark />
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <Logo />
          <p>
            Templates by{" "}
            <a href="https://commonpaper.com" className="hover:text-navy hover:underline" target="_blank" rel="noopener noreferrer">
              Common Paper
            </a>
            , used under CC BY 4.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
