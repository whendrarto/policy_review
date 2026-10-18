import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorScreen } from "@/components/EditorScreen";
import { PageSpinner } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "Editor",
  description: "Draft a Common Paper legal agreement with an AI assistant and download it as a PDF.",
};

export default function EditorPage() {
  // The document id is read from the URL in the browser, so the prerendered page shows the spinner.
  return (
    <Suspense fallback={<PageSpinner />}>
      <EditorScreen />
    </Suspense>
  );
}
