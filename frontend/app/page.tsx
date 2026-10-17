import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/nda/template";

export default async function Home() {
  const standardTerms = await loadStandardTerms();
  return <NdaCreator standardTerms={standardTerms} />;
}
