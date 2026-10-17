import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/nda/template";

export default function Home() {
  return <NdaCreator standardTerms={loadStandardTerms()} />;
}
