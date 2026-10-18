import { GuestGate } from "@/components/AuthGate";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-navy/[0.06] via-white to-white">
      <header className="px-6 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <GuestGate>{children}</GuestGate>
      </main>
    </div>
  );
}
