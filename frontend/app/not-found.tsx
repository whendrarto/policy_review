import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
        <p className="text-sm font-semibold tracking-wider text-accent uppercase">404</p>
        <h1 className="text-3xl font-semibold tracking-tight text-navy">Page not found</h1>
        <p className="max-w-sm text-muted">The page you’re looking for doesn’t exist or has moved.</p>
        <ButtonLink href="/" variant="outline" className="mt-4">
          Back to home
        </ButtonLink>
      </main>
    </div>
  );
}
