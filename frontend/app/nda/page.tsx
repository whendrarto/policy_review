import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/nda/template";

export const metadata: Metadata = {
  title: "Mutual NDA Creator | Prelegal",
  description: "Fill in a Common Paper Mutual NDA and download it as a PDF.",
};

export default function NdaPage() {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col lg:h-screen">
        <AppHeader />
        <NdaCreator standardTerms={loadStandardTerms()} />
      </div>
    </AuthGate>
  );
}
