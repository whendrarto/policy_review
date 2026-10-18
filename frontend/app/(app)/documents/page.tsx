import type { Metadata } from "next";
import { DocumentsDashboard } from "@/components/DocumentsDashboard";

export const metadata: Metadata = { title: "My documents" };

export default function DocumentsPage() {
  return <DocumentsDashboard />;
}
