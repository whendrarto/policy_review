import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { DocumentCreator } from "@/components/DocumentCreator";

export const metadata: Metadata = {
  title: "Document Creator | Prelegal",
  description: "Draft a Common Paper legal agreement with an AI assistant and download it as a PDF.",
};

export default function DocumentsPage() {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col lg:h-screen">
        <AppHeader />
        <DocumentCreator />
      </div>
    </AuthGate>
  );
}
