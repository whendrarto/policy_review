import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";

// The signed-in part of the site. On large screens it fills the window, so the editor's chat and
// preview scroll on their own.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col bg-zinc-50 lg:h-screen">
        <AppHeader />
        <div className="flex flex-1 flex-col lg:min-h-0">{children}</div>
      </div>
    </AuthGate>
  );
}
